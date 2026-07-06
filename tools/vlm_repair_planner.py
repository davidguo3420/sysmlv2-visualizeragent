from __future__ import annotations

import argparse
import base64
import json
from dataclasses import dataclass, asdict
from pathlib import Path

import requests


OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
DEFAULT_MODEL = "qwen2.5vl"

VALID_LAYOUTS = {"auto", "hierarchy", "grid", "radial"}
VALID_DETAILS = {"standard", "compact", "full"}


@dataclass
class RepairPlannerResult:
    success: bool
    image_path: str
    model: str
    response_text: str | None = None
    parsed_json: dict | None = None
    error: str | None = None


def encode_image_base64(image_path: Path) -> str:
    return base64.b64encode(image_path.read_bytes()).decode("utf-8")


def extract_json(text: str) -> dict | None:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    start = text.find("{")
    end = text.rfind("}")

    if start == -1 or end == -1 or end <= start:
        return None

    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None


def build_repair_prompt(
    critique: dict,
    previous_attempts: list[dict],
) -> str:
    return f"""
You are a diagram layout repair planner for a SysML v2 visualizer.

The SysML source must never be edited.

You may only choose new render settings.

Allowed layout values:
- auto
- hierarchy
- grid
- radial

Allowed detail values:
- standard
- compact
- full

The current VLM critique is:

{json.dumps(critique, indent=2)}

Previous render attempts are:

{json.dumps(previous_attempts, indent=2)}

Choose the next render settings most likely to improve readability.

Guidelines:
- If labels overlap, prefer compact detail.
- If nodes overlap in auto layout, try hierarchy or grid.
- If hierarchy is too dense, try grid.
- If grid is still cluttered, try radial.
- Avoid repeating an exact layout/detail pair already tried.
- Do not suggest editing SysML.
- Do not suggest changing the source model.
- Return JSON only.

Return this schema:

{{
  "layout": "hierarchy",
  "detail": "compact",
  "reason": "Compact hierarchy may reduce label overlap and make containment relationships clearer."
}}
"""


def validate_plan(plan: dict, previous_attempts: list[dict]) -> tuple[bool, str | None]:
    layout = plan.get("layout")
    detail = plan.get("detail")

    if layout not in VALID_LAYOUTS:
        return False, f"Invalid layout: {layout}"

    if detail not in VALID_DETAILS:
        return False, f"Invalid detail: {detail}"

    previous_pairs = {
        (attempt.get("layout"), attempt.get("detail"))
        for attempt in previous_attempts
    }

    if (layout, detail) in previous_pairs:
        return False, f"Repeated attempt: layout={layout}, detail={detail}"

    return True, None


def fallback_plan(previous_attempts: list[dict]) -> dict | None:
    """
    Deterministic fallback if Qwen suggests invalid/repeated settings.
    """
    candidates = [
        {"layout": "hierarchy", "detail": "compact"},
        {"layout": "grid", "detail": "compact"},
        {"layout": "radial", "detail": "compact"},
        {"layout": "hierarchy", "detail": "standard"},
        {"layout": "grid", "detail": "standard"},
        {"layout": "radial", "detail": "standard"},
        {"layout": "auto", "detail": "compact"},
        {"layout": "auto", "detail": "full"},
    ]

    tried = {
        (attempt.get("layout"), attempt.get("detail"))
        for attempt in previous_attempts
    }

    for candidate in candidates:
        if (candidate["layout"], candidate["detail"]) not in tried:
            return {
                **candidate,
                "reason": "Fallback deterministic layout setting because the VLM planner returned an invalid or repeated plan.",
            }

    return None


def propose_repair_settings(
    image_path: Path,
    critique: dict,
    previous_attempts: list[dict],
    model: str = DEFAULT_MODEL,
    ollama_url: str = OLLAMA_URL,
) -> RepairPlannerResult:
    if not image_path.exists():
        return RepairPlannerResult(
            success=False,
            image_path=str(image_path),
            model=model,
            error="Image file does not exist.",
        )

    try:
        image_base64 = encode_image_base64(image_path)

        payload = {
            "model": model,
            "prompt": build_repair_prompt(
                critique=critique,
                previous_attempts=previous_attempts,
            ),
            "images": [image_base64],
            "stream": False,
            "format": "json",
            "options": {
                "temperature": 0.2
            },
        }

        response = requests.post(
            ollama_url,
            json=payload,
            timeout=180,
        )

        response.raise_for_status()
        data = response.json()

        response_text = data.get("response", "")
        parsed = extract_json(response_text)

        if parsed is None:
            fallback = fallback_plan(previous_attempts)
            if fallback is None:
                return RepairPlannerResult(
                    success=False,
                    image_path=str(image_path),
                    model=model,
                    response_text=response_text,
                    error="Could not parse JSON and no fallback plan remains.",
                )

            return RepairPlannerResult(
                success=True,
                image_path=str(image_path),
                model=model,
                response_text=response_text,
                parsed_json=fallback,
                error="Used fallback because JSON parsing failed.",
            )

        valid, validation_error = validate_plan(parsed, previous_attempts)

        if not valid:
            fallback = fallback_plan(previous_attempts)
            if fallback is None:
                return RepairPlannerResult(
                    success=False,
                    image_path=str(image_path),
                    model=model,
                    response_text=response_text,
                    parsed_json=parsed,
                    error=validation_error,
                )

            return RepairPlannerResult(
                success=True,
                image_path=str(image_path),
                model=model,
                response_text=response_text,
                parsed_json=fallback,
                error=f"Used fallback because planner output was invalid: {validation_error}",
            )

        return RepairPlannerResult(
            success=True,
            image_path=str(image_path),
            model=model,
            response_text=response_text,
            parsed_json=parsed,
        )

    except Exception as exc:
        fallback = fallback_plan(previous_attempts)

        if fallback is not None:
            return RepairPlannerResult(
                success=True,
                image_path=str(image_path),
                model=model,
                parsed_json=fallback,
                error=f"Used fallback because planner request failed: {exc}",
            )

        return RepairPlannerResult(
            success=False,
            image_path=str(image_path),
            model=model,
            error=str(exc),
        )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Use Qwen2.5-VL to propose next render settings for diagram repair."
    )
    parser.add_argument("image_path", type=Path)
    parser.add_argument("--critique", type=Path, required=True)
    parser.add_argument("--attempts", type=Path, default=None)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--report", type=Path, default=None)

    args = parser.parse_args()

    critique = json.loads(args.critique.read_text(encoding="utf-8"))

    previous_attempts = []
    if args.attempts and args.attempts.exists():
        previous_attempts = json.loads(args.attempts.read_text(encoding="utf-8"))

    result = propose_repair_settings(
        image_path=args.image_path,
        critique=critique,
        previous_attempts=previous_attempts,
        model=args.model,
    )

    print(json.dumps(asdict(result), indent=2))

    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(
            json.dumps(asdict(result), indent=2),
            encoding="utf-8",
        )

    raise SystemExit(0 if result.success else 1)


if __name__ == "__main__":
    main()