"""
Deterministic SVG quality checks.

Purpose:
    Inspect rendered SVG files before using any VLM feedback.

This is not a visual AI critic.
This only checks objective properties such as:
    - file exists
    - SVG parses as XML
    - has text labels
    - has graphical elements
    - has viewBox or width/height
    - is not suspiciously small
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
import json
import xml.etree.ElementTree as ET


SVG_NAMESPACE = "{http://www.w3.org/2000/svg}"


@dataclass
class SVGQualityReport:
    svg_path: str
    success: bool
    issues: list[str]
    file_size_bytes: int
    text_count: int
    shape_count: int
    path_count: int
    group_count: int
    has_viewbox: bool
    width: str | None
    height: str | None


def strip_namespace(tag: str) -> str:
    """
    Convert '{namespace}text' to 'text'.
    """
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag


def check_svg(svg_path: Path) -> SVGQualityReport:
    issues: list[str] = []

    if not svg_path.exists():
        return SVGQualityReport(
            svg_path=str(svg_path),
            success=False,
            issues=["SVG file does not exist."],
            file_size_bytes=0,
            text_count=0,
            shape_count=0,
            path_count=0,
            group_count=0,
            has_viewbox=False,
            width=None,
            height=None,
        )

    file_size = svg_path.stat().st_size

    if file_size < 500:
        issues.append("SVG file is suspiciously small.")

    try:
        tree = ET.parse(svg_path)
        root = tree.getroot()
    except ET.ParseError as exc:
        return SVGQualityReport(
            svg_path=str(svg_path),
            success=False,
            issues=[f"SVG XML parse error: {exc}"],
            file_size_bytes=file_size,
            text_count=0,
            shape_count=0,
            path_count=0,
            group_count=0,
            has_viewbox=False,
            width=None,
            height=None,
        )

    if strip_namespace(root.tag) != "svg":
        issues.append("Root element is not <svg>.")

    width = root.attrib.get("width")
    height = root.attrib.get("height")
    has_viewbox = "viewBox" in root.attrib

    if not has_viewbox and (not width or not height):
        issues.append("SVG has neither viewBox nor explicit width/height.")

    text_count = 0
    shape_count = 0
    path_count = 0
    group_count = 0

    shape_tags = {
        "rect",
        "circle",
        "ellipse",
        "line",
        "polyline",
        "polygon",
        "path",
    }

    for element in root.iter():
        tag = strip_namespace(element.tag)

        if tag == "text":
            text_count += 1

        if tag in shape_tags:
            shape_count += 1

        if tag == "path":
            path_count += 1

        if tag == "g":
            group_count += 1

    if text_count == 0:
        issues.append("SVG contains no <text> labels.")

    if shape_count == 0:
        issues.append("SVG contains no basic graphical shape elements.")

    success = len(issues) == 0

    return SVGQualityReport(
        svg_path=str(svg_path),
        success=success,
        issues=issues,
        file_size_bytes=file_size,
        text_count=text_count,
        shape_count=shape_count,
        path_count=path_count,
        group_count=group_count,
        has_viewbox=has_viewbox,
        width=width,
        height=height,
    )


def write_quality_report(svg_path: Path, report_path: Path) -> SVGQualityReport:
    report = check_svg(svg_path)

    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps(asdict(report), indent=2),
        encoding="utf-8",
    )

    return report


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="Run deterministic SVG quality checks."
    )
    parser.add_argument("svg_path", type=Path)
    parser.add_argument(
        "--report",
        type=Path,
        default=None,
        help="Optional JSON report output path.",
    )

    args = parser.parse_args()

    report = check_svg(args.svg_path)

    print(json.dumps(asdict(report), indent=2))

    if args.report:
        write_quality_report(args.svg_path, args.report)


if __name__ == "__main__":
    main()