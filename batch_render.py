"""
Batch renderer for SysML2 visualizer agent.

Purpose:
    Render .sysml or .txt files in an input folder to SVG files
    using the existing sysml2viz browser UI.

Usage:
    Terminal 1:
        python app.py

    Terminal 2:
        python batch_render.py input_models output_diagrams

Render only the first 10 percent:
        python batch_render.py input_models output_diagrams --percent 10

Render only the first 25 files:
        python batch_render.py input_models output_diagrams --limit 25
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from tools.svg_quality_checks import write_quality_report

from tools.browser_svg_renderer import BrowserSVGRenderer


SUPPORTED_EXTENSIONS = {".sysml", ".txt"}


def find_model_files(input_dir: Path) -> list[Path]:
    """
    Find all supported SysML-like files under input_dir.
    """
    files: list[Path] = []

    for path in input_dir.rglob("*"):
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS:
            files.append(path)

    return sorted(files)


def select_subset(
    files: list[Path],
    percent: float | None = None,
    limit: int | None = None,
) -> list[Path]:
    """
    Select only part of the dataset.

    Rules:
        - If --percent is provided, keep the first N percent of files.
        - If --limit is provided, keep at most that many files.
        - If both are provided, apply percent first, then limit.
    """
    selected = files

    if percent is not None:
        if percent <= 0 or percent > 100:
            raise ValueError("--percent must be greater than 0 and less than or equal to 100.")

        count = math.ceil(len(selected) * (percent / 100.0))
        count = max(1, count)
        selected = selected[:count]

    if limit is not None:
        if limit <= 0:
            raise ValueError("--limit must be greater than 0.")

        selected = selected[:limit]

    return selected


def safe_output_name(input_file: Path, input_root: Path) -> Path:
    """
    Preserve folder structure but remove file extension.

    Example:
        input_models/foo/bar.sysml
    becomes:
        output_diagrams/foo/bar/
    """
    relative = input_file.relative_to(input_root)
    return relative.with_suffix("")


def write_report(
    report_path: Path,
    input_file: Path,
    output_svg: Path,
    success: bool,
    error: str | None,
) -> None:
    report = {
        "input_file": str(input_file),
        "output_svg": str(output_svg),
        "success": success,
        "error": error,
    }

    report_path.write_text(
        json.dumps(report, indent=2),
        encoding="utf-8",
    )


def batch_render(
    input_dir: Path,
    output_dir: Path,
    show_browser: bool = False,
    percent: float | None = None,
    limit: int | None = None,
) -> int:
    """
    Render SysML files in input_dir.

    Returns:
        Number of failed files.
    """
    renderer = BrowserSVGRenderer(headless=not show_browser)

    all_model_files = find_model_files(input_dir)

    if not all_model_files:
        print(f"No .sysml or .txt files found in {input_dir}")
        return 1

    model_files = select_subset(
        files=all_model_files,
        percent=percent,
        limit=limit,
    )

    print(f"Found {len(all_model_files)} total model file(s).")
    print(f"Rendering {len(model_files)} selected model file(s).")

    if percent is not None:
        print(f"Subset percentage: {percent}%")

    if limit is not None:
        print(f"Limit: {limit}")

    failures = 0

    for index, input_file in enumerate(model_files, start=1):
        output_subdir = output_dir / safe_output_name(input_file, input_dir)
        output_svg = output_subdir / "initial.svg"
        report_path = output_subdir / "report.json"

        print()
        print(f"[{index}/{len(model_files)}] Rendering {input_file}")
        print(f"    → {output_svg}")

        result = renderer.render_file(input_file, output_svg)

        output_subdir.mkdir(parents=True, exist_ok=True)

        write_report(
            report_path=report_path,
            input_file=input_file,
            output_svg=output_svg,
            success=result.success,
            error=result.error,
        )

        if result.success:
            print("    render: success")

            quality_report_path = output_subdir / "quality_report.json"
            quality_report = write_quality_report(output_svg, quality_report_path)

            if quality_report.success:
                print("    quality: pass")
            else:
                print("    quality: fail")
                for issue in quality_report.issues:
                    print(f"      - {issue}")
        else:
            failures += 1
            print("    render: failed")
            print(f"    error: {result.error}")

    print()
    print(f"Done. Failures: {failures}")

    return failures


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Batch-render SysML files to SVG diagrams."
    )

    parser.add_argument(
        "input_dir",
        type=Path,
        help="Folder containing .sysml or .txt files.",
    )

    parser.add_argument(
        "output_dir",
        type=Path,
        help="Folder where rendered diagrams should be written.",
    )

    parser.add_argument(
        "--show-browser",
        action="store_true",
        help="Run Chromium visibly instead of headless.",
    )

    parser.add_argument(
        "--percent",
        type=float,
        default=None,
        help="Render only the first N percent of the discovered dataset. Example: --percent 10",
    )

    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Render at most this many files after applying --percent.",
    )

    return parser.parse_args()


def main() -> None:
    args = parse_args()

    failures = batch_render(
        input_dir=args.input_dir,
        output_dir=args.output_dir,
        show_browser=args.show_browser,
        percent=args.percent,
        limit=args.limit,
    )

    raise SystemExit(1 if failures else 0)


if __name__ == "__main__":
    main()