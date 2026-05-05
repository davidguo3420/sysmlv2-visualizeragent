# ME VAL Analysis Integration Report

## Purpose

This report documents the difference between the prior analysis-tab behavior and the new analysis experience after integrating the `ME VAL Rules.xlsx` standard modeling workbook.

## Source Ruleset

- Workbook: `/Users/bsoeder/Library/CloudStorage/OneDrive-TheMITRECorporation/2026/ME VAL Rules.xlsx`
- Extracted snapshot: [analysis/me_val_rules_snapshot.json](/Users/bsoeder/vscode/sysml2/sysml2-visualizer/analysis/me_val_rules_snapshot.json)
- Browser data bundle: [static/me_val_rules_data.js](/Users/bsoeder/vscode/sysml2/sysml2-visualizer/static/me_val_rules_data.js)
- Extraction utility: [scripts/extract_me_val_rules.py](/Users/bsoeder/vscode/sysml2/sysml2-visualizer/scripts/extract_me_val_rules.py)

The workbook source contains `74` rules across `4` sheets. The active visualizer ruleset intentionally excludes the `ME Essential Modeling` sheet, leaving `38` rules across `3` sheets:

| Ruleset | Rules |
| --- | ---: |
| Standard Modeling | 25 |
| Optional | 8 |
| Executable | 5 |

## Before vs After

### Previous analysis tab

Before this change, the analysis tab focused on model-to-text and view-quality signals:

- Overall similarity to the companion TXT description
- Structural alignment
- Behavioral alignment
- Data/interface alignment
- Sequence-diagram validity

Those metrics remain in place.

### New analysis tab behavior

The analysis tab now adds a standards-compliance layer derived from the ME VAL workbook:

- `ME-VAL Checks` metric
- `Rule Coverage` metric
- `ME VAL Modeling Rules` summary card
- `ME VAL Coverage` summary card
- One analysis card per workbook sheet:
  - `Standard Modeling`
  - `Optional`
  - `Executable`

This means the tab now answers two distinct questions:

1. How similar is the model to its intended narrative?
2. How well does the model satisfy the standard modeling checks available from the ME VAL workbook?

## Current Implementation Coverage

The current visualizer/parser can evaluate `18` of the `38` active workbook rules:

- Supported rules: `18`
- Direct checks: `16`
- Approximate checks: `2`
- Unsupported rules: `20`

Coverage is reported separately from compliance so users can distinguish:

- a model that fails a supported rule
- a model that cannot yet be judged because the parser does not expose the needed concept

## Supported Rules by Category

### Direct checks

- `ACTIVITYEDGEINCOMING`
- `ACTIVITYNAME`
- `ACTORNAME`
- `BLOCKNAME`
- `CLASSPROHIBIT-EDIT`
- `CONSTRAINTSPECIFICATION`
- `CONTROLNODEINCOMING`
- `CONTROLNODEOUTGOING`
- `DECISIONNODENAME`
- `ENUMERATIONLITERAL`
- `FLOWFINALINCOMING`
- `MERGEJOINOUTGOING`
- `OPERATIONNAME`
- `PACKAGENAME`
- `SIGNALEVENTSIGNAL`
- `ACTPARTYPE`

### Approximate checks

- `MESSAGESIGNATURE`
- `MESSAGEFLOWNEEDED`

Approximate checks are surfaced explicitly in the analysis cards because they rely on inferred SysML2 structures rather than one-to-one parser objects.

## Workbook Coverage by Ruleset

Current per-ruleset support in the browser analysis engine:

| Ruleset | Total | Supported | Direct | Approximate | Unsupported |
| --- | ---: | ---: | ---: | ---: | ---: |
| Standard Modeling | 25 | 15 | 15 | 0 | 10 |
| Optional | 8 | 1 | 1 | 0 | 7 |
| Executable | 5 | 2 | 0 | 2 | 3 |

## Example Outcome on the bundled sample model

The current smoke-test evaluation of `sample_model.sysml` produced:

- Compliance score: `100.00%`
- Rule coverage: `47.37%`
- Passing supported rules: `12`
- Failing supported rules: `0`
- Not-applicable supported rules: `6`
- Unsupported rules: `20`

Per ruleset:

| Ruleset | Pass | Fail | Not Applicable | Unsupported | Score |
| --- | ---: | ---: | ---: | ---: | ---: |
| Standard Modeling | 10 | 0 | 5 | 10 | 100.00% |
| Optional | 0 | 0 | 1 | 7 | N/A |
| Executable | 2 | 0 | 0 | 3 | 100.00% |

## Key Differences Introduced by This Change

### What the user now sees

- A standards-based compliance view in addition to the narrative similarity scores
- Explicit distinction between `failing` and `unsupported` checks
- Ruleset-level rollups, not just a single aggregate number
- Rationale text that names failing rules or the strongest passing rules for each ruleset

### What the system now does

- Loads the selected workbook structure into a repo-local snapshot, excluding `ME Essential Modeling`
- Evaluates rules against parsed SysML2 text and derived diagram semantics
- Publishes ME VAL metrics and cards inside the existing analysis board
- Preserves the prior similarity, structure, behavior, data, and sequence-validity scoring

## Remaining Gaps

The unsupported portion of the workbook is mostly due to concepts the current parser does not yet model deeply enough, including:

- diagram ownership semantics inherited from legacy UML tooling conventions
- comments, rationale annotations, glossary terms, and other documentation-focused artifacts
- use-case and actor/use-case relationships
- richer state-machine ownership, submachine, and transition semantics
- signal typing and event semantics beyond the currently inferred activity/sequence views
- interface-block, proxy-port, and other specialization-heavy constructs
- MagicDraw-specific exceptions and imported-package provenance checks

## Bottom Line

Before this change, the analysis tab told users whether the SysML2 model looked similar to its intended description and whether the generated sequence diagram was internally credible.

After this change, the same tab also tells users how much of the ME VAL standard modeling ruleset can be inspected, which supported rules pass or fail, and where the current parser still lacks enough fidelity to grade the model against the full workbook.
