"""
Probe the sysml2viz browser UI.

Purpose:
    app.py only serves the visualizer page and helper endpoints.
    The SVG appears to be generated client-side in JavaScript.

    This script opens http://127.0.0.1:8000 with Playwright and prints
    the useful page elements so we can build a real renderer next.

Usage:
    Terminal 1:
        python app.py

    Terminal 2:
        python tools/probe_sysml2viz_page.py
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:8000"


@dataclass
class ElementInfo:
    tag: str
    text: str
    element_id: str
    name: str
    class_name: str
    placeholder: str
    value: str


def clean(value: Any, max_len: int = 120) -> str:
    if value is None:
        return ""
    text = str(value).replace("\n", "\\n").strip()
    if len(text) > max_len:
        return text[: max_len - 3] + "..."
    return text


def collect_elements(page, selector: str) -> list[ElementInfo]:
    elements = page.locator(selector)
    count = elements.count()
    results: list[ElementInfo] = []

    for i in range(count):
        el = elements.nth(i)

        try:
            tag = el.evaluate("node => node.tagName.toLowerCase()")
        except Exception:
            tag = ""

        def attr(name: str) -> str:
            try:
                return clean(el.get_attribute(name))
            except Exception:
                return ""

        try:
            text = clean(el.inner_text())
        except Exception:
            text = ""

        try:
            value = clean(el.input_value())
        except Exception:
            value = ""

        results.append(
            ElementInfo(
                tag=tag,
                text=text,
                element_id=attr("id"),
                name=attr("name"),
                class_name=attr("class"),
                placeholder=attr("placeholder"),
                value=value,
            )
        )

    return results


def print_section(title: str, elements: list[ElementInfo]) -> None:
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)

    if not elements:
        print("(none)")
        return

    for idx, el in enumerate(elements):
        print(f"[{idx}] <{el.tag}>")
        print(f"    id:          {el.element_id}")
        print(f"    name:        {el.name}")
        print(f"    class:       {el.class_name}")
        print(f"    placeholder: {el.placeholder}")
        print(f"    value:       {el.value}")
        print(f"    text:        {el.text}")


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.goto(BASE_URL, wait_until="networkidle")

        print(f"Opened: {BASE_URL}")
        print(f"Title: {page.title()}")

        print_section(
            "TEXTAREAS",
            collect_elements(page, "textarea"),
        )

        print_section(
            "INPUTS",
            collect_elements(page, "input"),
        )

        print_section(
            "SELECTS",
            collect_elements(page, "select"),
        )

        print_section(
            "BUTTONS",
            collect_elements(page, "button"),
        )

        print_section(
            "LINKS",
            collect_elements(page, "a"),
        )

        print_section(
            "SVG ELEMENTS",
            collect_elements(page, "svg"),
        )

        print_section(
            "CANVAS ELEMENTS",
            collect_elements(page, "canvas"),
        )

        print("\nDone. Close the browser window when finished.")
        input("Press Enter to close browser...")
        browser.close()


if __name__ == "__main__":
    main()