#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ANALYSIS_DIR = path.join(ROOT, "analysis");
const SIMILARITY_FILE = path.join(ANALYSIS_DIR, "model_similarity_scores.csv");
const READINESS_FILE = path.join(ANALYSIS_DIR, "simulation_readiness_scores.csv");
const OUTPUT_FILE = path.join(ANALYSIS_DIR, "tradespace_dataset.csv");
const SUMMARY_FILE = path.join(ANALYSIS_DIR, "tradespace_category_summary.csv");
const README_FILE = path.join(ANALYSIS_DIR, "tradespace_dataset_README.md");

const SOURCE_KEYS = [
  "local_model_similarity_scores",
  "local_simulation_readiness_scores",
  "omg_sysml_v2",
  "nasa_systems_engineering_handbook_trade_studies",
  "nasa_systems_modeling_handbook"
];

const SCORE_WEIGHTS = {
  readiness_percent: 0.35,
  similarity_percent: 0.25,
  l1_structural_score: 0.1,
  l2_behavioral_score: 0.1,
  l3_property_score: 0.1,
  observability_score: 0.05,
  repair_score: 0.05
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  const [headers, ...records] = rows;
  return records
    .filter((record) => record.some((value) => value !== ""))
    .map((record) =>
      Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""]))
    );
}

function csvEscape(value) {
  const normalized = String(value ?? "");
  return /[",\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
}

function toNumber(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : "";
}

function weightedScore(row) {
  let totalWeight = 0;
  let total = 0;

  for (const [field, weight] of Object.entries(SCORE_WEIGHTS)) {
    const value = toNumber(row[field]);
    if (value !== null) {
      total += value * weight;
      totalWeight += weight;
    }
  }

  return totalWeight > 0 ? total / totalWeight : null;
}

function recommendation(score, readiness, similarity, l2Behavior) {
  if (score === null) {
    return "insufficient data";
  }
  if (score >= 75 && readiness >= 70 && similarity >= 70) {
    return "frontier candidate";
  }
  if (score >= 60 && readiness >= 55) {
    return "promising with targeted maturation";
  }
  if (l2Behavior >= 65 || similarity >= 70) {
    return "specialized candidate";
  }
  if (score >= 45) {
    return "research or refactoring candidate";
  }
  return "low priority";
}

function main() {
  const similarityRows = parseCsv(fs.readFileSync(SIMILARITY_FILE, "utf8"));
  const readinessRows = parseCsv(fs.readFileSync(READINESS_FILE, "utf8"));
  const readinessByPath = new Map(readinessRows.map((row) => [row.sysml_path, row]));

  const rows = similarityRows.map((similarity) => {
    const readiness = readinessByPath.get(similarity.sysml_path) || {};
    const merged = { ...similarity, ...readiness };
    const score = weightedScore(merged);
    const readinessPercent = toNumber(merged.readiness_percent) ?? 0;
    const similarityPercent = toNumber(merged.similarity_percent) ?? 0;
    const l2Behavior = toNumber(merged.l2_behavioral_score) ?? 0;

    return {
      model_id: similarity.model_id,
      alternative_name: `sysml_model_${String(similarity.model_id).padStart(4, "0")}`,
      category: similarity.category || "unknown",
      split: similarity.split,
      quality: similarity.quality,
      sysml_path: similarity.sysml_path,
      source_text_path: similarity.txt_path,
      likert_score: similarity.likert_score,
      similarity_percent: similarity.similarity_percent,
      source_structure_score: similarity.structure_score,
      source_behavior_score: similarity.behavior_score,
      source_data_score: similarity.data_score,
      token_recall_percent: similarity.token_recall_percent,
      readiness_percent: readiness.readiness_percent,
      readiness_band: readiness.readiness_band,
      l1_structural_score: readiness.l1_structural_score,
      l2_behavioral_score: readiness.l2_behavioral_score,
      l3_property_score: readiness.l3_property_score,
      observability_score: readiness.observability_score,
      repair_score: readiness.repair_score,
      sequence_validity: readiness.sequence_validity,
      tradespace_score: formatNumber(score),
      recommendation: recommendation(score, readinessPercent, similarityPercent, l2Behavior),
      source_keys: SOURCE_KEYS.join(";")
    };
  });

  const headers = [
    "model_id",
    "alternative_name",
    "category",
    "split",
    "quality",
    "sysml_path",
    "source_text_path",
    "likert_score",
    "similarity_percent",
    "source_structure_score",
    "source_behavior_score",
    "source_data_score",
    "token_recall_percent",
    "readiness_percent",
    "readiness_band",
    "l1_structural_score",
    "l2_behavioral_score",
    "l3_property_score",
    "observability_score",
    "repair_score",
    "sequence_validity",
    "tradespace_score",
    "recommendation",
    "source_keys"
  ];

  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))
  ].join("\n");

  fs.writeFileSync(OUTPUT_FILE, `${csv}\n`, "utf8");
  fs.writeFileSync(SUMMARY_FILE, buildCategorySummary(rows), "utf8");
  fs.writeFileSync(README_FILE, buildReadme(rows), "utf8");

  console.log(`Wrote ${rows.length} alternatives to ${path.relative(process.cwd(), OUTPUT_FILE)}`);
  console.log(`Wrote category summary to ${path.relative(process.cwd(), SUMMARY_FILE)}`);
  console.log(`Wrote source notes to ${path.relative(process.cwd(), README_FILE)}`);
}

function buildCategorySummary(rows) {
  const groups = new Map();
  const metricFields = [
    "similarity_percent",
    "readiness_percent",
    "l1_structural_score",
    "l2_behavioral_score",
    "l3_property_score",
    "observability_score",
    "repair_score",
    "tradespace_score"
  ];

  for (const row of rows) {
    const category = row.category || "unknown";
    if (!groups.has(category)) {
      groups.set(category, {
        category,
        alternatives: 0,
        frontier_candidates: 0,
        promising_candidates: 0,
        sums: Object.fromEntries(metricFields.map((field) => [field, 0])),
        counts: Object.fromEntries(metricFields.map((field) => [field, 0]))
      });
    }

    const group = groups.get(category);
    group.alternatives += 1;
    if (row.recommendation === "frontier candidate") {
      group.frontier_candidates += 1;
    }
    if (row.recommendation === "promising with targeted maturation") {
      group.promising_candidates += 1;
    }

    for (const field of metricFields) {
      const value = toNumber(row[field]);
      if (value !== null) {
        group.sums[field] += value;
        group.counts[field] += 1;
      }
    }
  }

  const headers = [
    "category",
    "alternatives",
    "frontier_candidates",
    "promising_candidates",
    "avg_similarity_percent",
    "avg_readiness_percent",
    "avg_l1_structural_score",
    "avg_l2_behavioral_score",
    "avg_l3_property_score",
    "avg_observability_score",
    "avg_repair_score",
    "avg_tradespace_score"
  ];

  const rowsOut = [...groups.values()]
    .map((group) => ({
      category: group.category,
      alternatives: group.alternatives,
      frontier_candidates: group.frontier_candidates,
      promising_candidates: group.promising_candidates,
      avg_similarity_percent: average(group, "similarity_percent"),
      avg_readiness_percent: average(group, "readiness_percent"),
      avg_l1_structural_score: average(group, "l1_structural_score"),
      avg_l2_behavioral_score: average(group, "l2_behavioral_score"),
      avg_l3_property_score: average(group, "l3_property_score"),
      avg_observability_score: average(group, "observability_score"),
      avg_repair_score: average(group, "repair_score"),
      avg_tradespace_score: average(group, "tradespace_score")
    }))
    .sort((left, right) => Number(right.avg_tradespace_score) - Number(left.avg_tradespace_score));

  return [
    headers.join(","),
    ...rowsOut.map((row) => headers.map((header) => csvEscape(row[header])).join(","))
  ].join("\n") + "\n";
}

function average(group, field) {
  return group.counts[field] > 0 ? formatNumber(group.sums[field] / group.counts[field]) : "";
}

function buildReadme(rows) {
  const counts = rows.reduce((accumulator, row) => {
    accumulator[row.recommendation] = (accumulator[row.recommendation] || 0) + 1;
    return accumulator;
  }, {});

  const countLines = Object.entries(counts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, count]) => `- ${label}: ${count}`)
    .join("\n");

  return `# SysML Tradespace Dataset

Generated on 2026-04-29 from the local SysML model corpus and existing analysis outputs.

## Purpose

This dataset treats each SysML model as a candidate alternative for tradespace analysis. It combines source-text similarity, structural/behavioral/data coverage, simulation readiness, property-readiness, observability, and repairability into a single table that can be filtered, plotted, or fed to a weighted decision matrix.

## Files

- \`tradespace_dataset.csv\`: one row per model alternative.
- \`tradespace_category_summary.csv\`: category-level rollup for quick portfolio scans.
- \`model_similarity_scores.csv\`: local source-text alignment inputs.
- \`simulation_readiness_scores.csv\`: local simulation-readiness inputs.

## Composite Score

\`tradespace_score\` is a weighted score on a 0-100 scale:

- readiness_percent: ${SCORE_WEIGHTS.readiness_percent}
- similarity_percent: ${SCORE_WEIGHTS.similarity_percent}
- l1_structural_score: ${SCORE_WEIGHTS.l1_structural_score}
- l2_behavioral_score: ${SCORE_WEIGHTS.l2_behavioral_score}
- l3_property_score: ${SCORE_WEIGHTS.l3_property_score}
- observability_score: ${SCORE_WEIGHTS.observability_score}
- repair_score: ${SCORE_WEIGHTS.repair_score}

Blank criteria are ignored and remaining weights are renormalized for that row.

## Recommendation Bands

${countLines}

## Source Keys

- \`local_model_similarity_scores\`: \`sysml2-visualizer/analysis/model_similarity_scores.csv\`, generated by \`sysml2-visualizer/scripts/score_model_similarity.js\`.
- \`local_simulation_readiness_scores\`: \`sysml2-visualizer/analysis/simulation_readiness_scores.csv\`, generated by \`sysml2-visualizer/scripts/score_simulation_readiness.js\`.
- \`omg_sysml_v2\`: OMG describes SysML v2 as a systems modeling language for requirements, behavior, structure, analysis, verification, traceability, and API-backed interoperability. https://www.omg.org/sysml/sysmlv2/
- \`nasa_systems_engineering_handbook_trade_studies\`: NASA's Systems Engineering Handbook frames trade studies as evaluating alternative system designs against measures, cost, ranking criteria, uncertainty, and decision reporting. https://www.nasa.gov/seh/4-design-process and https://www.nasa.gov/reference/6-0-crosscutting-technical-management/
- \`nasa_systems_modeling_handbook\`: NASA-HDBK-1009A covers integrating SysML models with NASA SE processes and model-derived work products including MOEs, MOPs, TPMs, verification, and validation. https://standards.nasa.gov/standard/NASA/NASA-HDBK-1009

## Caveats

The dataset is a decision-support artifact, not an authoritative certification of model quality. The local similarity and readiness scores are heuristic outputs from this repository's scripts, so sensitivity analysis should be performed before making a final selection.
`;
}

main();
