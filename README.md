# SysML v2 Visualizer Agent

A batch rendering and diagram-preparation pipeline built on top of [`sysml2viz`](https://github.com/bsoeder/sysml2viz). The current system takes SysML v2-style model files, renders SVG diagrams through the existing browser-based visualizer, runs deterministic SVG quality checks, and converts the resulting SVGs into PNG previews.

This repository is being developed toward an agentic diagram-refinement workflow where open-source vision-language models (VLMs) critique generated diagrams and feed back layout or model-improvement suggestions.

---

## Current Status

Implemented:

* Browser-automated SysML-to-SVG rendering
* Batch rendering for folders of `.sysml` and `.txt` files
* Optional dataset subsetting with `--percent` and `--limit`
* Deterministic SVG quality checks
* SVG-to-PNG preview generation using Playwright
* Per-model output folders containing rendered diagrams and JSON reports

Planned:

* Open-source VLM diagram critique
* Automated feedback reports
* Semantic vs. visual issue classification
* Iterative diagram refinement loop
* Optional agent planner for rerendering and repair decisions

---

## Pipeline Overview

The current pipeline is:

```text
input_models/*.sysml
        ↓
batch_render.py
        ↓
tools/browser_svg_renderer.py
        ↓
running sysml2viz browser UI
        ↓
initial.svg
        ↓
tools/svg_quality_checks.py
        ↓
quality_report.json
        ↓
tools/svg_to_png.py
        ↓
initial.png
```

The final output for each input file is a rendered SVG diagram and a PNG preview.

---

## Repository Structure

```text
sysmlv2-visualizeragent/
│
├── app.py
├── batch_render.py
├── requirements.txt
│
├── tools/
│   ├── browser_svg_renderer.py
│   ├── probe_sysml2viz_page.py
│   ├── svg_quality_checks.py
│   └── svg_to_png.py
│
├── input_models/
│   └── sample_model.sysml
│
├── output_diagrams/
│   └── ...
│
└── workspace/
    └── ...
```

### Important Files

| File                            | Purpose                                                    |
| ------------------------------- | ---------------------------------------------------------- |
| `app.py`                        | Original `sysml2viz` local web server                      |
| `batch_render.py`               | Batch entry point for rendering many SysML files           |
| `tools/browser_svg_renderer.py` | Uses Playwright to automate the browser UI and extract SVG |
| `tools/svg_quality_checks.py`   | Runs deterministic checks on rendered SVG files            |
| `tools/svg_to_png.py`           | Converts SVG diagrams into PNG previews using Playwright   |
| `tools/probe_sysml2viz_page.py` | Debugging/probing script for inspecting page elements      |

---

## Requirements

You need:

* Python 3.12 recommended
* A virtual environment
* Playwright with Chromium installed
* The original `sysml2viz` app working locally

The current workflow assumes the local server runs at:

```text
http://127.0.0.1:8000
```

---

## Setup

### 1. Clone the repository

```powershell
git clone https://github.com/YOUR_USERNAME/sysmlv2-visualizeragent.git
cd sysmlv2-visualizeragent
```

### 2. Create and activate a virtual environment

```powershell
python -m venv .venv
```

Activate it:

```powershell
.venv\Scripts\Activate.ps1
```

If PowerShell blocks script execution, use Command Prompt instead:

```cmd
.venv\Scripts\activate.bat
```

### 3. Install dependencies

```powershell
python -m pip install -r requirements.txt
```

### 4. Install Playwright browser support

```powershell
python -m playwright install chromium
```

---

## Running the Current Pipeline

The pipeline requires two terminals.

---

### Terminal 1: Start the local visualizer server

From the repository root:

```powershell
python app.py
```

Expected output:

```text
Serving SysML2 visualizer at http://127.0.0.1:8000
```

Leave this terminal running.

---

### Terminal 2: Run the batch renderer

In a second terminal, from the repository root:

```powershell
python batch_render.py input_models output_diagrams
```

This renders every supported file in `input_models/`.

Supported input extensions:

```text
.sysml
.txt
```

---

## Example Output

For an input file:

```text
input_models/sample_model.sysml
```

the pipeline creates:

```text
output_diagrams/
└── sample_model/
    ├── initial.svg
    ├── initial.png
    ├── report.json
    └── quality_report.json
```

### Output Files

| File                  | Meaning                                                    |
| --------------------- | ---------------------------------------------------------- |
| `initial.svg`         | Rendered SVG diagram extracted from the browser visualizer |
| `initial.png`         | PNG preview generated from the SVG                         |
| `report.json`         | Render status and file-level metadata                      |
| `quality_report.json` | Deterministic SVG quality-check results                    |

---

## Rendering Only Part of a Dataset

For large datasets, use `--percent` or `--limit`.

### Render the first 10 percent

```powershell
python batch_render.py input_models output_diagrams --percent 10
```

### Render the first 25 percent

```powershell
python batch_render.py input_models output_diagrams --percent 25
```

### Render only the first 5 files

```powershell
python batch_render.py input_models output_diagrams --limit 5
```

### Render the first 10 percent, capped at 50 files

```powershell
python batch_render.py input_models output_diagrams --percent 10 --limit 50
```

If both options are provided, `--percent` is applied first, then `--limit`.

---

## Showing the Browser During Rendering

By default, rendering is headless.

To watch Chromium interact with the visualizer UI:

```powershell
python batch_render.py input_models output_diagrams --show-browser
```

This is useful for debugging.

---

## Single-File SVG Rendering

You can render one SysML file directly:

```powershell
python tools/browser_svg_renderer.py input_models/sample_model.sysml workspace/test_output.svg --show-browser
```

This produces:

```text
workspace/test_output.svg
```

---

## Single-File SVG Quality Check

Run deterministic checks on one SVG:

```powershell
python tools/svg_quality_checks.py output_diagrams/sample_model/initial.svg
```

Example output:

```json
{
  "success": true,
  "issues": [],
  "file_size_bytes": 4129,
  "text_count": 6,
  "shape_count": 28,
  "path_count": 6,
  "group_count": 6,
  "has_viewbox": true,
  "width": null,
  "height": null
}
```

A missing `width` or `height` is not necessarily an error if the SVG has a valid `viewBox`.

---

## Single-File SVG to PNG Conversion

Convert one SVG to PNG:

```powershell
python tools/svg_to_png.py output_diagrams/sample_model/initial.svg
```

This produces:

```text
output_diagrams/sample_model/initial.png
```

This converter uses Playwright rather than CairoSVG so that it works without installing native Cairo libraries on Windows.

---

## How Rendering Works

The original `app.py` does not expose a server-side SVG rendering API. It serves a browser application, and the diagram is generated client-side in the DOM.

Because of that, this project uses Playwright to automate the existing UI:

```text
1. Open http://127.0.0.1:8000
2. Fill the #model-text textarea with SysML source
3. Click the #load-text button
4. Wait for the #diagram SVG element
5. Extract the SVG outerHTML
6. Save it as initial.svg
```

The important UI element IDs discovered by probing the page are:

| Element           | ID           |
| ----------------- | ------------ |
| SysML textarea    | `model-text` |
| Parse button      | `load-text`  |
| Main diagram SVG  | `diagram`    |
| Export SVG button | `export-svg` |
| Overview SVG      | `overview`   |

---

## Deterministic SVG Quality Checks

The quality checker currently verifies:

* SVG file exists
* SVG parses as XML
* Root element is `<svg>`
* File is not suspiciously small
* Diagram has text labels
* Diagram has graphical elements
* Diagram has a `viewBox` or explicit dimensions
* Counts of text, paths, shapes, and groups

These checks are intentionally simple, fast, and repeatable. They are meant to run before any VLM-based critique.

---

## Why PNG Output Matters

Most open-source VLMs accept raster images more reliably than raw SVG. Therefore, the pipeline prepares both:

```text
initial.svg  → source-quality vector diagram
initial.png  → VLM-ready visual preview
```

The next major development step is to pass `initial.png` into a local or open-source VLM for visual critique.

---

## Planned VLM Feedback Stage

The future VLM stage will evaluate diagram quality beyond deterministic checks.

Possible VLM feedback categories:

* Label readability
* Visual clutter
* Node overlap
* Edge crossing
* Missing visual hierarchy
* Diagram layout quality
* Whether the diagram visually represents the source SysML model

Planned VLM output format:

```json
{
  "accepted": false,
  "issue_type": "visual_layout",
  "issues": [
    "Text labels overlap near the center of the diagram.",
    "Several connector lines cross through block labels."
  ],
  "suggested_fix": "Increase node spacing and rerender using a hierarchy layout."
}
```

This feedback will later feed into an agentic refinement loop.

---

## Intended Future Agent Loop

The long-term architecture is:

```text
SysML source
    ↓
render SVG
    ↓
run deterministic checks
    ↓
convert SVG to PNG
    ↓
VLM critique
    ↓
planner decides:
        - accept diagram
        - repair SysML
        - adjust layout
        - rerender
    ↓
final SVG + PNG + report
```

The final goal is a deployable GitHub repository that can process many SysML v2 files and produce refined diagram outputs with traceable feedback reports.

---

## Development Notes

Generated outputs should usually not be committed.

Recommended `.gitignore` entries:

```gitignore
.venv/
__pycache__/
*.pyc

workspace/
output_diagrams/
input_models/
```

If you want to include small test models in the repo, place them in:

```text
examples/
```

instead of committing a large dataset.

---

## Current Milestone

This repository currently supports:

```text
batch SysML input
    → browser-rendered SVG
    → deterministic quality report
    → PNG preview
```

The next milestone is:

```text
PNG preview
    → open-source VLM critique
    → structured feedback report
```
