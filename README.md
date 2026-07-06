# SysML v2 Visualizer Agent

This project batch-renders SysML v2 input files into SVG/PNG diagrams, then uses a local open-source vision-language model through Ollama to critique and repair diagram layout settings.

The current pipeline is:

```text
SysML v2 file
  → browser-based sysml2viz rendering
  → SVG output
  → PNG preview
  → Qwen2.5-VL critique
  → Qwen-planned layout/detail repair
  → final accepted SVG/PNG diagram
```

The SysML v2 source is not modified during repair. The repair loop only changes renderer settings such as layout and detail level.

---

## Current Status

The current version supports:

* Batch rendering `.sysml` and `.txt` input files
* SVG generation through the existing browser visualizer
* PNG preview generation
* Deterministic SVG quality checks
* Qwen2.5-VL diagram critique through Ollama
* Qwen-planned layout repair
* Final accepted diagram output

Repair mode is currently enabled by default.

---

## Repository Structure

```text
sysmlv2-visualizeragent/
├── app.py
├── batch_render.py
├── input_models/
├── tools/
│   ├── __init__.py
│   ├── browser_svg_renderer.py
│   ├── layout_repair.py
│   ├── probe_sysml2viz_page.py
│   ├── svg_quality_checks.py
│   ├── svg_to_png.py
│   ├── vlm_critic.py
│   └── vlm_repair_planner.py
├── requirements.txt
└── README.md
```

Generated outputs are written to `output_diagrams/`.

---

## Installation

Create and activate a Python virtual environment.

On Windows PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

If PowerShell blocks activation because of execution policy, use Command Prompt instead:

```cmd
.venv\Scripts\activate.bat
```

Install dependencies:

```powershell
python -m pip install -r requirements.txt
python -m playwright install chromium
```

Install Ollama separately, then pull the vision model:

```powershell
ollama pull qwen2.5vl
```

Test that the model responds:

```powershell
ollama run qwen2.5vl "Say only: Ready"
```

---

## Running the Current Pipeline

The current workflow uses multiple terminals.

### Terminal 1: Start the SysML visualizer server

From the repository root:

```powershell
python app.py
```

This should print something like:

```text
Serving SysML2 visualizer at http://127.0.0.1:8000
```

Leave this terminal running.

You can also open this URL in a browser to confirm the visualizer works:

```text
http://127.0.0.1:8000
```

---

### Terminal 2: Start Ollama

If Ollama is already running in the background, you may not need this terminal.

Otherwise run:

```powershell
ollama serve
```

Leave this terminal running.

If Qwen fails because of GPU/CUDA issues on Windows, force Ollama to use CPU mode:

```powershell
$env:CUDA_VISIBLE_DEVICES="-1"
$env:OLLAMA_LLM_LIBRARY="cpu"
ollama serve
```

CPU mode is slower, but it is more stable on machines with limited GPU memory.

---

### Terminal 3: Run the batch renderer

Run the pipeline from the repository root:

```powershell
python batch_render.py input_models output_diagrams --limit 1
```

Because repair mode is enabled by default, this command will:

1. render the initial SVG,
2. convert it to PNG,
3. ask Qwen2.5-VL to critique it,
4. ask Qwen2.5-VL to choose better render settings if needed,
5. rerender the diagram,
6. save the best final SVG/PNG.

Expected output looks like:

```text
Found 1 total model file(s).
Rendering 1 selected model file(s).

[1/1] Rendering input_models\000001.sysml
    → output_diagrams\000001\initial.svg
    render: success
    quality: pass
    png: created
    repair: enabled
    attempt: layout=auto, detail=standard
    planner next: layout=hierarchy, detail=compact
    attempt: layout=hierarchy, detail=compact
    accepted by VLM; stopping repair loop
    repair: success (accepted=True, layout=hierarchy, detail=compact)

Done. Failures: 0
```

---

## Output Files

For each input model, the pipeline creates an output folder like:

```text
output_diagrams/
└── 000001/
    ├── initial.svg
    ├── initial.png
    ├── final.svg
    ├── final.png
    ├── report.json
    ├── quality_report.json
    ├── repair_report.json
    └── iterations/
        ├── attempt_00_auto_standard/
        │   ├── diagram.svg
        │   ├── diagram.png
        │   ├── quality_report.json
        │   ├── vlm_report.json
        │   └── attempt_report.json
        ├── planner_after_attempt_00/
        │   └── planner_report.json
        └── attempt_01_hierarchy_compact/
            ├── diagram.svg
            ├── diagram.png
            ├── quality_report.json
            ├── vlm_report.json
            └── attempt_report.json
```

The most important files are:

```text
final.svg
final.png
repair_report.json
```

`final.svg` is the final selected diagram.

`final.png` is the preview image used for visual inspection.

`repair_report.json` records which layout/detail settings were tried and which attempt was selected.

---

## Running Without Repair

For faster debugging, disable Qwen repair:

```powershell
python batch_render.py input_models output_diagrams --limit 1 --no-repair
```

This only renders the initial diagram and skips the VLM critique/repair loop.

---

## Rendering More Files

Render the first 5 files:

```powershell
python batch_render.py input_models output_diagrams --limit 5
```

Render a percentage of the input folder:

```powershell
python batch_render.py input_models output_diagrams --percent 10
```

Render all files:

```powershell
python batch_render.py input_models output_diagrams
```

Be careful when rendering all files with repair enabled. Qwen2.5-VL can be slow, especially on CPU.

---

## Important Notes

The input folder is currently expected to be:

```text
input_models/
```

The output folder is usually:

```text
output_diagrams/
```

`output_diagrams/` should not be committed to Git because it contains generated artifacts.

The repair loop does not edit the SysML v2 source files. It only changes render settings such as:

```text
layout = auto | hierarchy | grid | radial
detail = standard | compact | full
```

The visualizer server must be running at:

```text
http://127.0.0.1:8000
```

Ollama must be available at:

```text
http://127.0.0.1:11434
```

---

## Common Issues

### `ERR_CONNECTION_REFUSED`

This usually means the visualizer server is not running.

Start it in Terminal 1:

```powershell
python app.py
```

---

### Ollama connection error

Make sure Ollama is running:

```powershell
ollama serve
```

Also verify the model exists:

```powershell
ollama list
```

If needed, pull the model:

```powershell
ollama pull qwen2.5vl
```

---

### CUDA or GPU error from Ollama

Force CPU mode:

```powershell
$env:CUDA_VISIBLE_DEVICES="-1"
$env:OLLAMA_LLM_LIBRARY="cpu"
ollama serve
```

Then rerun the batch pipeline.

---

### `No module named tools`

Make sure the repository contains:

```text
tools/__init__.py
```

Then run commands from the repository root.

Use:

```powershell
python -m tools.layout_repair input_models\000001.sysml output_diagrams\000001_repair --model qwen2.5vl
```

instead of running `layout_repair.py` directly.
