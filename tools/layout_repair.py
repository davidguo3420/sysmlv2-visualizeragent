from __future__ import annotations

import json
import shutil
from dataclasses import asdict
from pathlib import Path

from tools.browser_svg_renderer import BrowserSVGRenderer
from tools.svg_quality_checks import write_quality_report
from tools.svg_to_png import svg_to_png
from tools.vlm_critic import critique_image
from tools.vlm_repair_planner import propose_repair_settings

from tools.svg_padding import add_svg_padding


def score_vlm_report(parsed: dict | None) -> int:
    """
    Score a VLM critique report.

    Higher is better.

    This function supports the simplified critique schema:

      accepted: bool
      overall_score: 0-100

      layout_quality: excellent | good | fair | poor | unusable
      readability: excellent | good | fair | poor | unusable
      visual_usability: excellent | good | fair | poor | unusable

      label_overlap: none | minor | moderate | severe
      node_overlap: none | minor | moderate | severe
      text_clipping: none | minor | moderate | severe
      off_canvas_content: none | minor | moderate | severe
      title_intrusion: none | minor | moderate | severe
      connector_label_overlap: none | minor | moderate | severe
      background_interference: none | minor | moderate | severe

      clutter: low | moderate | high
      viewport_fit: excellent | good | fair | poor | unusable

      fatal_issue_count: int
      minor_issue_count: int
      confidence: 0.0-1.0

    It is intentionally graded, not binary. This lets the repair loop rank
    bad diagrams against each other instead of giving all failures the same score.
    """
    if not parsed:
        return -200

    try:
        score = int(parsed.get("overall_score", 50))
    except (TypeError, ValueError):
        score = 50

    score = max(0, min(100, score))

    # Acceptance reward, but not enough to hide severe visual issues.
    if parsed.get("accepted") is True:
        score += 40

    quality_bonus = {
        "excellent": 30,
        "good": 20,
        "fair": 5,
        "poor": -20,
        "unusable": -55,
    }

    for key in ["layout_quality", "readability", "visual_usability"]:
        value = str(parsed.get(key, "fair")).lower()
        score += quality_bonus.get(value, 0)

    severity_penalty = {
        "none": 0,
        "minor": 5,
        "moderate": 20,
        "severe": 55,
    }

    # Normal visual problems.
    for key in [
        "label_overlap",
        "node_overlap",
        "connector_label_overlap",
    ]:
        value = str(parsed.get(key, "none")).lower()
        score -= severity_penalty.get(value, 0)

    # Critical visual problems. These matter more because they often make
    # the output unusable even if the rest of the diagram is simple.
    critical_severity_penalty = {
        "none": 0,
        "minor": 10,
        "moderate": 35,
        "severe": 85,
    }

    for key in [
        "text_clipping",
        "off_canvas_content",
        "title_intrusion",
        "background_interference",
    ]:
        value = str(parsed.get(key, "none")).lower()
        score -= critical_severity_penalty.get(value, 0)

    viewport_fit = str(parsed.get("viewport_fit", "fair")).lower()

    if viewport_fit == "excellent":
        score += 15
    elif viewport_fit == "good":
        score += 8
    elif viewport_fit == "fair":
        score += 0
    elif viewport_fit == "poor":
        score -= 35
    elif viewport_fit == "unusable":
        score -= 80

    clutter = str(parsed.get("clutter", "moderate")).lower()

    if clutter == "low":
        score += 8
    elif clutter == "moderate":
        score -= 3
    elif clutter == "high":
        score -= 30

    try:
        fatal_issue_count = int(parsed.get("fatal_issue_count", 0))
    except (TypeError, ValueError):
        fatal_issue_count = 0

    try:
        minor_issue_count = int(parsed.get("minor_issue_count", 0))
    except (TypeError, ValueError):
        minor_issue_count = 0

    score -= 40 * fatal_issue_count
    score -= 3 * minor_issue_count

    # Backward compatibility with older issue-array schema.
    issues = parsed.get("issues", [])
    if isinstance(issues, list):
        score -= min(25, 3 * len(issues))

        for issue in issues:
            if isinstance(issue, dict):
                severity = str(issue.get("severity", "")).lower()

                if severity == "high":
                    score -= 20
                elif severity == "medium":
                    score -= 10
                elif severity == "low":
                    score -= 3

    fatal_issues = parsed.get("fatal_issues", [])
    if isinstance(fatal_issues, list):
        score -= 40 * len(fatal_issues)

    minor_issues = parsed.get("minor_issues", [])
    if isinstance(minor_issues, list):
        score -= min(15, 2 * len(minor_issues))

    # Use free-text self-check fields as additional weak signals.
    # This helps when the VLM writes "cut off" in text but fails to set
    # the corresponding severity field correctly.
    combined_notes = " ".join(
        str(parsed.get(key, "")).lower()
        for key in [
            "worst_visible_problem",
            "border_check",
            "overlap_check",
            "suggested_fix",
        ]
    )

    keyword_penalties = {
        "cut off": 35,
        "cut-off": 35,
        "clipped": 35,
        "outside": 30,
        "off canvas": 35,
        "off-canvas": 35,
        "boundary": 20,
        "edge": 15,
        "overlap": 25,
        "overlapping": 25,
        "title": 15,
        "header": 15,
        "unreadable": 40,
        "crowded": 20,
        "clutter": 20,
    }

    for keyword, penalty in keyword_penalties.items():
        if keyword in combined_notes:
            score -= penalty

    try:
        confidence = float(parsed.get("confidence", 0.75))
    except (TypeError, ValueError):
        confidence = 0.75

    confidence = max(0.0, min(1.0, confidence))

    if confidence < 0.35:
        score -= 10
    elif confidence > 0.85:
        score += 5

    return score

def attempt_score(attempt: dict | None) -> int:
    """
    Safely extract an integer score from an attempt report.
    """
    if not attempt:
        return -999999

    try:
        return int(attempt.get("score", -999999))
    except (TypeError, ValueError):
        return -999999

def attempt_rank(attempt: dict | None) -> tuple[int, int, int, int]:
    """
    Ranking key for selecting the best attempt.

    Priority:
      1. highest score
      2. hard-gate pass beats fail
      3. VLM accepted beats rejected
      4. fewer hard-gate failures
    """
    if not attempt:
        return (-999999, 0, 0, -999999)

    score = attempt_score(attempt)

    hard_pass = 1 if attempt.get("hard_acceptance_passed") is True else 0
    vlm_accept = 1 if attempt.get("vlm_accepted") is True else 0

    failures = attempt.get("hard_acceptance_failures", [])
    failure_count = len(failures) if isinstance(failures, list) else 999

    layout = attempt.get("layout")
    detail = attempt.get("detail")

    # Prefer repair-oriented settings over the untouched default when scores tie.
    layout_preference = {
        "hierarchy": 4,
        "grid": 3,
        "radial": 2,
        "auto": 1,
    }.get(layout, 0)

    detail_preference = {
        "compact": 2,
        "standard": 1,
        "full": 0,
    }.get(detail, 0)

    return (
        score,
        hard_pass,
        vlm_accept,
        -failure_count,
        layout_preference,
        detail_preference,
    )

def passes_hard_acceptance_gates(parsed: dict | None) -> tuple[bool, list[str]]:
    """
    Deterministic acceptance rules applied after the VLM critique.

    These gates should reject truly unusable diagrams, but they should not
    reject every diagram with minor or moderate imperfections.
    """
    if not parsed:
        return False, ["No parsed VLM critique."]

    failures: list[str] = []

    if parsed.get("accepted") is not True:
        failures.append("VLM did not accept the diagram.")

    try:
        overall_score = int(parsed.get("overall_score", 0))
    except (TypeError, ValueError):
        overall_score = 0

    if overall_score < 70:
        failures.append(f"Overall score below acceptance threshold: {overall_score}")

    readability = str(parsed.get("readability", "")).lower()
    layout_quality = str(parsed.get("layout_quality", "")).lower()
    visual_usability = str(parsed.get("visual_usability", "")).lower()

    if readability not in {"excellent", "good"}:
        failures.append(f"Readability is not good/excellent: {readability}")

    if layout_quality not in {"excellent", "good", "fair"}:
        failures.append(f"Layout quality is too low: {layout_quality}")

    if visual_usability and visual_usability not in {"excellent", "good", "fair"}:
        failures.append(f"Visual usability is too low: {visual_usability}")

    # These are fatal only if severe.
    severe_blockers = [
        "label_overlap",
        "node_overlap",
        "text_clipping",
        "off_canvas_content",
        "connector_label_overlap",
        "title_intrusion",
        "background_interference",
        "cropping_risk",
    ]

    for key in severe_blockers:
        value = str(parsed.get(key, "none")).lower()
        if value == "severe":
            failures.append(f"{key} is severe")

    viewport_fit = str(parsed.get("viewport_fit", "good")).lower()
    if viewport_fit in {"poor", "unusable"}:
        failures.append(f"Viewport fit is unacceptable: {viewport_fit}")

    clutter = str(parsed.get("clutter", "low")).lower()
    if clutter == "high":
        failures.append("Clutter is high.")

    fatal_issues = parsed.get("fatal_issues", [])
    if isinstance(fatal_issues, list) and fatal_issues:
        failures.append(f"Fatal issues reported: {fatal_issues}")

    return len(failures) == 0, failures


def run_attempt(
    input_file: Path,
    attempt_dir: Path,
    layout: str,
    detail: str,
    model: str,
    show_browser: bool,
) -> dict:
    renderer = BrowserSVGRenderer(headless=not show_browser)

    attempt_dir.mkdir(parents=True, exist_ok=True)

    svg_path = attempt_dir / "diagram.svg"
    png_path = attempt_dir / "diagram.png"
    quality_path = attempt_dir / "quality_report.json"
    vlm_path = attempt_dir / "vlm_report.json"
    attempt_report_path = attempt_dir / "attempt_report.json"

    print(f"    attempt: layout={layout}, detail={detail}")

    render_result = renderer.render_file(
        input_path=input_file,
        output_path=svg_path,
        layout=layout,
        detail=detail,
    )

    if not render_result.success:
        report = {
            "layout": layout,
            "detail": detail,
            "render_success": False,
            "error": render_result.error,
            "score": -999,
        }
        attempt_report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
        return report

    add_svg_padding(svg_path)

    quality_report = write_quality_report(svg_path, quality_path)

    if not quality_report.success:
        report = {
            "layout": layout,
            "detail": detail,
            "render_success": True,
            "quality_success": False,
            "quality_issues": quality_report.issues,
            "score": -500,
        }
        attempt_report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
        return report

    png_result = svg_to_png(svg_path, png_path)

    if not png_result.success:
        report = {
            "layout": layout,
            "detail": detail,
            "render_success": True,
            "quality_success": True,
            "png_success": False,
            "error": png_result.error,
            "score": -400,
        }
        attempt_report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
        return report

    vlm_result = critique_image(png_path, model=model)
    vlm_path.write_text(json.dumps(asdict(vlm_result), indent=2), encoding="utf-8")

    score = score_vlm_report(vlm_result.parsed_json)

    hard_acceptance_passed, hard_acceptance_failures = passes_hard_acceptance_gates(
        vlm_result.parsed_json
    )

    # Make the score reflect hard-gate failures.
    # This prevents visually unacceptable diagrams from still ranking highly.
    if not hard_acceptance_passed:
        score -= 75
        score -= 10 * len(hard_acceptance_failures)

    report = {
        "layout": layout,
        "detail": detail,
        "render_success": True,
        "quality_success": True,
        "png_success": True,
        "vlm_success": vlm_result.success,
        "vlm_accepted": (
            vlm_result.parsed_json.get("accepted")
            if vlm_result.parsed_json
            else None
        ),
        "hard_acceptance_passed": hard_acceptance_passed,
        "hard_acceptance_failures": hard_acceptance_failures,
        "vlm_parsed": vlm_result.parsed_json,
        "score": score,
        "svg_path": str(svg_path),
        "png_path": str(png_path),
        "vlm_report_path": str(vlm_path),
    }

    attempt_report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def repair_layout(
    input_file: Path,
    output_dir: Path,
    model: str = "qwen2.5vl",
    max_attempts: int = 4,
    show_browser: bool = False,
) -> dict:
    iterations_dir = output_dir / "iterations"
    iterations_dir.mkdir(parents=True, exist_ok=True)

    attempts: list[dict] = []
    best_attempt: dict | None = None

    current_layout = "auto"
    current_detail = "standard"

    for index in range(max_attempts):
        attempt_dir = iterations_dir / f"attempt_{index:02d}_{current_layout}_{current_detail}"

        attempt_report = run_attempt(
            input_file=input_file,
            attempt_dir=attempt_dir,
            layout=current_layout,
            detail=current_detail,
            model=model,
            show_browser=show_browser,
        )

        attempts.append(attempt_report)

        if best_attempt is None or attempt_rank(attempt_report) > attempt_rank(best_attempt):
            best_attempt = attempt_report

        print(
            f"    attempt score={attempt_score(attempt_report)}, "
            f"hard_pass={attempt_report.get('hard_acceptance_passed')}, "
            f"vlm_accepted={attempt_report.get('vlm_accepted')}, "
            f"best score={attempt_score(best_attempt)}, "
            f"best layout={best_attempt.get('layout')}, "
            f"best detail={best_attempt.get('detail')}"
        )

        parsed = attempt_report.get("vlm_parsed") or {}

        if parsed:
            print(f"      qwen worst: {parsed.get('worst_visible_problem')}")
            print(f"      qwen border: {parsed.get('border_check')}")
            print(f"      qwen overlap: {parsed.get('overlap_check')}")

        if not attempt_report.get("hard_acceptance_passed"):
            for failure in attempt_report.get("hard_acceptance_failures", []):
                print(f"      hard gate: {failure}")

        if attempt_report.get("vlm_accepted") is True:
            print("    VLM accepted, but hard gates rejected:")
            for failure in attempt_report.get("hard_acceptance_failures", []):
                print(f"      - {failure}")

        # If there is no usable VLM critique, we cannot ask Qwen to plan meaningfully.
        critique = attempt_report.get("vlm_parsed")
        png_path = attempt_report.get("png_path")

        critique = attempt_report.get("vlm_parsed")
        png_path = attempt_report.get("png_path")

        if not png_path:
            print("    no PNG available for planning; stopping repair loop")
            break

        if not critique:
            print("    no usable critique; using fallback critique for planning")

            critique = {
                "accepted": False,
                "overall_score": 0,
                "layout_quality": "poor",
                "readability": "poor",
                "label_overlap": "severe",
                "node_overlap": "moderate",
                "edge_crossing": "moderate",
                "text_clipping": "severe",
                "off_canvas_content": "moderate",
                "connector_label_overlap": "moderate",
                "background_interference": "moderate",
                "clutter": "high",
                "connector_visibility": "fair",
                "diagram_completeness": "partial",
                "diagram_type_confidence": "medium",
                "issues": [
                    {
                        "category": "vlm_parse_or_timeout_failure",
                        "severity": "high",
                        "description": "The VLM critique failed, timed out, or could not be parsed.",
                        "suggested_fix": "Try a more conservative compact layout."
                    }
                ],
                "recommended_layout": "hierarchy",
                "recommended_detail": "compact",
                "repair_priority": "layout_settings",
                "suggested_fix": "Try hierarchy layout with compact detail.",
                "confidence": 0.5,
            }

        planner_dir = iterations_dir / f"planner_after_attempt_{index:02d}"
        planner_report_path = planner_dir / "planner_report.json"
        planner_dir.mkdir(parents=True, exist_ok=True)

        planner_result = propose_repair_settings(
            image_path=Path(png_path),
            critique=critique,
            previous_attempts=[
                {"layout": a.get("layout"), "detail": a.get("detail")}
                for a in attempts
            ],
            model=model,
        )

        planner_report_path.write_text(
            json.dumps(asdict(planner_result), indent=2),
            encoding="utf-8",
        )

        if not planner_result.success or not planner_result.parsed_json:
            print("    planner failed; stopping repair loop")
            break

        current_layout = planner_result.parsed_json["layout"]
        current_detail = planner_result.parsed_json["detail"]

        print(
            f"    planner next: layout={current_layout}, "
            f"detail={current_detail}"
        )

    best_attempt = max(attempts, key=attempt_rank) if attempts else None

    if best_attempt is None or not best_attempt.get("png_path") or not best_attempt.get("svg_path"):
        final_report = {
            "success": False,
            "error": "No successful attempts.",
            "attempts": attempts,
        }
        (output_dir / "repair_report.json").write_text(
            json.dumps(final_report, indent=2),
            encoding="utf-8",
        )
        return final_report

    accepted = best_attempt.get("hard_acceptance_passed") is True

    if accepted:
        final_svg_path = output_dir / "final.svg"
        final_png_path = output_dir / "final.png"
    else:
        final_svg_path = output_dir / "best_failed.svg"
        final_png_path = output_dir / "best_failed.png"

    shutil.copyfile(best_attempt["svg_path"], final_svg_path)
    shutil.copyfile(best_attempt["png_path"], final_png_path)

    final_report = {
        "success": accepted,
        "best_score": attempt_score(best_attempt),
        "best_layout": best_attempt.get("layout"),
        "best_detail": best_attempt.get("detail"),
        "accepted": accepted,
        "final_svg": str(final_svg_path),
        "final_png": str(final_png_path),
        "best_attempt": best_attempt,
        "attempts": attempts,
    }

    if not accepted:
        final_report["error"] = "No attempt passed VLM critique and hard acceptance gates."

    (output_dir / "repair_report.json").write_text(
        json.dumps(final_report, indent=2),
        encoding="utf-8",
    )

    return final_report


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="Use Qwen2.5-VL to plan render-setting repairs for diagram readability."
    )
    parser.add_argument("input_file", type=Path)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--model", default="qwen2.5vl")
    parser.add_argument("--max-attempts", type=int, default=4)
    parser.add_argument("--show-browser", action="store_true")

    args = parser.parse_args()

    report = repair_layout(
        input_file=args.input_file,
        output_dir=args.output_dir,
        model=args.model,
        max_attempts=args.max_attempts,
        show_browser=args.show_browser,
    )

    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()