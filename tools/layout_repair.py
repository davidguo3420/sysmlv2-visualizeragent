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


def score_vlm_report(parsed: dict | None) -> int:
    """
    Higher is better.
    """
    if not parsed:
        return 0

    score = 0

    if parsed.get("accepted") is True:
        score += 100

    layout_quality = str(parsed.get("layout_quality", "")).lower()
    readability = str(parsed.get("readability", "")).lower()

    if layout_quality == "good":
        score += 30
    elif layout_quality == "fair":
        score += 15
    elif layout_quality == "poor":
        score -= 20

    if readability == "good":
        score += 30
    elif readability == "fair":
        score += 15
    elif readability == "poor":
        score -= 20

    issues = parsed.get("issues", [])
    if isinstance(issues, list):
        score -= 5 * len(issues)

    return score


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

        if best_attempt is None or attempt_report.get("score", -999) > best_attempt.get("score", -999):
            best_attempt = attempt_report

        if attempt_report.get("vlm_accepted") is True:
            print("    accepted by VLM; stopping repair loop")
            break

        # If there is no usable VLM critique, we cannot ask Qwen to plan meaningfully.
        critique = attempt_report.get("vlm_parsed")
        png_path = attempt_report.get("png_path")

        if not critique or not png_path:
            print("    no usable critique for planning; stopping repair loop")
            break

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

    shutil.copyfile(best_attempt["svg_path"], output_dir / "final.svg")
    shutil.copyfile(best_attempt["png_path"], output_dir / "final.png")

    final_report = {
        "success": True,
        "best_score": best_attempt.get("score"),
        "best_layout": best_attempt.get("layout"),
        "best_detail": best_attempt.get("detail"),
        "accepted": best_attempt.get("vlm_accepted"),
        "best_attempt": best_attempt,
        "attempts": attempts,
    }

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