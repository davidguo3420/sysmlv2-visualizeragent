"""
Browser-based SVG renderer for sysml2viz.

Why this exists:
    app.py does not render SVG server-side.
    It serves a browser application, and the diagram is generated in the DOM.

This module automates the browser:
    SysML source -> browser UI -> #diagram SVG -> output file

Usage:
    Terminal 1:
        python app.py

    Terminal 2:
        python tools/browser_svg_renderer.py sample_model.sysml workspace/test_output.svg
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError


BASE_URL = "http://127.0.0.1:8000"


@dataclass
class BrowserRenderResult:
    success: bool
    input_path: Path
    output_path: Path
    svg_text: Optional[str] = None
    error: Optional[str] = None


class BrowserSVGRenderer:
    def __init__(
        self,
        base_url: str = BASE_URL,
        headless: bool = True,
        timeout_ms: int = 10_000,
    ) -> None:
        self.base_url = base_url
        self.headless = headless
        self.timeout_ms = timeout_ms

    def render_source_to_svg_text(self, sysml_source: str) -> str:
        """
        Render SysML source through the existing browser UI and return SVG text.
        """
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=self.headless)
            page = browser.new_page()
            page.set_default_timeout(self.timeout_ms)

            try:
                page.goto(self.base_url, wait_until="networkidle")

                # Fill the SysML editor.
                page.locator("#model-text").fill(sysml_source)

                # Trigger parsing/rendering.
                page.locator("#load-text").click()

                # Wait for the main SVG to exist.
                diagram = page.locator("svg#diagram")
                diagram.wait_for(state="attached")

                # Wait until the SVG has some child content.
                page.wait_for_function(
                    """
                    () => {
                        const svg = document.querySelector('svg#diagram');
                        return svg && svg.children.length > 0;
                    }
                    """
                )

                svg_text = diagram.evaluate("node => node.outerHTML")

                if not svg_text.strip().startswith("<svg"):
                    raise RuntimeError("Extracted diagram did not start with <svg>.")

                return svg_text

            finally:
                browser.close()

    def render_file(self, input_path: Path, output_path: Path) -> BrowserRenderResult:
        """
        Render one SysML file to one SVG file.
        """
        try:
            sysml_source = input_path.read_text(encoding="utf-8")
        except OSError as exc:
            return BrowserRenderResult(
                success=False,
                input_path=input_path,
                output_path=output_path,
                error=f"Could not read input file: {exc}",
            )

        try:
            svg_text = self.render_source_to_svg_text(sysml_source)
        except PlaywrightTimeoutError as exc:
            return BrowserRenderResult(
                success=False,
                input_path=input_path,
                output_path=output_path,
                error=f"Timed out while rendering: {exc}",
            )
        except Exception as exc:
            return BrowserRenderResult(
                success=False,
                input_path=input_path,
                output_path=output_path,
                error=str(exc),
            )

        try:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(svg_text, encoding="utf-8")
        except OSError as exc:
            return BrowserRenderResult(
                success=False,
                input_path=input_path,
                output_path=output_path,
                svg_text=svg_text,
                error=f"Could not write output file: {exc}",
            )

        return BrowserRenderResult(
            success=True,
            input_path=input_path,
            output_path=output_path,
            svg_text=svg_text,
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render a SysML file to SVG using the sysml2viz browser UI."
    )
    parser.add_argument(
        "input_file",
        type=Path,
        help="Path to the .sysml or .txt input model.",
    )
    parser.add_argument(
        "output_svg",
        type=Path,
        help="Path where the output .svg should be written.",
    )
    parser.add_argument(
        "--show-browser",
        action="store_true",
        help="Run Chromium visibly instead of headless.",
    )
    parser.add_argument(
        "--base-url",
        default=BASE_URL,
        help="URL of the running sysml2viz app.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    renderer = BrowserSVGRenderer(
        base_url=args.base_url,
        headless=not args.show_browser,
    )

    result = renderer.render_file(args.input_file, args.output_svg)

    if result.success:
        print(f"Rendered SVG: {result.output_path}")
    else:
        print("Render failed.")
        print(result.error)
        raise SystemExit(1)


if __name__ == "__main__":
    main()