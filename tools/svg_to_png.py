"""
Convert SVG diagrams to PNG previews using Playwright.

This version injects the SVG inline into an HTML page and screenshots the
actual <svg> element. This avoids problems where Chromium displays SVG source
code or fails to load a data-uri <img>.

Usage:
    python tools/svg_to_png.py output_diagrams/sample_model/initial.svg
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass, asdict
from pathlib import Path

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError


@dataclass
class SVGToPNGResult:
    success: bool
    svg_path: str
    png_path: str
    error: str | None = None


def ensure_svg_namespace(svg_text: str) -> str:
    """
    Ensure the root <svg> has the standard SVG namespace.

    Some browser contexts are more reliable when xmlns is explicit.
    """
    if "xmlns=" in svg_text[:300]:
        return svg_text

    return re.sub(
        r"<svg\b",
        '<svg xmlns="http://www.w3.org/2000/svg"',
        svg_text,
        count=1,
    )


def add_size_from_viewbox(svg_text: str) -> str:
    """
    If width/height are missing but viewBox exists, add width/height.

    Example:
        viewBox="0 0 1040 560"
    becomes:
        width="1040" height="560"
    """
    opening_tag_match = re.search(r"<svg\b[^>]*>", svg_text)
    if not opening_tag_match:
        return svg_text

    opening_tag = opening_tag_match.group(0)

    has_width = re.search(r"\bwidth=", opening_tag) is not None
    has_height = re.search(r"\bheight=", opening_tag) is not None

    if has_width and has_height:
        return svg_text

    viewbox_match = re.search(
        r'viewBox=["\']\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*["\']',
        opening_tag,
    )

    if not viewbox_match:
        return svg_text

    width = viewbox_match.group(3)
    height = viewbox_match.group(4)

    replacement = opening_tag

    if not has_width:
        replacement = replacement[:-1] + f' width="{width}">'

    if not has_height:
        replacement = replacement[:-1] + f' height="{height}">'

    return svg_text.replace(opening_tag, replacement, 1)


def normalize_svg(svg_text: str) -> str:
    svg_text = ensure_svg_namespace(svg_text)
    svg_text = add_size_from_viewbox(svg_text)
    return svg_text


def svg_to_png(
    svg_path: Path,
    png_path: Path | None = None,
    viewport_width: int = 1800,
    viewport_height: int = 1400,
) -> SVGToPNGResult:
    if not svg_path.exists():
        return SVGToPNGResult(
            success=False,
            svg_path=str(svg_path),
            png_path=str(png_path or svg_path.with_suffix(".png")),
            error="SVG file does not exist.",
        )

    if png_path is None:
        png_path = svg_path.with_suffix(".png")

    try:
        raw_svg_text = svg_path.read_text(encoding="utf-8")
        svg_text = normalize_svg(raw_svg_text)

        html = f"""
        <!doctype html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                html, body {{
                    margin: 0;
                    padding: 0;
                    background: white;
                }}

                body {{
                    display: inline-block;
                }}

                svg {{
                    display: block;
                    background: white;
                }}
            </style>
        </head>
        <body>
            {svg_text}
        </body>
        </html>
        """

        png_path.parent.mkdir(parents=True, exist_ok=True)

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)

            page = browser.new_page(
                viewport={
                    "width": viewport_width,
                    "height": viewport_height,
                },
                device_scale_factor=2,
            )

            page.set_content(html, wait_until="domcontentloaded")

            svg = page.locator("svg").first
            svg.wait_for(state="visible", timeout=10_000)

            # Confirm the inline SVG has a visible bounding box.
            box = svg.bounding_box()

            if not box:
                raise RuntimeError("SVG exists, but Playwright could not compute a bounding box.")

            if box["width"] <= 0 or box["height"] <= 0:
                raise RuntimeError(
                    f"SVG bounding box is invalid: width={box['width']}, height={box['height']}"
                )

            svg.screenshot(path=str(png_path))

            browser.close()

        return SVGToPNGResult(
            success=True,
            svg_path=str(svg_path),
            png_path=str(png_path),
        )

    except PlaywrightTimeoutError as exc:
        return SVGToPNGResult(
            success=False,
            svg_path=str(svg_path),
            png_path=str(png_path),
            error=f"Timed out while converting SVG to PNG: {exc}",
        )
    except Exception as exc:
        return SVGToPNGResult(
            success=False,
            svg_path=str(svg_path),
            png_path=str(png_path),
            error=str(exc),
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert SVG to PNG using Playwright.")
    parser.add_argument("svg_path", type=Path)

    parser.add_argument(
        "--png-path",
        type=Path,
        default=None,
        help="Optional output PNG path. Defaults to same name as SVG.",
    )

    parser.add_argument(
        "--viewport-width",
        type=int,
        default=1800,
        help="Browser viewport width.",
    )

    parser.add_argument(
        "--viewport-height",
        type=int,
        default=1400,
        help="Browser viewport height.",
    )

    parser.add_argument(
        "--report",
        type=Path,
        default=None,
        help="Optional JSON conversion report path.",
    )

    args = parser.parse_args()

    result = svg_to_png(
        svg_path=args.svg_path,
        png_path=args.png_path,
        viewport_width=args.viewport_width,
        viewport_height=args.viewport_height,
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