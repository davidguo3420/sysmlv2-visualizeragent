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


def build_prompt() -> str:
    return """
You are reviewing a SysML diagram rendered as a PNG.

Evaluate the diagram visually. Focus only on diagram quality, not whether the underlying SysML source is correct.

Check:
1. Are labels readable?
2. Are nodes or labels overlapping?
3. Are connectors visible and understandable?
4. Is the diagram too sparse, too cluttered, or malformed?
5. Does it look like an actual diagram rather than source code or an empty image?

Return JSON only using this schema:

{
  "accepted": true,
  "layout_quality": "good",
  "readability": "good",
  "issues": [],
  "suggested_fix": "No changes needed."
}

Use accepted=false if the diagram has serious visual problems.
"""


def critique_image(
    image_path: Path,
    model: str = DEFAULT_MODEL,
    ollama_url: str = OLLAMA_URL,
) -> VLMCritiqueResult:
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

        return VLMCritiqueResult(
            success=parsed is not None,
            image_path=str(image_path),
            model=model,
            response_text=response_text,
            parsed_json=parsed,
            error=None if parsed is not None else "Could not parse JSON from VLM response.",
        )

    except Exception as exc:
        return VLMCritiqueResult(
            success=False,
            image_path=str(image_path),
            model=model,
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