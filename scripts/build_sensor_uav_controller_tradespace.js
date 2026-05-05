#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ANALYSIS_DIR = path.join(ROOT, "analysis");
const COMPONENT_FILE = path.join(ANALYSIS_DIR, "sensor_uav_controller_components.csv");
const ARCHITECTURE_FILE = path.join(ANALYSIS_DIR, "sensor_uav_controller_tradespace.csv");
const README_FILE = path.join(ANALYSIS_DIR, "sensor_uav_controller_tradespace_README.md");

const sensors = [
  {
    id: "sensor_lwir_thermal",
    type: "sensor",
    option_name: "LWIR thermal camera module",
    representative: "Teledyne FLIR Boson",
    source_keys: "flir_boson",
    primary_strength: "night/thermal contrast, low SWaP",
    sourced_specs:
      "LWIR; 640x512 or 320x256; 12 um pixel pitch; starts at 7.5 g and 600 mW; Boson+ sensitivity <=20 mK",
    payload_kg: 0.0075,
    power_w: 0.6,
    sensing_score: 72,
    mapping_score: 42,
    night_score: 96,
    weather_score: 72,
    privacy_score: 58,
    integration_complexity: 28,
    relative_cost_score: 78
  },
  {
    id: "sensor_lidar_3d",
    type: "sensor",
    option_name: "3D scanning lidar",
    representative: "Ouster OS1",
    source_keys: "ouster_os1",
    primary_strength: "3D geometry, SLAM, mapping",
    sourced_specs:
      "200 m max range; 45 deg vertical FOV; up to 128 channels; up to 5.2M points/s; 20 Hz max frame rate; IP68/IP69K",
    payload_kg: 0.45,
    power_w: 14,
    sensing_score: 92,
    mapping_score: 98,
    night_score: 88,
    weather_score: 86,
    privacy_score: 92,
    integration_complexity: 72,
    relative_cost_score: 42
  }
];

const uavs = [
  {
    id: "uav_multirotor_heavy_lift",
    type: "uav",
    option_name: "Heavy-lift multirotor",
    representative: "DJI Matrice 350 RTK",
    source_keys: "dji_matrice_350",
    primary_strength: "hover, precise inspection, payload ecosystem",
    sourced_specs:
      "55 min max flight time; 960 g single-gimbal max payload; 23 m/s max horizontal speed; 12 m/s wind resistance; IP55",
    endurance_min: 55,
    max_payload_kg: 0.96,
    speed_mps: 23,
    coverage_score: 70,
    hover_score: 98,
    payload_score: 88,
    weather_score: 86,
    launch_recovery_score: 94,
    integration_complexity: 48,
    relative_cost_score: 55
  },
  {
    id: "uav_vtol_fixed_wing",
    type: "uav",
    option_name: "VTOL fixed-wing mapper",
    representative: "WingtraOne GEN II",
    source_keys: "wingtraone_gen_ii",
    primary_strength: "large-area mapping, efficient survey operations",
    sourced_specs:
      "59 min max flight time; 800 g payload; 16 m/s flight speed; 12 m/s sustained wind; up to 310 ha RGB coverage or 360 ha lidar coverage",
    endurance_min: 59,
    max_payload_kg: 0.8,
    speed_mps: 16,
    coverage_score: 96,
    hover_score: 38,
    payload_score: 75,
    weather_score: 78,
    launch_recovery_score: 86,
    integration_complexity: 56,
    relative_cost_score: 50
  }
];

const controllers = [
  {
    id: "controller_pid",
    type: "controller",
    option_name: "PID controller",
    representative: "Classical PID feedback loop",
    source_keys: "ni_pid",
    primary_strength: "simple, mature, low-compute feedback control",
    sourced_specs:
      "NI describes PID as the most common industrial control algorithm, valued for robust performance and functional simplicity",
    autonomy_score: 62,
    constraints_score: 42,
    compute_efficiency_score: 94,
    maturity_score: 96,
    tuning_complexity: 38,
    integration_complexity: 24,
    relative_cost_score: 92
  },
  {
    id: "controller_mpc",
    type: "controller",
    option_name: "Model predictive controller",
    representative: "Constrained MPC",
    source_keys: "mathworks_mpc",
    primary_strength: "constraint-aware optimization over a prediction horizon",
    sourced_specs:
      "MathWorks describes MPC as predicting future outputs and solving a constrained optimization problem for manipulated-variable adjustments",
    autonomy_score: 88,
    constraints_score: 96,
    compute_efficiency_score: 52,
    maturity_score: 78,
    tuning_complexity: 76,
    integration_complexity: 68,
    relative_cost_score: 58
  }
];

const sourceNotes = {
  flir_boson:
    "Teledyne FLIR Boson product page: LWIR camera module, resolutions, SWaP, power, pixel pitch, sensitivity, radiometry.",
  ouster_os1:
    "Ouster OS1 product page: 200 m max range, 45 deg vertical FOV, 128 channels, 5.2M points/s, 20 Hz, IP68/IP69K.",
  dji_matrice_350:
    "DJI Matrice 350 RTK support specs: max flight time, payload, speed, wind resistance, IP rating, RTK accuracy.",
  wingtraone_gen_ii:
    "WingtraOne technical specifications: VTOL type, payload, flight time, wind resistance, coverage, accuracy, IP54.",
  ni_pid:
    "NI PID theory article: PID as common industrial control algorithm with simplicity and robust performance.",
  mathworks_mpc:
    "MathWorks control guidance: MPC predicts future outputs and solves constrained optimization problems."
};

function csvEscape(value) {
  const normalized = String(value ?? "");
  return /[",\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
}

function formatScore(value) {
  return Number.isFinite(value) ? value.toFixed(1) : "";
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function payloadMarginScore(uav, sensor) {
  return clamp(((uav.max_payload_kg - sensor.payload_kg) / uav.max_payload_kg) * 100);
}

function architectureScore(sensor, uav, controller) {
  const payloadMargin = payloadMarginScore(uav, sensor);
  const coverage = clamp(uav.coverage_score + sensor.mapping_score * 0.15 - sensor.integration_complexity * 0.08);
  const sensing = clamp(sensor.sensing_score * 0.58 + sensor.mapping_score * 0.22 + sensor.night_score * 0.2);
  const autonomy = clamp(controller.autonomy_score * 0.65 + controller.constraints_score * 0.25 + uav.hover_score * 0.1);
  const environmental = clamp((sensor.weather_score + uav.weather_score) / 2);
  const affordability = clamp(
    sensor.relative_cost_score * 0.35 + uav.relative_cost_score * 0.35 + controller.relative_cost_score * 0.3
  );
  const maturity = clamp(
    controller.maturity_score * 0.4 + affordability * 0.2 + payloadMargin * 0.2 + (100 - sensor.integration_complexity) * 0.2
  );
  const complexity = clamp(
    sensor.integration_complexity * 0.4 + uav.integration_complexity * 0.25 + controller.integration_complexity * 0.35
  );

  const weighted =
    coverage * 0.2 +
    sensing * 0.2 +
    autonomy * 0.18 +
    payloadMargin * 0.12 +
    environmental * 0.1 +
    affordability * 0.1 +
    maturity * 0.1 -
    complexity * 0.08;

  return {
    coverage,
    sensing,
    autonomy,
    payloadMargin,
    environmental,
    affordability,
    maturity,
    complexity,
    score: clamp(weighted)
  };
}

function recommendation(score) {
  if (score >= 78) return "frontier candidate";
  if (score >= 68) return "mission-fit candidate";
  if (score >= 58) return "viable with trade mitigation";
  return "low priority";
}

function buildComponentsCsv() {
  const rows = [...sensors, ...uavs, ...controllers];
  const headers = [
    "id",
    "type",
    "option_name",
    "representative",
    "primary_strength",
    "sourced_specs",
    "source_keys"
  ];
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))
  ].join("\n") + "\n";
}

function buildArchitectureRows() {
  const rows = [];
  let index = 1;
  for (const sensor of sensors) {
    for (const uav of uavs) {
      for (const controller of controllers) {
        const scores = architectureScore(sensor, uav, controller);
        rows.push({
          architecture_id: `arch_${String(index).padStart(2, "0")}`,
          sensor_id: sensor.id,
          sensor_type: sensor.option_name,
          uav_id: uav.id,
          uav_type: uav.option_name,
          controller_id: controller.id,
          controller_type: controller.option_name,
          representative_stack: `${sensor.representative} + ${uav.representative} + ${controller.representative}`,
          payload_margin_score: formatScore(scores.payloadMargin),
          coverage_score: formatScore(scores.coverage),
          sensing_score: formatScore(scores.sensing),
          autonomy_score: formatScore(scores.autonomy),
          environmental_score: formatScore(scores.environmental),
          affordability_score: formatScore(scores.affordability),
          maturity_score: formatScore(scores.maturity),
          integration_complexity: formatScore(scores.complexity),
          tradespace_score: formatScore(scores.score),
          recommendation: recommendation(scores.score),
          source_keys: [...new Set(`${sensor.source_keys};${uav.source_keys};${controller.source_keys}`.split(";"))].join(";")
        });
        index += 1;
      }
    }
  }
  return rows.sort((left, right) => Number(right.tradespace_score) - Number(left.tradespace_score));
}

function buildArchitectureCsv(rows) {
  const headers = [
    "architecture_id",
    "sensor_id",
    "sensor_type",
    "uav_id",
    "uav_type",
    "controller_id",
    "controller_type",
    "representative_stack",
    "payload_margin_score",
    "coverage_score",
    "sensing_score",
    "autonomy_score",
    "environmental_score",
    "affordability_score",
    "maturity_score",
    "integration_complexity",
    "tradespace_score",
    "recommendation",
    "source_keys"
  ];
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))
  ].join("\n") + "\n";
}

function buildReadme(rows) {
  const sourceLines = Object.entries(sourceNotes)
    .map(([key, note]) => `- \`${key}\`: ${note}`)
    .join("\n");
  const top = rows[0];

  return `# Sensor, UAV, and Controller Tradespace Dataset

Generated on 2026-04-29. This extension compares two sensor classes, two UAV classes, and two controller classes as an 8-alternative full-factorial tradespace.

## Files

- \`sensor_uav_controller_components.csv\`: component-level source facts and assumptions.
- \`sensor_uav_controller_tradespace.csv\`: all 2x2x2 architecture combinations with weighted scores.

## Alternatives

- Sensors: LWIR thermal camera module; 3D scanning lidar.
- UAVs: heavy-lift multirotor; VTOL fixed-wing mapper.
- Controllers: PID controller; model predictive controller.

## Scoring

\`tradespace_score\` is a normalized 0-100 decision-support score. Higher is better. Integration complexity is included as a penalty. The weighted factors are coverage, sensing, autonomy/constraint handling, payload margin, environmental fit, affordability, and maturity. Affordability, integration complexity, and several mission-fit values are ordinal engineering estimates derived from the representative source facts, not vendor-quoted prices.

Current top-ranked architecture: \`${top.architecture_id}\` with ${top.sensor_type}, ${top.uav_type}, and ${top.controller_type}; score ${top.tradespace_score}.

## Source Keys

${sourceLines}

## Direct Source URLs

- Teledyne FLIR Boson: https://oem.flir.com/en-150/products/boson/
- Ouster OS1: https://ouster.com/products/hardware/os1-lidar-sensor
- DJI Matrice 350 RTK specs: https://www.dji.com/support/product/matrice-350-rtk
- WingtraOne technical specifications: https://wingtra.com/mapping-drone-wingtraone/technical-specifications/
- NI PID theory: https://www.ni.com/en/shop/labview/pid-theory-explained.html
- MathWorks MPC/PID constraints guidance: https://www.mathworks.com/help/slcontrol/ug/improve-pid-to-handle-plant-constraints.html

## Caveats

This table is intended for early tradespace analysis. Replace ordinal scores with program-specific costs, payload interfaces, regulatory constraints, compute hardware limits, and mission performance simulations before source selection or procurement.
`;
}

function main() {
  fs.mkdirSync(ANALYSIS_DIR, { recursive: true });
  const architectureRows = buildArchitectureRows();
  fs.writeFileSync(COMPONENT_FILE, buildComponentsCsv(), "utf8");
  fs.writeFileSync(ARCHITECTURE_FILE, buildArchitectureCsv(architectureRows), "utf8");
  fs.writeFileSync(README_FILE, buildReadme(architectureRows), "utf8");
  console.log(`Wrote ${COMPONENT_FILE}`);
  console.log(`Wrote ${ARCHITECTURE_FILE}`);
  console.log(`Wrote ${README_FILE}`);
}

main();
