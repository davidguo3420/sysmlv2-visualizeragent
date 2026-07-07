from __future__ import annotations

import argparse
import base64
import json
from dataclasses import dataclass, asdict
from pathlib import Path

import requests


OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
DEFAULT_MODEL = "qwen2.5vl"


@dataclass
class VLMCritiqueResult:
    success: bool
    image_path: str
    model: str
    response_text: str | None = None
    parsed_json: dict | None = None
    error: str | None = None


def encode_image_base64(image_path: Path) -> str:
    return base64.b64encode(image_path.read_bytes()).decode("utf-8")


def extract_json(text: str) -> dict | None:
    """
    Robustly extract a JSON object from imperfect VLM output.
    Handles:
      - valid JSON
      - markdown fenced JSON
      - extra text before/after JSON
      - trailing commas
      - nested braces
    """
    import re

    if not text:
        return None

    cleaned = text.strip()

    # Remove common markdown fences.
    cleaned = re.sub(r"^```(?:json)?", "", cleaned.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"```$", "", cleaned.strip())

    # First try the full string.
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Find the first balanced JSON object.
    start = cleaned.find("{")
    if start == -1:
        return None

    depth = 0
    in_string = False
    escape = False

    for i in range(start, len(cleaned)):
        char = cleaned[i]

        if escape:
            escape = False
            continue

        if char == "\\":
            escape = True
            continue

        if char == '"':
            in_string = not in_string
            continue

        if in_string:
            continue

        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1

            if depth == 0:
                candidate = cleaned[start : i + 1]

                # Remove trailing commas before } or ].
                candidate = re.sub(r",\s*([}\]])", r"\1", candidate)

                try:
                    return json.loads(candidate)
                except json.JSONDecodeError:
                    return None

    return None

def normalize_critique(parsed: dict | None) -> dict | None:
    """
    Fill missing fields and coerce invalid values so scoring does not fail.
    """
    if parsed is None:
        return None

    allowed_severity = {"none", "minor", "moderate", "severe"}
    allowed_quality = {"excellent", "good", "fair", "poor", "unusable"}
    allowed_clutter = {"low", "moderate", "high"}
    allowed_layout = {"auto", "hierarchy", "grid", "radial"}
    allowed_detail = {"standard", "compact", "full"}

    defaults = {
        "accepted": False,
        "overall_score": 50,
        "layout_quality": "fair",
        "readability": "fair",
        "visual_usability": "fair",
        "label_overlap": "none",
        "node_overlap": "none",
        "text_clipping": "none",
        "off_canvas_content": "none",
        "title_intrusion": "none",
        "connector_label_overlap": "none",
        "background_interference": "none",
        "clutter": "low",
        "viewport_fit": "good",
        "fatal_issue_count": 0,
        "minor_issue_count": 0,
        "worst_visible_problem": "",
        "border_check": "",
        "overlap_check": "",
        "recommended_layout": "hierarchy",
        "recommended_detail": "compact",
        "suggested_fix": "",
        "confidence": 0.5,
    }

    result = {**defaults, **parsed}

    for key in [
        "label_overlap",
        "node_overlap",
        "text_clipping",
        "off_canvas_content",
        "title_intrusion",
        "connector_label_overlap",
        "background_interference",
    ]:
        value = str(result.get(key, "none")).lower()
        result[key] = value if value in allowed_severity else "none"

    for key in ["layout_quality", "readability", "visual_usability", "viewport_fit"]:
        value = str(result.get(key, "fair")).lower()
        result[key] = value if value in allowed_quality else "fair"

    clutter = str(result.get("clutter", "low")).lower()
    result["clutter"] = clutter if clutter in allowed_clutter else "low"

    layout = str(result.get("recommended_layout", "hierarchy")).lower()
    result["recommended_layout"] = layout if layout in allowed_layout else "hierarchy"

    detail = str(result.get("recommended_detail", "compact")).lower()
    result["recommended_detail"] = detail if detail in allowed_detail else "compact"

    try:
        result["overall_score"] = int(result.get("overall_score", 50))
    except (TypeError, ValueError):
        result["overall_score"] = 50

    result["overall_score"] = max(0, min(100, result["overall_score"]))

    try:
        result["fatal_issue_count"] = int(result.get("fatal_issue_count", 0))
    except (TypeError, ValueError):
        result["fatal_issue_count"] = 0

    try:
        result["minor_issue_count"] = int(result.get("minor_issue_count", 0))
    except (TypeError, ValueError):
        result["minor_issue_count"] = 0

    try:
        result["confidence"] = float(result.get("confidence", 0.5))
    except (TypeError, ValueError):
        result["confidence"] = 0.5

    result["confidence"] = max(0.0, min(1.0, result["confidence"]))

    accepted_value = result.get("accepted", False)

    if isinstance(accepted_value, bool):
        result["accepted"] = accepted_value
    elif isinstance(accepted_value, str):
        result["accepted"] = accepted_value.strip().lower() == "true"
    else:
        result["accepted"] = False

    return result

def build_prompt() -> str:
    return """
You are a strict visual inspector for SysML diagram PNG images.

Return JSON only. No markdown. No prose outside JSON.

Judge only visual readability and layout quality.

Before answering, inspect these specific areas:
1. top edge of the image
2. left edge of the image
3. right edge of the image
4. bottom edge of the image
5. title/header text
6. text labels inside nodes/cards
7. connector labels
8. arrows/edges
9. whether any text or card is cut off by the canvas
10. whether any large title/background text overlaps diagram content

Important rules:
- If any visible text is cut off by the image boundary, text_clipping is moderate or severe.
- If any card, label, title, or node touches or crosses the image boundary, off_canvas_content is moderate or severe.
- If title/header text overlaps cards, nodes, labels, or connectors, title_intrusion is moderate or severe.
- If labels overlap cards, nodes, arrows, or other labels, label_overlap is moderate or severe.
- If connector labels sit on top of nodes/cards/arrows, connector_label_overlap is moderate or severe.
- If a large faded/background title makes the diagram harder to read, background_interference is moderate or severe.
- Do not mark overlap fields as "none" unless you are confident there is no visible overlap.
- Do not give the same generic critique to every image.
- If the image has obvious visual defects, do not assign overall_score above 60.
- If the image has severe clipping or severe off-canvas content, overall_score must be below 40.
- If readability is only fair, accepted must be false.
- accepted=true only if the diagram is clean enough to use as a final output.

Use only these values:
severity: "none", "minor", "moderate", "severe"
quality: "excellent", "good", "fair", "poor", "unusable"
clutter: "low", "moderate", "high"
layout: "auto", "hierarchy", "grid", "radial"
detail: "standard", "compact", "full"

Return exactly this JSON object:

{
  "accepted": false,
  "overall_score": 50,

  "layout_quality": "fair",
  "readability": "fair",
  "visual_usability": "fair",

  "label_overlap": "none",
  "node_overlap": "none",
  "text_clipping": "none",
  "off_canvas_content": "none",
  "title_intrusion": "none",
  "connector_label_overlap": "none",
  "background_interference": "none",

  "clutter": "low",
  "viewport_fit": "good",

  "fatal_issue_count": 0,
  "minor_issue_count": 0,

  "worst_visible_problem": "short description of the worst visible issue",
  "border_check": "short description of whether content is cut off near image borders",
  "overlap_check": "short description of whether text/cards/connectors overlap",

  "recommended_layout": "hierarchy",
  "recommended_detail": "compact",
  "suggested_fix": "short fix",
  "confidence": 0.8
}

Score guide:
90-100: clean final diagram
75-89: usable, minor imperfections only
60-74: readable but flawed
40-59: poor layout/readability
20-39: severe overlap, clipping, or off-canvas content
0-19: unusable, blank, malformed, or mostly unreadable

Return JSON only.
"""


def critique_image(
    image_path: Path,
    model: str = DEFAULT_MODEL,
    ollama_url: str = OLLAMA_URL,
) -> VLMCritiqueResult:
    """
    Send a rendered diagram PNG/JPEG to the local VLM and request a strict
    JSON visual-quality critique.

    This version is designed to be more robust:
      - uses Ollama JSON mode
      - limits output length
      - keeps timeout long enough for CPU inference
      - saves raw response text if parsing fails
      - normalizes parsed JSON so missing fields do not break scoring
    """
    if not image_path.exists():
        return VLMCritiqueResult(
            success=False,
            image_path=str(image_path),
            model=model,
            error="Image file does not exist.",
        )

    try:
        image_base64 = encode_image_base64(image_path)

        payload = {
            "model": model,
            "prompt": build_prompt(),
            "images": [image_base64],
            "stream": False,
            "format": "json",
            "options": {
                "temperature": 0,
                "num_predict": 400,
                "num_ctx": 8192
            },
        }

        response = requests.post(
            ollama_url,
            json=payload,
            timeout=600,
        )

        response.raise_for_status()
        data = response.json()

        response_text = data.get("response", "")

        parsed = normalize_critique(
            extract_json(response_text)
        )

        if parsed is None:
            return VLMCritiqueResult(
                success=False,
                image_path=str(image_path),
                model=model,
                response_text=response_text,
                parsed_json=None,
                error="Could not parse VLM response as JSON.",
            )

        return VLMCritiqueResult(
            success=True,
            image_path=str(image_path),
            model=model,
            response_text=response_text,
            parsed_json=parsed,
            error=None,
        )

    except Exception as exc:
        return VLMCritiqueResult(
            success=False,
            image_path=str(image_path),
            model=model,
            response_text=None,
            parsed_json=None,
            error=str(exc),
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Critique a rendered SysML diagram PNG with Qwen2.5-VL via Ollama.")
    parser.add_argument("image_path", type=Path)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--report", type=Path, default=None)

    args = parser.parse_args()

    result = critique_image(args.image_path, model=args.model)

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