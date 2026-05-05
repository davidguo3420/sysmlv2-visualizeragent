from __future__ import annotations

import argparse
import json
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


NS = {
    "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "pr": "http://schemas.openxmlformats.org/package/2006/relationships",
}
REL_NS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
EXCLUDED_SHEETS = {"ME Essential Modeling"}


def cell_value(cell: ET.Element, shared_strings: list[str]) -> str:
    value_node = cell.find("a:v", NS)
    raw_value = "" if value_node is None or value_node.text is None else value_node.text
    cell_type = cell.attrib.get("t", "")
    if cell_type == "s" and raw_value:
        return shared_strings[int(raw_value)]
    if cell_type == "inlineStr":
        inline = cell.find("a:is", NS)
        if inline is None:
            return ""
        return "".join(node.text or "" for node in inline.iterfind(".//a:t", NS))
    return raw_value


def read_rows(sheet_root: ET.Element, shared_strings: list[str]) -> list[list[str]]:
    rows: list[list[str]] = []
    for row in sheet_root.findall("a:sheetData/a:row", NS):
        values = [cell_value(cell, shared_strings) for cell in row.findall("a:c", NS)]
        if any(value.strip() for value in values):
            rows.append(values)
    return rows


def load_rules(workbook_path: Path) -> dict[str, object]:
    with zipfile.ZipFile(workbook_path) as archive:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            shared_root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in shared_root.findall("a:si", NS):
                shared_strings.append("".join(node.text or "" for node in item.iterfind(".//a:t", NS)))

        workbook_root = ET.fromstring(archive.read("xl/workbook.xml"))
        rel_root = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        rel_map = {
            relation.attrib["Id"]: f"xl/{relation.attrib['Target']}"
            for relation in rel_root.findall("pr:Relationship", NS)
        }

        sheets: list[dict[str, object]] = []
        total_rules = 0
        for sheet in workbook_root.findall("a:sheets/a:sheet", NS):
            sheet_name = sheet.attrib["name"]
            if sheet_name in EXCLUDED_SHEETS:
                continue
            target = rel_map[sheet.attrib[REL_NS]]
            sheet_root = ET.fromstring(archive.read(target))
            rows = read_rows(sheet_root, shared_strings)
            header = rows[0] if rows else []
            rules = []
            for row in rows[1:]:
                rule = {
                    "index": row[0] if len(row) > 0 else "",
                    "name": row[1] if len(row) > 1 else "",
                    "specification": row[2] if len(row) > 2 else "",
                    "error_message": row[3] if len(row) > 3 else "",
                }
                rules.append(rule)
            total_rules += len(rules)
            sheets.append(
                {
                    "sheet": sheet_name,
                    "header": header,
                    "rule_count": len(rules),
                    "rules": rules,
                }
            )

    return {
        "source_workbook": str(workbook_path),
        "sheet_count": len(sheets),
        "rule_count": total_rules,
        "sheets": sheets,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract active ME VAL modeling rules from an XLSX workbook, excluding retired sheets."
    )
    parser.add_argument("--input", required=True, help="Path to the ME VAL Rules.xlsx workbook")
    parser.add_argument("--json-out", required=True, help="Path to write the JSON snapshot")
    parser.add_argument("--js-out", required=True, help="Path to write the browser JS snapshot")
    args = parser.parse_args()

    workbook_path = Path(args.input).expanduser().resolve()
    payload = load_rules(workbook_path)

    json_out = Path(args.json_out).resolve()
    js_out = Path(args.js_out).resolve()
    json_out.parent.mkdir(parents=True, exist_ok=True)
    js_out.parent.mkdir(parents=True, exist_ok=True)

    json_out.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    js_out.write_text(
        "window.ME_VAL_RULES_SNAPSHOT = " + json.dumps(payload, indent=2) + ";\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
