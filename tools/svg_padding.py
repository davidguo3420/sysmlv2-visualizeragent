from __future__ import annotations

import re
from pathlib import Path


def add_svg_padding(svg_path: Path, padding_ratio: float = 0.08) -> None:
    """
    Expand an SVG's viewBox so content near the edge is not clipped.

    This modifies the SVG file in place.

    Example:
        viewBox="0 0 800 600"
    becomes approximately:
        viewBox="-64 -48 928 696"
    """
    text = svg_path.read_text(encoding="utf-8")

    match = re.search(
        r'viewBox\s*=\s*["\']\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*["\']',
        text,
    )

    if not match:
        return

    x = float(match.group(1))
    y = float(match.group(2))
    width = float(match.group(3))
    height = float(match.group(4))

    pad_x = width * padding_ratio
    pad_y = height * padding_ratio

    new_x = x - pad_x
    new_y = y - pad_y
    new_width = width + 2 * pad_x
    new_height = height + 2 * pad_y

    new_viewbox = (
        f'viewBox="{new_x:.2f} {new_y:.2f} '
        f'{new_width:.2f} {new_height:.2f}"'
    )

    text = (
        text[: match.start()]
        + new_viewbox
        + text[match.end() :]
    )

    svg_path.write_text(text, encoding="utf-8")