const svg = document.getElementById("diagram");
const titleEl = document.getElementById("view-title");
const summaryEl = document.getElementById("view-summary");
const modelTitleEl = document.getElementById("model-title");
const modelDescriptionEl = document.getElementById("model-description");
const modelTextEl = document.getElementById("model-text");
const modelFileEl = document.getElementById("model-file");
const loadTextButton = document.getElementById("load-text");
const resetModelButton = document.getElementById("reset-model");
const importStatusEl = document.getElementById("import-status");
const embeddedSysmlEl = document.getElementById("embedded-sysml");
const datasetPathEl = document.getElementById("dataset-path");
const datasetOptionsEl = document.getElementById("dataset-options");
const loadDatasetButton = document.getElementById("load-dataset");
const layoutSelectEl = document.getElementById("layout-select");
const scopeSelectEl = document.getElementById("scope-select");
const detailSelectEl = document.getElementById("detail-select");
const searchInputEl = document.getElementById("search-input");
const searchNextButton = document.getElementById("search-next");
const analysisStatusEl = document.getElementById("analysis-status");
const ov1EditorPanelEl = document.getElementById("ov1-editor-panel");
const ov1EditToggleEl = document.getElementById("ov1-edit-toggle");
const ov1ArrowToolEl = document.getElementById("ov1-arrow-tool");
const ov1SaveButtonEl = document.getElementById("ov1-save");
const ov1ResetButtonEl = document.getElementById("ov1-reset-edits");
const ov1EditorStatusEl = document.getElementById("ov1-editor-status");
const ov1PaletteEl = document.getElementById("ov1-palette");
const editorTitleEl = document.getElementById("editor-title");
const editorCopyEl = document.getElementById("editor-copy");
const editorPaletteLabelEl = document.getElementById("editor-palette-label");
const explorerFilterEl = document.getElementById("explorer-filter");
const explorerTreeEl = document.getElementById("explorer-tree");
const inspectorEl = document.getElementById("inspector");
const overviewSvg = document.getElementById("overview");
const analysisViewEl = document.getElementById("analysis-view");
const workbenchEl = document.getElementById("workbench");
const diagramPanelEl = document.getElementById("diagram-panel");
const canvasCardEl = document.getElementById("diagram-canvas-card");
const inspectorPanelEl = document.getElementById("inspector-panel");
const requirementsBoardEl = document.getElementById("requirements-board");
const requirementsSummaryEl = document.getElementById("requirements-summary");
const requirementsSearchEl = document.getElementById("requirements-search");
const requirementsClearEl = document.getElementById("requirements-clear");
const requirementsListCountEl = document.getElementById("requirements-list-count");
const requirementsListEl = document.getElementById("requirements-list");
const requirementsDetailEl = document.getElementById("requirements-detail");
const requirementsExplorerModalEl = document.getElementById("requirements-explorer-modal");
const requirementsExplorerModalCardEl = document.getElementById("requirements-explorer-modal-card");
const requirementsExplorerModalTitleEl = document.getElementById("requirements-explorer-modal-title");
const requirementsExplorerModalSubtitleEl = document.getElementById("requirements-explorer-modal-subtitle");
const requirementsExplorerModalContentEl = document.getElementById("requirements-explorer-modal-content");
const requirementsExplorerModalCloseEl = document.getElementById("requirements-explorer-modal-close");
const zoomInButton = document.getElementById("zoom-in");
const zoomOutButton = document.getElementById("zoom-out");
const fitViewButton = document.getElementById("fit-view");
const resetViewButton = document.getElementById("reset-view");
const exportSvgButton = document.getElementById("export-svg");
const buttons = [...document.querySelectorAll(".view-button")];
let model = null;
let sampleSource = "";
let sampleAnalysisPayload = null;

const NS = "http://www.w3.org/2000/svg";
const VIEWBOX_WIDTH = 1040;
const VIEWBOX_HEIGHT = 560;
const OVERVIEW_WIDTH = 260;
const OVERVIEW_HEIGHT = 180;
const OV1_CARD_WIDTH = 204;
const OV1_CARD_HEIGHT = 138;
const VISUALIZER_METADATA_TAG = "@sysml2-visualizer";
const ME_VAL_RULES_SNAPSHOT = window.ME_VAL_RULES_SNAPSHOT || { source_workbook: "", rule_count: 0, sheets: [] };
const state = {
  currentView: "ov1",
  layoutMode: "auto",
  scopeMode: "all",
  detailMode: "standard",
  selectedEntityId: null,
  catalog: [],
  renderEntities: [],
  renderLinks: [],
  currentBounds: { minX: 0, minY: 0, maxX: VIEWBOX_WIDTH, maxY: VIEWBOX_HEIGHT },
  transform: { scale: 1, x: 0, y: 0 },
  searchCursor: 0,
  datasetIndex: [],
  currentModelPath: "",
  currentSourceText: "",
  loadedSourceText: "",
  analysisPayload: null,
  requirementsModalId: "",
  isPanning: false,
  panOrigin: null,
  pendingFocusEntityId: null,
  visibleEntityIds: new Set(),
  matchIds: new Set(),
  contextIds: new Set(),
  ov1Editor: {
    enabled: false,
    tool: "move",
    paletteSelectionId: "",
    arrowSourceId: null,
    dragActorId: null,
    dragPointerId: null,
    dragOffset: null,
    dragMoved: false
  }
};
let drawingLayer = null;

function isTextFirstView(viewName) {
  return ["analysis", "simulation"].includes(viewName);
}

function isWorkspaceFirstView(viewName) {
  return viewName === "requirements";
}

function isEditableDiagramView(viewName) {
  return ["ov1", "bdd", "ibd"].includes(viewName);
}

function defaultCardSelectionId(viewName) {
  return (
    state.catalog.find((item) => item.view === viewName && item.id === `${viewName}:overall`)?.id ||
    state.catalog.find((item) => item.view === viewName)?.id ||
    null
  );
}

function defaultRequirementSelectionId() {
  return (
    state.catalog.find((item) => item.view === "requirements" && !item.id.includes("element:"))?.id ||
    state.catalog.find((item) => item.view === "requirements")?.id ||
    null
  );
}

function defaultSelectionIdForView(viewName) {
  if (viewName === "requirements") {
    return defaultRequirementSelectionId();
  }
  if (isTextFirstView(viewName)) {
    return defaultCardSelectionId(viewName);
  }
  return null;
}

function el(name, attrs = {}, text = "") {
  const node = document.createElementNS(NS, name);
  Object.entries(attrs).forEach(([key, value]) => {
    node.setAttribute(key, value);
  });
  if (text) {
    node.textContent = text;
  }
  return node;
}

function resetSvg() {
  svg.replaceChildren();
  const defs = el("defs");
  defs.append(
    marker("arrow", "#36536b"),
    marker("diamond", "#36536b", "diamond"),
    marker("triangle", "#36536b", "triangle")
  );
  svg.append(defs);
}

function marker(id, color, kind = "arrow") {
  let markerEl;
  if (kind === "diamond") {
    markerEl = el("marker", {
      id,
      markerWidth: 14,
      markerHeight: 10,
      refX: 11,
      refY: 5,
      orient: "auto",
      markerUnits: "strokeWidth"
    });
    markerEl.append(el("path", { d: "M 0 5 L 5 0 L 10 5 L 5 10 z", fill: color }));
    return markerEl;
  }
  if (kind === "triangle") {
    markerEl = el("marker", {
      id,
      markerWidth: 12,
      markerHeight: 10,
      refX: 10,
      refY: 5,
      orient: "auto",
      markerUnits: "strokeWidth"
    });
    markerEl.append(el("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: color }));
    return markerEl;
  }
  markerEl = el("marker", {
    id,
    markerWidth: 10,
    markerHeight: 10,
    refX: 8,
    refY: 5,
    orient: "auto",
    markerUnits: "strokeWidth"
  });
  markerEl.append(el("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: color }));
  return markerEl;
}

function ov1SkyGradient() {
  const gradient = el("linearGradient", { id: "ov1-sky-gradient", x1: "0%", y1: "0%", x2: "0%", y2: "100%" });
  gradient.append(
    el("stop", { offset: "0%", "stop-color": "#f6fbff" }),
    el("stop", { offset: "48%", "stop-color": "#d9ebf8" }),
    el("stop", { offset: "100%", "stop-color": "#eef5df" })
  );
  return gradient;
}

function addLabel(x, y, text, extra = {}) {
  (drawingLayer || svg).append(el("text", { x, y, "font-size": 14, fill: "#344456", ...extra }, text));
}

function actorColor(type) {
  return (
    {
      command: "#d7e9ff",
      air: "#d7f0ef",
      sea: "#dce7f8",
      civil: "#f7e7cb",
      consumer: "#fbe3dd"
    }[type] || "#eceff4"
  );
}

function humanize(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function titleFromIdentifier(identifier) {
  return humanize(identifier).trim();
}

function normalizeName(name) {
  return name.replace(/^['"]|['"]$/g, "").trim();
}

function stripComments(text) {
  return text.replace(/\/\/.*$/gm, "");
}

function extractBalancedBlock(source, startIndex) {
  let index = startIndex;
  let depth = 1;
  while (index < source.length && depth > 0) {
    const char = source[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
    }
    index += 1;
  }
  if (depth !== 0) {
    throw new Error("Unbalanced braces in SysML2 block.");
  }
  return source.slice(startIndex, index);
}

function extractBody(blockText) {
  const start = blockText.indexOf("{");
  return blockText.slice(start + 1, -1);
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function deepClone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function sanitizeIdentifier(value, fallback = "actor") {
  const normalized = String(value || "")
    .replace(/[^A-Za-z0-9_]+/g, " ")
    .trim()
    .replace(/\s+/g, "_");
  if (!normalized) {
    return fallback;
  }
  return normalized.replace(/^./, (char) => char.toLowerCase());
}

function stripVisualizerMetadataBlock(text) {
  return String(text || "").replace(new RegExp(`/\\*\\s*${VISUALIZER_METADATA_TAG}[\\s\\S]*?\\*/\\s*`, "m"), "").trimEnd();
}

function extractVisualizerMetadata(text) {
  const sourceText = String(text || "");
  const pattern = new RegExp(`/\\*\\s*${VISUALIZER_METADATA_TAG}\\s*([\\s\\S]*?)\\*/`, "m");
  const match = sourceText.match(pattern);
  if (!match) {
    return { cleanText: sourceText, metadata: {} };
  }
  let metadata = {};
  try {
    metadata = JSON.parse(match[1].trim());
  } catch {
    metadata = {};
  }
  return {
    cleanText: sourceText.replace(match[0], "").trimEnd(),
    metadata
  };
}

function serializeVisualizerMetadata(sourceText, metadata) {
  const baseSource = stripVisualizerMetadataBlock(sourceText);
  const payload = JSON.stringify(metadata, null, 2);
  const suffix = `\n\n/* ${VISUALIZER_METADATA_TAG}\n${payload}\n*/\n`;
  return `${baseSource}${suffix}`;
}

function buildOperationalComponentPool(definitions, operationalActors) {
  const actorComponents = operationalActors.map((actor) => ({
    id: actor.id,
    label: actor.label,
    type: actor.type,
    definitionType: actor.definitionType || actor.label,
    source: "view"
  }));
  const definitionComponents = definitions
    .filter((definition) => definition.kind === "part" && definition.name)
    .map((definition) => ({
      id: definition.id,
      label: titleFromIdentifier(definition.name),
      type: classifyOperationalType(definition.name),
      definitionType: definition.name,
      source: "definition"
    }));
  return uniqueBy([...actorComponents, ...definitionComponents], (component) => component.id);
}

function bddDefinitionPool(modelData) {
  return modelData.definitions.filter((definition) =>
    ["part", "item", "port", "attribute", "enum", "action", "calc"].includes(definition.kind)
  );
}

function bddBlockFromDefinition(definition, index = 0) {
  return {
    id: definition.id,
    name: definition.name,
    stereotype: `<<${definition.kind}>>`,
    definitionKind: definition.kind,
    properties: definition.attributes.length ? definition.attributes : definition.members.slice(0, 6),
    operations: definition.operations,
    ...gridPosition(index),
    width: 210
  };
}

function bddBlockHeight(block) {
  const propertyCount = (block.properties || []).length;
  const operationCount = state.detailMode === "compact" ? 0 : (block.operations || []).length;
  const visibleProperties = state.detailMode === "full" ? propertyCount : Math.min(propertyCount, state.detailMode === "compact" ? 2 : 4);
  const visibleOperations = state.detailMode === "full" ? operationCount : Math.min(operationCount, state.detailMode === "compact" ? 0 : 2);
  const hiddenProperties = Math.max(0, propertyCount - visibleProperties);
  const hiddenOperations = Math.max(0, operationCount - visibleOperations);
  return Math.max(118, 78 + visibleProperties * 18 + visibleOperations * 18 + (hiddenProperties || hiddenOperations ? 18 : 0));
}

function buildBddComponentPool(modelData) {
  return bddDefinitionPool(modelData).map((definition, index) => ({
    ...bddBlockFromDefinition(definition, index),
    paletteTitle: definition.name,
    paletteMeta: `<<${definition.kind}>> • ${(definition.attributes.length ? definition.attributes : definition.members).length || 0} members`
  }));
}

function buildIbdPartFromSource(part, definition, index = 0) {
  const column = index % 3;
  const row = Math.floor(index / 3);
  const shape = {
    x: 80 + column * 270,
    y: 70 + row * 170,
    width: 190,
    height: 100
  };
  const ports = (definition?.ports || []).slice(0, 6).map((port, portIndex) => {
    const portCycle = [
      { side: "right", offset: 30 },
      { side: "left", offset: 30 },
      { side: "bottom", offset: 70 },
      { side: "top", offset: 70 },
      { side: "right", offset: 70 },
      { side: "left", offset: 70 }
    ];
    const selected = portCycle[portIndex] || { side: "right", offset: 50 };
    return { id: `${part.name}.${port.name}`, name: port.name, side: selected.side, offset: selected.offset };
  });
  return {
    id: part.name,
    instanceName: part.name,
    typeName: part.type,
    name: `${part.name}: ${part.type}`,
    ...shape,
    ports
  };
}

function buildIbdComponentPool(modelData, contextPart = null) {
  const definitionLookup = new Map(modelData.definitions.map((definition) => [definition.name, definition]));
  const sourceParts = contextPart?.parts?.length
    ? contextPart.parts
    : modelData.definitions
        .filter((definition) => definition.kind === "part" && definition.name !== contextPart?.name)
        .slice(0, 12)
        .map((definition) => ({ name: definition.id, type: definition.name }));
  return sourceParts.map((part, index) => {
    const definition =
      definitionLookup.get(part.type) ||
      modelData.definitions.find((entry) => entry.id === part.name || entry.name === part.type) ||
      null;
    return {
      ...buildIbdPartFromSource(part, definition, index),
      paletteTitle: `${part.name}: ${part.type}`,
      paletteMeta: `${(definition?.ports || []).length || 0} ports`
    };
  });
}

function applyOv1Metadata(baseActors, baseFlows, componentPool, metadata) {
  const ov1Metadata = metadata?.ov1 || {};
  const componentLookup = Object.fromEntries(componentPool.map((component) => [component.id, component]));
  const actorMap = new Map(baseActors.map((actor) => [actor.id, { ...actor }]));

  (ov1Metadata.actors || []).forEach((entry) => {
    const component = componentLookup[entry.id] || {};
    actorMap.set(entry.id, {
      id: entry.id,
      label: entry.label || component.label || titleFromIdentifier(entry.id),
      type: entry.type || component.type || classifyOperationalType(entry.definitionType || entry.label || entry.id),
      definitionType: entry.definitionType || component.definitionType || entry.label || titleFromIdentifier(entry.id),
      x: Number.isFinite(entry.x) ? entry.x : component.x,
      y: Number.isFinite(entry.y) ? entry.y : component.y
    });
  });

  const flows = uniqueBy(
    [
      ...baseFlows.map((flow) => ({ ...flow })),
      ...(ov1Metadata.flows || []).map((flow) => ({
        from: flow.from,
        to: flow.to,
        label: flow.label || "interaction"
      }))
    ].filter((flow) => flow.from && flow.to),
    (flow) => `${flow.from}:${flow.to}:${flow.label || ""}`
  );

  return {
    actors: [...actorMap.values()],
    flows
  };
}

function applyBddMetadata(baseView, metadata) {
  const bddMetadata = metadata?.bdd || {};
  const blockLookup = new Map((baseView.componentPool || []).map((block) => [block.id, deepClone(block)]));
  const blocks = new Map(baseView.blocks.map((block) => [block.id, { ...block }]));

  (bddMetadata.blocks || []).forEach((entry) => {
    const baseBlock = blockLookup.get(entry.id) || blocks.get(entry.id);
    if (!baseBlock) {
      return;
    }
    blocks.set(entry.id, {
      ...baseBlock,
      x: Number.isFinite(entry.x) ? entry.x : baseBlock.x,
      y: Number.isFinite(entry.y) ? entry.y : baseBlock.y
    });
  });

  return {
    ...baseView,
    blocks: [...blocks.values()],
    relationships: uniqueBy(
      [
        ...baseView.relationships,
        ...((bddMetadata.relationships || []).map((relationship) => ({ ...relationship })))
      ],
      keyForRelationship
    )
  };
}

function applyIbdMetadata(baseView, metadata) {
  const ibdMetadata = metadata?.ibd || {};
  const partLookup = new Map((baseView.componentPool || []).map((part) => [part.id, deepClone(part)]));
  const parts = new Map(baseView.parts.map((part) => [part.id, { ...part }]));

  (ibdMetadata.parts || []).forEach((entry) => {
    const basePart = partLookup.get(entry.id) || parts.get(entry.id);
    if (!basePart) {
      return;
    }
    parts.set(entry.id, {
      ...basePart,
      x: Number.isFinite(entry.x) ? entry.x : basePart.x,
      y: Number.isFinite(entry.y) ? entry.y : basePart.y
    });
  });

  return {
    ...baseView,
    parts: [...parts.values()],
    connectors: uniqueBy(
      [
        ...baseView.connectors,
        ...((ibdMetadata.connectors || []).map((connector) => ({ ...connector })))
      ],
      keyForConnector
    )
  };
}

function buildVisualizerMetadataFromModel(nextModel) {
  return {
    version: 2,
    ov1: {
      actors: nextModel.views.ov1.actors.map((actor) => ({
        id: actor.id,
        label: actor.label,
        type: actor.type,
        definitionType: actor.definitionType || actor.label,
        x: Math.round(actor.x),
        y: Math.round(actor.y)
      })),
      flows: nextModel.views.ov1.flows.map((flow) => ({
        from: flow.from,
        to: flow.to,
        label: flow.label || "interaction"
      }))
    },
    bdd: {
      blocks: nextModel.views.bdd.blocks.map((block) => ({
        id: block.id,
        x: Math.round(block.x),
        y: Math.round(block.y)
      })),
      relationships: nextModel.views.bdd.relationships.map((relationship) => ({
        from: relationship.from,
        to: relationship.to,
        kind: relationship.kind || "association",
        label: relationship.label || ""
      }))
    },
    ibd: {
      parts: nextModel.views.ibd.parts.map((part) => ({
        id: part.id,
        x: Math.round(part.x),
        y: Math.round(part.y)
      })),
      connectors: nextModel.views.ibd.connectors.map((connector) => ({
        from: connector.from,
        to: connector.to,
        label: connector.label || ""
      }))
    }
  };
}

function appendStatementsToSource(sourceText, statements) {
  const cleanStatements = statements.map((statement) => String(statement || "").trim()).filter(Boolean);
  if (!cleanStatements.length) {
    return sourceText;
  }
  const hasPackageWrapper = /\bpackage\s+('[^']+'|"[^"]+"|[A-Za-z_][A-Za-z0-9_]*)\s*\{/.test(sourceText);
  const lastBrace = hasPackageWrapper ? sourceText.lastIndexOf("}") : -1;
  if (lastBrace === -1) {
    return `${sourceText.trimEnd()}\n\n${cleanStatements.join("\n")}\n`;
  }
  return `${sourceText.slice(0, lastBrace).trimEnd()}\n\n${cleanStatements.join("\n")}\n${sourceText.slice(lastBrace)}`;
}

function insertLinesIntoNamedBlock(sourceText, name, lines, keywords = ["part def", "item def", "port def", "enum def", "attribute def", "calc def", "part"]) {
  const cleanLines = lines.map((line) => String(line || "").trim()).filter(Boolean);
  if (!cleanLines.length) {
    return sourceText;
  }
  const block = captureNamedBlocks(sourceText, keywords).find((entry) => entry.name === name);
  if (!block) {
    return sourceText;
  }
  const insertAt = block.start + block.block.lastIndexOf("}");
  const blockBody = extractBody(block.block).trim();
  const insertion = `${blockBody ? "\n" : "\n"}${cleanLines.map((line) => `    ${line}`).join("\n")}\n`;
  return `${sourceText.slice(0, insertAt)}${insertion}${sourceText.slice(insertAt)}`;
}

function keyForFlow(flow) {
  return `${flow.from}:${flow.to}:${flow.label || ""}`;
}

function keyForRelationship(relationship) {
  return `${relationship.from}:${relationship.to}:${relationship.label || ""}:${relationship.kind || ""}`;
}

function keyForConnector(connector) {
  return `${connector.from}:${connector.to}:${connector.label || ""}`;
}

function applySemanticModelEdits(sourceText, nextModel) {
  const cleanSource = stripVisualizerMetadataBlock(sourceText);
  let workingSource = cleanSource;
  let baselineModel = null;

  try {
    baselineModel = parseModelText(cleanSource);
  } catch {
    return cleanSource;
  }

  const baselineTopLevelActors = new Set((baselineModel.sourceMeta?.topLevelParts || []).map((part) => part.id));
  const addedTopLevelActors = nextModel.views.ov1.actors
    .filter((actor) => !baselineTopLevelActors.has(actor.id) && actor.definitionType)
    .map((actor) => `part ${actor.id} : ${actor.definitionType};`);
  workingSource = appendStatementsToSource(workingSource, addedTopLevelActors);

  const baselineFlows = new Set((baselineModel.views.ov1.flows || []).map(keyForFlow));
  const addedFlows = nextModel.views.ov1.flows
    .filter((flow) => !baselineFlows.has(keyForFlow(flow)))
    .map((flow) => `flow ${flow.from} -> ${flow.to}${flow.label ? ` "${flow.label}"` : ""};`);
  workingSource = appendStatementsToSource(workingSource, addedFlows);

  const definitionById = new Map((nextModel.modelData?.definitions || []).map((definition) => [definition.id, definition]));
  const baselineRelationships = new Set((baselineModel.views.bdd.relationships || []).map(keyForRelationship));
  nextModel.views.bdd.relationships
    .filter((relationship) => !baselineRelationships.has(keyForRelationship(relationship)))
    .forEach((relationship) => {
      const sourceDefinition = definitionById.get(relationship.from);
      const targetDefinition = definitionById.get(relationship.to);
      if (!sourceDefinition || !targetDefinition) {
        return;
      }
      const memberName = sanitizeIdentifier(relationship.label || targetDefinition.name, "member");
      const statement =
        relationship.kind === "association"
          ? `port ${memberName} : ${targetDefinition.name};`
          : `part ${memberName} : ${targetDefinition.name};`;
      workingSource = insertLinesIntoNamedBlock(workingSource, sourceDefinition.name, [statement]);
    });

  const contextPartName = nextModel.views.ibd.frame?.contextName || baselineModel.views.ibd.frame?.contextName || "";
  const baselinePartIds = new Set((baselineModel.views.ibd.parts || []).map((part) => part.id));
  if (contextPartName) {
    nextModel.views.ibd.parts
      .filter((part) => !baselinePartIds.has(part.id) && part.typeName)
      .forEach((part) => {
        workingSource = insertLinesIntoNamedBlock(
          workingSource,
          contextPartName,
          [`part ${part.instanceName || part.id} : ${part.typeName};`],
          ["part def", "part"]
        );
      });
  }

  const baselineConnectors = new Set((baselineModel.views.ibd.connectors || []).map(keyForConnector));
  if (contextPartName) {
    nextModel.views.ibd.connectors
      .filter((connector) => !baselineConnectors.has(keyForConnector(connector)))
      .forEach((connector) => {
        workingSource = insertLinesIntoNamedBlock(
          workingSource,
          contextPartName,
          [`connect ${connector.from} -> ${connector.to}${connector.label ? ` "${connector.label}"` : ""};`],
          ["part def", "part"]
        );
      });
  }

  return workingSource;
}

function buildSourceTextWithVisualizerState(sourceText = state.currentSourceText || modelTextEl.value) {
  const semanticSource = applySemanticModelEdits(sourceText, model);
  return serializeVisualizerMetadata(semanticSource, buildVisualizerMetadataFromModel(model));
}

function positionOperationalActors(parts) {
  const columns = [80, 360, 650];
  const rows = [60, 210];
  return parts.map((part, index) => {
    const col = columns[index % columns.length];
    const row = rows[Math.floor(index / columns.length)] ?? 360;
    return { ...part, x: col, y: row };
  });
}

function classifyOperationalType(typeName) {
  const lower = typeName.toLowerCase();
  if (lower.includes("air")) return "air";
  if (lower.includes("sea") || lower.includes("ship")) return "sea";
  if (lower.includes("agency") || lower.includes("civil")) return "civil";
  if (lower.includes("population") || lower.includes("user")) return "consumer";
  if (lower.includes("display") || lower.includes("station")) return "consumer";
  return "command";
}

function operationalGraphicFamily(actor) {
  const text = `${actor.label || ""} ${actor.id || ""} ${actor.type || ""}`.toLowerCase();
  if (/(satellite|space|orbital)/.test(text)) return "satellite";
  if (/(air|aircraft|plane|flight|drone|uav|helicopter|helo|sortie|wing)/.test(text)) return "aircraft";
  if (/(ship|sea|maritime|vessel|boat|naval|sealift|port|harbor)/.test(text)) return "ship";
  if (/(truck|convoy|vehicle|ground|wheel|transport|cargo|logistics)/.test(text)) return "vehicle";
  if (/(sensor|probe|radar|detector|touch|camera|surveillance)/.test(text)) return "sensor";
  if (/(display|screen|console|dashboard|station|interface)/.test(text)) return "display";
  if (/(agency|relief|civil|ngo|medical|hospital|aid)/.test(text)) return "agency";
  if (/(population|people|citizen|user|customer|operator|community)/.test(text)) return "population";
  if (/(command|planner|hq|control|task force|coordination|mission)/.test(text)) return "command";
  if (/(processor|server|system|module|unit|cell|network)/.test(text)) return "system";
  if (actor.type === "air") return "aircraft";
  if (actor.type === "sea") return "ship";
  if (actor.type === "civil") return "agency";
  if (actor.type === "consumer") return "population";
  return "command";
}

function operationalPalette(family) {
  return {
    aircraft: { accent: "#2f6690", soft: "#dceef8", line: "#204a67", glow: "rgba(47, 102, 144, 0.16)" },
    ship: { accent: "#0b7285", soft: "#d7f1f4", line: "#155e75", glow: "rgba(11, 114, 133, 0.16)" },
    vehicle: { accent: "#5f6f52", soft: "#e7f0dc", line: "#4b5d3f", glow: "rgba(95, 111, 82, 0.16)" },
    agency: { accent: "#b26a00", soft: "#f8ecd4", line: "#8c5200", glow: "rgba(178, 106, 0, 0.15)" },
    population: { accent: "#a44a3f", soft: "#f8dfdb", line: "#873f36", glow: "rgba(164, 74, 63, 0.15)" },
    display: { accent: "#7b5ea7", soft: "#ece2f9", line: "#62468c", glow: "rgba(123, 94, 167, 0.14)" },
    sensor: { accent: "#0f766e", soft: "#d8f2ee", line: "#0c5d57", glow: "rgba(15, 118, 110, 0.15)" },
    satellite: { accent: "#495057", soft: "#e7eaef", line: "#343a40", glow: "rgba(73, 80, 87, 0.15)" },
    system: { accent: "#3f5c7a", soft: "#dce5ef", line: "#31485f", glow: "rgba(63, 92, 122, 0.15)" },
    command: { accent: "#7a3f98", soft: "#efdef8", line: "#5f3078", glow: "rgba(122, 63, 152, 0.15)" }
  }[family] || { accent: "#36536b", soft: "#e5edf2", line: "#2c4558", glow: "rgba(54, 83, 107, 0.15)" };
}

function operationalDomainBand(family) {
  if (family === "satellite") return "space";
  if (family === "aircraft") return "air";
  if (family === "ship") return "sea";
  if (["population", "agency", "vehicle"].includes(family)) return "ground";
  return "command";
}

function applyOperationalArtState(node, entityId) {
  node.setAttribute("pointer-events", "none");
  if (isMutedEntity(entityId)) {
    node.setAttribute("opacity", "0.34");
  } else {
    node.setAttribute("opacity", "1");
  }
}

function addOperationalBackdrop(view) {
  const families = new Set(view.actors.map((actor) => operationalGraphicFamily(actor)));
  addCanvasNode(
    el("rect", {
      x: 12,
      y: 12,
      width: 1016,
      height: 536,
      rx: 28,
      fill: "url(#ov1-sky-gradient)"
    })
  );
  addCanvasNode(
    el("path", {
      d: "M 16 340 C 140 300, 240 332, 364 300 C 460 276, 598 292, 726 260 C 842 232, 934 256, 1024 228 L 1024 548 L 16 548 Z",
      fill: "rgba(205, 228, 207, 0.84)"
    })
  );
  addCanvasNode(
    el("path", {
      d: "M 520 336 C 632 314, 752 348, 872 330 C 934 320, 986 326, 1024 312 L 1024 548 L 560 548 Z",
      fill: families.has("ship") ? "rgba(145, 202, 219, 0.84)" : "rgba(215, 233, 255, 0.38)"
    })
  );
  addCanvasNode(el("circle", { cx: 892, cy: 92, r: 34, fill: "rgba(255, 241, 187, 0.86)" }));
  [
    { x: 120, y: 88, scale: 1 },
    { x: 286, y: 62, scale: 0.78 },
    { x: 742, y: 118, scale: 0.88 }
  ].forEach((cloud) => {
    addCanvasNode(
      el("g", {
        transform: `translate(${cloud.x} ${cloud.y}) scale(${cloud.scale})`,
        fill: "rgba(255,255,255,0.72)"
      })
    ).append(
      el("circle", { cx: 0, cy: 14, r: 18 }),
      el("circle", { cx: 20, cy: 8, r: 22 }),
      el("circle", { cx: 42, cy: 15, r: 17 }),
      el("rect", { x: 0, y: 14, width: 42, height: 16, rx: 8 })
    );
  });

  const bandLabels = [
    ["space", "Space / Overwatch", 88, 54],
    ["air", "Air Domain", 76, 118],
    ["command", "Command and Control", 384, 92],
    ["ground", "Ground / Civil Interface", 68, 384],
    ["sea", "Maritime Domain", 704, 404]
  ];
  const activeBands = new Set([...families].map((family) => operationalDomainBand(family)));
  bandLabels.forEach(([band, label, x, y]) => {
    if (!activeBands.has(band)) {
      return;
    }
    const textNode = el("text", { x, y, "font-size": 16, fill: "rgba(20, 36, 51, 0.32)", "font-weight": 700 }, label);
    textNode.classList.add("label-shape");
    addCanvasNode(textNode);
  });
}

function makeOperationalIllustration(family, palette, frame) {
  const g = el("g", {
    transform: `translate(${frame.x} ${frame.y})`,
    fill: palette.accent,
    stroke: palette.line,
    "stroke-width": 2,
    "stroke-linecap": "round",
    "stroke-linejoin": "round"
  });
  if (family === "aircraft") {
    g.append(
      el("path", { d: "M 78 10 L 88 34 L 118 42 L 118 52 L 88 48 L 88 76 L 96 84 L 96 90 L 78 82 L 60 90 L 60 84 L 68 76 L 68 48 L 38 52 L 38 42 L 68 34 Z", fill: palette.soft }),
      el("line", { x1: 78, y1: 10, x2: 78, y2: 84 }),
      el("line", { x1: 48, y1: 46, x2: 108, y2: 46 }),
      el("line", { x1: 64, y1: 70, x2: 92, y2: 70 })
    );
  } else if (family === "ship") {
    g.append(
      el("path", { d: "M 22 62 L 118 62 L 102 82 L 42 82 Z", fill: palette.soft }),
      el("rect", { x: 58, y: 34, width: 26, height: 24, rx: 5, fill: palette.soft }),
      el("rect", { x: 68, y: 20, width: 6, height: 16, rx: 2, fill: palette.soft }),
      el("line", { x1: 28, y1: 88, x2: 112, y2: 88 }),
      el("path", { d: "M 30 94 Q 40 88 50 94 T 70 94 T 90 94 T 110 94", fill: "none" })
    );
  } else if (family === "vehicle") {
    g.append(
      el("rect", { x: 28, y: 40, width: 70, height: 28, rx: 8, fill: palette.soft }),
      el("path", { d: "M 98 46 L 114 46 L 126 58 L 126 68 L 98 68 Z", fill: palette.soft }),
      el("circle", { cx: 48, cy: 74, r: 10, fill: "#fff" }),
      el("circle", { cx: 110, cy: 74, r: 10, fill: "#fff" }),
      el("circle", { cx: 48, cy: 74, r: 4 }),
      el("circle", { cx: 110, cy: 74, r: 4 })
    );
  } else if (family === "population") {
    [
      { x: 48, y: 36, s: 1 },
      { x: 78, y: 28, s: 1.08 },
      { x: 108, y: 38, s: 0.96 }
    ].forEach((person) => {
      g.append(
        el("circle", { cx: person.x, cy: person.y, r: 10 * person.s, fill: palette.soft }),
        el("path", { d: `M ${person.x - 11 * person.s} ${person.y + 18 * person.s} Q ${person.x} ${person.y + 8 * person.s} ${person.x + 11 * person.s} ${person.y + 18 * person.s} L ${person.x + 8 * person.s} ${person.y + 42 * person.s} L ${person.x - 8 * person.s} ${person.y + 42 * person.s} Z`, fill: palette.soft })
      );
    });
  } else if (family === "agency") {
    g.append(
      el("path", { d: "M 24 38 L 78 16 L 132 38", fill: "none" }),
      el("rect", { x: 30, y: 38, width: 96, height: 44, rx: 6, fill: palette.soft }),
      el("line", { x1: 48, y1: 42, x2: 48, y2: 82 }),
      el("line", { x1: 68, y1: 42, x2: 68, y2: 82 }),
      el("line", { x1: 88, y1: 42, x2: 88, y2: 82 }),
      el("line", { x1: 108, y1: 42, x2: 108, y2: 82 })
    );
  } else if (family === "display") {
    g.append(
      el("rect", { x: 24, y: 18, width: 108, height: 64, rx: 12, fill: palette.soft }),
      el("line", { x1: 78, y1: 82, x2: 78, y2: 96 }),
      el("line", { x1: 52, y1: 96, x2: 104, y2: 96 }),
      el("line", { x1: 40, y1: 36, x2: 116, y2: 36 }),
      el("line", { x1: 40, y1: 50, x2: 102, y2: 50 }),
      el("line", { x1: 40, y1: 64, x2: 92, y2: 64 })
    );
  } else if (family === "sensor") {
    g.append(
      el("path", { d: "M 78 36 L 62 76 L 94 76 Z", fill: palette.soft }),
      el("line", { x1: 78, y1: 76, x2: 78, y2: 92 }),
      el("path", { d: "M 78 30 Q 102 38 112 60", fill: "none" }),
      el("path", { d: "M 78 22 Q 112 32 126 62", fill: "none" }),
      el("path", { d: "M 78 30 Q 54 38 44 60", fill: "none" }),
      el("path", { d: "M 78 22 Q 44 32 30 62", fill: "none" })
    );
  } else if (family === "satellite") {
    g.append(
      el("rect", { x: 62, y: 36, width: 32, height: 24, rx: 6, fill: palette.soft }),
      el("rect", { x: 26, y: 40, width: 28, height: 16, rx: 4, fill: palette.soft }),
      el("rect", { x: 102, y: 40, width: 28, height: 16, rx: 4, fill: palette.soft }),
      el("line", { x1: 54, y1: 48, x2: 62, y2: 48 }),
      el("line", { x1: 94, y1: 48, x2: 102, y2: 48 }),
      el("path", { d: "M 78 36 Q 92 24 104 24", fill: "none" }),
      el("path", { d: "M 78 36 Q 62 20 46 18", fill: "none" })
    );
  } else if (family === "system") {
    g.append(
      el("rect", { x: 42, y: 28, width: 72, height: 48, rx: 10, fill: palette.soft }),
      el("line", { x1: 58, y1: 18, x2: 58, y2: 28 }),
      el("line", { x1: 78, y1: 18, x2: 78, y2: 28 }),
      el("line", { x1: 98, y1: 18, x2: 98, y2: 28 }),
      el("line", { x1: 58, y1: 76, x2: 58, y2: 86 }),
      el("line", { x1: 78, y1: 76, x2: 78, y2: 86 }),
      el("line", { x1: 98, y1: 76, x2: 98, y2: 86 }),
      el("line", { x1: 54, y1: 44, x2: 102, y2: 44 }),
      el("line", { x1: 54, y1: 58, x2: 94, y2: 58 })
    );
  } else {
    g.append(
      el("path", { d: "M 78 16 L 124 44 L 124 76 L 78 96 L 32 76 L 32 44 Z", fill: palette.soft }),
      el("line", { x1: 78, y1: 16, x2: 78, y2: 96 }),
      el("line", { x1: 32, y1: 44, x2: 124, y2: 44 })
    );
  }
  return g;
}

function operationalFlowPath(fromActor, toActor, cardWidth, cardHeight) {
  const fromCenter = { x: fromActor.x + cardWidth / 2, y: fromActor.y + cardHeight / 2 };
  const toCenter = { x: toActor.x + cardWidth / 2, y: toActor.y + cardHeight / 2 };
  const startX = toCenter.x >= fromCenter.x ? fromActor.x + cardWidth : fromActor.x;
  const endX = toCenter.x >= fromCenter.x ? toActor.x : toActor.x + cardWidth;
  const startY = fromCenter.y;
  const endY = toCenter.y;
  const curvature = Math.max(56, Math.abs(endX - startX) * 0.35);
  return {
    d: `M ${startX} ${startY} C ${startX + (endX >= startX ? curvature : -curvature)} ${startY}, ${endX - (endX >= startX ? curvature : -curvature)} ${endY}, ${endX} ${endY}`,
    labelX: (startX + endX) / 2,
    labelY: (startY + endY) / 2 - 12
  };
}

function gridPosition(index) {
  const columns = 3;
  const column = index % columns;
  const row = Math.floor(index / columns);
  return {
    x: 55 + column * 290,
    y: 50 + row * 215
  };
}

function buildBDD(modelData) {
  const definitionPool = bddDefinitionPool(modelData);
  const componentPool = buildBddComponentPool(modelData);
  const blocks = componentPool.slice(0, 12).map((block) => ({ ...block }));

  const relationships = [];
  definitionPool.forEach((definition) => {
    definition.parts.forEach((part) => {
      const target = definitionPool.find((candidate) => candidate.name === part.type);
      if (target) {
        relationships.push({
          from: definition.id,
          to: target.id,
          kind: "composition",
          label: part.name
        });
      }
    });
    definition.ports.forEach((port) => {
      const target = definitionPool.find((candidate) => candidate.name === port.type);
      if (target) {
        relationships.push({
          from: definition.id,
          to: target.id,
          kind: "association",
          label: port.name
        });
      }
    });
  });

  return {
    title: "Block Definition Diagram",
    blocks,
    componentPool,
    relationships: uniqueBy(relationships, (rel) => `${rel.from}:${rel.to}:${rel.label}:${rel.kind}`)
  };
}

function chooseContextPart(modelData) {
  return (
    modelData.definitions.find((definition) => definition.kind === "part" && (definition.parts.length || definition.connectors.length)) ||
    modelData.definitions.find((definition) => definition.kind === "part" && definition.ports.length) ||
    null
  );
}

function buildIBD(modelData) {
  const contextPart = chooseContextPart(modelData);
  const componentPool = buildIbdComponentPool(modelData, contextPart);
  if (!contextPart) {
    const fallbackActors = modelData.operationalActors.length
      ? modelData.operationalActors
      : modelData.definitions.slice(0, 6).map((definition) => ({
          id: definition.id,
          label: titleFromIdentifier(definition.name),
          type: classifyOperationalType(definition.name)
        }));
    const fallbackParts = fallbackActors.slice(0, 6).map((actor, index) => ({
      id: actor.id,
      name: actor.label,
      x: 80 + (index % 3) * 270,
      y: 70 + Math.floor(index / 3) * 170,
      width: 190,
      height: 100,
      ports: [{ id: `${actor.id}.port`, name: "port", side: "right", offset: 50 }]
    }));
    return {
      title: "Internal Block Diagram",
      frame: { name: "System Context : System Context", contextName: "" },
      parts: fallbackParts,
      componentPool,
      connectors: fallbackParts.slice(0, -1).map((part, index) => ({
        from: `${part.id}.port`,
        to: `${fallbackParts[index + 1].id}.port`,
        label: modelData.flows[index]?.label || "interaction"
      }))
    };
  }

  const sourceParts = contextPart.parts.length
    ? contextPart.parts
    : modelData.definitions
        .filter((definition) => definition.name !== contextPart.name)
        .slice(0, 6)
        .map((definition) => ({ name: definition.id, type: definition.name }));

  const parts = sourceParts.map((part, index) => {
    const definition = modelData.definitions.find((entry) => entry.name === part.type || entry.id === part.name);
    return buildIbdPartFromSource(part, definition, index);
  });

  const connectors = contextPart.connectors.map((connector) => ({
    from: connector.from,
    to: connector.to,
    label: connector.label
  }));

  return {
    title: "Internal Block Diagram",
    frame: { name: `${contextPart.name} : ${contextPart.name}`, contextName: contextPart.name },
    parts,
    componentPool,
    connectors:
      contextPart.connectors.length > 0
        ? connectors
        : parts.slice(0, -1).map((part, index) => ({
            from: `${part.id}.${part.ports[0]?.name || "port"}`,
            to: `${parts[index + 1].id}.${parts[index + 1].ports[0]?.name || "port"}`,
            label: "interaction"
          }))
  };
}

function tokenizeIdentifier(value) {
  return humanize(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token && !["action", "activity", "system", "workflow", "step", "task"].includes(token));
}

function displayType(typeName) {
  return (typeName || "").replace(/\s+/g, " ").trim();
}

function mergePinCollections(basePins = [], overridePins = []) {
  const pinMap = new Map(basePins.map((pin) => [pin.name, { ...pin }]));
  overridePins.forEach((pin) => {
    const existing = pinMap.get(pin.name) || {};
    pinMap.set(pin.name, {
      ...existing,
      ...pin,
      type: pin.type || existing.type || "",
      binding: pin.binding || existing.binding || ""
    });
  });
  return [...pinMap.values()];
}

function buildActivityActorCandidates(modelData) {
  const definitionByName = new Map(modelData.definitions.map((definition) => [definition.name, definition]));
  const contextPart = chooseContextPart(modelData);
  const candidates = (contextPart?.parts?.length
    ? contextPart.parts
    : modelData.operationalActors.slice(0, 6).map((actor) => ({
        name: actor.id,
        type: actor.definitionType || actor.label || actor.id
      })))
    .map((part) => {
      const definition =
        definitionByName.get(part.type) ||
        modelData.definitions.find((entry) => entry.id === part.name || entry.name === part.type) ||
        null;
      const portTypes = uniqueBy(
        [
          ...(definition?.pins || []).map((pin) => displayType(pin.type)),
          ...(definition?.ports || []).flatMap((port) => {
            const portDefinition = definitionByName.get(port.type);
            return [
              displayType(port.type),
              ...((portDefinition?.pins || []).map((pin) => displayType(pin.type)))
            ];
          })
        ].filter(Boolean),
        (value) => value
      );
      const behaviorNames = uniqueBy(
        [
          ...(definition?.localActionDefinitions || []),
          ...(definition?.performedActions || []).flatMap((action) => [action.alias, action.target])
        ].filter(Boolean),
        (value) => value
      );
      return {
        id: part.name,
        type: part.type,
        label: part.name === part.type ? titleFromIdentifier(part.name) : `${titleFromIdentifier(part.name)}: ${titleFromIdentifier(part.type)}`,
        definition,
        portTypes,
        behaviorNames
      };
    });
  return candidates.length ? candidates : [{ id: "System", type: "System", label: "System", definition: null, portTypes: [], behaviorNames: [] }];
}

function inferActivityOwners(modelData, nodes, signatureMap) {
  const candidates = buildActivityActorCandidates(modelData);
  const ownerByNode = new Map();

  nodes.forEach((node) => {
    if (node.kind !== "action") {
      return;
    }
    const signature = signatureMap.get(node.actionType) || { inputs: [], outputs: [] };
    const flowTypes = uniqueBy(
      [...mergePinCollections(signature.inputs, node.inputs), ...mergePinCollections(signature.outputs, node.outputs)]
        .map((pin) => displayType(pin.type))
        .filter(Boolean),
      (value) => value
    );
    const nodeTokens = new Set([...tokenizeIdentifier(node.id), ...tokenizeIdentifier(node.actionType)]);
    let bestCandidate = null;
    let bestScore = 0;

    candidates.forEach((candidate) => {
      let score = 0;
      const candidateTokens = new Set([
        ...tokenizeIdentifier(candidate.id),
        ...tokenizeIdentifier(candidate.type),
        ...candidate.behaviorNames.flatMap((name) => tokenizeIdentifier(name))
      ]);
      if (candidate.behaviorNames.includes(node.actionType) || candidate.behaviorNames.includes(node.id)) {
        score += 10;
      }
      score += [...nodeTokens].filter((token) => candidateTokens.has(token)).length * 2;
      score += flowTypes.filter((typeName) => candidate.portTypes.includes(typeName)).length * 3;
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = candidate;
      }
    });

    ownerByNode.set(node.id, bestScore >= 3 ? bestCandidate?.label || "System" : "System");
  });

  return ownerByNode;
}

function buildActivity(modelData, activityBlock, activityBlocks = []) {
  if (!activityBlock) {
    throw new Error("An 'action def ... { ... }' activity block is required to render the activity diagram.");
  }

  const signatureMap = new Map(
    activityBlocks.map((block) => [
      block.name,
      {
        inputs: block.inputs || [],
        outputs: block.outputs || []
      }
    ])
  );

  const nodes = activityBlock.nodes.map((node, index) => {
    const signature = signatureMap.get(node.actionType || node.id) || { inputs: [], outputs: [] };
    const inputs = mergePinCollections(signature.inputs, node.inputs || []);
    const outputs = mergePinCollections(signature.outputs, node.outputs || []);
    return {
      id: node.id,
      kind: node.kind,
      actionType: node.actionType || node.id,
      label: titleFromIdentifier(node.id),
      subtitle:
        node.kind === "accept"
          ? titleFromIdentifier(node.eventType || "")
          : node.actionType && node.actionType !== node.id
            ? titleFromIdentifier(node.actionType)
            : "",
      inputs,
      outputs,
      eventType: node.eventType || "",
      order: index
    };
  });

  const ownerByNode = inferActivityOwners(modelData, nodes, signatureMap);
  nodes.forEach((node) => {
    if (ownerByNode.has(node.id)) {
      node.performer = ownerByNode.get(node.id);
    }
  });

  const incoming = new Map();
  const outgoing = new Map();
  activityBlock.flows.forEach((flow) => {
    incoming.set(flow.to, [...(incoming.get(flow.to) || []), flow.from]);
    outgoing.set(flow.from, [...(outgoing.get(flow.from) || []), flow.to]);
  });

  const nodeById = Object.fromEntries(nodes.map((node) => [node.id, node]));
  nodes.forEach((node) => {
    if (node.performer) {
      return;
    }
    if (node.kind === "accept") {
      node.performer = "External";
      return;
    }
    const incomingOwner = (incoming.get(node.id) || []).map((id) => nodeById[id]?.performer).find(Boolean);
    const outgoingOwner = (outgoing.get(node.id) || []).map((id) => nodeById[id]?.performer).find(Boolean);
    node.performer = incomingOwner || outgoingOwner || "System";
  });

  const laneIds = uniqueBy(nodes.map((node) => node.performer || "System"), (value) => value);
  const laneWidth = 220;
  const laneGap = 24;
  const laneStartX = 60;
  const laneHeaderHeight = 44;

  const indexByNode = Object.fromEntries(nodes.map((node, index) => [node.id, index]));
  const levelByNode = new Map(nodes.map((node) => [node.id, 0]));
  for (let iteration = 0; iteration < nodes.length; iteration += 1) {
    activityBlock.flows.forEach((flow) => {
      if (indexByNode[flow.from] >= indexByNode[flow.to]) {
        return;
      }
      const candidateLevel = (levelByNode.get(flow.from) || 0) + 1;
      if (candidateLevel > (levelByNode.get(flow.to) || 0)) {
        levelByNode.set(flow.to, candidateLevel);
      }
    });
  }

  const lanes = laneIds.map((laneId, index) => ({
    id: laneId,
    label: laneId,
    x: laneStartX + index * (laneWidth + laneGap),
    width: laneWidth,
    headerHeight: laneHeaderHeight
  }));
  const laneLookup = Object.fromEntries(lanes.map((lane) => [lane.id, lane]));

  nodes.forEach((node) => {
    if (node.kind === "start" || node.kind === "end") {
      node.width = 36;
      node.height = 36;
    } else if (node.kind === "decision" || node.kind === "merge") {
      node.width = 112;
      node.height = 84;
    } else if (node.kind === "fork" || node.kind === "join") {
      node.width = 124;
      node.height = 14;
    } else if (node.kind === "accept") {
      node.width = 150;
      node.height = 52;
    } else {
      node.width = 178;
      node.height = 60;
    }
    const lane = laneLookup[node.performer] || lanes[0];
    node.x = lane.x + lane.width / 2;
    node.y = 108 + (levelByNode.get(node.id) || 0) * 118;
  });

  const edgeMap = new Map();
  const ensureEdge = (from, to) => {
    const key = `${from}:${to}`;
    if (!edgeMap.has(key)) {
      edgeMap.set(key, { from, to, controlLabels: [], dataLabels: [] });
    }
    return edgeMap.get(key);
  };

  activityBlock.flows.forEach((flow) => {
    if (!nodeById[flow.from] || !nodeById[flow.to]) {
      return;
    }
    const edge = ensureEdge(flow.from, flow.to);
    if (flow.label) {
      edge.controlLabels.push(flow.label);
    }
  });

  nodes.forEach((node) => {
    node.inputs.forEach((input) => {
      const binding = input.binding || "";
      const sourceMatch = binding.match(/^([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)$/);
      if (!sourceMatch || !nodeById[sourceMatch[1]]) {
        return;
      }
      const sourceNode = nodeById[sourceMatch[1]];
      const sourceOutput = sourceNode.outputs.find((output) => output.name === sourceMatch[2]);
      const edge = ensureEdge(sourceMatch[1], node.id);
      const typeName = displayType(input.type || sourceOutput?.type || "");
      edge.dataLabels.push(typeName ? `${input.name}: ${typeName}` : input.name);
    });
  });

  const edges = [...edgeMap.values()].map((edge) => {
    const dataLabel = uniqueBy(edge.dataLabels, (value) => value).join(" • ");
    const controlLabel = uniqueBy(edge.controlLabels, (value) => value).join(" / ");
    return {
      from: edge.from,
      to: edge.to,
      controlLabel,
      dataLabel,
      label: [dataLabel, controlLabel].filter(Boolean).join(" | ")
    };
  });

  return {
    title: `${titleFromIdentifier(activityBlock.name)} Activity`,
    lanes,
    nodes,
    inputs: activityBlock.inputs || [],
    outputs: activityBlock.outputs || [],
    edges
  };
}

function buildSequence(activityView) {
  const actionableKinds = new Set(["action", "accept"]);
  const participantWidth = 170;
  const participantGap = 70;
  const participantStartX = 110;
  const sequenceTopY = 154;
  const messageGap = 76;
  const activationWidth = 18;

  const participantLabels = uniqueBy(
    activityView.lanes.map((lane) => lane.label).filter(Boolean),
    (value) => value
  );
  const participants = participantLabels.map((label, index) => ({
    id: label,
    label,
    x: participantStartX + index * (participantWidth + participantGap),
    width: participantWidth
  }));
  const participantLookup = Object.fromEntries(participants.map((participant) => [participant.id, participant]));

  const actionableNodes = activityView.nodes.filter((node) => actionableKinds.has(node.kind));
  const executions = actionableNodes.map((node, index) => {
    const participant = participantLookup[node.performer] || participants[0] || { x: participantStartX, width: participantWidth };
    return {
      id: `execution:${node.id}`,
      nodeId: node.id,
      participant: node.performer,
      label: node.label,
      subtitle: node.subtitle || "",
      x: participant.x + participant.width / 2 - activationWidth / 2,
      y: sequenceTopY + index * messageGap - 22,
      width: activationWidth,
      height: node.kind === "accept" ? 46 : 54,
      order: node.order
    };
  });
  const executionLookup = Object.fromEntries(executions.map((execution) => [execution.nodeId, execution]));
  const nodeLookup = Object.fromEntries(activityView.nodes.map((node) => [node.id, node]));

  const messageMap = new Map();
  activityView.edges.forEach((edge, index) => {
    const fromNode = nodeLookup[edge.from];
    const toNode = nodeLookup[edge.to];
    if (!fromNode || !toNode) {
      return;
    }
    if (!actionableKinds.has(fromNode.kind) && !actionableKinds.has(toNode.kind)) {
      return;
    }
    const fromParticipant = fromNode.performer || "System";
    const toParticipant = toNode.performer || "System";
    const execution = executionLookup[toNode.id] || executionLookup[fromNode.id];
    const y = execution ? execution.y + execution.height / 2 - 8 : sequenceTopY + index * messageGap;
    const key = `${fromParticipant}:${toParticipant}:${toNode.id}:${Math.round(y)}`;
    if (!messageMap.has(key)) {
      messageMap.set(key, {
        id: `message:${messageMap.size + 1}`,
        from: fromParticipant,
        to: toParticipant,
        targetNodeId: toNode.id,
        y,
        labels: []
      });
    }
    const message = messageMap.get(key);
    const label = edge.label || edge.dataLabel || edge.controlLabel || toNode.label;
    if (label) {
      message.labels.push(label);
    }
  });

  const messages = [...messageMap.values()].map((message, index) => ({
    ...message,
    id: `message:${index + 1}`,
    label: uniqueBy(message.labels.filter(Boolean), (value) => value).join(" | ")
  }));

  return {
    title: activityView.title.replace(/ Activity$/, " Sequence"),
    participants,
    executions,
    messages
  };
}

function normalizeRequirementId(value) {
  return normalizeName(String(value || "").replace(/^<|>$/g, "").trim());
}

function requirementRecordId(kind, name, requirementId = "", parentName = "") {
  const basis = requirementId || (parentName ? `${parentName}_${name}` : name) || kind;
  return `${kind}:${sanitizeIdentifier(basis, kind)}`;
}

function parseRequirementHeader(headerText) {
  const header = String(headerText || "").trim();
  let match = header.match(
    /^requirement\s+def\s+(?:<\s*([^>]+)\s*>\s+)?('[^']+'|"[^"]+"|[A-Za-z_][A-Za-z0-9_]*)(?:\s*:\>\s*([^{}\n]+))?$/i
  );
  if (match) {
    return {
      kind: "definition",
      requirementId: normalizeRequirementId(match[1]),
      name: normalizeName(match[2]),
      baseType: cleanType(match[3] || "")
    };
  }
  match = header.match(
    /^requirement\s+(?:<\s*([^>]+)\s*>\s+)?('[^']+'|"[^"]+"|[A-Za-z_][A-Za-z0-9_]*)(?:\s*:\s*([^{}\n]+))?$/i
  );
  if (match) {
    return {
      kind: "requirement",
      requirementId: normalizeRequirementId(match[1]),
      name: normalizeName(match[2]),
      typeName: cleanType(match[3] || "")
    };
  }
  return null;
}

function normalizeTraceKind(kind) {
  const lower = String(kind || "").toLowerCase();
  if (lower.startsWith("refine")) {
    return "refine";
  }
  if (lower.startsWith("derive")) {
    return "derive";
  }
  if (lower.startsWith("verify")) {
    return "verify";
  }
  if (lower.startsWith("trace")) {
    return "trace";
  }
  return lower;
}

function normalizeMultilineText(value) {
  return String(value || "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line, index, lines) => line || (index > 0 && index < lines.length - 1))
    .join("\n")
    .trim();
}

function captureConstraintBodies(source) {
  const text = String(source || "");
  const pattern = /\brequire\s+constraint\s*\{/g;
  const blocks = [];
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const braceIndex = text.indexOf("{", match.index);
    const block = text.slice(match.index, braceIndex + 1) + extractBalancedBlock(text, braceIndex + 1);
    blocks.push(block.trim());
    pattern.lastIndex = braceIndex + 1;
  }
  return blocks;
}

function parseRequirementStatementSource(sourceText, parentName = "") {
  const source = String(sourceText || "");
  const statements = [];

  parseMembers(
    source,
    /\brequirement\s+def\s+(?:<\s*([^>]+)\s*>\s+)?('[^']+'|"[^"]+"|[A-Za-z_][A-Za-z0-9_]*)(?:\s*:\>\s*([^;{\n]+))?\s*;/g,
    (entry) => {
      const name = normalizeName(entry[2]);
      statements.push({
        id: requirementRecordId("definition", name, normalizeRequirementId(entry[1]), parentName),
        kind: "definition",
        name,
        requirementId: normalizeRequirementId(entry[1]),
        typeName: "",
        baseType: cleanType(entry[3] || ""),
        parentName,
        description: "",
        requirementText: "",
        subjectName: "",
        subjectType: "",
        constraintCount: 0,
        requiredTargets: [],
        traceLinks: [],
        satisfyBy: [],
        constraintTexts: [],
        rawText: normalizeMultilineText(entry[0])
      });
      return entry[2];
    }
  );

  parseMembers(
    source,
    /\brequirement\s+(?!def\b)(?:<\s*([^>]+)\s*>\s+)?('[^']+'|"[^"]+"|[A-Za-z_][A-Za-z0-9_]*)(?:\s*:\s*([^;{\n]+))?\s*;/g,
    (entry) => {
      const name = normalizeName(entry[2]);
      statements.push({
        id: requirementRecordId("requirement", name, normalizeRequirementId(entry[1]), parentName),
        kind: "requirement",
        name,
        requirementId: normalizeRequirementId(entry[1]),
        typeName: cleanType(entry[3] || ""),
        baseType: "",
        parentName,
        description: "",
        requirementText: "",
        subjectName: "",
        subjectType: "",
        constraintCount: 0,
        requiredTargets: [],
        traceLinks: [],
        satisfyBy: [],
        constraintTexts: [],
        rawText: normalizeMultilineText(entry[0])
      });
      return entry[2];
    }
  );

  return uniqueBy(statements, (statement) => statement.id);
}

function parseRequirementBody(body, requirementName = "") {
  const docMatch = body.match(/\bdoc\s+(?:\/\*([\s\S]*?)\*\/|"([^"]+)")/);
  const subjectMatch = body.match(/\bsubject\s+([A-Za-z_][A-Za-z0-9_.]*)(?:\s*:\s*([^;{\n]+))?\s*;/);
  const constraintTexts = captureConstraintBodies(body).map((block) => normalizeMultilineText(block));
  const constraintCount = constraintTexts.length;
  const childRequirements = [];
  const requiredTargets = [];

  parseMembers(
    body,
    /\brequire(?:ment)?\s+(?!constraint\b)(?:<\s*([^>]+)\s*>\s+)?([A-Za-z_][A-Za-z0-9_.]*)(?:\s*:\s*([^;{\n]+))?\s*;/g,
    (entry) => {
      const targetName = normalizeName(entry[2]);
      const typeName = cleanType(entry[3] || "");
      if (typeName || !targetName.includes(".")) {
        childRequirements.push({
          id: requirementRecordId("requirement", targetName, normalizeRequirementId(entry[1]), requirementName),
          kind: "requirement",
          name: targetName,
          requirementId: normalizeRequirementId(entry[1]),
          typeName,
          baseType: "",
          parentName: requirementName,
          description: "",
          requirementText: "",
          subjectName: "",
          subjectType: "",
          constraintCount: 0,
          requiredTargets: [],
          traceLinks: [],
          satisfyBy: [],
          constraintTexts: [],
          rawText: normalizeMultilineText(entry[0])
        });
      } else {
        requiredTargets.push({
          kind: "require",
          target: targetName,
          typeName
        });
      }
      return entry[2];
    }
  );

  const traceLinks = parseMembers(
    body,
    /\b(refine|refines|derive|derives|verify|verifies|trace|traces)\s+([A-Za-z_][A-Za-z0-9_]*)\s*;/g,
    (entry) => ({
      kind: normalizeTraceKind(entry[1]),
      target: normalizeName(entry[2])
    })
  );

  const satisfyBy = parseMembers(
    body,
    /\bsatisfy\s+by\s+([A-Za-z_][A-Za-z0-9_.]*)\s*;/g,
    (entry) => normalizeName(entry[1])
  );

  return {
    description: (docMatch?.[1] || docMatch?.[2] || "").replace(/\s+/g, " ").trim(),
    requirementText: normalizeMultilineText(docMatch?.[1] || docMatch?.[2] || ""),
    subjectName: normalizeName(subjectMatch?.[1] || ""),
    subjectType: cleanType(subjectMatch?.[2] || ""),
    constraintCount,
    requiredTargets: uniqueBy(requiredTargets, (entry) => `${entry.kind}:${entry.target}:${entry.typeName || ""}`),
    traceLinks: uniqueBy(traceLinks, (entry) => `${entry.kind}:${entry.target}`),
    satisfyBy: uniqueBy(satisfyBy, (entry) => entry),
    constraintTexts,
    childRequirements
  };
}

function parseRequirementBlocks(source) {
  const pattern =
    /\brequirement\s+(?:def\s+)?(?:<\s*[^>\n]+\s*>\s+)?(?:'[^']+'|"[^"]+"|[A-Za-z_][A-Za-z0-9_]*)(?:\s*:\s*(?:>|)?\s*[^;{\n]+)?\s*\{/g;
  const blocks = [];
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const braceIndex = source.indexOf("{", match.index);
    const header = source.slice(match.index, braceIndex).trim();
    const parsedHeader = parseRequirementHeader(header);
    if (!parsedHeader) {
      continue;
    }
    const block = source.slice(match.index, braceIndex + 1) + extractBalancedBlock(source, braceIndex + 1);
    blocks.push({
      ...parsedHeader,
      block,
      header,
      body: extractBody(block),
      start: match.index
    });
    pattern.lastIndex = braceIndex + 1;
  }
  return blocks;
}

function parseTopLevelRequirementRelations(source) {
  return uniqueBy(
    [
      ...parseMembers(
        source,
        /\bsatisfy\s+([A-Za-z_][A-Za-z0-9_]*)\s+by\s+([A-Za-z_][A-Za-z0-9_.]*)\s*;/g,
        (entry) => ({
          kind: "satisfy",
          requirement: normalizeName(entry[1]),
          source: normalizeName(entry[2])
        })
      ),
      ...parseMembers(
        source,
        /\bsatisfy\s+([A-Za-z_][A-Za-z0-9_.]*)\s+([A-Za-z_][A-Za-z0-9_]*)\s*;/g,
        (entry) => ({
          kind: "satisfy",
          requirement: normalizeName(entry[2]),
          source: normalizeName(entry[1])
        })
      )
    ],
    (entry) => `${entry.kind}:${entry.requirement}:${entry.source}`
  );
}

function buildRequirementElementNode(token, index = 0) {
  const path = normalizeName(token);
  const label = path.includes(".") ? path : titleFromIdentifier(path);
  return {
    id: `element:${sanitizeIdentifier(path, `element${index + 1}`)}`,
    label,
    fullPath: path,
    kind: "System Element",
    category: "element",
    description: "",
    requirementId: "",
    name: path,
    typeName: "",
    baseType: "",
    parentName: "",
    requirementText: "",
    subjectName: "",
    subjectType: "",
    constraintCount: 0,
    requiredTargets: [],
    traceLinks: [],
    satisfyBy: [],
    constraintTexts: [],
    rawText: "",
    width: 240,
    height: 84
  };
}

function buildRequirementsView(modelData) {
  const requirements = modelData.requirements || [];
  if (!requirements.length) {
    return {
      title: "Requirements View",
      summary: "No explicit SysML requirements were found in the current model.",
      nodes: [],
      links: [],
      emptyMessage: "This SysML2 input does not currently declare any `requirement` or `requirement def` elements."
    };
  }

  const definitionLookup = new Map(
    requirements
      .filter((requirement) => requirement.kind === "definition")
      .map((requirement) => [requirement.name, requirement.id])
  );
  const requirementLookup = new Map(
    requirements
      .filter((requirement) => requirement.kind !== "definition")
      .map((requirement) => [requirement.name, requirement.id])
  );
  const idLookup = new Map(
    requirements
      .filter((requirement) => requirement.requirementId)
      .map((requirement) => [requirement.requirementId, requirement.id])
  );
  const anyRequirementLookup = new Map();
  requirements.forEach((requirement) => {
    if (!anyRequirementLookup.has(requirement.name)) {
      anyRequirementLookup.set(requirement.name, requirement.id);
    }
    if (requirement.requirementId && !anyRequirementLookup.has(requirement.requirementId)) {
      anyRequirementLookup.set(requirement.requirementId, requirement.id);
    }
  });

  const resolveRequirement = (token, preferredType = "") => {
    const normalized = normalizeName(token);
    const preferred = cleanType(preferredType || "");
    if (preferred && definitionLookup.has(preferred)) {
      return definitionLookup.get(preferred);
    }
    return requirementLookup.get(normalized) || idLookup.get(normalized) || definitionLookup.get(normalized) || anyRequirementLookup.get(normalized) || null;
  };

  const elementTokens = new Set();
  requirements.forEach((requirement) => {
    if (requirement.subjectName) {
      elementTokens.add(requirement.subjectName);
    }
    (requirement.satisfyBy || []).forEach((token) => elementTokens.add(token));
    (requirement.requiredTargets || []).forEach((entry) => {
      if (!resolveRequirement(entry.target, entry.typeName)) {
        elementTokens.add(entry.target);
      }
    });
  });
  (modelData.requirementRelations || []).forEach((relation) => {
    elementTokens.add(relation.source);
  });
  (modelData.definitions || []).forEach((definition) => {
    (definition.satisfies || []).forEach((entry) => {
      if (!resolveRequirement(entry.target, entry.type)) {
        return;
      }
      elementTokens.add(definition.name);
    });
  });

  const elementNodes = [...elementTokens].sort().map((token, index) => buildRequirementElementNode(token, index));
  const elementLookup = new Map(elementNodes.map((node) => [node.fullPath, node.id]));

  const nodes = [
    ...requirements.map((requirement) => ({
      id: requirement.id,
      label: requirement.requirementId ? `${requirement.requirementId} ${titleFromIdentifier(requirement.name)}` : titleFromIdentifier(requirement.name),
      shortName: titleFromIdentifier(requirement.name),
      name: requirement.name,
      requirementId: requirement.requirementId,
      typeName: requirement.typeName,
      baseType: requirement.baseType,
      kind: requirement.kind === "definition" ? "Requirement Definition" : "Requirement",
      category: requirement.kind === "definition" ? "definition" : "requirement",
      description: requirement.description || "",
      requirementText: requirement.requirementText || "",
      subjectName: requirement.subjectName || "",
      subjectType: requirement.subjectType || "",
      constraintCount: requirement.constraintCount || 0,
      parentName: requirement.parentName || "",
      requiredTargets: requirement.requiredTargets || [],
      traceLinks: requirement.traceLinks || [],
      satisfyBy: requirement.satisfyBy || [],
      constraintTexts: requirement.constraintTexts || [],
      rawText: requirement.rawText || "",
      width: requirement.kind === "definition" ? 280 : 300,
      height: Math.max(100, requirement.description ? 128 : 100)
    })),
    ...elementNodes
  ];

  const nodeLookup = new Map(nodes.map((node) => [node.id, node]));
  const links = [];
  const pushLink = (from, to, kind, label = kind) => {
    if (!nodeLookup.has(from) || !nodeLookup.has(to) || from === to) {
      return;
    }
    links.push({ from, to, kind, label });
  };

  requirements.forEach((requirement) => {
    if (requirement.typeName) {
      const typeTarget = resolveRequirement(requirement.typeName, requirement.typeName);
      if (typeTarget) {
        pushLink(requirement.id, typeTarget, "type", "typed by");
      }
    }
    if (requirement.baseType) {
      const baseTarget = resolveRequirement(requirement.baseType, requirement.baseType);
      if (baseTarget) {
        pushLink(requirement.id, baseTarget, "specialize", "specializes");
      }
    }
    if (requirement.parentName) {
      const parentTarget = resolveRequirement(requirement.parentName);
      if (parentTarget) {
        pushLink(parentTarget, requirement.id, "require", "contains");
      }
    }
    if (requirement.subjectName && elementLookup.has(requirement.subjectName)) {
      pushLink(elementLookup.get(requirement.subjectName), requirement.id, "subject", "subject");
    }
    (requirement.requiredTargets || []).forEach((entry) => {
      const targetId = resolveRequirement(entry.target, entry.typeName) || elementLookup.get(entry.target);
      if (targetId) {
        pushLink(requirement.id, targetId, "require", "requires");
      }
    });
    (requirement.traceLinks || []).forEach((entry) => {
      const targetId = resolveRequirement(entry.target);
      if (targetId) {
        pushLink(requirement.id, targetId, entry.kind, entry.kind);
      }
    });
    (requirement.satisfyBy || []).forEach((token) => {
      const sourceId = elementLookup.get(token);
      if (sourceId) {
        pushLink(sourceId, requirement.id, "satisfy", "satisfies");
      }
    });
  });

  (modelData.requirementRelations || []).forEach((relation) => {
    const targetId = resolveRequirement(relation.requirement);
    const sourceId = elementLookup.get(relation.source);
    if (sourceId && targetId) {
      pushLink(sourceId, targetId, relation.kind, "satisfies");
    }
  });

  (modelData.definitions || []).forEach((definition) => {
    const sourceId = elementLookup.get(definition.name);
    if (!sourceId) {
      return;
    }
    (definition.satisfies || []).forEach((entry) => {
      const targetId = resolveRequirement(entry.target, entry.type);
      if (targetId) {
        pushLink(sourceId, targetId, "satisfy", "satisfies");
      }
    });
  });

  const definitionNodes = nodes.filter((node) => node.category === "definition");
  const requirementNodes = nodes.filter((node) => node.category === "requirement");
  const elementViewNodes = nodes.filter((node) => node.category === "element");
  const placeColumn = (items, x, yStart = 82, rowGap = 26) => {
    let currentY = yStart;
    items.forEach((item) => {
      item.x = x;
      item.y = currentY;
      currentY += item.height + rowGap;
    });
  };
  placeColumn(definitionNodes, 72);
  placeColumn(requirementNodes, 384);
  placeColumn(elementViewNodes, 736, 96, 24);

  const summaryParts = [
    `${requirementNodes.length} requirement${requirementNodes.length === 1 ? "" : "s"}`,
    `${definitionNodes.length} definition${definitionNodes.length === 1 ? "" : "s"}`,
    `${links.filter((link) => link.kind === "satisfy").length} satisfaction link${links.filter((link) => link.kind === "satisfy").length === 1 ? "" : "s"}`
  ];

  return {
    title: "Requirements View",
    summary: `SysML requirement graph with definitions, requirement statements, and trace links. ${summaryParts.join(", ")}.`,
    nodes,
    links: uniqueBy(links, (link) => `${link.from}:${link.to}:${link.kind}:${link.label}`)
  };
}

function captureNamedBlocks(source, keywords) {
  const pattern = new RegExp(`\\b(${keywords.join("|")})\\s+('[^']+'|"[^"]+"|[A-Za-z_][A-Za-z0-9_]*)[^\\{;]*\\{`, "g");
  const blocks = [];
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const braceIndex = source.indexOf("{", match.index);
    blocks.push({
      keyword: match[1],
      name: normalizeName(match[2]),
      block: source.slice(match.index, braceIndex + 1) + extractBalancedBlock(source, braceIndex + 1),
      start: match.index
    });
    pattern.lastIndex = braceIndex + 1;
  }
  return blocks;
}

function parseMembers(body, regex, mapper) {
  return [...body.matchAll(regex)].map(mapper);
}

function parseConnectors(body) {
  const direct = parseMembers(
    body,
    /\bconnect\s+([A-Za-z_][A-Za-z0-9_.]*)\s*->\s*([A-Za-z_][A-Za-z0-9_.]*)(?:\s+"([^"]+)")?\s*;/g,
    (entry) => ({
      from: entry[1],
      to: entry[2],
      label: entry[3] || "connects"
    })
  );
  const named = parseMembers(
    body,
    /\bconnection\s+([A-Za-z_][A-Za-z0-9_]*)\s+connect\s+([A-Za-z_][A-Za-z0-9_.]*)\s+to\s+([A-Za-z_][A-Za-z0-9_.]*)\s*;/g,
    (entry) => ({
      from: entry[2],
      to: entry[3],
      label: entry[1]
    })
  );
  return [...direct, ...named];
}

function cleanType(typeText) {
  return (typeText || "").replace(/\s+/g, " ").trim();
}

function parsePins(body) {
  return parseMembers(
    body,
    /\b(in|out)\s+(?:item\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*(?::\s*([^;=\n]+))?(?:\s*=\s*([^;]+))?\s*;/g,
    (entry) => ({
      direction: entry[1],
      name: entry[2],
      type: cleanType(entry[3]),
      binding: (entry[4] || "").trim()
    })
  );
}

function parsePerformedActions(body) {
  return parseMembers(
    body,
    /\bperform\s+action\s+([A-Za-z_][A-Za-z0-9_]*)(?:\[[^\]]*\])?(?:\s+ordered)?(?:\s+references\s+([A-Za-z_][A-Za-z0-9_]*))?(?:\s*:\s*([A-Za-z_][A-Za-z0-9_:]*))?\s*(?:\{|;)/g,
    (entry) => ({
      alias: entry[1],
      target: entry[3] || entry[2] || entry[1]
    })
  );
}

function captureTopLevelActionBlocks(body) {
  const pattern = /\b(?:then\s+|do\s+)?action\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s*:\s*([A-Za-z_][A-Za-z0-9_:]*))?[^;{]*\{/g;
  const blocks = [];
  let match;
  while ((match = pattern.exec(body)) !== null) {
    const prefixDepth = braceDepth(body.slice(0, match.index));
    if (prefixDepth !== 0) {
      continue;
    }
    const braceIndex = body.indexOf("{", match.index);
    const balanced = extractBalancedBlock(body, braceIndex + 1);
    const endIndex = braceIndex + 1 + balanced.length;
    const block = body.slice(match.index, endIndex);
    const prefix = block.trimStart().startsWith("then") ? "then action" : block.trimStart().startsWith("do") ? "do action" : "action";
    blocks.push({
      alias: match[1],
      type: normalizeName(match[2] || match[1]),
      block,
      body: extractBody(block),
      start: match.index,
      end: endIndex,
      statement: `${prefix} ${match[1]};`
    });
    pattern.lastIndex = endIndex;
  }
  return blocks;
}

function braceDepth(source) {
  let depth = 0;
  for (const char of source) {
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
    }
  }
  return depth;
}

function parsePartLikeDefinition(keyword, name, body) {
  const pins = parsePins(body);
  const attributes = parseMembers(
    body,
    /\b(?:in|out|inout)?\s*attribute\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([^;={\n]+)(?:=[^;]+)?\s*;/g,
    (entry) => `${entry[1]}: ${entry[2].trim()}`
  );
  const operations = parseMembers(
    body,
    /\boperation\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)\s*;/g,
    (entry) => `${entry[1]}()`
  );
  const partMembers = parseMembers(
    body,
    /\bpart\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_]*)/g,
    (entry) => ({ name: entry[1], type: entry[2] })
  );
  const ports = [
    ...parseMembers(
      body,
      /\bport\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_]*)\s*;/g,
      (entry) => ({ name: entry[1], type: entry[2] })
    ),
    ...parseMembers(
      body,
      /\bport\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/g,
      (entry) => ({ name: entry[1], type: "inline" })
    ),
    ...parseMembers(
      body,
      /\bport\s+([A-Za-z_][A-Za-z0-9_]*)\s*;/g,
      (entry) => ({ name: entry[1], type: "Port" })
    )
  ];
  const localActionDefinitions = parseMembers(
    body,
    /\baction def\s+('[^']+'|"[^"]+"|[A-Za-z_][A-Za-z0-9_]*)/g,
    (entry) => normalizeName(entry[1])
  );
  const performedActions = parsePerformedActions(body);
  const satisfies = uniqueBy(
    [
      ...parseMembers(
        body,
        /\bsatisfy\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:\{|;)/g,
        (entry) => ({ target: entry[1], type: "" })
      ),
      ...parseMembers(
        body,
        /\bsatisfy\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_:]*)\s*(?:\{|;)/g,
        (entry) => ({ target: entry[1], type: normalizeName(entry[2]) })
      )
    ],
    (entry) => `${entry.target}:${entry.type}`
  );
  const members = uniqueBy(
    [
      ...attributes,
      ...operations,
      ...ports.map((port) => `${port.name}: ${port.type}`),
      ...partMembers.map((part) => `${part.name}: ${part.type}`),
      ...pins.map((pin) => `${pin.direction} ${pin.name}${pin.type ? `: ${pin.type}` : ""}`)
    ],
    (entry) => entry
  );

  return {
    id: name.replace(/[^A-Za-z0-9_]/g, "").replace(/^./, (char) => char.toLowerCase()),
    kind:
      keyword === "item def"
        ? "item"
        : keyword === "calc def"
          ? "calc"
        : keyword === "port def"
          ? "port"
          : keyword === "attribute def"
            ? "attribute"
            : keyword === "enum def"
              ? "enum"
              : "part",
    name,
    attributes,
    operations,
    pins,
    ports: uniqueBy(ports, (port) => `${port.name}:${port.type}`),
    parts: uniqueBy(partMembers, (part) => `${part.name}:${part.type}`),
    localActionDefinitions: uniqueBy(localActionDefinitions, (entry) => entry),
    performedActions: uniqueBy(performedActions, (entry) => `${entry.alias}:${entry.target}`),
    satisfies,
    connectors: parseConnectors(body),
    members
  };
}

function parseActivityBlock(name, body) {
  const nodeMap = new Map();
  let decisionCount = 0;

  const addNode = (id, kind = "action", extra = {}) => {
    if (!id) {
      return id;
    }
    const normalizedKind = kind === "decide" ? "decision" : kind;
    const existing = nodeMap.get(id) || { id, kind: normalizedKind };
    existing.kind = existing.kind === "action" ? normalizedKind : existing.kind;
    Object.assign(existing, extra);
    nodeMap.set(id, existing);
    return id;
  };

  const actionBlocks = captureTopLevelActionBlocks(body);
  let topLevelBody = body;
  [...actionBlocks].reverse().forEach((block) => {
    topLevelBody = `${topLevelBody.slice(0, block.start)}${block.statement}${topLevelBody.slice(block.end)}`;
  });

  const pins = parsePins(topLevelBody);
  const inputs = pins.filter((pin) => pin.direction === "in");
  const outputs = pins.filter((pin) => pin.direction === "out");

  actionBlocks.forEach((block) => {
    const blockPins = parsePins(block.body);
    addNode(block.alias, "action", {
      actionType: block.type,
      inputs: blockPins.filter((pin) => pin.direction === "in"),
      outputs: blockPins.filter((pin) => pin.direction === "out")
    });
  });

  parseMembers(topLevelBody, /\b(start|merge|decision|decide|fork|join|end)\s+([A-Za-z_][A-Za-z0-9_]*)/g, (entry) => {
    addNode(entry[2], entry[1]);
    return entry[2];
  });
  parseMembers(topLevelBody, /\baccept\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s*:\s*([A-Za-z_][A-Za-z0-9_:]*))?/g, (entry) => {
    addNode(entry[1], "accept", { eventType: normalizeName(entry[2] || "") });
    return entry[1];
  });
  parseMembers(topLevelBody, /\bfirst\s+([A-Za-z_][A-Za-z0-9_]*)\s*;/g, (entry) => {
    addNode(entry[1], "start");
    return entry[1];
  });

  const flows = [];
  let lastNode = null;
  const linePattern = /([^\n;]+;)/g;
  let lineMatch;
  while ((lineMatch = linePattern.exec(topLevelBody)) !== null) {
    const statement = lineMatch[1].trim();
    let current = null;
    let label = null;

    if (/^then\s+decide\b/.test(statement)) {
      decisionCount += 1;
      current = addNode(`decision${decisionCount}`, "decision");
    } else {
      const thenMatch = statement.match(/^(?:then|do)\s+(?:action\s+|merge\s+|fork\s+|join\s+|accept\s+)?([A-Za-z_][A-Za-z0-9_]*)/);
      if (thenMatch) {
        current = addNode(thenMatch[1], "action");
      }
    }

    const actionMatch = statement.match(/^action\s+([A-Za-z_][A-Za-z0-9_]*)/);
    if (!current && actionMatch) {
      current = addNode(actionMatch[1], "action");
    }

    const ifMatch = statement.match(/^if\s+(.+)\s+then\s+([A-Za-z_][A-Za-z0-9_]*)/);
    if (ifMatch) {
      current = addNode(ifMatch[2], "action");
      label = ifMatch[1].replace(/\s+/g, " ").trim();
    }

    const firstMatch = statement.match(/^first\s+([A-Za-z_][A-Za-z0-9_]*)/);
    if (!current && firstMatch) {
      current = addNode(firstMatch[1], "start");
    }

    if (current && lastNode && lastNode !== current) {
      flows.push(label ? { from: lastNode, to: current, label } : { from: lastNode, to: current });
    }
    if (current) {
      lastNode = current;
    }
  }

  const explicitFlows = parseMembers(
    topLevelBody,
    /\bflow\s+([A-Za-z_][A-Za-z0-9_]*)\s*->\s*([A-Za-z_][A-Za-z0-9_]*)(?:\s+"([^"]+)")?\s*;/g,
    (entry) => ({
      from: entry[1],
      to: entry[2],
      ...(entry[3] ? { label: entry[3] } : {})
    })
  );

  const nodes = uniqueBy([...nodeMap.values()], (node) => node.id);
  if (!nodes.length && (inputs.length || outputs.length)) {
    nodes.push({
      id: name.replace(/[^A-Za-z0-9_]/g, "") || "action",
      kind: "action",
      actionType: name,
      inputs,
      outputs
    });
  }

  return {
    name,
    inputs,
    outputs,
    nodes,
    flows: uniqueBy([...explicitFlows, ...flows], (flow) => `${flow.from}:${flow.to}:${flow.label || ""}`)
  };
}

function parseSysML(text) {
  const { cleanText, metadata } = extractVisualizerMetadata(text);
  const source = stripComments(cleanText);
  const packageMatch = source.match(/package\s+('[^']+'|"[^"]+"|[A-Za-z_][A-Za-z0-9_]*)\s*\{/);
  const packageName = normalizeName(packageMatch?.[1] || "SysML2 Model");
  const docMatch = source.match(/\bdoc\s+(?:\/\*([\s\S]*?)\*\/|"([^"]+)")/);
  const definitions = [];
  const activityBlocks = [];
  const requirements = [];
  let packageLevelSource = source;
  let requirementLevelSource = source;

  const requirementBlocks = parseRequirementBlocks(source);
  requirementBlocks.forEach((entry) => {
    requirementLevelSource = requirementLevelSource.replace(entry.block, "");
    const parsedBody = parseRequirementBody(entry.body, entry.name);
    requirements.push({
      id: requirementRecordId(entry.kind, entry.name, entry.requirementId),
      kind: entry.kind,
      name: entry.name,
      requirementId: entry.requirementId,
      typeName: entry.typeName || "",
      baseType: entry.baseType || "",
      parentName: "",
      description: parsedBody.description,
      requirementText: parsedBody.requirementText,
      subjectName: parsedBody.subjectName,
      subjectType: parsedBody.subjectType,
      constraintCount: parsedBody.constraintCount,
      requiredTargets: parsedBody.requiredTargets,
      traceLinks: parsedBody.traceLinks,
      satisfyBy: parsedBody.satisfyBy,
      constraintTexts: parsedBody.constraintTexts,
      rawText: normalizeMultilineText(entry.block)
    });
    requirements.push(...parsedBody.childRequirements);
  });

  parseRequirementStatementSource(requirementLevelSource).forEach((entry) => {
    requirements.push(entry);
  });

  const blockEntries = captureNamedBlocks(source, ["part def", "item def", "port def", "enum def", "attribute def", "calc def", "action def", "part", "action"]);
  blockEntries.forEach((entry) => {
    packageLevelSource = packageLevelSource.replace(entry.block, "");
    const body = extractBody(entry.block);
    if (entry.keyword === "action def" || entry.keyword === "action") {
      const parsedActivity = parseActivityBlock(entry.name, body);
      if (parsedActivity.nodes.length) {
        activityBlocks.push(parsedActivity);
      }
    } else {
      definitions.push(parsePartLikeDefinition(entry.keyword, entry.name, body));
    }
  });

  parseMembers(
    packageLevelSource,
    /\b(attribute def)\s+('[^']+'|"[^"]+"|[A-Za-z_][A-Za-z0-9_]*)(?:\s*:\>\s*([^;{\n]+))?\s*;/g,
    (entry) => {
      definitions.push({
        id: normalizeName(entry[2]).replace(/[^A-Za-z0-9_]/g, "").replace(/^./, (char) => char.toLowerCase()),
        kind: "attribute",
        name: normalizeName(entry[2]),
        attributes: entry[3] ? [`base: ${entry[3].trim()}`] : [],
        operations: [],
        ports: [],
        parts: [],
        connectors: [],
        members: entry[3] ? [`base: ${entry[3].trim()}`] : []
      });
      return entry[2];
    }
  );

  parseMembers(
    packageLevelSource,
    /\baction def\s+('[^']+'|"[^"]+"|[A-Za-z_][A-Za-z0-9_]*)[^;{]*;/g,
    (entry) => {
      const actionName = normalizeName(entry[1]);
      activityBlocks.push({
        name: actionName,
        nodes: [{ id: actionName.replace(/[^A-Za-z0-9_]/g, "") || "action", kind: "action" }],
        flows: []
      });
      definitions.push({
        id: actionName.replace(/[^A-Za-z0-9_]/g, "").replace(/^./, (char) => char.toLowerCase()),
        kind: "action",
        name: actionName,
        attributes: [],
        operations: [],
        ports: [],
        parts: [],
        connectors: [],
        members: []
      });
      return actionName;
    }
  );

  const topLevelParts = parseMembers(
    packageLevelSource,
    /^\s*part\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_]*)/gm,
    (entry) => ({
      id: entry[1],
      label: titleFromIdentifier(entry[1]),
      type: classifyOperationalType(entry[2]),
      definitionType: entry[2]
    })
  );

  const topLevelFlows = parseMembers(
    packageLevelSource,
    /^\s*flow\s+([A-Za-z_][A-Za-z0-9_]*)\s*->\s*([A-Za-z_][A-Za-z0-9_]*)(?:\s+"([^"]+)")?\s*;/gm,
    (entry) => ({
      from: entry[1],
      to: entry[2],
      label: entry[3] || "flow"
    })
  );

  let operationalActors = positionOperationalActors(topLevelParts);
  let flows = topLevelFlows;
  if (!operationalActors.length || !flows.length) {
    const contextPart = chooseContextPart({ definitions });
    if (contextPart) {
      operationalActors = positionOperationalActors(
        (contextPart.parts.length
          ? contextPart.parts
          : definitions
              .filter((definition) => definition.kind === "part" && definition.name !== contextPart.name)
              .slice(0, 6)
              .map((definition) => ({ name: definition.id, type: definition.name }))).map((part) => ({
          id: part.name,
          label: titleFromIdentifier(part.name),
          type: classifyOperationalType(part.type),
          definitionType: part.type
        }))
      );
      flows = contextPart.connectors.map((connector) => ({
        from: connector.from.split(".")[0],
        to: connector.to.split(".")[0],
        label: connector.label
      }));
    }
  }

  if (!definitions.length && activityBlocks.length) {
    activityBlocks.forEach((block) => {
      definitions.push({
        id: block.name.replace(/[^A-Za-z0-9_]/g, "").replace(/^./, (char) => char.toLowerCase()),
        kind: "action",
        name: block.name,
        attributes: [],
        operations: [],
        ports: [],
        parts: [],
        connectors: [],
        members: []
      });
    });
  }
  if (!definitions.length) {
    definitions.push({
      id: "sysmlModel",
      kind: "part",
      name: packageName,
      attributes: [],
      operations: [],
      ports: [],
      parts: [],
      connectors: [],
      members: []
    });
  }
  if (!operationalActors.length) {
    operationalActors = positionOperationalActors(
      definitions
        .filter((definition) => definition.name)
        .slice(0, 6)
        .map((definition) => ({
          id: definition.id,
          label: titleFromIdentifier(definition.name),
          type: classifyOperationalType(definition.name)
        }))
    );
  }
  if (!flows.length && operationalActors.length > 1) {
    flows = operationalActors.slice(0, -1).map((actor, index) => ({
      from: actor.id,
      to: operationalActors[index + 1].id,
      label: "interaction"
    }));
  }
  const fallbackBehaviorNodesSource =
    operationalActors.length > 0
      ? operationalActors
      : definitions.slice(0, 5).map((definition) => ({ id: definition.id }));
  const activityBlock = [...activityBlocks].sort((left, right) => right.nodes.length - left.nodes.length)[0] || {
    name: "Behavior",
    inputs: [],
    outputs: [],
    nodes: fallbackBehaviorNodesSource.map((node, index) => ({
      id: node.id,
      kind: index === 0 ? "start" : index === fallbackBehaviorNodesSource.length - 1 ? "end" : "action",
      actionType: node.id,
      inputs: [],
      outputs: []
    })),
    flows: fallbackBehaviorNodesSource.slice(0, -1).map((node, index) => ({
      from: node.id,
      to: fallbackBehaviorNodesSource[index + 1].id
    }))
  };

  const modelData = {
    definitions,
    operationalActors,
    flows,
    activityBlock,
    requirements: uniqueBy(requirements, (requirement) => requirement.id),
    requirementRelations: parseTopLevelRequirementRelations(requirementLevelSource)
  };
  const componentPool = buildOperationalComponentPool(definitions, operationalActors);
  const ov1View = applyOv1Metadata(operationalActors, flows, componentPool, metadata);
  const bddView = applyBddMetadata(buildBDD(modelData), metadata);
  const ibdView = applyIbdMetadata(buildIBD(modelData), metadata);
  const activityView = buildActivity(modelData, activityBlock, activityBlocks);
  const sequenceView = buildSequence(activityView);
  const requirementsView = buildRequirementsView(modelData);

  return {
    title: titleFromIdentifier(packageName),
    description: (docMatch?.[1] || docMatch?.[2] || "SysML2 textual model").replace(/\s+/g, " ").trim(),
    modelData,
    sourceMeta: {
      packageName,
      contextPartName: ibdView.frame?.contextName || "",
      topLevelParts: topLevelParts.map((part) => ({ ...part })),
      topLevelFlows: topLevelFlows.map((flow) => ({ ...flow }))
    },
    views: {
      ov1: {
        title: "OV-1 High-Level Operational Concept",
        mission: (docMatch?.[1] || docMatch?.[2] || "Operational mission view").replace(/\s+/g, " ").trim(),
        actors: ov1View.actors,
        flows: ov1View.flows,
        componentPool
      },
      bdd: bddView,
      ibd: ibdView,
      activity: activityView,
      sequence: sequenceView,
      requirements: requirementsView
    }
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function setImportStatus(message, isError = false) {
  importStatusEl.textContent = message;
  importStatusEl.style.color = isError ? "#b23a48" : "#586575";
}

function parseModelText(text) {
  if (text.trim().startsWith("{")) {
    throw new Error("JSON input is no longer accepted. Provide a SysML2 textual specification instead.");
  }
  return parseSysML(text);
}

function numericScore(value) {
  const score = Number.parseFloat(value);
  return Number.isFinite(score) ? score : null;
}

function formatPercentScore(score, fallback = "N/A") {
  return score === null ? fallback : `${score.toFixed(1)}%`;
}

function parseAnalysisTerms(value) {
  return String(value || "")
    .split("|")
    .map((term) => term.trim())
    .filter(Boolean);
}

function formatSeries(values) {
  if (!values.length) {
    return "";
  }
  if (values.length === 1) {
    return values[0];
  }
  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function scoreToneClass(score) {
  if (score === null) {
    return "";
  }
  if (score >= 80) {
    return "is-high";
  }
  if (score >= 55) {
    return "is-medium";
  }
  return "is-low";
}

function summarizeModelNarrative(nextModel) {
  const actors = uniqueBy(
    [
      ...nextModel.views.ov1.actors.map((actor) => actor.label),
      ...nextModel.views.activity.lanes
        .map((lane) => lane.label)
        .filter((lane) => lane && !["System", "External"].includes(lane))
    ],
    (value) => value
  ).slice(0, 5);
  const structures = uniqueBy(
    [
      ...nextModel.views.ibd.parts.map((part) => part.name),
      ...nextModel.views.bdd.blocks
        .filter((block) => ["<<part>>", "<<item>>", "<<port>>"].includes(block.stereotype))
        .map((block) => block.name)
    ],
    (value) => value
  ).slice(0, 6);
  const behaviors = uniqueBy(
    nextModel.views.activity.nodes
      .filter((node) => ["action", "accept"].includes(node.kind))
      .map((node) => node.label),
    (value) => value
  ).slice(0, 6);
  const dataConcepts = uniqueBy(
    [
      ...nextModel.views.activity.edges.flatMap((edge) => parseAnalysisTerms(edge.dataLabel.replace(/•/g, "|"))),
      ...nextModel.views.bdd.blocks
        .filter((block) => ["<<item>>", "<<attribute>>", "<<port>>"].includes(block.stereotype))
        .map((block) => block.name)
    ],
    (value) => value
  ).slice(0, 5);

  const sentences = [`This model centers on ${nextModel.title || "the current system"} and its surrounding MBSE views.`];
  if (structures.length) {
    sentences.push(`The main structural elements are ${formatSeries(structures)}.`);
  }
  if (actors.length) {
    sentences.push(`Key actors or performers include ${formatSeries(actors)}.`);
  }
  if (behaviors.length) {
    sentences.push(`The modeled behavior highlights ${formatSeries(behaviors)}.`);
  }
  if (dataConcepts.length) {
    sentences.push(`Important data, interfaces, or exchanged items include ${formatSeries(dataConcepts)}.`);
  }
  return sentences.join(" ");
}

function scoreBandSummary(score, label) {
  if (score === null) {
    return `No ${label.toLowerCase()} score is available for this model.`;
  }
  if (score >= 85) {
    return `${label} alignment is very strong.`;
  }
  if (score >= 70) {
    return `${label} alignment is strong with only moderate gaps.`;
  }
  if (score >= 55) {
    return `${label} alignment is moderate and captures the main intent.`;
  }
  if (score >= 35) {
    return `${label} alignment is limited and misses several cues from the reference text.`;
  }
  return `${label} alignment is low and only weakly matches the reference text.`;
}

function buildScoreRationale(label, score, matchedTerms, missingTerms, parseStatus = "ok") {
  if (parseStatus === "not_scored") {
    return `This model does not yet have a paired corpus TXT comparison, so the ${label.toLowerCase()} rating is unavailable.`;
  }
  if (parseStatus && parseStatus !== "ok") {
    return `The scorer could not reliably parse this model (${parseStatus}), so the rating is conservative.`;
  }
  const matchText = matchedTerms.length
    ? `The strongest overlap appears around ${formatSeries(matchedTerms.slice(0, 3))}.`
    : "The scorer did not find strong direct phrase overlap in this area.";
  const gapText = missingTerms.length
    ? `The score is held down by weaker or missing cues around ${formatSeries(missingTerms.slice(0, 3))}.`
    : "No major missing cues were flagged for this dimension.";
  return `${scoreBandSummary(score, label)} ${matchText} ${gapText}`;
}

function buildAnalysisCard({
  id,
  title,
  kind,
  scoreText = "",
  scoreValue = null,
  body = "",
  rationale = "",
  detailRows = [],
  matchedTerms = [],
  missingTerms = [],
  matchedLabel = "Matched cues",
  missingLabel = "Missing or weak cues",
  wide = false
}) {
  return {
    id,
    title,
    kind,
    scoreText,
    scoreValue,
    body,
    rationale,
    detailRows,
    matchedTerms,
    missingTerms,
    matchedLabel,
    missingLabel,
    wide
  };
}

function weightedAverage(components) {
  const available = components.filter((component) => component.score !== null);
  if (!available.length) {
    return null;
  }
  const totalWeight = available.reduce((sum, component) => sum + component.weight, 0);
  if (!totalWeight) {
    return null;
  }
  return available.reduce((sum, component) => sum + component.score * component.weight, 0) / totalWeight;
}

function evaluateSequenceValidity(nextModel) {
  const activityView = nextModel.views.activity || { nodes: [], edges: [] };
  const sequenceView = nextModel.views.sequence || { participants: [], executions: [], messages: [] };
  const actionableKinds = new Set(["action", "accept"]);
  const nodeLookup = Object.fromEntries(activityView.nodes.map((node) => [node.id, node]));
  const actionableNodes = activityView.nodes.filter((node) => actionableKinds.has(node.kind));

  if (!actionableNodes.length) {
    return {
      score: null,
      scoreText: "N/A",
      body: "No actionable activity steps were found, so the generated sequence view does not yet have enough behavioral evidence to validate.",
      rationale: "Sequence validity is unavailable because this model does not expose action or accept-event steps that can be compared against lifelines, execution bars, and messages.",
      detailRows: [
        ["Actionable Steps", "0"],
        ["Participants", String(sequenceView.participants.length)],
        ["Executions", String(sequenceView.executions.length)],
        ["Messages", String(sequenceView.messages.length)]
      ],
      metricCopy: "Needs actionable activity steps"
    };
  }

  const actionableNodeIds = new Set(actionableNodes.map((node) => node.id));
  const participantIds = new Set(sequenceView.participants.map((participant) => participant.id));
  const expectedPerformers = uniqueBy(
    actionableNodes.map((node) => node.performer || "System").filter(Boolean),
    (value) => value
  );
  const coveredPerformers = expectedPerformers.filter((performer) => participantIds.has(performer)).length;

  const representedExecutionIds = new Set(
    sequenceView.executions
      .filter((execution) => actionableNodeIds.has(execution.nodeId))
      .map((execution) => execution.nodeId)
  );
  const validExecutionParticipants = sequenceView.executions.filter((execution) => participantIds.has(execution.participant)).length;

  const candidateEdges = activityView.edges.filter((edge) => {
    const fromNode = nodeLookup[edge.from];
    const toNode = nodeLookup[edge.to];
    return fromNode && toNode && (actionableKinds.has(fromNode.kind) || actionableKinds.has(toNode.kind));
  });
  const expectedMessageKeys = uniqueBy(
    candidateEdges.map((edge) => {
      const fromNode = nodeLookup[edge.from];
      const toNode = nodeLookup[edge.to];
      const fromParticipant = fromNode.performer || "System";
      const toParticipant = toNode.performer || "System";
      return `${fromParticipant}::${toParticipant}::${toNode.id}`;
    }),
    (value) => value
  );
  const actualMessageKeys = new Set(
    sequenceView.messages.map((message) => `${message.from || "System"}::${message.to || "System"}::${message.targetNodeId || ""}`)
  );
  const matchedMessageCount = expectedMessageKeys.filter((key) => actualMessageKeys.has(key)).length;
  const validMessageEndpoints = sequenceView.messages.filter(
    (message) => participantIds.has(message.from) && participantIds.has(message.to)
  ).length;
  const labeledMessageCount = sequenceView.messages.filter((message) => String(message.label || "").trim()).length;

  const referenceExecutionOrder = actionableNodes
    .slice()
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
    .map((node) => node.id);
  const actualExecutionOrder = sequenceView.executions
    .filter((execution) => actionableNodeIds.has(execution.nodeId))
    .slice()
    .sort((left, right) => left.y - right.y)
    .map((execution) => execution.nodeId);
  const executionOrderMatches = referenceExecutionOrder.filter((nodeId, index) => actualExecutionOrder[index] === nodeId).length;
  const executionOrderIntegrity = referenceExecutionOrder.length > 1
    ? (executionOrderMatches / referenceExecutionOrder.length) * 100
    : referenceExecutionOrder.length === 1 && actualExecutionOrder.length === 1
      ? 100
      : null;
  const messageOrderIntegrity = sequenceView.messages.length > 1
    ? (sequenceView.messages.slice(1).filter((message, index) => message.y >= sequenceView.messages[index].y - 1).length / (sequenceView.messages.length - 1)) * 100
    : sequenceView.messages.length === 1
      ? 100
      : null;
  const orderingIntegrity = weightedAverage([
    { score: executionOrderIntegrity, weight: 1 },
    { score: messageOrderIntegrity, weight: 1 }
  ]);

  const participantCoverage = expectedPerformers.length ? (coveredPerformers / expectedPerformers.length) * 100 : null;
  const executionCoverage = actionableNodes.length ? (representedExecutionIds.size / actionableNodes.length) * 100 : null;
  const executionAnchoring = sequenceView.executions.length
    ? (validExecutionParticipants / sequenceView.executions.length) * 100
    : 0;
  const messageCoverage = expectedMessageKeys.length ? (matchedMessageCount / expectedMessageKeys.length) * 100 : null;
  const endpointValidity = sequenceView.messages.length
    ? (validMessageEndpoints / sequenceView.messages.length) * 100
    : expectedMessageKeys.length
      ? 0
      : null;
  const labelCompleteness = sequenceView.messages.length
    ? (labeledMessageCount / sequenceView.messages.length) * 100
    : expectedMessageKeys.length
      ? 0
      : null;

  const score = weightedAverage([
    { score: participantCoverage, weight: 20 },
    { score: executionCoverage, weight: 20 },
    { score: executionAnchoring, weight: 15 },
    { score: messageCoverage, weight: 20 },
    { score: endpointValidity, weight: 15 },
    { score: labelCompleteness, weight: 5 },
    { score: orderingIntegrity, weight: 5 }
  ]);

  const strengths = [];
  const gaps = [];
  if (participantCoverage !== null) {
    if (participantCoverage >= 85) {
      strengths.push(`lifelines cover ${coveredPerformers} of ${expectedPerformers.length} performers`);
    } else {
      gaps.push(`only ${coveredPerformers} of ${expectedPerformers.length} performers receive lifelines`);
    }
  }
  if (executionCoverage !== null) {
    if (executionCoverage >= 85) {
      strengths.push(`execution bars represent ${representedExecutionIds.size} of ${actionableNodes.length} actionable steps`);
    } else {
      gaps.push(`only ${representedExecutionIds.size} of ${actionableNodes.length} actionable steps appear as executions`);
    }
  }
  if (messageCoverage !== null) {
    if (messageCoverage >= 80) {
      strengths.push(`the diagram traces ${matchedMessageCount} of ${expectedMessageKeys.length} expected interactions`);
    } else {
      gaps.push(`only ${matchedMessageCount} of ${expectedMessageKeys.length} expected interactions are traced`);
    }
  }
  if (endpointValidity !== null && sequenceView.messages.length) {
    if (endpointValidity >= 85) {
      strengths.push(`message endpoints resolve cleanly across ${validMessageEndpoints} of ${sequenceView.messages.length} messages`);
    } else {
      gaps.push(`some message endpoints do not resolve to visible lifelines`);
    }
  }
  if (labelCompleteness !== null && sequenceView.messages.length) {
    if (labelCompleteness >= 80) {
      strengths.push(`message labels are present on ${labeledMessageCount} of ${sequenceView.messages.length} messages`);
    } else {
      gaps.push(`message labels are sparse across the generated interactions`);
    }
  }
  if (orderingIntegrity !== null) {
    if (orderingIntegrity >= 85) {
      strengths.push("message and execution ordering is consistent with the activity flow");
    } else {
      gaps.push("message or execution ordering drifts from the activity sequencing");
    }
  }

  let bandSummary = "Sequence validity could not be established.";
  if (score !== null) {
    if (score >= 85) {
      bandSummary = "The generated sequence diagram is a strong MBSE-style trace of the activity behavior.";
    } else if (score >= 70) {
      bandSummary = "The generated sequence diagram is broadly valid, with a few moderate fidelity gaps.";
    } else if (score >= 55) {
      bandSummary = "The generated sequence diagram captures the main behavior, but it is only moderately faithful to the activity source.";
    } else if (score >= 35) {
      bandSummary = "The generated sequence diagram shows some of the intended behavior, but important sequencing details are missing or weak.";
    } else {
      bandSummary = "The generated sequence diagram is only weakly supported by the modeled activity behavior.";
    }
  }

  const strengthText = strengths.length ? `Strengths include ${formatSeries(strengths.slice(0, 3))}.` : "";
  const gapText = gaps.length ? `The main gaps are ${formatSeries(gaps.slice(0, 3))}.` : "No major validity gaps were detected in the generated sequence trace.";

  const interactionSummary = expectedMessageKeys.length
    ? `${matchedMessageCount}/${expectedMessageKeys.length} interactions traced`
    : `${sequenceView.messages.length} messages shown`;

  return {
    score,
    scoreText: formatPercentScore(score),
    body: `The generated sequence view renders ${sequenceView.participants.length} lifelines, ${sequenceView.executions.length} executions, and ${sequenceView.messages.length} messages from ${actionableNodes.length} actionable activity steps.`,
    rationale: `${bandSummary} ${strengthText} ${gapText}`.trim(),
    detailRows: [
      ["Participants Covered", expectedPerformers.length ? `${coveredPerformers}/${expectedPerformers.length}` : "N/A"],
      ["Executions Mapped", `${representedExecutionIds.size}/${actionableNodes.length}`],
      ["Interactions Traced", expectedMessageKeys.length ? `${matchedMessageCount}/${expectedMessageKeys.length}` : String(sequenceView.messages.length)],
      ["Endpoint Validity", sequenceView.messages.length ? `${validMessageEndpoints}/${sequenceView.messages.length}` : "No messages"],
      ["Labeled Messages", sequenceView.messages.length ? `${labeledMessageCount}/${sequenceView.messages.length}` : "No messages"]
    ],
    metricCopy: `${expectedPerformers.length ? `${coveredPerformers}/${expectedPerformers.length} performers` : `${sequenceView.participants.length} lifelines`}, ${interactionSummary}`
  };
}

function scoreToTarget(count, target) {
  if (!target) {
    return 0;
  }
  return clamp((count / target) * 100, 0, 100);
}

function compactDetailRows(rows) {
  return rows.filter(([, value]) => value !== null && value !== undefined && value !== "");
}

function countPatternMatches(sourceText, pattern) {
  const matches = String(sourceText || "").match(pattern);
  return matches ? matches.length : 0;
}

function analyzeSentinelSource(sourceText) {
  const source = stripVisualizerMetadataBlock(String(sourceText || ""));
  return {
    lineCount: source ? source.split(/\r?\n/).length : 0,
    imports: countPatternMatches(source, /\b(?:private\s+)?import\b/gi),
    partDefs: countPatternMatches(source, /\bpart\s+def\b/gi),
    itemDefs: countPatternMatches(source, /\bitem\s+def\b/gi),
    portDefs: countPatternMatches(source, /\bport\s+def\b/gi),
    enumDefs: countPatternMatches(source, /\benum\s+def\b/gi),
    attributeDefs: countPatternMatches(source, /\battribute\s+def\b/gi),
    stateDefs: countPatternMatches(source, /\bstate\s+def\b/gi),
    stateEntries: countPatternMatches(source, /\bstate\s+(?!def\b)[A-Za-z_~][A-Za-z0-9_~]*/g),
    transitions: countPatternMatches(source, /\btransition\b/gi),
    guards: countPatternMatches(source, /\bif\b/gi),
    acceptEvents: countPatternMatches(source, /\baccept\b/gi),
    entryActions: countPatternMatches(source, /\bentry\s+action\b/gi),
    doActions: countPatternMatches(source, /\bdo\s+action\b/gi),
    actionDefs: countPatternMatches(source, /\baction\s+def\b/gi),
    calcDefs: countPatternMatches(source, /\bcalc\s+def\b/gi),
    constraints: countPatternMatches(source, /\brequire\s+constraint\b|\bconstraint\s*\{/gi),
    typedAttributes: countPatternMatches(source, /\battribute\s+[A-Za-z_][A-Za-z0-9_]*\s*:\s*[^;{\n]+/g),
    typedPins: countPatternMatches(source, /\b(?:in|out|inout)\s+(?:item\s+)?[A-Za-z_][A-Za-z0-9_]*\s*:\s*[^;=\n]+/g),
    comparisonOps: countPatternMatches(source, /(?:<=|>=|==|!=|<|>)/g),
    timeTerms: countPatternMatches(source, /\b(?:ms|msec|millisecond(?:s)?|second(?:s)?|sec(?:s)?|minute(?:s)?|hour(?:s)?|timevalue|duration(?:value)?|clock|deadline|timeout)\b/gi),
    probabilityTerms: countPatternMatches(source, /\b(?:probabilistic|probability|distribution|stochastic|random)\b|P\s*[<>]=?/g)
  };
}

function collectSimulationDataConcepts(nextModel) {
  return uniqueBy(
    [
      ...nextModel.views.activity.edges.flatMap((edge) => parseAnalysisTerms((edge.dataLabel || "").replace(/•/g, "|"))),
      ...nextModel.views.sequence.messages.flatMap((message) => parseAnalysisTerms((message.label || "").replace(/•/g, "|").replace(/\|/g, " | "))),
      ...nextModel.views.bdd.blocks
        .filter((block) => ["<<item>>", "<<attribute>>", "<<port>>"].includes(block.stereotype))
        .map((block) => block.name)
    ]
      .map((value) => String(value || "").replace(/\s+/g, " ").trim())
      .filter(Boolean),
    (value) => value.toLowerCase()
  );
}

function simulationReadinessBand(score) {
  if (score >= 85) {
    return {
      label: "SENTINEL-Ready",
      summary: "The model exposes the structural, behavioral, and property-oriented semantics needed for a strong Generate-Simulate-Verify loop."
    };
  }
  if (score >= 70) {
    return {
      label: "Simulation-Ready",
      summary: "The model looks ready for structural and behavioral feedback, with moderate gaps before full SENTINEL-style verification."
    };
  }
  if (score >= 55) {
    return {
      label: "Behavior-Partially Ready",
      summary: "The model contains executable semantics, but the full Generate-Simulate-Verify loop would still be fragile."
    };
  }
  if (score >= 35) {
    return {
      label: "Mostly Structural",
      summary: "The model is trending toward compiler-readiness, yet it still needs richer executable or checkable semantics."
    };
  }
  return {
    label: "Not Ready",
    summary: "The model does not yet expose enough executable or verifiable semantics for SENTINEL-style feedback."
  };
}

function buildSimulationRationale(label, score, strengths, gaps) {
  const strengthText = strengths.length
    ? `Ready signals include ${formatSeries(strengths.slice(0, 3))}.`
    : `This area has only weak readiness signals right now.`;
  const gapText = gaps.length
    ? `The main gaps are ${formatSeries(gaps.slice(0, 3))}.`
    : `No major gaps were flagged in this area.`;

  if (score >= 85) {
    return `${label} readiness is very strong. ${strengthText} ${gapText}`.trim();
  }
  if (score >= 70) {
    return `${label} readiness is strong with moderate cleanup still advisable. ${strengthText} ${gapText}`.trim();
  }
  if (score >= 55) {
    return `${label} readiness is moderate and supports only part of a simulation workflow. ${strengthText} ${gapText}`.trim();
  }
  if (score >= 35) {
    return `${label} readiness is limited. ${strengthText} ${gapText}`.trim();
  }
  return `${label} readiness is low. ${strengthText} ${gapText}`.trim();
}

function evaluateSimulationReadiness(nextModel, sourcePath = "", sourceText = "") {
  const sourceSignals = analyzeSentinelSource(sourceText);
  const bddBlocks = nextModel.views.bdd.blocks || [];
  const bddRelationships = nextModel.views.bdd.relationships || [];
  const ibdParts = nextModel.views.ibd.parts || [];
  const ibdConnectors = nextModel.views.ibd.connectors || [];
  const activityNodes = nextModel.views.activity.nodes || [];
  const activityEdges = nextModel.views.activity.edges || [];
  const sequenceView = nextModel.views.sequence || { participants: [], executions: [], messages: [] };
  const ov1Actors = nextModel.views.ov1.actors || [];
  const ov1Flows = nextModel.views.ov1.flows || [];
  const actionableSteps = activityNodes.filter((node) => ["action", "accept"].includes(node.kind));
  const performerLabels = uniqueBy(
    actionableSteps.map((node) => node.performer || "System").filter(Boolean),
    (value) => value
  );
  const typedProperties = bddBlocks.reduce(
    (sum, block) => sum + (block.properties || []).filter((property) => property.includes(":")).length,
    0
  );
  const typedPins = activityNodes.reduce(
    (sum, node) =>
      sum +
      [...(node.inputs || []), ...(node.outputs || [])].filter((pin) => String(pin.type || "").trim()).length,
    0
  );
  const calcBlocks = bddBlocks.filter((block) => block.stereotype === "<<calc>>").length;
  const itemBlocks = bddBlocks.filter((block) => block.stereotype === "<<item>>").length;
  const portBlocks = bddBlocks.filter((block) => block.stereotype === "<<port>>").length;
  const attributeBlocks = bddBlocks.filter((block) => block.stereotype === "<<attribute>>").length;
  const portsOnParts = ibdParts.reduce((sum, part) => sum + (part.ports || []).length, 0);
  const labeledConnectorFlows = ibdConnectors.filter((connector) => String(connector.label || "").trim()).length;
  const labeledOperationalFlows = ov1Flows.filter((flow) => String(flow.label || "").trim()).length;
  const labeledDataEdges = activityEdges.filter((edge) => String(edge.dataLabel || "").trim()).length;
  const controlEdges = activityEdges.length;
  const labeledMessages = sequenceView.messages.filter((message) => String(message.label || "").trim()).length;
  const sequenceValidity = evaluateSequenceValidity(nextModel);
  const startCount = activityNodes.filter((node) => node.kind === "start").length;
  const endCount = activityNodes.filter((node) => node.kind === "end").length;
  const dataConcepts = collectSimulationDataConcepts(nextModel);
  const relationshipSurface = bddRelationships.length + ibdConnectors.length + ov1Flows.length;
  const internalAssemblySurface = ibdParts.length + portsOnParts + sourceSignals.portDefs;
  const controlCoverage = actionableSteps.length <= 1
    ? (actionableSteps.length ? 100 : 0)
    : clamp((controlEdges / Math.max(actionableSteps.length - 1, 1)) * 100, 0, 100);
  const startEndCoverage = weightedAverage([
    { score: startCount ? 100 : 0, weight: 1 },
    { score: endCount ? 100 : 0, weight: 1 }
  ]) || 0;
  const traceExecutionCoverage = actionableSteps.length
    ? clamp((sequenceView.executions.length / actionableSteps.length) * 100, 0, 100)
    : 0;
  const traceMessageCoverage = actionableSteps.length > 1
    ? clamp((sequenceView.messages.length / Math.max(actionableSteps.length - 1, 1)) * 100, 0, 100)
    : sequenceView.messages.length
      ? 100
      : 0;
  const traceParticipantCoverage = performerLabels.length
    ? clamp((sequenceView.participants.length / performerLabels.length) * 100, 0, 100)
    : 0;
  const parseScore = 100;
  const l1StructuralScore = weightedAverage([
    { score: parseScore, weight: 25 },
    { score: scoreToTarget(sourceSignals.partDefs + sourceSignals.itemDefs + sourceSignals.portDefs + sourceSignals.enumDefs, 10), weight: 25 },
    { score: scoreToTarget(sourceSignals.typedAttributes + sourceSignals.typedPins + portsOnParts + attributeBlocks, 16), weight: 30 },
    { score: scoreToTarget(relationshipSurface + sourceSignals.imports + sourceSignals.actionDefs + sourceSignals.stateDefs, 14), weight: 20 }
  ]) || 0;

  const stateExecutionScore =
    sourceSignals.stateDefs || sourceSignals.transitions
      ? weightedAverage([
          { score: scoreToTarget(sourceSignals.stateDefs, 1), weight: 15 },
          { score: scoreToTarget(sourceSignals.stateEntries, 5), weight: 15 },
          { score: scoreToTarget(sourceSignals.transitions, 6), weight: 25 },
          { score: scoreToTarget(sourceSignals.guards + sourceSignals.acceptEvents, 6), weight: 20 },
          { score: scoreToTarget(sourceSignals.entryActions + sourceSignals.doActions, 4), weight: 25 }
        ])
      : null;

  const activityExecutionScore =
    actionableSteps.length
      ? weightedAverage([
          { score: scoreToTarget(actionableSteps.length, 8), weight: 30 },
          { score: controlCoverage, weight: 25 },
          { score: scoreToTarget(performerLabels.length, 3), weight: 15 },
          { score: startEndCoverage, weight: 10 },
          { score: sequenceValidity.score ?? 0, weight: 20 }
        ])
      : null;

  const parametricExecutionScore =
    sourceSignals.calcDefs || sourceSignals.constraints
      ? weightedAverage([
          { score: scoreToTarget(sourceSignals.calcDefs + sourceSignals.constraints, 5), weight: 40 },
          { score: scoreToTarget(sourceSignals.typedAttributes + sourceSignals.typedPins, 14), weight: 25 },
          { score: scoreToTarget(sourceSignals.comparisonOps, 8), weight: 15 },
          { score: scoreToTarget(dataConcepts.length + labeledDataEdges, 8), weight: 20 }
        ])
      : null;

  const l2BehavioralScore =
    weightedAverage(
      [
        stateExecutionScore !== null ? { score: stateExecutionScore, weight: 45 } : null,
        activityExecutionScore !== null ? { score: activityExecutionScore, weight: 35 } : null,
        parametricExecutionScore !== null ? { score: parametricExecutionScore, weight: 20 } : null
      ].filter(Boolean)
    ) || 0;

  const statePropertyScore =
    sourceSignals.stateDefs || sourceSignals.transitions
      ? weightedAverage([
          { score: scoreToTarget(sourceSignals.stateDefs + sourceSignals.stateEntries, 6), weight: 20 },
          { score: scoreToTarget(sourceSignals.transitions + sourceSignals.guards, 8), weight: 35 },
          { score: scoreToTarget(sourceSignals.acceptEvents, 3), weight: 10 },
          { score: scoreToTarget(sourceSignals.comparisonOps, 8), weight: 20 },
          { score: scoreToTarget(sourceSignals.typedAttributes + sourceSignals.typedPins, 12), weight: 15 }
        ])
      : null;

  const activityPropertyScore =
    actionableSteps.length
      ? weightedAverage([
          { score: scoreToTarget(actionableSteps.length, 8), weight: 35 },
          { score: controlCoverage, weight: 25 },
          { score: scoreToTarget(sourceSignals.guards + sourceSignals.comparisonOps, 8), weight: 20 },
          { score: scoreToTarget(dataConcepts.length + itemBlocks, 8), weight: 20 }
        ])
      : null;

  const advancedPropertyScore =
    sourceSignals.timeTerms || sourceSignals.probabilityTerms
      ? weightedAverage([
          { score: scoreToTarget(sourceSignals.timeTerms, 3), weight: 55 },
          { score: scoreToTarget(sourceSignals.probabilityTerms, 2), weight: 45 }
        ])
      : 60;

  const propertyCoreScore =
    weightedAverage(
      [
        statePropertyScore !== null ? { score: statePropertyScore, weight: 55 } : null,
        activityPropertyScore !== null ? { score: activityPropertyScore, weight: 45 } : null
      ].filter(Boolean)
    );

  const l3PropertyScore =
    propertyCoreScore === null
      ? 0
      : weightedAverage([
          { score: propertyCoreScore, weight: 85 },
          { score: advancedPropertyScore, weight: 15 }
        ]) || 0;

  const observabilityScore = weightedAverage([
    {
      score: scoreToTarget(
        sourceSignals.portDefs + portsOnParts + portBlocks + itemBlocks + dataConcepts.length,
        14
      ),
      weight: 35
    },
    {
      score: scoreToTarget(
        labeledDataEdges + labeledMessages + labeledConnectorFlows + labeledOperationalFlows,
        10
      ),
      weight: 25
    },
    {
      score:
        sourceSignals.stateDefs || sourceSignals.transitions
          ? scoreToTarget(sourceSignals.stateEntries + sourceSignals.transitions, 10)
          : scoreToTarget(sequenceView.executions.length + sequenceView.messages.length, 10),
      weight: 20
    },
    {
      score:
        sourceSignals.calcDefs || sourceSignals.constraints
          ? scoreToTarget(sourceSignals.calcDefs + sourceSignals.constraints + sourceSignals.comparisonOps, 10)
          : sequenceValidity.score ?? 0,
      weight: 20
    }
  ]) || 0;

  const repairScore = weightedAverage([
    {
      score: scoreToTarget(
        sourceSignals.stateDefs +
          sourceSignals.transitions +
          sourceSignals.actionDefs +
          sourceSignals.calcDefs +
          sourceSignals.constraints +
          sourceSignals.portDefs +
          sourceSignals.partDefs,
        20
      ),
      weight: 35
    },
    {
      score: scoreToTarget(sourceSignals.guards + sourceSignals.comparisonOps + sourceSignals.acceptEvents, 10),
      weight: 20
    },
    { score: observabilityScore, weight: 25 },
    {
      score:
        weightedAverage([
          { score: l1StructuralScore, weight: 1 },
          { score: l2BehavioralScore, weight: 1 },
          { score: l3PropertyScore, weight: 1 }
        ]) || 0,
      weight: 20
    }
  ]) || 0;

  const overallScore = weightedAverage([
    { score: l1StructuralScore, weight: 25 },
    { score: l2BehavioralScore, weight: 25 },
    { score: l3PropertyScore, weight: 25 },
    { score: observabilityScore, weight: 15 },
    { score: repairScore, weight: 10 }
  ]) || 0;

  const band = simulationReadinessBand(overallScore);

  const structuralSignals = [
    `${sourceSignals.partDefs + sourceSignals.itemDefs + sourceSignals.portDefs} core SysML definitions`,
    sourceSignals.typedAttributes + sourceSignals.typedPins >= 8 ? `${sourceSignals.typedAttributes + sourceSignals.typedPins} typed attributes or pins` : "",
    relationshipSurface >= 6 ? `${relationshipSurface} explicit relationships or flows` : "",
    sourceSignals.stateDefs || sourceSignals.actionDefs ? `${sourceSignals.stateDefs + sourceSignals.actionDefs} executable definitions` : ""
  ].filter(Boolean);
  const structuralGaps = [
    sourceSignals.partDefs + sourceSignals.itemDefs + sourceSignals.portDefs < 4 ? "Add more explicit part, item, and port definitions." : "",
    sourceSignals.typedAttributes + sourceSignals.typedPins < 6 ? "Type more attributes, ports, inputs, and outputs for stronger compiler feedback." : "",
    relationshipSurface < 4 ? "Model more explicit connectors, references, or flows." : "",
    !sourceSignals.actionDefs && !sourceSignals.stateDefs ? "Add executable action or state definitions to move beyond a static structure-only model." : ""
  ].filter(Boolean);

  const behaviorSignals = [
    sourceSignals.stateDefs ? `${sourceSignals.stateDefs} state definitions` : "",
    sourceSignals.transitions >= 3 ? `${sourceSignals.transitions} transitions` : "",
    actionableSteps.length >= 4 ? `${actionableSteps.length} actionable steps` : "",
    sourceSignals.calcDefs + sourceSignals.constraints ? `${sourceSignals.calcDefs + sourceSignals.constraints} parametric or constraint blocks` : "",
    (sequenceValidity.score ?? 0) >= 70 ? sequenceValidity.metricCopy : ""
  ].filter(Boolean);
  const behaviorGaps = [
    !sourceSignals.stateDefs && !actionableSteps.length ? "Add state machines or activity behavior that can actually execute." : "",
    sourceSignals.stateDefs && sourceSignals.transitions < 2 ? "Model more transitions so simulation can expose behavior, not just isolated states." : "",
    actionableSteps.length && controlCoverage < 70 ? "Strengthen the control flow between activity steps." : "",
    !sourceSignals.calcDefs && !sourceSignals.constraints ? "If the model is parametric, add explicit calc or constraint definitions for FMU-style execution." : "",
    actionableSteps.length && (sequenceValidity.score ?? 0) < 70 ? "Tighten the activity-to-sequence mapping so execution traces stay faithful." : ""
  ].filter(Boolean);

  const propertySignals = [
    sourceSignals.guards >= 2 ? `${sourceSignals.guards} guards or logical conditions` : "",
    sourceSignals.comparisonOps >= 3 ? `${sourceSignals.comparisonOps} threshold or comparison expressions` : "",
    sourceSignals.stateDefs ? "state-machine structure suitable for CTL/LTL style reasoning" : "",
    sourceSignals.timeTerms ? `${sourceSignals.timeTerms} timing cues` : "",
    sourceSignals.probabilityTerms ? `${sourceSignals.probabilityTerms} probabilistic cues` : ""
  ].filter(Boolean);
  const propertyGaps = [
    !sourceSignals.stateDefs && !actionableSteps.length ? "Add state or action semantics before expecting model-checker-ready properties." : "",
    sourceSignals.guards + sourceSignals.comparisonOps < 3 ? "Add more guards, thresholds, or boolean conditions that temporal properties can reference." : "",
    !dataConcepts.length ? "Expose more named signals or values so violated properties can point to something concrete." : "",
    !sourceSignals.timeTerms ? "Timed verification will stay weak until the model exposes timing or deadline semantics." : ""
  ].filter(Boolean);

  const observabilitySignals = [
    sourceSignals.portDefs + portsOnParts >= 4 ? `${sourceSignals.portDefs + portsOnParts} ports or port definitions` : "",
    itemBlocks ? `${itemBlocks} item definitions` : "",
    labeledDataEdges + labeledMessages >= 4 ? `${labeledDataEdges + labeledMessages} labeled exchanges` : "",
    dataConcepts.length >= 4 ? `${dataConcepts.length} named data concepts` : "",
    (sequenceValidity.score ?? 0) >= 70 ? sequenceValidity.scoreText : ""
  ].filter(Boolean);
  const observabilityGaps = [
    sourceSignals.portDefs + portsOnParts < 4 ? "Add more ports or port defs so traces can expose observable inputs and outputs." : "",
    labeledDataEdges + labeledMessages < 3 ? "Label more exchanged values, messages, or flows." : "",
    dataConcepts.length < 3 ? "Make the simulated state and data more explicit so the oracle can inspect it." : "",
    sourceSignals.calcDefs + sourceSignals.constraints === 0 && sourceSignals.stateDefs === 0 ? "Add executable state or constraint constructs that can emit traces." : ""
  ].filter(Boolean);

  const repairSignals = [
    sourceSignals.transitions ? `${sourceSignals.transitions} named transitions` : "",
    sourceSignals.actionDefs ? `${sourceSignals.actionDefs} named action defs` : "",
    sourceSignals.calcDefs + sourceSignals.constraints ? `${sourceSignals.calcDefs + sourceSignals.constraints} named calculations or constraints` : "",
    observabilityScore >= 70 ? "trace surface is strong enough for targeted counterexamples" : "",
    l3PropertyScore >= 70 ? "property layer has enough anchors for precise repair prompts" : ""
  ].filter(Boolean);
  const repairGaps = [
    sourceSignals.transitions + sourceSignals.actionDefs + sourceSignals.calcDefs + sourceSignals.constraints < 4 ? "Break behavior into more named transitions, actions, or constraints so repairs can target specific fragments." : "",
    observabilityScore < 70 ? "Strengthen trace observability before relying on counterexample-driven repair." : "",
    l3PropertyScore < 70 ? "Add more guards, thresholds, and state structure so violated properties map cleanly back to the model." : "",
    !sourceSignals.acceptEvents && !sourceSignals.guards ? "Model explicit events or guard conditions to make conflict diagnosis clearer." : ""
  ].filter(Boolean);

  const overallSignals = uniqueBy(
    [
      l1StructuralScore >= 70 ? "Layer 1 compiler and type-resolution signals look strong." : "",
      l2BehavioralScore >= 70 ? "Layer 2 executable behavior looks ready for simulation feedback." : "",
      l3PropertyScore >= 70 ? "Layer 3 property translation and checking look plausible." : "",
      observabilityScore >= 70 ? "Simulation traces should be observable enough to compare against requirements." : "",
      repairScore >= 70 ? "Counterexamples should be localized enough to drive targeted repair." : ""
    ].filter(Boolean),
    (value) => value
  );
  const overallGaps = uniqueBy(
    [
      l1StructuralScore < 70 ? "Strengthen the structural and typing surface for compiler-in-the-loop repair." : "",
      l2BehavioralScore < 70 ? "Add richer executable behavior for the simulation layer." : "",
      l3PropertyScore < 70 ? "Add more guards, thresholds, and state semantics for formal property checking." : "",
      observabilityScore < 70 ? "Expose more state, values, and interfaces so behavioral oracles can inspect the run." : "",
      repairScore < 70 ? "Name and modularize behavioral fragments so repair prompts can stay targeted." : ""
    ].filter(Boolean),
    (value) => value
  );

  const cards = [
    buildAnalysisCard({
      id: "simulation:basis",
      title: "SENTINEL Rubric Basis",
      kind: "Draft Paper Basis",
      body:
        "This rubric follows the SENTINEL paper's Generate-Simulate-Verify framing. It grades whether a SysML v2 model looks ready for Layer 1 compiler repair, Layer 2 executable simulation, Layer 3 property verification, and the targeted counterexample-and-human arbitration loop described in the paper.",
      rationale:
        "The paper treats trustworthy model generation as a grounded feedback stack: structural validity, behavioral execution, property checking, and repair on top of observable traces. This score converts those paper concepts into a practical readiness checklist inside the visualizer.",
      detailRows: compactDetailRows([
        ["Paper", "SENTINEL: Simulation-Grounded Verification for System Model Generation from Natural Language"],
        ["Framework", "Generate-Simulate-Verify (GSV)"],
        ["Evidence Source", sourcePath || "Current loaded SysML2 text"],
        ["Rubric Dimensions", "L1 structural, L2 behavioral, L3 property, trace observability, and repairability"],
        ["Paper Dataset", "1,935 NL-SysML v2 pairs"]
      ]),
      matchedTerms: [
        "Compiler-in-the-loop",
        "Simulation traces",
        "Property verification",
        "Human-in-the-loop arbitration"
      ],
      matchedLabel: "Paper themes",
      missingTerms: [],
      missingLabel: "Improvement cues",
      wide: true
    }),
    buildAnalysisCard({
      id: "simulation:overall",
      title: "Overall GSV Readiness",
      kind: "Readiness Score",
      scoreText: formatPercentScore(overallScore),
      scoreValue: overallScore,
      body: band.summary,
      rationale: buildSimulationRationale("Overall", overallScore, overallSignals, overallGaps),
      detailRows: compactDetailRows([
        ["Readiness Band", band.label],
        ["Source", sourcePath || "Pasted or local model"],
        ["Sequence Validity", sequenceValidity.scoreText],
        ["Actionable Steps", String(actionableSteps.length)],
        ["State Definitions", String(sourceSignals.stateDefs)],
        ["Transitions", String(sourceSignals.transitions)]
      ]),
      matchedTerms: overallSignals,
      missingTerms: overallGaps,
      matchedLabel: "Ready signals",
      missingLabel: "Improvement cues"
    }),
    buildAnalysisCard({
      id: "simulation:l1",
      title: "L1 Structural Validation",
      kind: "Compiler Readiness",
      scoreText: formatPercentScore(l1StructuralScore),
      scoreValue: l1StructuralScore,
      body: "Readiness for parser and compiler feedback: typed definitions, explicit references, and enough named structure for syntax and type-resolution repair loops.",
      rationale: buildSimulationRationale("Layer 1 structural", l1StructuralScore, structuralSignals, structuralGaps),
      detailRows: compactDetailRows([
        ["Definitions", String(sourceSignals.partDefs + sourceSignals.itemDefs + sourceSignals.portDefs)],
        ["Relationships", String(relationshipSurface)],
        ["Typed Attributes / Pins", String(sourceSignals.typedAttributes + sourceSignals.typedPins)],
        ["Imports", String(sourceSignals.imports)]
      ]),
      matchedTerms: structuralSignals,
      missingTerms: structuralGaps,
      matchedLabel: "Ready signals",
      missingLabel: "Improvement cues"
    }),
    buildAnalysisCard({
      id: "simulation:l2",
      title: "L2 Behavioral Simulation",
      kind: "Execution Readiness",
      scoreText: formatPercentScore(l2BehavioralScore),
      scoreValue: l2BehavioralScore,
      body: "Readiness for the paper's execution layer: executable state machines, action flows, or parametric constructs that can produce behavioral traces.",
      rationale: buildSimulationRationale("Layer 2 behavioral", l2BehavioralScore, behaviorSignals, behaviorGaps),
      detailRows: compactDetailRows([
        ["State Definitions", String(sourceSignals.stateDefs)],
        ["Transitions", String(sourceSignals.transitions)],
        ["Actionable Steps", String(actionableSteps.length)],
        ["Control Flows", String(controlEdges)],
        ["Calc / Constraint Blocks", String(sourceSignals.calcDefs + sourceSignals.constraints)],
        ["Start / End Nodes", `${startCount} / ${endCount}`]
      ]),
      matchedTerms: behaviorSignals,
      missingTerms: behaviorGaps,
      matchedLabel: "Ready signals",
      missingLabel: "Improvement cues"
    }),
    buildAnalysisCard({
      id: "simulation:l3",
      title: "L3 Property Verification",
      kind: "Verification Readiness",
      scoreText: formatPercentScore(l3PropertyScore),
      scoreValue: l3PropertyScore,
      body: "Readiness for temporal-logic and model-checker feedback: guards, thresholds, states, and observable values that can anchor safety, liveness, timed, or probabilistic properties.",
      rationale: buildSimulationRationale("Layer 3 property", l3PropertyScore, propertySignals, propertyGaps),
      detailRows: compactDetailRows([
        ["Guards / Conditions", String(sourceSignals.guards)],
        ["Comparisons / Thresholds", String(sourceSignals.comparisonOps)],
        ["Timed Cues", String(sourceSignals.timeTerms)],
        ["Probabilistic Cues", String(sourceSignals.probabilityTerms)]
      ]),
      matchedTerms: propertySignals,
      missingTerms: propertyGaps,
      matchedLabel: "Ready signals",
      missingLabel: "Improvement cues"
    }),
    buildAnalysisCard({
      id: "simulation:trace",
      title: "Trace Observability",
      kind: "Simulation Oracle",
      scoreText: formatPercentScore(observabilityScore),
      scoreValue: observabilityScore,
      body: "How well the model can emit the traces the paper relies on: state transitions, port values, labeled exchanges, and constraint-relevant observations.",
      rationale: buildSimulationRationale("Trace observability", observabilityScore, observabilitySignals, observabilityGaps),
      detailRows: compactDetailRows([
        ["Item Blocks", String(itemBlocks)],
        ["Ports / Port Defs", String(sourceSignals.portDefs + portsOnParts)],
        ["Labeled Exchanges", String(labeledDataEdges + labeledMessages + labeledConnectorFlows + labeledOperationalFlows)],
        ["Explicit Data Concepts", String(dataConcepts.length)],
        ["Sequence Validity", sequenceValidity.scoreText]
      ]),
      matchedTerms: observabilitySignals,
      missingTerms: observabilityGaps,
      matchedLabel: "Ready signals",
      missingLabel: "Improvement cues"
    }),
    buildAnalysisCard({
      id: "simulation:repair",
      title: "Repair and Arbitration",
      kind: "Counterexample Repair",
      scoreText: formatPercentScore(repairScore),
      scoreValue: repairScore,
      body: "How well the model is structured for targeted counterexamples, repair prompts, and human-in-the-loop arbitration when simulation and verification disagree.",
      rationale: buildSimulationRationale("Repair and arbitration", repairScore, repairSignals, repairGaps),
      detailRows: compactDetailRows([
        ["Named Actions", String(sourceSignals.actionDefs)],
        ["Named Transitions", String(sourceSignals.transitions)],
        ["Named Constraints", String(sourceSignals.calcDefs + sourceSignals.constraints)],
        ["Observability Score", formatPercentScore(observabilityScore)]
      ]),
      matchedTerms: repairSignals,
      missingTerms: repairGaps,
      matchedLabel: "Ready signals",
      missingLabel: "Improvement cues"
    })
  ];

  const metrics = [
    {
      id: "simulation:overall",
      label: "Readiness",
      valueText: formatPercentScore(overallScore),
      scoreValue: overallScore,
      copy: band.label
    },
    {
      id: "simulation:l1",
      label: "L1 Structural",
      valueText: formatPercentScore(l1StructuralScore),
      scoreValue: l1StructuralScore,
      copy: `${sourceSignals.partDefs + sourceSignals.itemDefs + sourceSignals.portDefs} defs, ${sourceSignals.typedAttributes + sourceSignals.typedPins} typed members`
    },
    {
      id: "simulation:l2",
      label: "L2 Behavior",
      valueText: formatPercentScore(l2BehavioralScore),
      scoreValue: l2BehavioralScore,
      copy: `${sourceSignals.stateDefs} state defs, ${actionableSteps.length} steps`
    },
    {
      id: "simulation:l3",
      label: "L3 Property",
      valueText: formatPercentScore(l3PropertyScore),
      scoreValue: l3PropertyScore,
      copy: `${sourceSignals.guards} guards, ${sourceSignals.comparisonOps} comparisons`
    },
    {
      id: "simulation:trace",
      label: "Observability",
      valueText: formatPercentScore(observabilityScore),
      scoreValue: observabilityScore,
      copy: `${sourceSignals.portDefs + portsOnParts} ports, ${labeledDataEdges + labeledMessages} trace labels`
    },
    {
      id: "simulation:repair",
      label: "Repair",
      valueText: formatPercentScore(repairScore),
      scoreValue: repairScore,
      copy: `${sourceSignals.transitions + sourceSignals.actionDefs} named repair anchors`
    }
  ];

  const links = [
    { from: "simulation:basis", to: "simulation:overall", label: "frames" },
    { from: "simulation:overall", to: "simulation:l1", label: "depends on" },
    { from: "simulation:overall", to: "simulation:l2", label: "depends on" },
    { from: "simulation:overall", to: "simulation:l3", label: "depends on" },
    { from: "simulation:overall", to: "simulation:trace", label: "depends on" },
    { from: "simulation:overall", to: "simulation:repair", label: "depends on" },
    { from: "simulation:l2", to: "simulation:trace", label: "validated by" },
    { from: "simulation:l3", to: "simulation:repair", label: "feeds" }
  ];

  return {
    overallScore,
    sequenceValidityScore: sequenceValidity.score ?? 0,
    sequenceValidityText: sequenceValidity.scoreText,
    band,
    cards,
    metrics,
    links
  };
}

function buildSimulationReadinessView(nextModel, sourcePath = "", sourceText = "") {
  const readiness = evaluateSimulationReadiness(nextModel, sourcePath, sourceText);
  return {
    title: "Simulation Readiness",
    summary:
      "SENTINEL-style grading for whether the current SysML2 model is ready for compiler, simulation, and property-verification feedback.",
    hero: {
      title: `${readiness.band.label} Model`,
      copy:
        "This tab applies the SENTINEL paper's Generate-Simulate-Verify lens: Layer 1 structural validity, Layer 2 behavioral execution, Layer 3 property verification, and the trace-and-repair loop wrapped around them.",
      scoreText: formatPercentScore(readiness.overallScore),
      scoreValue: readiness.overallScore
    },
    metrics: readiness.metrics,
    cards: readiness.cards,
    links: readiness.links
  };
}

function meValComplianceScore(passedCount, failedCount) {
  return passedCount + failedCount ? (passedCount / (passedCount + failedCount)) * 100 : null;
}

function meValCategoryDescription(sheetName) {
  const descriptions = {
    "Standard Modeling": "Core naming, structural hygiene, and activity-control integrity checks from the workbook's standard modeling rules.",
    "Optional": "Optional rigor checks that strengthen typing discipline and executable-quality interfaces when those concepts are present.",
    "Executable": "Executable-model checks focused on message semantics, signal realization, and behavior that can participate in simulation."
  };
  return descriptions[sheetName] || "Workbook-derived modeling checks.";
}

function flattenMeValRulesSnapshot() {
  return (ME_VAL_RULES_SNAPSHOT.sheets || []).flatMap((sheet) =>
    (sheet.rules || []).map((rule) => ({
      ...rule,
      sheet: sheet.sheet
    }))
  );
}

function collectActivityAdjacency(activityView) {
  const incoming = new Map();
  const outgoing = new Map();
  const nodeLookup = Object.fromEntries((activityView.nodes || []).map((node) => [node.id, node]));
  (activityView.edges || []).forEach((edge) => {
    incoming.set(edge.to, [...(incoming.get(edge.to) || []), edge]);
    outgoing.set(edge.from, [...(outgoing.get(edge.from) || []), edge]);
  });
  return { incoming, outgoing, nodeLookup };
}

function countEnumLiteralCandidates(bodyText) {
  const cleaned = String(bodyText || "")
    .replace(/\bdoc\s+(?:\/\*[\s\S]*?\*\/|"[^"]*")/g, " ")
    .replace(/[{}]/g, " ");
  return uniqueBy(
    cleaned
      .split(/\r?\n/)
      .flatMap((line) => line.split(/[;,]/))
      .map((token) => token.trim())
      .filter((token) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(token)),
    (token) => token
  ).length;
}

function buildMeValContext(nextModel, sourceText = "") {
  const source = stripVisualizerMetadataBlock(String(sourceText || ""));
  const modelData = nextModel.modelData || { definitions: [], operationalActors: [], flows: [] };
  const activityView = nextModel.views.activity || { nodes: [], edges: [], inputs: [], outputs: [] };
  const bddView = nextModel.views.bdd || { blocks: [], relationships: [] };
  const ibdView = nextModel.views.ibd || { parts: [], connectors: [] };
  const sequenceView = nextModel.views.sequence || { participants: [], executions: [], messages: [] };
  const { incoming, outgoing, nodeLookup } = collectActivityAdjacency(activityView);
  const definitions = modelData.definitions || [];
  const operations = definitions.flatMap((definition) =>
    (definition.operations || []).map((operation) => ({
      owner: definition.name,
      name: String(operation || "").replace(/\(\)$/, "").trim()
    }))
  );
  const attributeEntries = definitions.flatMap((definition) =>
    (definition.attributes || []).map((attribute) => {
      const parts = String(attribute || "").split(":");
      return {
        owner: definition.name,
        name: (parts[0] || "").trim(),
        type: parts.slice(1).join(":").trim()
      };
    })
  );
  const definitionPins = definitions.flatMap((definition) =>
    (definition.pins || []).map((pin) => ({
      owner: definition.name,
      nodeId: "",
      direction: pin.direction || "",
      name: pin.name || "",
      type: pin.type || "",
      binding: pin.binding || ""
    }))
  );
  const activityPinEntries = (activityView.nodes || []).flatMap((node) => [
    ...(node.inputs || []).map((pin) => ({
      owner: node.performer || "System",
      nodeId: node.id,
      direction: "in",
      name: pin.name || "",
      type: pin.type || "",
      binding: pin.binding || ""
    })),
    ...(node.outputs || []).map((pin) => ({
      owner: node.performer || "System",
      nodeId: node.id,
      direction: "out",
      name: pin.name || "",
      type: pin.type || "",
      binding: pin.binding || ""
    }))
  ]);
  const allPinEntries = [...definitionPins, ...activityPinEntries];
  const candidateLabels = new Set(buildActivityActorCandidates(modelData).map((candidate) => candidate.label));
  const connectorPairs = new Set();
  (ibdView.connectors || []).forEach((connector) => {
    const from = String(connector.from || "").split(".")[0];
    const to = String(connector.to || "").split(".")[0];
    if (from && to) {
      connectorPairs.add(`${from}->${to}`);
      connectorPairs.add(`${to}->${from}`);
    }
  });
  const enumBlocks = captureNamedBlocks(source, ["enum def"]).map((entry) => ({
    name: entry.name,
    literalCount: countEnumLiteralCandidates(extractBody(entry.block))
  }));
  const constraintBodies = captureConstraintBodies(source).map((block) => extractBody(block).trim());
  return {
    source,
    nextModel,
    explicitActivityCount:
      countPatternMatches(source, /\baction\s+def\b/gi) +
      countPatternMatches(source, /^\s*action\s+[A-Za-z_][A-Za-z0-9_]*[^;\n]*\{/gm),
    classDeclarationCount: countPatternMatches(source, /\bclass\s+[A-Za-z_][A-Za-z0-9_]*/g),
    nestedUntypedParts: [...source.matchAll(/^\s{2,}part\s+[A-Za-z_][A-Za-z0-9_]*\s*(?:;|\{)/gm)].map((match) => match[0].trim()),
    untypedAttributes: [...source.matchAll(/^\s{2,}(?:in|out|inout\s+)?attribute\s+[A-Za-z_][A-Za-z0-9_]*\s*;/gm)].map((match) => match[0].trim()),
    hasNamedPackage: /\bpackage\s+('[^']+'|"[^"]+"|[A-Za-z_][A-Za-z0-9_]*)\s*\{/.test(source),
    enumBlocks,
    constraintBodies,
    modelData,
    activityView,
    bddView,
    ibdView,
    sequenceView,
    definitions,
    operations,
    attributeEntries,
    allPinEntries,
    contextPart: chooseContextPart(modelData),
    candidateLabels,
    topLevelFlows: nextModel.sourceMeta?.topLevelFlows || [],
    connectorPairs,
    incoming,
    outgoing,
    nodeLookup
  };
}

function meValRuleOutcome(rule, status, detail, support = "direct") {
  return {
    ...rule,
    status,
    detail,
    support,
    scoreValue: status === "pass" ? 100 : status === "fail" ? 0 : null
  };
}

function evaluateMeValRule(rule, context) {
  const controlKinds = new Set(["decision", "merge", "fork", "join", "end"]);
  const behaviorModeled = context.explicitActivityCount > 0;
  const decisionNodes = (context.activityView.nodes || []).filter((node) => node.kind === "decision");
  const mergeJoinNodes = (context.activityView.nodes || []).filter((node) => ["merge", "join"].includes(node.kind));
  const flowFinalNodes = (context.activityView.nodes || []).filter((node) => node.kind === "end");
  const startNodes = (context.activityView.nodes || []).filter((node) => node.kind === "start");
  const acceptNodes = (context.activityView.nodes || []).filter((node) => node.kind === "accept");
  const messages = context.sequenceView.messages || [];

  switch (rule.name) {
    case "ACTIVITYEDGEINCOMING": {
      if (!behaviorModeled) {
        return meValRuleOutcome(rule, "not_applicable", "No explicit activity model was parsed from the source.");
      }
      const candidates = (context.activityView.nodes || []).filter((node) => controlKinds.has(node.kind));
      if (!candidates.length) {
        return meValRuleOutcome(rule, "not_applicable", "The activity model does not include control nodes that require incoming flows.");
      }
      const failing = candidates.filter((node) => (context.incoming.get(node.id) || []).length < 1);
      return failing.length
        ? meValRuleOutcome(rule, "fail", `${failing.map((node) => node.label).join(", ")} are missing incoming flows.`)
        : meValRuleOutcome(rule, "pass", `${candidates.length} control nodes each have at least one incoming flow.`);
    }
    case "ACTIVITYNAME":
      if (!behaviorModeled) {
        return meValRuleOutcome(rule, "not_applicable", "No explicit activity definition was found in the source.");
      }
      return String(context.activityView.title || "").trim()
        ? meValRuleOutcome(rule, "pass", `Activity view title is "${context.activityView.title}".`)
        : meValRuleOutcome(rule, "fail", "The parsed activity view does not expose a stable activity name.");
    case "ACTORNAME":
      if (!(context.nextModel.views.ov1.actors || []).length) {
        return meValRuleOutcome(rule, "not_applicable", "No operational actors were derived for the OV-1 view.");
      }
      return (context.nextModel.views.ov1.actors || []).every((actor) => String(actor.label || "").trim())
        ? meValRuleOutcome(rule, "pass", `${context.nextModel.views.ov1.actors.length} operational actors have labels.`)
        : meValRuleOutcome(rule, "fail", "At least one derived operational actor is missing a label.");
    case "BLOCKNAME":
      if (!(context.bddView.blocks || []).length) {
        return meValRuleOutcome(rule, "not_applicable", "No BDD blocks were derived from the model.");
      }
      return (context.bddView.blocks || []).every((block) => String(block.name || "").trim())
        ? meValRuleOutcome(rule, "pass", `${context.bddView.blocks.length} BDD blocks have names.`)
        : meValRuleOutcome(rule, "fail", "At least one BDD block is unnamed.");
    case "CLASSPROHIBIT-EDIT":
      return context.classDeclarationCount > 0
        ? meValRuleOutcome(rule, "fail", `${context.classDeclarationCount} raw class declarations were found in the source text.`)
        : meValRuleOutcome(rule, "pass", "No raw class declarations were detected in the source text.");
    case "CONSTRAINTSPECIFICATION":
      if (!context.constraintBodies.length) {
        return meValRuleOutcome(rule, "not_applicable", "No `require constraint` blocks were found.");
      }
      return context.constraintBodies.every((body) => body.trim())
        ? meValRuleOutcome(rule, "pass", `${context.constraintBodies.length} constraint blocks include content.`)
        : meValRuleOutcome(rule, "fail", "At least one constraint block is empty.");
    case "CONTROLNODEINCOMING":
      if (!behaviorModeled) {
        return meValRuleOutcome(rule, "not_applicable", "No explicit activity model was parsed from the source.");
      }
      if (!mergeJoinNodes.length) {
        return meValRuleOutcome(rule, "not_applicable", "The activity model does not include merge or join nodes.");
      }
      return mergeJoinNodes.every((node) => (context.incoming.get(node.id) || []).length >= 2)
        ? meValRuleOutcome(rule, "pass", `${mergeJoinNodes.length} merge or join nodes have at least two incoming flows.`)
        : meValRuleOutcome(
            rule,
            "fail",
            `${mergeJoinNodes.filter((node) => (context.incoming.get(node.id) || []).length < 2).map((node) => node.label).join(", ")} need additional incoming flows.`
          );
    case "CONTROLNODEOUTGOING": {
      if (!behaviorModeled) {
        return meValRuleOutcome(rule, "not_applicable", "No explicit activity model was parsed from the source.");
      }
      const forkDecisionNodes = (context.activityView.nodes || []).filter((node) => ["fork", "decision"].includes(node.kind));
      if (!forkDecisionNodes.length) {
        return meValRuleOutcome(rule, "not_applicable", "The activity model does not include fork or decision nodes.");
      }
      return forkDecisionNodes.every((node) => (context.outgoing.get(node.id) || []).length >= 2)
        ? meValRuleOutcome(rule, "pass", `${forkDecisionNodes.length} fork or decision nodes have at least two outgoing flows.`)
        : meValRuleOutcome(
            rule,
            "fail",
            `${forkDecisionNodes.filter((node) => (context.outgoing.get(node.id) || []).length < 2).map((node) => node.label).join(", ")} need additional outgoing flows.`
          );
    }
    case "DECISIONNODENAME":
      if (!decisionNodes.length) {
        return meValRuleOutcome(rule, "not_applicable", "The activity model does not include decision nodes.");
      }
      return decisionNodes.every((node) => String(node.label || node.id || "").trim())
        ? meValRuleOutcome(rule, "pass", `${decisionNodes.length} decision nodes have labels or identifiers.`)
        : meValRuleOutcome(rule, "fail", "At least one decision node is unnamed.");
    case "ENUMERATIONLITERAL":
      if (!context.enumBlocks.length) {
        return meValRuleOutcome(rule, "not_applicable", "No enum definitions were found in the source text.");
      }
      return context.enumBlocks.every((block) => block.literalCount > 0)
        ? meValRuleOutcome(rule, "pass", `${context.enumBlocks.length} enum definitions include one or more literal candidates.`)
        : meValRuleOutcome(
            rule,
            "fail",
            `${context.enumBlocks.filter((block) => block.literalCount < 1).map((block) => block.name).join(", ")} do not expose any literal candidates in their bodies.`,
            "approximate"
          );
    case "FLOWFINALINCOMING":
      if (!behaviorModeled) {
        return meValRuleOutcome(rule, "not_applicable", "No explicit activity model was parsed from the source.");
      }
      if (!flowFinalNodes.length) {
        return meValRuleOutcome(rule, "not_applicable", "The activity model does not include end or flow-final style nodes.");
      }
      return flowFinalNodes.every((node) => (context.incoming.get(node.id) || []).length >= 1)
        ? meValRuleOutcome(rule, "pass", `${flowFinalNodes.length} end nodes have incoming flows.`)
        : meValRuleOutcome(
            rule,
            "fail",
            `${flowFinalNodes.filter((node) => (context.incoming.get(node.id) || []).length < 1).map((node) => node.label).join(", ")} do not have incoming flows.`
          );
    case "MERGEJOINOUTGOING":
      if (!behaviorModeled) {
        return meValRuleOutcome(rule, "not_applicable", "No explicit activity model was parsed from the source.");
      }
      if (!mergeJoinNodes.length) {
        return meValRuleOutcome(rule, "not_applicable", "The activity model does not include merge or join nodes.");
      }
      return mergeJoinNodes.every((node) => (context.outgoing.get(node.id) || []).length === 1)
        ? meValRuleOutcome(rule, "pass", `${mergeJoinNodes.length} merge or join nodes each have exactly one outgoing flow.`)
        : meValRuleOutcome(
            rule,
            "fail",
            `${mergeJoinNodes.filter((node) => (context.outgoing.get(node.id) || []).length !== 1).map((node) => node.label).join(", ")} do not have exactly one outgoing flow.`
          );
    case "OPERATIONNAME":
      if (!context.operations.length) {
        return meValRuleOutcome(rule, "not_applicable", "No operations were parsed from the model.");
      }
      return context.operations.every((operation) => String(operation.name || "").trim())
        ? meValRuleOutcome(rule, "pass", `${context.operations.length} operations have names.`)
        : meValRuleOutcome(rule, "fail", "At least one parsed operation is unnamed.");
    case "PACKAGENAME":
      return context.hasNamedPackage
        ? meValRuleOutcome(rule, "pass", `Package "${context.nextModel.sourceMeta?.packageName || context.nextModel.title}" is named.`)
        : meValRuleOutcome(rule, "fail", "The source text does not declare a named package.");
    case "SIGNALEVENTSIGNAL":
      if (!acceptNodes.length) {
        return meValRuleOutcome(rule, "not_applicable", "No accept-event nodes were parsed from the activity model.");
      }
      return acceptNodes.every((node) => String(node.eventType || "").trim())
        ? meValRuleOutcome(rule, "pass", `${acceptNodes.length} accept-event nodes declare an event type.`)
        : meValRuleOutcome(rule, "fail", `${acceptNodes.filter((node) => !String(node.eventType || "").trim()).map((node) => node.label).join(", ")} do not declare an event type.`);
    case "ACTIVITYEDGEGUARD": {
      if (!behaviorModeled) {
        return meValRuleOutcome(rule, "not_applicable", "No explicit activity model was parsed from the source.");
      }
      if (!decisionNodes.length) {
        return meValRuleOutcome(rule, "not_applicable", "The activity model does not include decision nodes.");
      }
      const guardFailures = decisionNodes.filter((node) => {
        const outgoingEdges = context.outgoing.get(node.id) || [];
        return outgoingEdges.length > 0 && outgoingEdges.some((edge) => !String(edge.controlLabel || edge.label || "").trim());
      });
      return guardFailures.length
        ? meValRuleOutcome(rule, "fail", `${guardFailures.map((node) => node.label).join(", ")} have decision exits without labels or guard-like text.`, "approximate")
        : meValRuleOutcome(rule, "pass", `${decisionNodes.length} decision nodes have labels on their outgoing flows.`, "approximate");
    }
    case "ACTIVITYFINAL":
      if (!behaviorModeled) {
        return meValRuleOutcome(rule, "not_applicable", "No explicit activity model was parsed from the source.");
      }
      return flowFinalNodes.length >= 1
        ? meValRuleOutcome(rule, "pass", `${flowFinalNodes.length} final or end nodes were found.`)
        : meValRuleOutcome(rule, "fail", "The activity model does not expose a final or end node.");
    case "ACTIVITYINITIAL":
      if (!behaviorModeled) {
        return meValRuleOutcome(rule, "not_applicable", "No explicit activity model was parsed from the source.");
      }
      if (!startNodes.length) {
        return meValRuleOutcome(rule, "fail", "The activity model does not expose an initial or start node.");
      }
      if (startNodes.length !== 1) {
        return meValRuleOutcome(rule, "fail", `Expected one start node but found ${startNodes.length}.`);
      }
      return (context.outgoing.get(startNodes[0].id) || []).length >= 1
        ? meValRuleOutcome(rule, "pass", `Start node "${startNodes[0].label}" has an outgoing flow.`)
        : meValRuleOutcome(rule, "fail", `Start node "${startNodes[0].label}" does not have an outgoing flow.`);
    case "CONTEXTPARTS":
      if (!context.definitions.some((definition) => definition.kind === "part")) {
        return meValRuleOutcome(rule, "not_applicable", "No part definitions were parsed from the model.");
      }
      return context.contextPart && (context.contextPart.parts || []).length >= 1
        ? meValRuleOutcome(rule, "pass", `Context block "${context.contextPart.name}" owns ${(context.contextPart.parts || []).length} part properties.`)
        : meValRuleOutcome(rule, "fail", "No context-style block with owned part properties could be found.");
    case "FLOWCONNECTOR":
      if (!context.topLevelFlows.length) {
        return meValRuleOutcome(rule, "not_applicable", "No top-level operational flows were found in the source.");
      }
      const unmatchedFlows = context.topLevelFlows.filter((flow) => !context.connectorPairs.has(`${flow.from}->${flow.to}`));
      return unmatchedFlows.length
        ? meValRuleOutcome(
            rule,
            "fail",
            `${unmatchedFlows.map((flow) => `${flow.from}->${flow.to}`).join(", ")} are not realized by IBD connectors.`,
            "approximate"
          )
        : meValRuleOutcome(rule, "pass", `${context.topLevelFlows.length} top-level flows are represented by IBD connectors.`, "approximate");
    case "GUARDSOURCE": {
      const guardedEdges = (context.activityView.edges || []).filter((edge) => String(edge.controlLabel || "").trim());
      if (!guardedEdges.length) {
        return meValRuleOutcome(rule, "not_applicable", "No guarded control flows were found.");
      }
      const invalid = guardedEdges.filter((edge) => context.nodeLookup[edge.from]?.kind !== "decision");
      return invalid.length
        ? meValRuleOutcome(rule, "fail", `${invalid.map((edge) => `${edge.from}->${edge.to}`).join(", ")} carry guard text but do not originate from decision nodes.`)
        : meValRuleOutcome(rule, "pass", `${guardedEdges.length} guarded flows originate from decision nodes.`);
    }
    case "INPINCONN": {
      const actionableInputs = (context.activityView.nodes || []).flatMap((node) =>
        (node.inputs || []).map((input) => ({ node, input }))
      );
      if (!actionableInputs.length) {
        return meValRuleOutcome(rule, "not_applicable", "No activity input pins were parsed from the model.");
      }
      const failing = actionableInputs.filter(({ node, input }) => !String(input.binding || "").trim() && !(context.incoming.get(node.id) || []).length);
      return failing.length
        ? meValRuleOutcome(rule, "fail", `${failing.map(({ node, input }) => `${node.label}.${input.name}`).join(", ")} are missing incoming object-flow evidence.`, "approximate")
        : meValRuleOutcome(rule, "pass", `${actionableInputs.length} activity input pins have bindings or incoming flows.`, "approximate");
    }
    case "LIFELINETYPE": {
      if (!behaviorModeled) {
        return meValRuleOutcome(rule, "not_applicable", "No explicit activity model was parsed from the source.");
      }
      const participants = (context.sequenceView.participants || []).filter(
        (participant) => !["System", "External"].includes(participant.id)
      );
      if (!participants.length) {
        return meValRuleOutcome(rule, "not_applicable", "No non-generic lifelines were derived for the sequence view.");
      }
      const failing = participants.filter((participant) => !context.candidateLabels.has(participant.label));
      return failing.length
        ? meValRuleOutcome(rule, "fail", `${failing.map((participant) => participant.label).join(", ")} do not map back to derived block-typed performers.`, "approximate")
        : meValRuleOutcome(rule, "pass", `${participants.length} lifelines map back to derived block or part performers.`, "approximate");
    }
    case "OPOWNER":
      if (!context.operations.length) {
        return meValRuleOutcome(rule, "not_applicable", "No operations were parsed from the model.");
      }
      return meValRuleOutcome(rule, "pass", `${context.operations.length} parsed operations are owned by blocks or action-bearing definitions.`);
    case "OUTPINCONN": {
      const actionableOutputs = (context.activityView.nodes || []).flatMap((node) =>
        (node.outputs || []).map((output) => ({ node, output }))
      );
      if (!actionableOutputs.length) {
        return meValRuleOutcome(rule, "not_applicable", "No activity output pins were parsed from the model.");
      }
      const failing = actionableOutputs.filter(({ node }) => !(context.outgoing.get(node.id) || []).length);
      return failing.length
        ? meValRuleOutcome(rule, "fail", `${failing.map(({ node, output }) => `${node.label}.${output.name}`).join(", ")} are missing outgoing object-flow evidence.`, "approximate")
        : meValRuleOutcome(rule, "pass", `${actionableOutputs.length} activity output pins have outgoing flows.`, "approximate");
    }
    case "PARTTYPE":
      if (context.nestedUntypedParts.length) {
        return meValRuleOutcome(rule, "fail", `${context.nestedUntypedParts.length} nested part declarations appear to be missing explicit types.`, "approximate");
      }
      return context.definitions.some((definition) => (definition.parts || []).length)
        ? meValRuleOutcome(rule, "pass", `${context.definitions.reduce((sum, definition) => sum + (definition.parts || []).length, 0)} nested part properties were parsed with types.`, "approximate")
        : meValRuleOutcome(rule, "not_applicable", "No nested part properties were found in the source text.");
    case "PINTYPE": {
      if (!context.allPinEntries.length) {
        return meValRuleOutcome(rule, "not_applicable", "No pins were parsed from definitions or activities.");
      }
      const failing = context.allPinEntries.filter((pin) => !String(pin.type || "").trim());
      return failing.length
        ? meValRuleOutcome(rule, "fail", `${failing.length} pins are missing explicit types in the parsed subset.`, "approximate")
        : meValRuleOutcome(rule, "pass", `${context.allPinEntries.length} parsed pins declare explicit types.`, "approximate");
    }
    case "VALUETYPE":
      if (context.untypedAttributes.length) {
        return meValRuleOutcome(rule, "fail", `${context.untypedAttributes.length} attribute declarations appear to be missing types.`, "approximate");
      }
      return context.attributeEntries.length
        ? meValRuleOutcome(rule, "pass", `${context.attributeEntries.length} parsed attributes declare explicit types.`, "approximate")
        : meValRuleOutcome(rule, "not_applicable", "No typed attribute declarations were found.");
    case "ACTPARTYPE": {
      const activityPins = [...(context.activityView.inputs || []), ...(context.activityView.outputs || [])];
      if (!activityPins.length) {
        return meValRuleOutcome(rule, "not_applicable", "No activity parameter pins were found.");
      }
      const failing = activityPins.filter((pin) => !String(pin.type || "").trim());
      return failing.length
        ? meValRuleOutcome(rule, "fail", `${failing.length} activity parameter pins are missing explicit types.`, "approximate")
        : meValRuleOutcome(rule, "pass", `${activityPins.length} activity parameter pins declare explicit types.`, "approximate");
    }
    case "MESSAGESIGNATURE":
      if (!behaviorModeled) {
        return meValRuleOutcome(rule, "not_applicable", "No explicit activity model was parsed from the source.");
      }
      if (!messages.length) {
        return meValRuleOutcome(rule, "not_applicable", "No sequence messages were generated from the model.");
      }
      return messages.every((message) => String(message.label || "").trim())
        ? meValRuleOutcome(rule, "pass", `${messages.length} generated sequence messages carry labels or signatures.`, "approximate")
        : meValRuleOutcome(rule, "fail", "At least one generated sequence message is unlabeled.", "approximate");
    case "MESSAGEFLOWNEEDED":
      if (!behaviorModeled) {
        return meValRuleOutcome(rule, "not_applicable", "No explicit activity model was parsed from the source.");
      }
      if (!messages.length) {
        return meValRuleOutcome(rule, "not_applicable", "No sequence messages were generated from the model.");
      }
      return (context.ibdView.connectors || []).length || (context.activityView.edges || []).some((edge) => String(edge.dataLabel || "").trim())
        ? meValRuleOutcome(rule, "pass", "Sequence messages are backed by connectors or typed activity data flows.", "approximate")
        : meValRuleOutcome(rule, "fail", "Sequence messages were generated without connector or typed data-flow evidence.", "approximate");
    default:
      return meValRuleOutcome(rule, "unsupported", "This workbook rule depends on concepts the current SysML2 parser does not yet model.");
  }
}

function evaluateMeValRules(nextModel, sourceText = "") {
  const rules = flattenMeValRulesSnapshot();
  const context = buildMeValContext(nextModel, sourceText);
  const evaluations = rules.map((rule) => evaluateMeValRule(rule, context));
  const categories = (ME_VAL_RULES_SNAPSHOT.sheets || []).map((sheet) => {
    const sheetRules = evaluations.filter((evaluation) => evaluation.sheet === sheet.sheet);
    const supported = sheetRules.filter((evaluation) => evaluation.status !== "unsupported");
    const direct = supported.filter((evaluation) => evaluation.support === "direct");
    const approximate = supported.filter((evaluation) => evaluation.support === "approximate");
    const passed = supported.filter((evaluation) => evaluation.status === "pass");
    const failed = supported.filter((evaluation) => evaluation.status === "fail");
    const notApplicable = supported.filter((evaluation) => evaluation.status === "not_applicable");
    const unsupported = sheetRules.filter((evaluation) => evaluation.status === "unsupported");
    return {
      sheet: sheet.sheet,
      totalRules: sheetRules.length,
      supportedRules: supported.length,
      directRules: direct.length,
      approximateRules: approximate.length,
      passedRules: passed,
      failedRules: failed,
      notApplicableRules: notApplicable,
      unsupportedRules: unsupported,
      score: meValComplianceScore(passed.length, failed.length),
      coverageScore: sheetRules.length ? (supported.length / sheetRules.length) * 100 : null
    };
  });
  const supportedRules = evaluations.filter((evaluation) => evaluation.status !== "unsupported");
  const directRules = supportedRules.filter((evaluation) => evaluation.support === "direct");
  const approximateRules = supportedRules.filter((evaluation) => evaluation.support === "approximate");
  const passedRules = supportedRules.filter((evaluation) => evaluation.status === "pass");
  const failedRules = supportedRules.filter((evaluation) => evaluation.status === "fail");
  const notApplicableRules = supportedRules.filter((evaluation) => evaluation.status === "not_applicable");
  const unsupportedRules = evaluations.filter((evaluation) => evaluation.status === "unsupported");
  return {
    sourceWorkbook: ME_VAL_RULES_SNAPSHOT.source_workbook || "",
    totalRules: evaluations.length,
    supportedRules: supportedRules.length,
    directRules: directRules.length,
    approximateRules: approximateRules.length,
    passedRules,
    failedRules,
    notApplicableRules,
    unsupportedRules,
    complianceScore: meValComplianceScore(passedRules.length, failedRules.length),
    coverageScore: evaluations.length ? (supportedRules.length / evaluations.length) * 100 : null,
    categories,
    evaluations
  };
}

function buildMeValCategoryCard(category) {
  const passedNames = category.passedRules.map((rule) => rule.name);
  const failedNames = category.failedRules.map((rule) => rule.name);
  const unsupportedNames = category.unsupportedRules.map((rule) => rule.name);
  const body = `${meValCategoryDescription(category.sheet)} Supported ${category.supportedRules} of ${category.totalRules} workbook rules for this ruleset, with ${category.passedRules.length} passing and ${category.failedRules.length} failing on the current model.`;
  let rationale = "";
  if (category.failedRules.length) {
    rationale = `The main issues are ${formatSeries(category.failedRules.slice(0, 3).map((rule) => rule.name))}.`;
  } else if (category.passedRules.length) {
    rationale = `The strongest passes are ${formatSeries(category.passedRules.slice(0, 3).map((rule) => rule.name))}.`;
  } else if (category.notApplicableRules.length) {
    rationale = "The model does not currently expose many of the concepts this ruleset evaluates.";
  } else {
    rationale = "This ruleset is largely outside the observable scope of the current parser.";
  }
  return buildAnalysisCard({
    id: `analysis:meval:${sanitizeIdentifier(category.sheet, "ruleset")}`,
    title: category.sheet,
    kind: "ME VAL Ruleset",
    scoreText: formatPercentScore(category.score),
    scoreValue: category.score,
    body,
    rationale,
    detailRows: compactDetailRows([
      ["Total Rules", String(category.totalRules)],
      ["Supported Here", String(category.supportedRules)],
      ["Direct Checks", String(category.directRules)],
      ["Approximate Checks", String(category.approximateRules)],
      ["Passed", String(category.passedRules.length)],
      ["Failed", String(category.failedRules.length)],
      ["Not Applicable", String(category.notApplicableRules.length)],
      ["Unsupported", String(category.unsupportedRules.length)]
    ]),
    matchedTerms: passedNames,
    missingTerms: failedNames.length ? failedNames : unsupportedNames,
    matchedLabel: "Passing rules",
    missingLabel: failedNames.length ? "Failing rules" : "Unsupported rules"
  });
}

function buildAnalysisView(nextModel, analysisPayload = null, sourcePath = "", sourceText = "") {
  const scoreRow = analysisPayload?.score || null;
  const meta = analysisPayload?.meta || {};
  const intentText = String(analysisPayload?.intent_text || "").trim();
  const matchedTerms = parseAnalysisTerms(scoreRow?.matched_terms);
  const missingTerms = parseAnalysisTerms(scoreRow?.missing_terms);
  const overallSimilarity = numericScore(scoreRow?.similarity_percent);
  const structureScore = numericScore(scoreRow?.structure_score);
  const behaviorScore = numericScore(scoreRow?.behavior_score);
  const dataScore = numericScore(scoreRow?.data_score);
  const tokenRecallScore = numericScore(scoreRow?.token_recall_percent);
  const parseStatus = scoreRow?.parse_status || (scoreRow ? "ok" : "not_scored");
  const narrative = summarizeModelNarrative(nextModel);
  const sequenceValidity = evaluateSequenceValidity(nextModel);
  const meValEvaluation = evaluateMeValRules(nextModel, sourceText);
  const actionableSteps = nextModel.views.activity.nodes.filter((node) => ["action", "accept"].includes(node.kind)).length;
  const labeledFlows = nextModel.views.activity.edges.filter((edge) => edge.label).length;
  const cards = [
    buildAnalysisCard({
      id: "analysis:model",
      title: "Generated Model Narrative",
      kind: "Model Summary",
      body: narrative,
      detailRows: [
        ["Source", sourcePath || "Pasted or local model"],
        ["Blocks", String(nextModel.views.bdd.blocks.length)],
        ["Activity Steps", String(actionableSteps)],
        ["Sequence Messages", String(nextModel.views.sequence.messages.length)],
        ["Sequence Validity", sequenceValidity.scoreText]
      ],
      wide: true
    })
  ];

  if (intentText) {
    cards.push(
      buildAnalysisCard({
        id: "analysis:intent",
        title: "Reference Intent Description",
        kind: "Corpus TXT",
        body: intentText,
        detailRows: [
          ["Dataset Split", meta.split || "Unknown"],
          ["Quality", meta.quality || "Unknown"],
          ["Category", meta.category || "Unknown"]
        ],
        wide: true
      })
    );
  }

  cards.push(
    buildAnalysisCard({
      id: "analysis:overall",
      title: "Overall Similarity",
      kind: "Likert Rating",
      scoreText: scoreRow?.likert_score ? `${scoreRow.likert_score} / 5` : "N/A",
      scoreValue: overallSimilarity,
      body: "Composite similarity between the rendered SysML2 model and its paired natural-language TXT intent description.",
      rationale: buildScoreRationale("Overall", overallSimilarity, matchedTerms, missingTerms, parseStatus),
      detailRows: [
        ["Similarity", formatPercentScore(overallSimilarity, "Not scored")],
        ["Parse Status", parseStatus],
        ["Token Recall", formatPercentScore(tokenRecallScore, "Not scored")]
      ],
      matchedTerms,
      missingTerms
    }),
    buildAnalysisCard({
      id: "analysis:structure",
      title: "Structural Alignment",
      kind: "Structure Score",
      scoreText: formatPercentScore(structureScore),
      scoreValue: structureScore,
      body: "Alignment of the model's blocks, parts, and structural composition with the reference description.",
      rationale: buildScoreRationale("Structural", structureScore, matchedTerms, missingTerms, parseStatus),
      detailRows: [
        ["Score", formatPercentScore(structureScore, "Not scored")],
        ["Observed Blocks", String(nextModel.views.bdd.blocks.length)],
        ["Observed Parts", String(nextModel.views.ibd.parts.length)]
      ],
      matchedTerms
    }),
    buildAnalysisCard({
      id: "analysis:behavior",
      title: "Behavioral Alignment",
      kind: "Behavior Score",
      scoreText: formatPercentScore(behaviorScore),
      scoreValue: behaviorScore,
      body: "Alignment of modeled actions, control flow, and operational sequencing with the reference behavior description.",
      rationale: buildScoreRationale("Behavioral", behaviorScore, matchedTerms, missingTerms, parseStatus),
      detailRows: [
        ["Score", formatPercentScore(behaviorScore, "Not scored")],
        ["Activity Nodes", String(nextModel.views.activity.nodes.length)],
        ["Sequence Messages", String(nextModel.views.sequence.messages.length)]
      ],
      matchedTerms,
      missingTerms
    }),
    buildAnalysisCard({
      id: "analysis:data",
      title: "Data and Interface Alignment",
      kind: "Data Score",
      scoreText: formatPercentScore(dataScore),
      scoreValue: dataScore,
      body: "Alignment of exchanged data, interfaces, and item flows with the information concepts described in the companion TXT.",
      rationale: buildScoreRationale("Data and interface", dataScore, matchedTerms, missingTerms, parseStatus),
      detailRows: [
        ["Score", formatPercentScore(dataScore, "Not scored")],
        ["Item/Port Blocks", String(nextModel.views.bdd.blocks.filter((block) => ["<<item>>", "<<port>>", "<<attribute>>"].includes(block.stereotype)).length)],
        ["Labeled Flows", String(labeledFlows)]
      ],
      matchedTerms,
      missingTerms
    }),
    buildAnalysisCard({
      id: "analysis:sequence",
      title: "Sequence Diagram Validity",
      kind: "Sequence Quality",
      scoreText: sequenceValidity.scoreText,
      scoreValue: sequenceValidity.score,
      body: sequenceValidity.body,
      rationale: sequenceValidity.rationale,
      detailRows: sequenceValidity.detailRows
    })
  );

  cards.push(
    buildAnalysisCard({
      id: "analysis:meval-overall",
      title: "ME VAL Modeling Rules",
      kind: "Standards Compliance",
      scoreText: formatPercentScore(meValEvaluation.complianceScore),
      scoreValue: meValEvaluation.complianceScore,
      body: `Loaded ${meValEvaluation.totalRules} workbook rules from ${ME_VAL_RULES_SNAPSHOT.sheets?.length || 0} sheets. The current visualizer can assess ${meValEvaluation.supportedRules} rules from parsed SysML2 text, with ${meValEvaluation.passedRules.length} passing and ${meValEvaluation.failedRules.length} failing on this model.`,
      rationale: meValEvaluation.failedRules.length
        ? `The main failing checks are ${formatSeries(meValEvaluation.failedRules.slice(0, 4).map((rule) => rule.name))}.`
        : meValEvaluation.supportedRules
          ? "No supported ME VAL checks are currently failing on this model."
          : "The current parser does not yet observe enough of the workbook's concepts to score these checks.",
      detailRows: compactDetailRows([
        ["Workbook Rules", String(meValEvaluation.totalRules)],
        ["Supported Here", String(meValEvaluation.supportedRules)],
        ["Direct Checks", String(meValEvaluation.directRules)],
        ["Approximate Checks", String(meValEvaluation.approximateRules)],
        ["Passed", String(meValEvaluation.passedRules.length)],
        ["Failed", String(meValEvaluation.failedRules.length)],
        ["Not Applicable", String(meValEvaluation.notApplicableRules.length)],
        ["Unsupported", String(meValEvaluation.unsupportedRules.length)]
      ]),
      matchedTerms: meValEvaluation.passedRules.map((rule) => rule.name),
      missingTerms: meValEvaluation.failedRules.map((rule) => rule.name),
      matchedLabel: "Passing rules",
      missingLabel: "Failing rules",
      wide: true
    }),
    buildAnalysisCard({
      id: "analysis:meval-coverage",
      title: "ME VAL Coverage",
      kind: "Rules Coverage",
      scoreText: formatPercentScore(meValEvaluation.coverageScore),
      scoreValue: meValEvaluation.coverageScore,
      body: "How much of the ME VAL workbook the current visualizer can actually inspect from this SysML2 parser and derived views.",
      rationale: meValEvaluation.unsupportedRules.length
        ? `Unsupported checks are dominated by concepts such as ${formatSeries(uniqueBy(meValEvaluation.unsupportedRules.map((rule) => rule.name), (value) => value).slice(0, 4))}.`
        : "Every workbook rule is observable through the current parser.",
      detailRows: compactDetailRows([
        ["Coverage", formatPercentScore(meValEvaluation.coverageScore, "Not available")],
        ["Supported Rules", `${meValEvaluation.supportedRules}/${meValEvaluation.totalRules}`],
        ["Direct Checks", String(meValEvaluation.directRules)],
        ["Approximate Checks", String(meValEvaluation.approximateRules)],
        ["Unsupported Checks", String(meValEvaluation.unsupportedRules.length)]
      ]),
      matchedTerms: meValEvaluation.categories.filter((category) => category.supportedRules > 0).map((category) => category.sheet),
      missingTerms: meValEvaluation.unsupportedRules.map((rule) => rule.name),
      matchedLabel: "Covered rulesets",
      missingLabel: "Unsupported rules",
      wide: true
    }),
    ...meValEvaluation.categories.map((category) => buildMeValCategoryCard(category))
  );

  if (scoreRow) {
    cards.push(
      buildAnalysisCard({
        id: "analysis:tokens",
        title: "Reference Phrase Recall",
        kind: "Token Recall",
        scoreText: formatPercentScore(tokenRecallScore),
        scoreValue: tokenRecallScore,
        body: "Coverage of the strongest reference terms and phrases from the companion TXT description.",
        rationale: buildScoreRationale("Reference phrase", tokenRecallScore, matchedTerms, missingTerms, parseStatus),
        detailRows: [
          ["Recall", formatPercentScore(tokenRecallScore, "Not scored")],
          ["Matched Terms", String(matchedTerms.length)],
          ["Missing Terms", String(missingTerms.length)]
        ],
        matchedTerms,
        missingTerms
      })
    );
  } else {
    cards.push(
      buildAnalysisCard({
        id: "analysis:availability",
        title: "Similarity Score Availability",
        kind: "Unscored Model",
        body: "This model does not currently have a companion scored TXT comparison row. Load a corpus `.sysml` file from the `data` directory to see the precomputed similarity rating and rationale.",
        detailRows: [["Source", sourcePath || "Pasted or local model"]],
        wide: true
      })
    );
  }

  const metrics = [
    {
      id: "analysis:overall",
      label: "Similarity",
      valueText: scoreRow?.likert_score ? `${scoreRow.likert_score} / 5` : "N/A",
      scoreValue: overallSimilarity,
      copy: overallSimilarity === null ? "Corpus TXT score unavailable" : `${formatPercentScore(overallSimilarity)} corpus similarity`
    },
    {
      id: "analysis:structure",
      label: "Structure",
      valueText: formatPercentScore(structureScore),
      scoreValue: structureScore,
      copy: `${nextModel.views.bdd.blocks.length} blocks, ${nextModel.views.ibd.parts.length} parts`
    },
    {
      id: "analysis:behavior",
      label: "Behavior",
      valueText: formatPercentScore(behaviorScore),
      scoreValue: behaviorScore,
      copy: `${actionableSteps} actionable steps, ${nextModel.views.sequence.messages.length} sequence messages`
    },
    {
      id: "analysis:data",
      label: "Data",
      valueText: formatPercentScore(dataScore),
      scoreValue: dataScore,
      copy: `${labeledFlows} labeled flows, ${nextModel.views.bdd.blocks.filter((block) => ["<<item>>", "<<port>>", "<<attribute>>"].includes(block.stereotype)).length} item or port blocks`
    },
    {
      id: "analysis:sequence",
      label: "Sequence Validity",
      valueText: sequenceValidity.scoreText,
      scoreValue: sequenceValidity.score,
      copy: sequenceValidity.metricCopy
    },
    {
      id: "analysis:meval-overall",
      label: "ME-VAL Checks",
      valueText: formatPercentScore(meValEvaluation.complianceScore),
      scoreValue: meValEvaluation.complianceScore,
      copy: `${meValEvaluation.passedRules.length} pass, ${meValEvaluation.failedRules.length} fail`
    },
    {
      id: "analysis:meval-coverage",
      label: "Rule Coverage",
      valueText: formatPercentScore(meValEvaluation.coverageScore),
      scoreValue: meValEvaluation.coverageScore,
      copy: `${meValEvaluation.supportedRules}/${meValEvaluation.totalRules} workbook rules observable`
    }
  ];

  const links = cards
    .filter((card) => card.id.startsWith("analysis:") && !["analysis:model", "analysis:intent"].includes(card.id))
    .map((card) => ({
      from: "analysis:overall",
      to: card.id,
      label: "supports"
    }))
    .filter((link) => link.from !== link.to);

  if (cards.some((card) => card.id === "analysis:intent")) {
    links.push({ from: "analysis:model", to: "analysis:intent", label: "compared against" });
    if (cards.some((card) => card.id === "analysis:overall")) {
      links.push({ from: "analysis:intent", to: "analysis:overall", label: "scored as" });
    }
  }

  if (cards.some((card) => card.id === "analysis:meval-overall")) {
    links.push({ from: "analysis:model", to: "analysis:meval-overall", label: "checked by" });
    if (cards.some((card) => card.id === "analysis:meval-coverage")) {
      links.push({ from: "analysis:meval-overall", to: "analysis:meval-coverage", label: "scoped by" });
    }
    meValEvaluation.categories.forEach((category) => {
      links.push({
        from: "analysis:meval-overall",
        to: `analysis:meval:${sanitizeIdentifier(category.sheet, "ruleset")}`,
        label: "includes"
      });
    });
  }

  return {
    title: "Model Analysis",
    summary: scoreRow
      ? "Narrative similarity analysis against the companion TXT description, augmented with ME VAL workbook rule checks and sequence-diagram validity."
      : "Generated model description for the current SysML2 input, including ME VAL workbook checks and sequence-diagram validity when the model exposes enough behavior to assess it.",
    hero: {
      title: scoreRow ? "Corpus Similarity Assessment" : "Unscored Model Summary",
      copy: scoreRow
        ? `This tab compares the rendered SysML2 model to its paired natural-language TXT description, highlights the main structure and behavior metrics, adds ME VAL workbook compliance checks, and reports how valid the generated sequence view is relative to the source activity flow.`
        : "This model is not part of the pre-scored comparison corpus, so the tab emphasizes generated model analysis, ME VAL workbook compliance checks, and sequence-diagram validity instead of corpus similarity ratings.",
      scoreText: scoreRow?.likert_score ? `${scoreRow.likert_score} / 5` : "",
      scoreValue: overallSimilarity
    },
    metrics,
    cards,
    links
  };
}

function buildCatalog(nextModel) {
  const items = [];
  nextModel.views.ov1.actors.forEach((actor) => {
    items.push({
      id: `ov1:${actor.id}`,
      view: "ov1",
      label: actor.label,
      kind: `Actor / ${actor.type}`,
      detailRows: [
        ["Type", actor.type],
        ["Identifier", actor.id],
        ["Definition", actor.definitionType || actor.label]
      ],
      lists: [],
      relatedItems: []
    });
  });
  nextModel.views.bdd.blocks.forEach((block) => {
    items.push({
      id: `bdd:${block.id}`,
      view: "bdd",
      label: block.name,
      kind: block.stereotype,
      detailRows: [
        ["Block", block.name],
        ["Stereotype", block.stereotype]
      ],
      lists: [
        ["Properties", block.properties],
        ["Operations", block.operations]
      ],
      relatedItems: []
    });
  });
  nextModel.views.ibd.parts.forEach((part) => {
    items.push({
      id: `ibd:${part.id}`,
      view: "ibd",
      label: part.name,
      kind: "Part",
      detailRows: [
        ["Part", part.name],
        ["Ports", String(part.ports.length)]
      ],
      lists: [["Ports", part.ports.map((port) => port.name)]],
      relatedItems: []
    });
  });
  nextModel.views.activity.nodes.forEach((node) => {
    items.push({
      id: `activity:${node.id}`,
      view: "activity",
      label: node.label,
      kind: humanize(node.kind),
      detailRows: [
        ["Node", node.label],
        ["Kind", node.kind],
        ["Actor", node.performer || "System"]
      ],
      lists: [
        ["Inputs", (node.inputs || []).map((pin) => (pin.type ? `${pin.name}: ${pin.type}` : pin.name))],
        ["Outputs", (node.outputs || []).map((pin) => (pin.type ? `${pin.name}: ${pin.type}` : pin.name))]
      ],
      relatedItems: []
    });
  });
  nextModel.views.sequence.participants.forEach((participant) => {
    items.push({
      id: `sequence:participant:${participant.id}`,
      view: "sequence",
      label: participant.label,
      kind: "Participant",
      detailRows: [["Participant", participant.label]],
      lists: [],
      relatedItems: []
    });
  });
  nextModel.views.sequence.executions.forEach((execution) => {
    items.push({
      id: `sequence:execution:${execution.nodeId}`,
      view: "sequence",
      label: execution.label,
      kind: `Execution / ${execution.participant}`,
      detailRows: [
        ["Step", execution.label],
        ["Participant", execution.participant]
      ],
      lists: execution.subtitle ? [["Type", [execution.subtitle]]] : [],
      relatedItems: []
    });
  });
  nextModel.views.sequence.messages.forEach((message) => {
    items.push({
      id: `sequence:message:${message.id}`,
      view: "sequence",
      label: message.label || "Message",
      kind: "Message",
      detailRows: [
        ["From", message.from],
        ["To", message.to]
      ],
      lists: [],
      relatedItems: []
    });
  });
  nextModel.views.requirements.nodes.forEach((node) => {
    items.push({
      id: `requirements:${node.id}`,
      view: "requirements",
      label: node.label,
      kind: node.kind,
      detailRows: [
        ["Category", humanize(node.category)],
        ...(node.requirementId ? [["Requirement Id", node.requirementId]] : []),
        ...(node.typeName ? [["Type", node.typeName]] : []),
        ...(node.baseType ? [["Base", node.baseType]] : []),
        ...(node.subjectName ? [["Subject", node.subjectName]] : []),
        ...(node.subjectType ? [["Subject Type", node.subjectType]] : []),
        ["Constraints", String(node.constraintCount || 0)]
      ],
      lists: [
        ...(node.requirementText ? [["Requirement Text", [node.requirementText]]] : []),
        ...(node.description && node.description !== node.requirementText ? [["Description", [node.description]]] : []),
        ...(node.constraintTexts?.length ? [["Constraint Text", node.constraintTexts]] : []),
        ...(node.rawText ? [["Raw SysML Text", [node.rawText]]] : []),
        ...(node.fullPath ? [["Element Path", [node.fullPath]]] : [])
      ],
      relatedItems: []
    });
  });
  (nextModel.views.analysis?.cards || []).forEach((card) => {
    items.push({
      id: card.id,
      view: "analysis",
      label: card.title,
      kind: card.kind,
      detailRows: [
        ...(card.scoreText ? [["Score", card.scoreText]] : []),
        ...card.detailRows
      ],
      lists: [
        ...(card.body ? [["Description", [card.body]]] : []),
        ...(card.rationale ? [["Rationale", [card.rationale]]] : []),
        ...(card.matchedTerms?.length ? [[card.matchedLabel || "Matched Terms", card.matchedTerms]] : []),
        ...(card.missingTerms?.length ? [[card.missingLabel || "Missing Terms", card.missingTerms]] : [])
      ],
      relatedItems: []
    });
  });
  (nextModel.views.simulation?.cards || []).forEach((card) => {
    items.push({
      id: card.id,
      view: "simulation",
      label: card.title,
      kind: card.kind,
      detailRows: [
        ...(card.scoreText ? [["Score", card.scoreText]] : []),
        ...card.detailRows
      ],
      lists: [
        ...(card.body ? [["Description", [card.body]]] : []),
        ...(card.rationale ? [["Rationale", [card.rationale]]] : []),
        ...(card.matchedTerms?.length ? [[card.matchedLabel || "Ready Signals", card.matchedTerms]] : []),
        ...(card.missingTerms?.length ? [[card.missingLabel || "Improvement Cues", card.missingTerms]] : [])
      ],
      relatedItems: []
    });
  });
  const itemById = new Map(items.map((item) => [item.id, { ...item, _relationKeys: new Set() }]));
  const links = [
    ...nextModel.views.ov1.flows.map((flow) => ({
      from: `ov1:${flow.from}`,
      to: `ov1:${flow.to}`,
      label: flow.label || "flow"
    })),
    ...nextModel.views.bdd.relationships.map((relationship) => ({
      from: `bdd:${relationship.from}`,
      to: `bdd:${relationship.to}`,
      label: relationship.label || relationship.kind || "relationship"
    })),
    ...nextModel.views.ibd.connectors.map((connector) => ({
      from: `ibd:${connector.from.split(".")[0]}`,
      to: `ibd:${connector.to.split(".")[0]}`,
      label: connector.label || "connector"
    })),
    ...nextModel.views.activity.edges.map((edge) => ({
      from: `activity:${edge.from}`,
      to: `activity:${edge.to}`,
      label: edge.label || "flow"
    })),
    ...nextModel.views.sequence.executions.map((execution) => ({
      from: `sequence:participant:${execution.participant}`,
      to: `sequence:execution:${execution.nodeId}`,
      label: execution.label
    })),
    ...nextModel.views.sequence.messages.flatMap((message) => [
      {
        from: `sequence:participant:${message.from}`,
        to: `sequence:message:${message.id}`,
        label: message.label || "message"
      },
      {
        from: `sequence:message:${message.id}`,
        to: `sequence:participant:${message.to}`,
        label: message.label || "message"
      }
    ])
    ,
    ...nextModel.views.requirements.links.map((link) => ({
      from: `requirements:${link.from}`,
      to: `requirements:${link.to}`,
      label: link.label || link.kind || "trace"
    }))
    ,
    ...((nextModel.views.analysis?.links || []).map((link) => ({
      from: link.from,
      to: link.to,
      label: link.label
    }))),
    ...((nextModel.views.simulation?.links || []).map((link) => ({
      from: link.from,
      to: link.to,
      label: link.label
    })))
  ].filter((link) => itemById.has(link.from) && itemById.has(link.to));

  const addRelation = (fromId, toId, label) => {
    const fromItem = itemById.get(fromId);
    const toItem = itemById.get(toId);
    if (!fromItem || !toItem) {
      return;
    }
    const relationKey = `${toId}:${label}`;
    if (fromItem._relationKeys.has(relationKey)) {
      return;
    }
    fromItem._relationKeys.add(relationKey);
    fromItem.relatedItems.push({
      id: toId,
      label: toItem.label,
      kind: toItem.kind,
      note: label
    });
  };

  links.forEach((link) => {
    addRelation(link.from, link.to, link.label);
    addRelation(link.to, link.from, link.label);
  });

  return [...itemById.values()].map((item) => {
    const { _relationKeys, ...cleanItem } = item;
    return {
      ...cleanItem,
      detailRows: [...cleanItem.detailRows, ["Related", String(cleanItem.relatedItems.length)]],
      searchText: [
        cleanItem.label,
        cleanItem.kind,
        ...cleanItem.detailRows.flat(),
        ...cleanItem.lists.flatMap((entry) => entry[1]),
        ...cleanItem.relatedItems.flatMap((entry) => [entry.label, entry.kind, entry.note])
      ]
        .join(" ")
        .toLowerCase()
    };
  });
}

function currentSearchQuery() {
  return searchInputEl.value.trim().toLowerCase();
}

function getCatalogMatches(query = currentSearchQuery()) {
  if (!query) {
    return [];
  }
  return state.catalog.filter((item) => item.searchText.includes(query));
}

function currentViewEntityIds() {
  return state.catalog.filter((item) => item.view === state.currentView).map((item) => item.id);
}

function selectedContextIds() {
  const selected = state.catalog.find((item) => item.id === state.selectedEntityId);
  if (!selected || selected.view !== state.currentView) {
    return new Set();
  }
  return new Set([selected.id, ...selected.relatedItems.map((entry) => entry.id)]);
}

function computeVisibleEntityIds() {
  const currentIds = currentViewEntityIds();
  if (state.scopeMode === "focus") {
    const focusedIds = [...selectedContextIds()];
    return focusedIds.length ? new Set(focusedIds) : new Set(currentIds);
  }
  if (state.scopeMode === "search" && currentSearchQuery()) {
    const matchingIds = state.catalog
      .filter((item) => item.view === state.currentView && state.matchIds.has(item.id))
      .map((item) => item.id);
    return matchingIds.length ? new Set(matchingIds) : new Set(currentIds);
  }
  return new Set(currentIds);
}

function refreshDerivedState() {
  state.matchIds = new Set(getCatalogMatches().map((item) => item.id));
  state.contextIds = selectedContextIds();
  state.visibleEntityIds = computeVisibleEntityIds();
}

function isHiddenEntity(entityId) {
  return state.visibleEntityIds.size > 0 && !state.visibleEntityIds.has(entityId);
}

function isMutedEntity(entityId) {
  if (isHiddenEntity(entityId)) {
    return true;
  }
  const query = currentSearchQuery();
  if (query && state.scopeMode !== "search") {
    return !state.matchIds.has(entityId);
  }
  return false;
}

function isContextEntity(entityId) {
  return state.contextIds.has(entityId) && state.selectedEntityId !== entityId;
}

function detailSlice(values, standardLimit, compactLimit = Math.min(standardLimit, 2)) {
  if (state.detailMode === "full") {
    return values;
  }
  if (state.detailMode === "compact") {
    return values.slice(0, compactLimit);
  }
  return values.slice(0, standardLimit);
}

function truncateLabel(label, compactLimit = 18, standardLimit = 28) {
  const limit = state.detailMode === "compact" ? compactLimit : standardLimit;
  return label.length > limit ? `${label.slice(0, limit - 1)}…` : label;
}

function setOv1EditorStatus(message, isError = false) {
  if (!ov1EditorStatusEl) {
    return;
  }
  ov1EditorStatusEl.textContent = message;
  ov1EditorStatusEl.style.color = isError ? "#b23a48" : "#5b6f82";
}

function editorTitleForView(viewName = state.currentView) {
  if (viewName === "bdd") {
    return "BDD Editor";
  }
  if (viewName === "ibd") {
    return "IBD Editor";
  }
  return "OV-1 Editor";
}

function editorCopyForView(viewName = state.currentView) {
  if (viewName === "bdd") {
    return "Reposition definition blocks, pull additional definitions into the canvas from the current SysML file, create composition or association links, and save the resulting structure back into the SysML text.";
  }
  if (viewName === "ibd") {
    return "Reposition internal parts, pull additional parts into the canvas from the current SysML file, create connectors, and save the resulting structure back into the SysML text.";
  }
  return "Drag components from the current SysML file into the OV-1 canvas, reposition actors, add operational arrows, and save the result back into the SysML text.";
}

function editorPaletteLabelForView(viewName = state.currentView) {
  if (viewName === "bdd") {
    return "Definitions From File";
  }
  if (viewName === "ibd") {
    return "Parts From File";
  }
  return "Components From File";
}

function editorLinkToolLabelForView(viewName = state.currentView) {
  if (viewName === "bdd") {
    return "Relationship Tool";
  }
  if (viewName === "ibd") {
    return "Connector Tool";
  }
  return "Arrow Tool";
}

function editorResetLabelForView(viewName = state.currentView) {
  if (viewName === "bdd") {
    return "Reset BDD Edits";
  }
  if (viewName === "ibd") {
    return "Reset IBD Edits";
  }
  return "Reset OV-1 Edits";
}

function currentEditorPaletteItems(viewName = state.currentView) {
  if (!model) {
    return [];
  }
  if (viewName === "bdd") {
    return model.views.bdd.componentPool || [];
  }
  if (viewName === "ibd") {
    return model.views.ibd.componentPool || [];
  }
  return model.views.ov1.componentPool || [];
}

function currentEditorPresentIds(viewName = state.currentView) {
  if (!model) {
    return new Set();
  }
  if (viewName === "bdd") {
    return new Set(model.views.bdd.blocks.map((block) => block.id));
  }
  if (viewName === "ibd") {
    return new Set(model.views.ibd.parts.map((part) => part.id));
  }
  return new Set(model.views.ov1.actors.map((actor) => actor.id));
}

function editorEntityPrefix(viewName = state.currentView) {
  if (viewName === "bdd") {
    return "bdd";
  }
  if (viewName === "ibd") {
    return "ibd";
  }
  return "ov1";
}

function syncSourceTextFromModel() {
  if (!model) {
    return "";
  }
  const nextSource = buildSourceTextWithVisualizerState();
  state.currentSourceText = nextSource;
  modelTextEl.value = nextSource;
  return nextSource;
}

function findOv1Actor(actorId) {
  return model?.views.ov1.actors.find((actor) => actor.id === actorId) || null;
}

function findOv1Component(componentId) {
  return model?.views.ov1.componentPool?.find((component) => component.id === componentId) || null;
}

function findBddBlock(blockId) {
  return model?.views.bdd.blocks.find((block) => block.id === blockId) || null;
}

function findBddComponent(componentId) {
  return model?.views.bdd.componentPool?.find((component) => component.id === componentId) || null;
}

function findIbdPart(partId) {
  return model?.views.ibd.parts.find((part) => part.id === partId) || null;
}

function findIbdComponent(componentId) {
  return model?.views.ibd.componentPool?.find((component) => component.id === componentId) || null;
}

function clampOv1ActorPosition(x, y) {
  return {
    x: clamp(x, 18, VIEWBOX_WIDTH - OV1_CARD_WIDTH - 18),
    y: clamp(y, 92, VIEWBOX_HEIGHT - OV1_CARD_HEIGHT - 18)
  };
}

function clampBddBlockPosition(x, y, width = 210, height = 140) {
  return {
    x: clamp(x, 18, VIEWBOX_WIDTH - width - 18),
    y: clamp(y, 44, VIEWBOX_HEIGHT - height - 18)
  };
}

function clampIbdPartPosition(x, y, width = 190, height = 100) {
  return {
    x: clamp(x, 56, VIEWBOX_WIDTH - width - 42),
    y: clamp(y, 78, VIEWBOX_HEIGHT - height - 42)
  };
}

function clientToDiagramPoint(clientX, clientY) {
  const rect = svg.getBoundingClientRect();
  const svgX = ((clientX - rect.left) / rect.width) * VIEWBOX_WIDTH;
  const svgY = ((clientY - rect.top) / rect.height) * VIEWBOX_HEIGHT;
  return {
    x: (svgX - state.transform.x) / state.transform.scale,
    y: (svgY - state.transform.y) / state.transform.scale
  };
}

function refreshCatalogAndAnalysis() {
  if (!model) {
    return;
  }
  model.views.analysis = buildAnalysisView(model, state.analysisPayload, state.currentModelPath, state.currentSourceText);
  model.views.simulation = buildSimulationReadinessView(model, state.currentModelPath, state.currentSourceText);
  state.catalog = buildCatalog(model);
  if (state.selectedEntityId && !state.catalog.some((item) => item.id === state.selectedEntityId)) {
    state.selectedEntityId = null;
  }
}

function refreshOv1EditorPanel() {
  if (!ov1EditorPanelEl) {
    return;
  }
  const showEditor = Boolean(model) && isEditableDiagramView(state.currentView);
  ov1EditorPanelEl.classList.toggle("is-hidden", !showEditor);
  if (!showEditor) {
    return;
  }

  if (editorTitleEl) {
    editorTitleEl.textContent = editorTitleForView();
  }
  if (editorCopyEl) {
    editorCopyEl.textContent = editorCopyForView();
  }
  if (editorPaletteLabelEl) {
    editorPaletteLabelEl.textContent = editorPaletteLabelForView();
  }
  ov1EditToggleEl.classList.toggle("is-active", state.ov1Editor.enabled);
  ov1EditToggleEl.textContent = state.ov1Editor.enabled ? "Disable Editing" : "Enable Editing";
  ov1ArrowToolEl.textContent = editorLinkToolLabelForView();
  ov1ArrowToolEl.classList.toggle("is-active", state.ov1Editor.enabled && state.ov1Editor.tool === "arrow");
  ov1ArrowToolEl.disabled = !state.ov1Editor.enabled;
  ov1SaveButtonEl.disabled = !state.ov1Editor.enabled;
  ov1ResetButtonEl.textContent = editorResetLabelForView();
  ov1ResetButtonEl.disabled = !state.ov1Editor.enabled;

  ov1PaletteEl.replaceChildren();
  const presentIds = currentEditorPresentIds();
  const paletteItems = currentEditorPaletteItems();
  paletteItems.forEach((component) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ov1-palette-item";
    button.draggable = state.ov1Editor.enabled;
    button.classList.toggle("is-present", presentIds.has(component.id));
    button.classList.toggle("is-selected", state.ov1Editor.paletteSelectionId === component.id);
    const title = document.createElement("strong");
    title.textContent = component.paletteTitle || component.label || component.name || component.id;
    const meta = document.createElement("span");
    meta.textContent =
      component.paletteMeta ||
      `${humanize(component.type || component.definitionKind || "component")} • ${component.definitionType || component.typeName || component.name || component.id}`;
    button.append(title, meta);
    button.addEventListener("click", () => {
      if (!state.ov1Editor.enabled) {
        return;
      }
      state.ov1Editor.tool = "move";
      state.ov1Editor.arrowSourceId = null;
      state.ov1Editor.paletteSelectionId = state.ov1Editor.paletteSelectionId === component.id ? "" : component.id;
      refreshOv1EditorPanel();
      setOv1EditorStatus(
        state.ov1Editor.paletteSelectionId
          ? `Click or drop on the ${editorTitleForView().replace(" Editor", "")} canvas to place ${component.paletteTitle || component.label || component.name || component.id}.`
          : "Palette selection cleared."
      );
      renderAnalysisStatus();
    });
    button.addEventListener("dragstart", (event) => {
      if (!state.ov1Editor.enabled) {
        event.preventDefault();
        return;
      }
      state.ov1Editor.paletteSelectionId = component.id;
      event.dataTransfer?.setData("text/sysml-editor-component", component.id);
      event.dataTransfer.effectAllowed = "copyMove";
      refreshOv1EditorPanel();
      setOv1EditorStatus(`Dragging ${component.paletteTitle || component.label || component.name || component.id}. Drop it into the ${editorTitleForView().replace(" Editor", "")} view to place it.`);
    });
    ov1PaletteEl.append(button);
  });

  if (!paletteItems.length) {
    const empty = document.createElement("p");
    empty.className = "ov1-editor-status";
    empty.textContent = `No reusable ${editorPaletteLabelForView().toLowerCase()} were inferred from the current SysML file.`;
    ov1PaletteEl.append(empty);
  }
}

function commitDiagramModelUpdates(statusMessage = "") {
  syncSourceTextFromModel();
  refreshCatalogAndAnalysis();
  renderCurrentView({ preserveViewport: true });
  refreshOv1EditorPanel();
  if (statusMessage) {
    setImportStatus(statusMessage);
    setOv1EditorStatus(statusMessage);
  }
}

function placeOv1Component(componentId, point) {
  if (!model) {
    return;
  }
  const component = findOv1Component(componentId);
  if (!component) {
    setOv1EditorStatus("That component is no longer available from the current SysML file.", true);
    return;
  }
  const position = clampOv1ActorPosition(point.x - OV1_CARD_WIDTH / 2, point.y - OV1_CARD_HEIGHT / 2);
  const existing = findOv1Actor(componentId);
  if (existing) {
    existing.x = position.x;
    existing.y = position.y;
  } else {
    model.views.ov1.actors.push({
      id: component.id,
      label: component.label,
      type: component.type,
      definitionType: component.definitionType,
      x: position.x,
      y: position.y
    });
  }
  state.selectedEntityId = `ov1:${component.id}`;
  state.ov1Editor.paletteSelectionId = "";
  commitDiagramModelUpdates(`${component.label} was placed on the OV-1 canvas.`);
}

function placeBddComponent(componentId, point) {
  if (!model) {
    return;
  }
  const component = findBddComponent(componentId);
  if (!component) {
    setOv1EditorStatus("That definition is no longer available from the current SysML file.", true);
    return;
  }
  const blockHeight = bddBlockHeight(component);
  const position = clampBddBlockPosition(point.x - component.width / 2, point.y - blockHeight / 2, component.width, blockHeight);
  const existing = findBddBlock(componentId);
  if (existing) {
    existing.x = position.x;
    existing.y = position.y;
  } else {
    model.views.bdd.blocks = uniqueBy(
      [
        ...model.views.bdd.blocks,
        {
          ...deepClone(component),
          x: position.x,
          y: position.y
        }
      ],
      (block) => block.id
    );
  }
  state.selectedEntityId = `bdd:${component.id}`;
  state.ov1Editor.paletteSelectionId = "";
  commitDiagramModelUpdates(`${component.name} was placed on the BDD canvas.`);
}

function placeIbdComponent(componentId, point) {
  if (!model) {
    return;
  }
  const component = findIbdComponent(componentId);
  if (!component) {
    setOv1EditorStatus("That part is no longer available from the current SysML file.", true);
    return;
  }
  const position = clampIbdPartPosition(point.x - component.width / 2, point.y - component.height / 2, component.width, component.height);
  const existing = findIbdPart(componentId);
  if (existing) {
    existing.x = position.x;
    existing.y = position.y;
  } else {
    model.views.ibd.parts = uniqueBy(
      [
        ...model.views.ibd.parts,
        {
          ...deepClone(component),
          x: position.x,
          y: position.y
        }
      ],
      (part) => part.id
    );
  }
  state.selectedEntityId = `ibd:${component.id}`;
  state.ov1Editor.paletteSelectionId = "";
  commitDiagramModelUpdates(`${component.name} was placed on the IBD canvas.`);
}

function placeEditorComponent(componentId, point) {
  if (state.currentView === "bdd") {
    placeBddComponent(componentId, point);
    return;
  }
  if (state.currentView === "ibd") {
    placeIbdComponent(componentId, point);
    return;
  }
  placeOv1Component(componentId, point);
}

function handleOv1ArrowSelection(actorId) {
  const sourceActorId = state.ov1Editor.arrowSourceId;
  if (!sourceActorId) {
    state.ov1Editor.arrowSourceId = actorId;
    state.selectedEntityId = `ov1:${actorId}`;
    renderCurrentView({ preserveViewport: true });
    refreshOv1EditorPanel();
    setOv1EditorStatus(`Arrow source selected. Choose a target actor to create an operational arrow.`);
    return;
  }

  const label = window.prompt("Arrow label", "interaction");
  if (label === null) {
    state.ov1Editor.arrowSourceId = null;
    refreshOv1EditorPanel();
    setOv1EditorStatus("Arrow creation canceled.");
    renderCurrentView({ preserveViewport: true });
    return;
  }

  model.views.ov1.flows = uniqueBy(
    [
      ...model.views.ov1.flows,
      {
        from: sourceActorId,
        to: actorId,
        label: label.trim() || "interaction"
      }
    ],
    (flow) => `${flow.from}:${flow.to}:${flow.label || ""}`
  );
  state.ov1Editor.arrowSourceId = null;
  state.selectedEntityId = `ov1:${actorId}`;
  commitDiagramModelUpdates(`Added OV-1 arrow from ${titleFromIdentifier(sourceActorId)} to ${titleFromIdentifier(actorId)}.`);
}

function handleBddRelationshipSelection(blockId) {
  const sourceBlockId = state.ov1Editor.arrowSourceId;
  if (!sourceBlockId) {
    state.ov1Editor.arrowSourceId = blockId;
    state.selectedEntityId = `bdd:${blockId}`;
    renderCurrentView({ preserveViewport: true });
    refreshOv1EditorPanel();
    setOv1EditorStatus("Relationship source selected. Choose a target block to create a BDD relationship.");
    return;
  }
  if (sourceBlockId === blockId) {
    state.ov1Editor.arrowSourceId = null;
    refreshOv1EditorPanel();
    setOv1EditorStatus("Relationship source cleared.");
    renderCurrentView({ preserveViewport: true });
    return;
  }
  const kindInput = window.prompt("BDD relationship type (composition or association)", "composition");
  if (kindInput === null) {
    state.ov1Editor.arrowSourceId = null;
    refreshOv1EditorPanel();
    setOv1EditorStatus("Relationship creation canceled.");
    renderCurrentView({ preserveViewport: true });
    return;
  }
  const kind = kindInput.trim().toLowerCase();
  if (!["composition", "association"].includes(kind)) {
    state.ov1Editor.arrowSourceId = null;
    refreshOv1EditorPanel();
    setOv1EditorStatus("Enter either 'composition' or 'association' for the BDD relationship type.", true);
    renderCurrentView({ preserveViewport: true });
    return;
  }
  const targetBlock = findBddBlock(blockId) || findBddComponent(blockId);
  const defaultLabel = sanitizeIdentifier(targetBlock?.name || "member", "member");
  const label = window.prompt("Relationship member name", defaultLabel);
  if (label === null) {
    state.ov1Editor.arrowSourceId = null;
    refreshOv1EditorPanel();
    setOv1EditorStatus("Relationship creation canceled.");
    renderCurrentView({ preserveViewport: true });
    return;
  }
  model.views.bdd.relationships = uniqueBy(
    [
      ...model.views.bdd.relationships,
      {
        from: sourceBlockId,
        to: blockId,
        kind,
        label: sanitizeIdentifier(label.trim() || defaultLabel, defaultLabel)
      }
    ],
    (relationship) => `${relationship.from}:${relationship.to}:${relationship.label || ""}:${relationship.kind || ""}`
  );
  state.ov1Editor.arrowSourceId = null;
  state.selectedEntityId = `bdd:${blockId}`;
  commitDiagramModelUpdates(`Added a ${kind} relationship from ${titleFromIdentifier(sourceBlockId)} to ${titleFromIdentifier(blockId)}.`);
}

function handleIbdConnectorSelection(partId) {
  const sourcePartId = state.ov1Editor.arrowSourceId;
  if (!sourcePartId) {
    state.ov1Editor.arrowSourceId = partId;
    state.selectedEntityId = `ibd:${partId}`;
    renderCurrentView({ preserveViewport: true });
    refreshOv1EditorPanel();
    setOv1EditorStatus("Connector source selected. Choose a target part to create an IBD connector.");
    return;
  }
  if (sourcePartId === partId) {
    state.ov1Editor.arrowSourceId = null;
    refreshOv1EditorPanel();
    setOv1EditorStatus("Connector source cleared.");
    renderCurrentView({ preserveViewport: true });
    return;
  }
  const label = window.prompt("Connector label", "connects");
  if (label === null) {
    state.ov1Editor.arrowSourceId = null;
    refreshOv1EditorPanel();
    setOv1EditorStatus("Connector creation canceled.");
    renderCurrentView({ preserveViewport: true });
    return;
  }
  model.views.ibd.connectors = uniqueBy(
    [
      ...model.views.ibd.connectors,
      {
        from: sourcePartId,
        to: partId,
        label: label.trim() || "connects"
      }
    ],
    (connector) => `${connector.from}:${connector.to}:${connector.label || ""}`
  );
  state.ov1Editor.arrowSourceId = null;
  state.selectedEntityId = `ibd:${partId}`;
  commitDiagramModelUpdates(`Added an IBD connector from ${titleFromIdentifier(sourcePartId)} to ${titleFromIdentifier(partId)}.`);
}

function handleEditorLinkSelection(entityId) {
  if (state.currentView === "bdd") {
    handleBddRelationshipSelection(entityId);
    return;
  }
  if (state.currentView === "ibd") {
    handleIbdConnectorSelection(entityId);
    return;
  }
  handleOv1ArrowSelection(entityId);
}

function promptForSavePath() {
  const suggestedPath = state.currentModelPath || datasetPathEl.value.trim() || "edited_model.sysml";
  return window.prompt("Save the current SysML text to this workspace path:", suggestedPath);
}

async function saveCurrentModelToWorkspace() {
  if (!model) {
    return;
  }
  const requestedPath = promptForSavePath();
  if (requestedPath === null) {
    setOv1EditorStatus("Save canceled.");
    return;
  }
  const trimmedPath = requestedPath.trim();
  if (!trimmedPath) {
    setOv1EditorStatus("A workspace file path is required to save the SysML text.", true);
    return;
  }
  const text = syncSourceTextFromModel();
  try {
    const response = await fetch("/save-model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: trimmedPath, text })
    });
    const payload = await response.json();
    if (!response.ok || !payload.saved) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }
    state.currentModelPath = payload.path;
    state.loadedSourceText = text;
    datasetPathEl.value = payload.path;
    setImportStatus(`Saved ${humanize(state.currentView)} edits into ${payload.path}.`);
    setOv1EditorStatus("Current diagram edits were written into the SysML file and persisted for reload.");
    await loadDatasetIndex();
  } catch (error) {
    setImportStatus(`Unable to save SysML file: ${error.message}`, true);
    setOv1EditorStatus(`Unable to save SysML file: ${error.message}`, true);
  }
}

function syncViewButtons() {
  buttons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === state.currentView);
  });
}

function resetSvg() {
  svg.replaceChildren();
  const defs = el("defs");
  defs.append(
    ov1SkyGradient(),
    marker("arrow", "#36536b"),
    marker("diamond", "#36536b", "diamond"),
    marker("triangle", "#36536b", "triangle")
  );
  drawingLayer = el("g", { id: "diagram-layer" });
  svg.append(defs, drawingLayer);
}

function applyTransform() {
  if (!drawingLayer) {
    return;
  }
  drawingLayer.setAttribute(
    "transform",
    `translate(${state.transform.x} ${state.transform.y}) scale(${state.transform.scale})`
  );
  renderOverview();
}

function computeBoundsFromEntities() {
  if (!state.renderEntities.length) {
    return { minX: 0, minY: 0, maxX: VIEWBOX_WIDTH, maxY: VIEWBOX_HEIGHT };
  }
  return {
    minX: Math.min(...state.renderEntities.map((entity) => entity.bounds.x)),
    minY: Math.min(...state.renderEntities.map((entity) => entity.bounds.y)),
    maxX: Math.max(...state.renderEntities.map((entity) => entity.bounds.x + entity.bounds.width)),
    maxY: Math.max(...state.renderEntities.map((entity) => entity.bounds.y + entity.bounds.height))
  };
}

function fitToBounds(bounds = state.currentBounds) {
  const width = Math.max(120, bounds.maxX - bounds.minX);
  const height = Math.max(120, bounds.maxY - bounds.minY);
  const padding = 48;
  const scale = Math.min(
    (VIEWBOX_WIDTH - padding * 2) / width,
    (VIEWBOX_HEIGHT - padding * 2) / height,
    1.4
  );
  state.transform.scale = scale;
  state.transform.x = padding + (VIEWBOX_WIDTH - padding * 2 - width * scale) / 2 - bounds.minX * scale;
  state.transform.y = padding + (VIEWBOX_HEIGHT - padding * 2 - height * scale) / 2 - bounds.minY * scale;
  applyTransform();
}

function centerEntityById(entityId) {
  const entity = state.renderEntities.find((item) => item.id === entityId);
  if (!entity) {
    return;
  }
  const centerX = entity.bounds.x + entity.bounds.width / 2;
  const centerY = entity.bounds.y + entity.bounds.height / 2;
  state.transform.x = VIEWBOX_WIDTH / 2 - centerX * state.transform.scale;
  state.transform.y = VIEWBOX_HEIGHT / 2 - centerY * state.transform.scale;
  applyTransform();
}

function zoomAt(factor, centerX = VIEWBOX_WIDTH / 2, centerY = VIEWBOX_HEIGHT / 2) {
  const newScale = clamp(state.transform.scale * factor, 0.35, 2.6);
  const modelX = (centerX - state.transform.x) / state.transform.scale;
  const modelY = (centerY - state.transform.y) / state.transform.scale;
  state.transform.scale = newScale;
  state.transform.x = centerX - modelX * newScale;
  state.transform.y = centerY - modelY * newScale;
  applyTransform();
}

function visibleRect() {
  return {
    x: -state.transform.x / state.transform.scale,
    y: -state.transform.y / state.transform.scale,
    width: VIEWBOX_WIDTH / state.transform.scale,
    height: VIEWBOX_HEIGHT / state.transform.scale
  };
}

function registerRenderedEntity(entity) {
  state.renderEntities.push(entity);
}

function registerRenderedLink(link) {
  state.renderLinks.push(link);
}

function bindEntity(node, entityId) {
  node.setAttribute("data-entity-id", entityId);
  node.classList.add("entity-shape");
  if (state.selectedEntityId === entityId) {
    node.classList.add("is-selected");
  }
  if (isContextEntity(entityId)) {
    node.classList.add("is-context");
  }
  if (isMutedEntity(entityId)) {
    node.classList.add("is-muted");
  }
  const catalogItem = state.catalog.find((item) => item.id === entityId);
  if (catalogItem) {
    const titleNode = el("title");
    titleNode.textContent = `${catalogItem.label} (${catalogItem.kind})`;
    node.append(titleNode);
  }
  node.addEventListener("click", (event) => {
    event.stopPropagation();
    const prefix = `${editorEntityPrefix()}:`;
    if (isEditableDiagramView(state.currentView) && state.ov1Editor.enabled && state.ov1Editor.tool === "arrow" && entityId.startsWith(prefix)) {
      handleEditorLinkSelection(entityId.slice(prefix.length));
      return;
    }
    selectEntity(entityId, { switchView: false, preserveViewport: true, center: false });
  });
}

function applyTextState(textNode, entityId) {
  textNode.classList.add("label-shape");
  if (isContextEntity(entityId)) {
    textNode.classList.add("is-context");
  }
  if (isMutedEntity(entityId)) {
    textNode.classList.add("is-muted");
  }
}

function makeLine(x1, y1, x2, y2, attrs = {}) {
  return el("line", {
    x1,
    y1,
    x2,
    y2,
    stroke: "#36536b",
    "stroke-width": 3,
    ...attrs
  });
}

function addCanvasNode(node) {
  drawingLayer.append(node);
  return node;
}

function entityCenter(entityId) {
  const entity = state.renderEntities.find((item) => item.id === entityId);
  if (!entity) {
    return null;
  }
  return {
    x: entity.bounds.x + entity.bounds.width / 2,
    y: entity.bounds.y + entity.bounds.height / 2
  };
}

function assignRectLayout(items, mode, options) {
  if (mode === "auto") {
    return items;
  }
  if (mode === "radial") {
    const angleStep = (Math.PI * 2) / Math.max(items.length, 1);
    items.forEach((item, index) => {
      const angle = -Math.PI / 2 + index * angleStep;
      item.x = options.centerX + Math.cos(angle) * options.radiusX - options.width / 2;
      item.y = options.centerY + Math.sin(angle) * options.radiusY - options.height / 2;
    });
    return items;
  }
  if (mode === "grid") {
    items.forEach((item, index) => {
      const column = index % options.columns;
      const row = Math.floor(index / options.columns);
      item.x = options.startX + column * options.gapX;
      item.y = options.startY + row * options.gapY;
    });
    return items;
  }
  items.forEach((item, index) => {
    const column = index % options.columns;
    const row = Math.floor(index / options.columns);
    item.x = options.startX + column * options.gapX;
    item.y = options.startY + row * options.gapY + (column % 2 === 1 ? options.staggerY : 0);
  });
  return items;
}

function assignPointLayout(items, mode, options) {
  if (mode === "auto") {
    return items;
  }
  if (mode === "radial") {
    const angleStep = (Math.PI * 2) / Math.max(items.length, 1);
    items.forEach((item, index) => {
      const angle = -Math.PI / 2 + index * angleStep;
      item.x = options.centerX + Math.cos(angle) * options.radiusX;
      item.y = options.centerY + Math.sin(angle) * options.radiusY;
    });
    return items;
  }
  if (mode === "grid") {
    items.forEach((item, index) => {
      const column = index % options.columns;
      const row = Math.floor(index / options.columns);
      item.x = options.startX + column * options.gapX;
      item.y = options.startY + row * options.gapY;
    });
    return items;
  }
  items.forEach((item, index) => {
    const column = index % options.columns;
    const row = Math.floor(index / options.columns);
    item.x = options.startX + column * options.gapX;
    item.y = options.startY + row * options.gapY + (column % 2 === 1 ? options.staggerY : 0);
  });
  return items;
}

function getPreparedView(viewName) {
  const view = deepClone(model.views[viewName]);
  const mode = isEditableDiagramView(viewName) && state.ov1Editor.enabled ? "auto" : state.layoutMode;
  if (viewName === "ov1") {
    assignRectLayout(view.actors, mode, {
      startX: 80,
      startY: 80,
      columns: 3,
      gapX: 280,
      gapY: 180,
      staggerY: 70,
      width: 160,
      height: 80,
      centerX: 520,
      centerY: 260,
      radiusX: 320,
      radiusY: 170
    });
  } else if (viewName === "bdd") {
    assignRectLayout(view.blocks, mode, {
      startX: 70,
      startY: 60,
      columns: 3,
      gapX: 285,
      gapY: 210,
      staggerY: 55,
      width: 210,
      height: 150,
      centerX: 520,
      centerY: 270,
      radiusX: 320,
      radiusY: 185
    });
  } else if (viewName === "ibd") {
    assignRectLayout(view.parts, mode, {
      startX: 90,
      startY: 90,
      columns: 3,
      gapX: 270,
      gapY: 170,
      staggerY: 45,
      width: 190,
      height: 100,
      centerX: 520,
      centerY: 265,
      radiusX: 290,
      radiusY: 170
    });
  } else if (viewName === "requirements") {
    const definitionNodes = view.nodes.filter((node) => node.category === "definition");
    const requirementNodes = view.nodes.filter((node) => node.category === "requirement");
    const elementNodes = view.nodes.filter((node) => node.category === "element");
    if (mode === "grid") {
      assignRectLayout(view.nodes, mode, {
        startX: 70,
        startY: 80,
        columns: 3,
        gapX: 315,
        gapY: 170,
        staggerY: 30,
        width: 290,
        height: 120,
        centerX: 520,
        centerY: 270,
        radiusX: 340,
        radiusY: 190
      });
    } else if (mode === "radial") {
      assignRectLayout(view.nodes, mode, {
        startX: 70,
        startY: 80,
        columns: 3,
        gapX: 315,
        gapY: 170,
        staggerY: 30,
        width: 290,
        height: 120,
        centerX: 520,
        centerY: 285,
        radiusX: 350,
        radiusY: 210
      });
    } else {
      const placeColumn = (items, x, yStart = 82, rowGap = 26) => {
        let currentY = yStart;
        items.forEach((item) => {
          item.x = x;
          item.y = currentY;
          currentY += item.height + rowGap;
        });
      };
      placeColumn(definitionNodes, 72);
      placeColumn(requirementNodes, 384);
      placeColumn(elementNodes, 736, 96, 24);
    }
  } else if (viewName === "activity" && !view.lanes?.length) {
    assignPointLayout(view.nodes, mode, {
      startX: 120,
      startY: 150,
      columns: 4,
      gapX: 220,
      gapY: 150,
      staggerY: 65,
      centerX: 520,
      centerY: 270,
      radiusX: 320,
      radiusY: 170
    });
  }
  return view;
}

function renderOV1(view) {
  titleEl.textContent = view.title;
  summaryEl.textContent = `${view.mission} Illustrated operational concept with representative actor graphics and mission backdrop.${state.ov1Editor.enabled ? " Editing is enabled for manual placement and arrow authoring." : ""} Layout: ${humanize(state.layoutMode)}. Scope: ${humanize(state.scopeMode)}. Detail: ${humanize(state.detailMode)}.`;

  const cardWidth = OV1_CARD_WIDTH;
  const cardHeight = OV1_CARD_HEIGHT;
  const artFrame = { x: 26, y: 18 };

  const entityLookup = Object.fromEntries(
    state.catalog.filter((item) => item.view === "ov1").map((item) => [item.id.replace("ov1:", ""), item.id])
  );
  const actorLookup = Object.fromEntries(view.actors.map((actor) => [actor.id, actor]));

  addOperationalBackdrop(view);
  const banner = addCanvasNode(
    el("rect", {
      x: 34,
      y: 24,
      width: 330,
      height: 56,
      rx: 20,
      fill: "rgba(255,255,255,0.7)",
      stroke: "rgba(54, 83, 107, 0.18)"
    })
  );
  banner.setAttribute("pointer-events", "none");
  const eyebrow = el("text", { x: 56, y: 46, "font-size": 12, fill: "#4e6276", "font-weight": 700 }, "HIGH-LEVEL OPERATIONAL CONCEPT");
  eyebrow.classList.add("label-shape");
  eyebrow.setAttribute("pointer-events", "none");
  addCanvasNode(eyebrow);
  const missionText = el("text", { x: 56, y: 66, "font-size": 18, fill: "#142433", "font-weight": 700 }, truncateLabel(view.mission || view.title, 30, 40));
  missionText.classList.add("label-shape");
  missionText.setAttribute("pointer-events", "none");
  addCanvasNode(missionText);

  view.flows.forEach((flow) => {
    const from = actorLookup[flow.from];
    const to = actorLookup[flow.to];
    if (!from || !to) {
      return;
    }
    const sourceId = entityLookup[flow.from];
    const targetId = entityLookup[flow.to];
    if ((sourceId && isHiddenEntity(sourceId)) || (targetId && isHiddenEntity(targetId))) {
      return;
    }
    const pathSpec = operationalFlowPath(from, to, cardWidth, cardHeight);
    const glow = addCanvasNode(
      el("path", {
        d: pathSpec.d,
        fill: "none",
        stroke: "rgba(255,255,255,0.54)",
        "stroke-width": 8
      })
    );
    glow.classList.add("link-shape");
    glow.setAttribute("pointer-events", "none");
    const line = addCanvasNode(
      el("path", {
        d: pathSpec.d,
        fill: "none",
        stroke: "#36536b",
        "stroke-width": 3.2,
        "marker-end": "url(#arrow)"
      })
    );
    line.classList.add("link-shape");
    if (sourceId && targetId && state.contextIds.has(sourceId) && state.contextIds.has(targetId)) {
      glow.classList.add("is-context");
      line.classList.add("is-context");
    }
    if ((sourceId && isMutedEntity(sourceId)) || (targetId && isMutedEntity(targetId))) {
      glow.classList.add("is-muted");
      line.classList.add("is-muted");
    }
    registerRenderedLink({ from: sourceId, to: targetId, label: flow.label });
    if (flow.label && state.detailMode !== "compact") {
      const pillWidth = Math.max(74, Math.min(160, flow.label.length * 6.8 + 22));
      const pill = addCanvasNode(
        el("rect", {
          x: pathSpec.labelX - pillWidth / 2,
          y: pathSpec.labelY - 16,
          width: pillWidth,
          height: 26,
          rx: 13,
          fill: "rgba(255,255,255,0.86)",
          stroke: "rgba(54,83,107,0.16)"
        })
      );
      pill.classList.add("label-shape");
      pill.setAttribute("pointer-events", "none");
      const label = el(
        "text",
        { x: pathSpec.labelX - pillWidth / 2 + 12, y: pathSpec.labelY + 1, "font-size": 12, fill: "#344456", "font-weight": 700 },
        truncateLabel(flow.label, 18, 28)
      );
      applyTextState(label, sourceId || targetId || "");
      label.setAttribute("pointer-events", "none");
      addCanvasNode(label);
    }
  });

  view.actors.forEach((actor) => {
    const entityId = entityLookup[actor.id] || `ov1:${actor.id}`;
    if (isHiddenEntity(entityId)) {
      return;
    }
    const family = operationalGraphicFamily(actor);
    const palette = operationalPalette(family);
    const shadow = addCanvasNode(
      el("ellipse", {
        cx: actor.x + cardWidth / 2,
        cy: actor.y + cardHeight - 6,
        rx: cardWidth / 2 - 18,
        ry: 13,
        fill: palette.glow
      })
    );
    shadow.classList.add("label-shape");
    shadow.setAttribute("pointer-events", "none");
    if (isMutedEntity(entityId)) {
      shadow.classList.add("is-muted");
    }

    const group = addCanvasNode(el("g"));
    const rect = el("rect", {
      x: actor.x,
      y: actor.y,
      width: cardWidth,
      height: cardHeight,
      rx: 22,
      fill: "rgba(255,255,255,0.9)",
      stroke: palette.line,
      "stroke-width": 2.2
    });
    bindEntity(rect, entityId);
    if (state.ov1Editor.enabled && state.ov1Editor.tool === "move") {
      rect.style.cursor = "grab";
      rect.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
        event.preventDefault();
        const point = clientToDiagramPoint(event.clientX, event.clientY);
        state.ov1Editor.dragActorId = actor.id;
        state.ov1Editor.dragPointerId = event.pointerId;
        state.ov1Editor.dragOffset = { x: point.x - actor.x, y: point.y - actor.y };
        state.ov1Editor.dragMoved = false;
        svg.setPointerCapture(event.pointerId);
      });
    }
    group.append(rect);
    const accentBar = el("rect", {
      x: actor.x,
      y: actor.y,
      width: cardWidth,
      height: 28,
      rx: 22,
      fill: palette.soft
    });
    accentBar.setAttribute("pointer-events", "none");
    group.append(accentBar);
    const artBackdrop = el("rect", {
      x: actor.x + 16,
      y: actor.y + 18,
      width: cardWidth - 32,
      height: 64,
      rx: 16,
      fill: palette.glow
    });
    artBackdrop.setAttribute("pointer-events", "none");
    group.append(artBackdrop);
    const illustration = makeOperationalIllustration(family, palette, {
      x: actor.x + artFrame.x,
      y: actor.y + artFrame.y
    });
    applyOperationalArtState(illustration, entityId);
    group.append(illustration);
    const badge = el("rect", {
      x: actor.x + cardWidth - 84,
      y: actor.y + 12,
      width: 68,
      height: 18,
      rx: 9,
      fill: "#ffffff"
    });
    badge.setAttribute("pointer-events", "none");
    group.append(badge);
    const badgeText = el(
      "text",
      { x: actor.x + cardWidth - 76, y: actor.y + 25, "font-size": 10, fill: palette.line, "font-weight": 700 },
      operationalDomainBand(family).toUpperCase()
    );
    applyTextState(badgeText, entityId);
    badgeText.setAttribute("pointer-events", "none");
    group.append(badgeText);

    const titleText = el(
      "text",
      { x: actor.x + 18, y: actor.y + 100, "font-size": 16, "font-weight": 700, fill: "#142433" },
      truncateLabel(actor.label, 16, 24)
    );
    applyTextState(titleText, entityId);
    titleText.setAttribute("pointer-events", "none");
    group.append(titleText);
    const typeText = el(
      "text",
      { x: actor.x + 18, y: actor.y + 120, "font-size": 11, fill: "#5f7083" },
      `${family.toUpperCase()}${state.detailMode === "full" ? ` • ${actor.type.toUpperCase()}` : ""}`
    );
    applyTextState(typeText, entityId);
    typeText.setAttribute("pointer-events", "none");
    if (state.detailMode !== "compact") {
      group.append(typeText);
    }
    registerRenderedEntity({
      id: entityId,
      label: actor.label,
      kind: "Actor",
      view: "ov1",
      bounds: { x: actor.x, y: actor.y, width: cardWidth, height: cardHeight }
    });
  });
}

function renderBDD(view) {
  titleEl.textContent = view.title;
  summaryEl.textContent = `Block structure with synchronized explorer and inspector.${state.ov1Editor.enabled ? " Editing is enabled for manual placement and relationship authoring." : ""} Layout: ${humanize(state.layoutMode)}. Scope: ${humanize(state.scopeMode)}. Detail: ${humanize(state.detailMode)}.`;

  const blockLookup = Object.fromEntries(view.blocks.map((block) => [block.id, block]));
  view.relationships.forEach((relationship) => {
    const from = blockLookup[relationship.from];
    const to = blockLookup[relationship.to];
    if (!from || !to) {
      return;
    }
    if (isHiddenEntity(`bdd:${relationship.from}`) || isHiddenEntity(`bdd:${relationship.to}`)) {
      return;
    }
    const x1 = from.x + from.width;
    const y1 = from.y + 62;
    const x2 = to.x;
    const y2 = to.y + 62;
    const line = addCanvasNode(
      makeLine(x1, y1, x2, y2, {
        "marker-end": relationship.kind === "composition" ? "url(#diamond)" : "url(#arrow)"
      })
    );
    line.classList.add("link-shape");
    if (state.contextIds.has(`bdd:${relationship.from}`) && state.contextIds.has(`bdd:${relationship.to}`)) {
      line.classList.add("is-context");
    }
    if (isMutedEntity(`bdd:${relationship.from}`) || isMutedEntity(`bdd:${relationship.to}`)) {
      line.classList.add("is-muted");
    }
    registerRenderedLink({
      from: `bdd:${relationship.from}`,
      to: `bdd:${relationship.to}`,
      label: relationship.label
    });
    const label = el("text", { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 8, "font-size": 12, fill: "#344456" }, relationship.label);
    label.classList.add("label-shape");
    label.setAttribute("pointer-events", "none");
    addCanvasNode(label);
  });

  view.blocks.forEach((block) => {
    const entityId = `bdd:${block.id}`;
    if (isHiddenEntity(entityId)) {
      return;
    }
    const visibleProperties = detailSlice(block.properties, 4, 2);
    const visibleOperations = state.detailMode === "compact" ? [] : detailSlice(block.operations, 2, 0);
    const hiddenProperties = Math.max(0, block.properties.length - visibleProperties.length);
    const hiddenOperations = Math.max(0, block.operations.length - visibleOperations.length);
    const blockHeight = Math.max(118, 78 + visibleProperties.length * 18 + visibleOperations.length * 18 + (hiddenProperties || hiddenOperations ? 18 : 0));
    const rect = el("rect", {
      x: block.x,
      y: block.y,
      width: block.width,
      height: blockHeight,
      fill: "#fffdf9",
      stroke: "#24384c",
      "stroke-width": 2,
      rx: 12
    });
    bindEntity(rect, entityId);
    if (state.currentView === "bdd" && state.ov1Editor.enabled && state.ov1Editor.tool === "move") {
      rect.style.cursor = "grab";
      rect.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
        event.preventDefault();
        const point = clientToDiagramPoint(event.clientX, event.clientY);
        state.ov1Editor.dragActorId = block.id;
        state.ov1Editor.dragPointerId = event.pointerId;
        state.ov1Editor.dragOffset = {
          x: point.x - block.x,
          y: point.y - block.y
        };
        state.ov1Editor.dragMoved = false;
        svg.setPointerCapture(event.pointerId);
      });
    }
    addCanvasNode(rect);
    const headerDivider = el("line", { x1: block.x, y1: block.y + 42, x2: block.x + block.width, y2: block.y + 42, stroke: "#24384c" });
    headerDivider.setAttribute("pointer-events", "none");
    addCanvasNode(headerDivider);
    const memberDivider = el("line", {
        x1: block.x,
        y1: block.y + 42 + visibleProperties.length * 18 + 10,
        x2: block.x + block.width,
        y2: block.y + 42 + visibleProperties.length * 18 + 10,
        stroke: "#24384c"
      });
    memberDivider.setAttribute("pointer-events", "none");
    addCanvasNode(memberDivider);
    const stereotypeText = el("text", { x: block.x + 14, y: block.y + 18, "font-size": 12, fill: "#0f766e" }, block.stereotype);
    applyTextState(stereotypeText, entityId);
    stereotypeText.setAttribute("pointer-events", "none");
    addCanvasNode(stereotypeText);
    const nameText = el("text", { x: block.x + 14, y: block.y + 35, "font-size": 16, "font-weight": 700, fill: "#142433" }, block.name);
    applyTextState(nameText, entityId);
    nameText.setAttribute("pointer-events", "none");
    addCanvasNode(nameText);
    visibleProperties.forEach((property, index) => {
      const propertyText = el("text", { x: block.x + 14, y: block.y + 60 + index * 18, "font-size": 13, fill: "#344456" }, property);
      applyTextState(propertyText, entityId);
      propertyText.setAttribute("pointer-events", "none");
      addCanvasNode(propertyText);
    });
    visibleOperations.forEach((operation, index) => {
      const operationText = el(
        "text",
        {
          x: block.x + 14,
          y: block.y + 60 + visibleProperties.length * 18 + 22 + index * 18,
          "font-size": 13,
          fill: "#344456"
        },
        operation
      );
      applyTextState(operationText, entityId);
      operationText.setAttribute("pointer-events", "none");
      addCanvasNode(operationText);
    });
    if (hiddenProperties || hiddenOperations) {
      const moreText = el(
        "text",
        {
          x: block.x + 14,
          y: block.y + blockHeight - 12,
          "font-size": 12,
          fill: "#5f7083"
        },
        `+${hiddenProperties + hiddenOperations} more`
      );
      applyTextState(moreText, entityId);
      moreText.setAttribute("pointer-events", "none");
      addCanvasNode(moreText);
    }
    registerRenderedEntity({
      id: entityId,
      label: block.name,
      kind: block.stereotype,
      view: "bdd",
      bounds: { x: block.x, y: block.y, width: block.width, height: blockHeight }
    });
  });
}

function portPosition(part, port) {
  if (port.side === "right") {
    return { x: part.x + part.width, y: part.y + port.offset };
  }
  if (port.side === "left") {
    return { x: part.x, y: part.y + port.offset };
  }
  if (port.side === "top") {
    return { x: part.x + port.offset, y: part.y };
  }
  return { x: part.x + port.offset, y: part.y + part.height };
}

function connectorEndpointPosition(partLookup, portLookup, endpoint, isSource = true) {
  if (portLookup[endpoint]) {
    return portLookup[endpoint];
  }
  const part = partLookup[endpoint.split(".")[0]];
  if (!part) {
    return null;
  }
  return {
    x: isSource ? part.x + part.width : part.x,
    y: part.y + part.height / 2
  };
}

function renderIBD(view) {
  titleEl.textContent = view.title;
  summaryEl.textContent = `Internal structure, ports, and connectors.${state.ov1Editor.enabled ? " Editing is enabled for manual placement and connector authoring." : ""} Layout: ${humanize(state.layoutMode)}. Scope: ${humanize(state.scopeMode)}. Detail: ${humanize(state.detailMode)}.`;

  addCanvasNode(
    el("rect", {
      x: 40,
      y: 25,
      width: 940,
      height: 500,
      fill: "rgba(255,255,255,0.72)",
      stroke: "#1d3346",
      "stroke-width": 3,
      rx: 18
    })
  );
  addCanvasNode(el("text", { x: 58, y: 52, "font-size": 18, "font-weight": 700, fill: "#132536" }, view.frame.name));

  const portLookup = {};
  const partLookup = Object.fromEntries(view.parts.map((part) => [part.id, part]));
  view.parts.forEach((part) => {
    const entityId = `ibd:${part.id}`;
    if (isHiddenEntity(entityId)) {
      return;
    }
    const rect = el("rect", {
      x: part.x,
      y: part.y,
      width: part.width,
      height: part.height,
      fill: "#ffffff",
      stroke: "#36536b",
      "stroke-width": 2,
      rx: 14
    });
    bindEntity(rect, entityId);
    if (state.currentView === "ibd" && state.ov1Editor.enabled && state.ov1Editor.tool === "move") {
      rect.style.cursor = "grab";
      rect.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
        event.preventDefault();
        const point = clientToDiagramPoint(event.clientX, event.clientY);
        state.ov1Editor.dragActorId = part.id;
        state.ov1Editor.dragPointerId = event.pointerId;
        state.ov1Editor.dragOffset = {
          x: point.x - part.x,
          y: point.y - part.y
        };
        state.ov1Editor.dragMoved = false;
        svg.setPointerCapture(event.pointerId);
      });
    }
    addCanvasNode(rect);
    const visiblePorts = detailSlice(part.ports, 4, 2);
    const hiddenPorts = Math.max(0, part.ports.length - visiblePorts.length);
    const label = el("text", { x: part.x + 14, y: part.y + 28, "font-size": 15, "font-weight": 700, fill: "#142433" }, truncateLabel(part.name, 18, 28));
    applyTextState(label, entityId);
    label.setAttribute("pointer-events", "none");
    addCanvasNode(label);
    visiblePorts.forEach((port) => {
      const position = portPosition(part, port);
      portLookup[port.id] = position;
      const portCircle = el("circle", { cx: position.x, cy: position.y, r: 7, fill: "#0f766e", stroke: "#ffffff", "stroke-width": 2 });
      portCircle.setAttribute("pointer-events", "none");
      addCanvasNode(portCircle);
      if (state.detailMode !== "compact") {
        const portLabel = el("text", { x: position.x + (port.side === "left" ? 12 : -60), y: position.y - 10, "font-size": 12, fill: "#344456" }, truncateLabel(port.name, 12, 18));
        applyTextState(portLabel, entityId);
        portLabel.setAttribute("pointer-events", "none");
        addCanvasNode(portLabel);
      }
    });
    if (hiddenPorts) {
      const morePorts = el("text", { x: part.x + 14, y: part.y + part.height - 12, "font-size": 12, fill: "#5f7083" }, `+${hiddenPorts} more ports`);
      applyTextState(morePorts, entityId);
      morePorts.setAttribute("pointer-events", "none");
      addCanvasNode(morePorts);
    }
    registerRenderedEntity({
      id: entityId,
      label: part.name,
      kind: "Part",
      view: "ibd",
      bounds: { x: part.x, y: part.y, width: part.width, height: part.height }
    });
  });

  view.connectors.forEach((connector) => {
    const from = connectorEndpointPosition(partLookup, portLookup, connector.from, true);
    const to = connectorEndpointPosition(partLookup, portLookup, connector.to, false);
    if (!from || !to) {
      return;
    }
    const fromEntityId = `ibd:${connector.from.split(".")[0]}`;
    const toEntityId = `ibd:${connector.to.split(".")[0]}`;
    if (isHiddenEntity(fromEntityId) || isHiddenEntity(toEntityId)) {
      return;
    }
    const midX = (from.x + to.x) / 2;
    const path = el("path", {
      d: `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`,
      fill: "none",
      stroke: "#36536b",
      "stroke-width": 3,
      "marker-end": "url(#arrow)"
    });
    path.classList.add("link-shape");
    if (state.contextIds.has(fromEntityId) && state.contextIds.has(toEntityId)) {
      path.classList.add("is-context");
    }
    if (isMutedEntity(fromEntityId) || isMutedEntity(toEntityId)) {
      path.classList.add("is-muted");
    }
    addCanvasNode(path);
    if (state.detailMode !== "compact") {
      const label = el("text", { x: midX - 28, y: (from.y + to.y) / 2 - 8, "font-size": 12, fill: "#344456" }, truncateLabel(connector.label, 14, 20));
      label.classList.add("label-shape");
      label.setAttribute("pointer-events", "none");
      if (state.contextIds.has(fromEntityId) && state.contextIds.has(toEntityId)) {
        label.classList.add("is-context");
      }
      if (isMutedEntity(fromEntityId) || isMutedEntity(toEntityId)) {
        label.classList.add("is-muted");
      }
      addCanvasNode(label);
    }
    registerRenderedLink({
      from: fromEntityId,
      to: toEntityId,
      label: connector.label
    });
  });
}

function activityAnchor(node, side) {
  if (node.kind === "start" || node.kind === "end") {
    return { x: node.x, y: node.y + (side === "from" ? node.height / 2 : -node.height / 2) };
  }
  if (node.kind === "decision" || node.kind === "merge") {
    return { x: node.x, y: node.y + (side === "from" ? node.height / 2 : -node.height / 2) };
  }
  if (node.kind === "fork" || node.kind === "join") {
    return { x: node.x, y: node.y + (side === "from" ? node.height / 2 : -node.height / 2) };
  }
  return { x: node.x, y: node.y + (side === "from" ? node.height / 2 : -node.height / 2) };
}

function activityConnectorPath(from, to) {
  const source = activityAnchor(from, "from");
  const target = activityAnchor(to, "to");
  if (Math.abs(source.x - target.x) < 2) {
    return {
      d: `M ${source.x} ${source.y} L ${target.x} ${target.y}`,
      labelX: source.x + 12,
      labelY: (source.y + target.y) / 2 - 8
    };
  }
  const bendY = target.y > source.y ? (source.y + target.y) / 2 : source.y + 40;
  return {
    d: `M ${source.x} ${source.y} L ${source.x} ${bendY} L ${target.x} ${bendY} L ${target.x} ${target.y}`,
    labelX: (source.x + target.x) / 2,
    labelY: bendY - 8
  };
}

function renderActivity(view) {
  titleEl.textContent = view.title;
  summaryEl.textContent = `Standard MBSE activity swimlanes with actors, steps, and object-flow labels. Scope: ${humanize(state.scopeMode)}. Detail: ${humanize(state.detailMode)}.`;

  const visibleNodes = view.nodes.filter((node) => !isHiddenEntity(`activity:${node.id}`));
  const nodeLookup = Object.fromEntries(view.nodes.map((node) => [node.id, node]));
  const laneIdsInUse = new Set(visibleNodes.map((node) => node.performer));
  const lanes = view.lanes.filter((lane) => laneIdsInUse.has(lane.id) || state.scopeMode === "all");
  const maxNodeBottom = Math.max(...visibleNodes.map((node) => node.y + node.height / 2), 180);
  const laneHeight = maxNodeBottom + 54;

  lanes.forEach((lane) => {
    addCanvasNode(
      el("rect", {
        x: lane.x,
        y: 36,
        width: lane.width,
        height: laneHeight,
        rx: 18,
        fill: "rgba(255,255,255,0.72)",
        stroke: "#bfd0db",
        "stroke-width": 1.5
      })
    );
    addCanvasNode(
      el("rect", {
        x: lane.x,
        y: 36,
        width: lane.width,
        height: lane.headerHeight,
        rx: 18,
        fill: "#d8eff2",
        stroke: "#7aa8b5",
        "stroke-width": 1.5
      })
    );
    addCanvasNode(
      el("text", { x: lane.x + 14, y: 63, "font-size": 14, "font-weight": 700, fill: "#143240" }, lane.label)
    );
  });

  view.edges.forEach((edge) => {
    const from = nodeLookup[edge.from];
    const to = nodeLookup[edge.to];
    if (!from || !to) {
      return;
    }
    if (isHiddenEntity(`activity:${edge.from}`) || isHiddenEntity(`activity:${edge.to}`)) {
      return;
    }
    const pathSpec = activityConnectorPath(from, to);
    const path = addCanvasNode(
      el("path", {
        d: pathSpec.d,
        fill: "none",
        stroke: "#36536b",
        "stroke-width": 3,
        "marker-end": "url(#arrow)"
      })
    );
    path.classList.add("link-shape");
    if (state.contextIds.has(`activity:${edge.from}`) && state.contextIds.has(`activity:${edge.to}`)) {
      path.classList.add("is-context");
    }
    if (isMutedEntity(`activity:${edge.from}`) || isMutedEntity(`activity:${edge.to}`)) {
      path.classList.add("is-muted");
    }
    registerRenderedLink({
      from: `activity:${edge.from}`,
      to: `activity:${edge.to}`,
      label: edge.label || "flow"
    });
    if (edge.label && state.detailMode !== "compact") {
      const label = el(
        "text",
        { x: pathSpec.labelX, y: pathSpec.labelY, "font-size": 12, fill: "#344456" },
        truncateLabel(edge.label, 26, 52)
      );
      label.classList.add("label-shape");
      if (state.contextIds.has(`activity:${edge.from}`) && state.contextIds.has(`activity:${edge.to}`)) {
        label.classList.add("is-context");
      }
      if (isMutedEntity(`activity:${edge.from}`) || isMutedEntity(`activity:${edge.to}`)) {
        label.classList.add("is-muted");
      }
      addCanvasNode(label);
    }
  });

  visibleNodes.forEach((node) => {
    const entityId = `activity:${node.id}`;
    if (node.kind === "start" || node.kind === "end") {
      const circle = el("circle", { cx: node.x, cy: node.y, r: node.width / 2, fill: node.kind === "start" ? "#0f766e" : "#18222f" });
      bindEntity(circle, entityId);
      addCanvasNode(circle);
      if (node.kind === "end") {
        addCanvasNode(el("circle", { cx: node.x, cy: node.y, r: 12, fill: "#fff" }));
        addCanvasNode(el("circle", { cx: node.x, cy: node.y, r: 8, fill: "#18222f" }));
      }
      const label = el("text", { x: node.x - 20, y: node.y + 38, "font-size": 12, fill: "#344456" }, truncateLabel(node.label, 12, 20));
      applyTextState(label, entityId);
      addCanvasNode(label);
    } else if (node.kind === "decision" || node.kind === "merge") {
      const diamond = el("polygon", {
        points: `${node.x},${node.y - node.height / 2} ${node.x + node.width / 2},${node.y} ${node.x},${node.y + node.height / 2} ${node.x - node.width / 2},${node.y}`,
        fill: "#f7e7cb",
        stroke: "#36536b",
        "stroke-width": 2
      });
      bindEntity(diamond, entityId);
      addCanvasNode(diamond);
      const label = el("text", { x: node.x - 34, y: node.y + 4, "font-size": 12, fill: "#344456" }, truncateLabel(node.label, 12, 18));
      applyTextState(label, entityId);
      addCanvasNode(label);
    } else if (node.kind === "fork" || node.kind === "join") {
      const bar = el("rect", {
        x: node.x - node.width / 2,
        y: node.y - node.height / 2,
        width: node.width,
        height: node.height,
        rx: 6,
        fill: "#36536b"
      });
      bindEntity(bar, entityId);
      addCanvasNode(bar);
    } else if (node.kind === "accept") {
      const acceptShape = el("path", {
        d: `M ${node.x - node.width / 2} ${node.y - node.height / 2} L ${node.x + node.width / 2 - 18} ${node.y - node.height / 2} L ${node.x + node.width / 2} ${node.y} L ${node.x + node.width / 2 - 18} ${node.y + node.height / 2} L ${node.x - node.width / 2} ${node.y + node.height / 2} z`,
        fill: "#ffffff",
        stroke: "#36536b",
        "stroke-width": 2
      });
      bindEntity(acceptShape, entityId);
      addCanvasNode(acceptShape);
      const label = el("text", { x: node.x - 58, y: node.y + 2, "font-size": 12, fill: "#344456" }, truncateLabel(node.label, 15, 24));
      applyTextState(label, entityId);
      addCanvasNode(label);
      if (node.subtitle && state.detailMode !== "compact") {
        const subtitle = el("text", { x: node.x - 58, y: node.y + 18, "font-size": 11, fill: "#6a7d8f" }, truncateLabel(node.subtitle, 18, 28));
        applyTextState(subtitle, entityId);
        addCanvasNode(subtitle);
      }
    } else {
      const rect = el("rect", {
        x: node.x - node.width / 2,
        y: node.y - node.height / 2,
        width: node.width,
        height: node.height,
        rx: 16,
        fill: "#ffffff",
        stroke: "#36536b",
        "stroke-width": 2
      });
      bindEntity(rect, entityId);
      addCanvasNode(rect);
      const titleY = node.subtitle && state.detailMode !== "compact" ? node.y - 4 : node.y + 4;
      const label = el("text", { x: node.x - node.width / 2 + 14, y: titleY, "font-size": 12, fill: "#344456", "font-weight": 700 }, truncateLabel(node.label, 16, 28));
      applyTextState(label, entityId);
      addCanvasNode(label);
      if (node.subtitle && state.detailMode !== "compact") {
        const subtitle = el("text", { x: node.x - node.width / 2 + 14, y: node.y + 16, "font-size": 11, fill: "#6a7d8f" }, truncateLabel(node.subtitle, 18, 32));
        applyTextState(subtitle, entityId);
        addCanvasNode(subtitle);
      }
    }

    registerRenderedEntity({
      id: entityId,
      label: node.label,
      kind: `${humanize(node.kind)} / ${node.performer}`,
      view: "activity",
      bounds: { x: node.x - node.width / 2, y: node.y - node.height / 2, width: node.width, height: node.height }
    });
  });
}

function renderSequence(view) {
  titleEl.textContent = view.title;
  summaryEl.textContent = `SysML-style sequence diagram with lifelines, messages, and execution bars. Scope: ${humanize(state.scopeMode)}. Detail: ${humanize(state.detailMode)}.`;

  const participantLookup = Object.fromEntries(view.participants.map((participant) => [participant.id, participant]));
  const visibleExecutions = view.executions.filter((execution) => !isHiddenEntity(`sequence:execution:${execution.nodeId}`));
  const visibleMessages = view.messages.filter((message) => !isHiddenEntity(`sequence:message:${message.id}`));
  const participantIdsInUse = new Set([
    ...visibleExecutions.map((execution) => execution.participant),
    ...visibleMessages.flatMap((message) => [message.from, message.to])
  ]);
  const visibleParticipants = view.participants.filter(
    (participant) => participantIdsInUse.has(participant.id) || !isHiddenEntity(`sequence:participant:${participant.id}`)
  );
  const bottomY = Math.max(
    250,
    ...visibleExecutions.map((execution) => execution.y + execution.height + 34),
    ...visibleMessages.map((message) => message.y + 40)
  );

  visibleParticipants.forEach((participant) => {
    const entityId = `sequence:participant:${participant.id}`;
    const rect = el("rect", {
      x: participant.x,
      y: 34,
      width: participant.width,
      height: 46,
      rx: 14,
      fill: "#ffffff",
      stroke: "#36536b",
      "stroke-width": 2
    });
    bindEntity(rect, entityId);
    addCanvasNode(rect);
    const label = el(
      "text",
      { x: participant.x + 14, y: 62, "font-size": 13, "font-weight": 700, fill: "#142433" },
      truncateLabel(participant.label, 18, 28)
    );
    applyTextState(label, entityId);
    addCanvasNode(label);
    const lifeline = addCanvasNode(
      el("line", {
        x1: participant.x + participant.width / 2,
        y1: 80,
        x2: participant.x + participant.width / 2,
        y2: bottomY,
        stroke: "#8aa1b3",
        "stroke-width": 2,
        "stroke-dasharray": "7 7"
      })
    );
    lifeline.classList.add("label-shape");
    if (isMutedEntity(entityId)) {
      lifeline.classList.add("is-muted");
    }
    registerRenderedEntity({
      id: entityId,
      label: participant.label,
      kind: "Participant",
      view: "sequence",
      bounds: { x: participant.x, y: 34, width: participant.width, height: bottomY - 34 }
    });
  });

  visibleExecutions.forEach((execution) => {
    const entityId = `sequence:execution:${execution.nodeId}`;
    const rect = el("rect", {
      x: execution.x,
      y: execution.y,
      width: execution.width,
      height: execution.height,
      rx: 7,
      fill: "#d8eff2",
      stroke: "#005f73",
      "stroke-width": 2
    });
    bindEntity(rect, entityId);
    addCanvasNode(rect);
    if (state.detailMode === "full") {
      const caption = el(
        "text",
        { x: execution.x + 20, y: execution.y + execution.height / 2 + 4, "font-size": 11, fill: "#4b6072" },
        truncateLabel(execution.label, 20, 30)
      );
      applyTextState(caption, entityId);
      addCanvasNode(caption);
    }
    registerRenderedEntity({
      id: entityId,
      label: execution.label,
      kind: `Execution / ${execution.participant}`,
      view: "sequence",
      bounds: { x: execution.x, y: execution.y, width: execution.width, height: execution.height }
    });
  });

  visibleMessages.forEach((message) => {
    const fromParticipant = participantLookup[message.from];
    const toParticipant = participantLookup[message.to];
    if (!fromParticipant || !toParticipant) {
      return;
    }
    const entityId = `sequence:message:${message.id}`;
    const fromX = fromParticipant.x + fromParticipant.width / 2;
    const toX = toParticipant.x + toParticipant.width / 2;
    let pathSpec;
    if (message.from === message.to) {
      pathSpec = {
        d: `M ${fromX} ${message.y} h 36 v 24 h -36`,
        labelX: fromX + 18,
        labelY: message.y - 8
      };
    } else {
      pathSpec = {
        d: `M ${fromX} ${message.y} L ${toX} ${message.y}`,
        labelX: (fromX + toX) / 2,
        labelY: message.y - 8
      };
    }
    const path = el("path", {
      d: pathSpec.d,
      fill: "none",
      stroke: "#36536b",
      "stroke-width": 2.5,
      "marker-end": "url(#arrow)"
    });
    bindEntity(path, entityId);
    addCanvasNode(path);
    if (message.label && state.detailMode !== "compact") {
      const label = el(
        "text",
        { x: pathSpec.labelX, y: pathSpec.labelY, "font-size": 12, fill: "#344456" },
        truncateLabel(message.label, 24, 54)
      );
      applyTextState(label, entityId);
      addCanvasNode(label);
    }
    registerRenderedLink({
      from: `sequence:participant:${message.from}`,
      to: `sequence:participant:${message.to}`,
      label: message.label || "message"
    });
    registerRenderedEntity({
      id: entityId,
      label: message.label || "Message",
      kind: `Message / ${message.from} -> ${message.to}`,
      view: "sequence",
      bounds: {
        x: Math.min(fromX, toX),
        y: message.y - 12,
        width: Math.max(42, Math.abs(toX - fromX)),
        height: 28
      }
    });
  });
}

function requirementPalette(category) {
  if (category === "definition") {
    return {
      fill: "#e7f5f4",
      header: "#cbeae6",
      stroke: "#0f766e",
      badge: "DEF"
    };
  }
  if (category === "element") {
    return {
      fill: "#eef3f7",
      header: "#dbe4ec",
      stroke: "#45637d",
      badge: "ELEM"
    };
  }
  return {
    fill: "#fff3df",
    header: "#ffe2ad",
    stroke: "#9a6700",
    badge: "REQ"
  };
}

function requirementLinkStyle(kind) {
  if (kind === "satisfy") {
    return { stroke: "#0f766e", markerEnd: "url(#arrow)", dash: "" };
  }
  if (kind === "subject") {
    return { stroke: "#6b7f91", markerEnd: "url(#arrow)", dash: "5 4" };
  }
  if (kind === "type" || kind === "specialize") {
    return { stroke: "#38536b", markerEnd: "url(#triangle)", dash: kind === "type" ? "6 4" : "" };
  }
  if (kind === "refine") {
    return { stroke: "#c17b00", markerEnd: "url(#arrow)", dash: "3 3" };
  }
  if (kind === "verify") {
    return { stroke: "#2f6690", markerEnd: "url(#arrow)", dash: "2 4" };
  }
  if (kind === "derive") {
    return { stroke: "#7a3f98", markerEnd: "url(#arrow)", dash: "6 3" };
  }
  if (kind === "trace") {
    return { stroke: "#8a5a44", markerEnd: "url(#arrow)", dash: "4 4" };
  }
  return { stroke: "#7a3f98", markerEnd: "url(#arrow)", dash: "" };
}

function requirementAnchor(node, targetNode, isSource = true) {
  const nodeCenter = node.y + node.height / 2;
  if (Math.abs((targetNode.x + targetNode.width / 2) - (node.x + node.width / 2)) < 36) {
    return {
      x: node.x + node.width / 2,
      y: isSource ? node.y + node.height : node.y
    };
  }
  return {
    x: (targetNode.x + targetNode.width / 2) >= (node.x + node.width / 2) ? node.x + node.width : node.x,
    y: nodeCenter
  };
}

function requirementLinkPath(fromNode, toNode) {
  const source = requirementAnchor(fromNode, toNode, true);
  const target = requirementAnchor(toNode, fromNode, false);
  if (Math.abs(source.x - target.x) < 24) {
    const midY = (source.y + target.y) / 2;
    return {
      d: `M ${source.x} ${source.y} C ${source.x} ${midY}, ${target.x} ${midY}, ${target.x} ${target.y}`,
      labelX: source.x + 18,
      labelY: midY - 10
    };
  }
  const deltaX = Math.abs(target.x - source.x);
  const curve = Math.max(42, deltaX * 0.34);
  return {
    d: `M ${source.x} ${source.y} C ${source.x + (target.x >= source.x ? curve : -curve)} ${source.y}, ${target.x - (target.x >= source.x ? curve : -curve)} ${target.y}, ${target.x} ${target.y}`,
    labelX: (source.x + target.x) / 2,
    labelY: (source.y + target.y) / 2 - 10
  };
}

function renderRequirements(view) {
  titleEl.textContent = view.title;
  summaryEl.textContent = `${view.summary} Layout: ${humanize(state.layoutMode)}. Scope: ${humanize(state.scopeMode)}. Detail: ${humanize(state.detailMode)}.`;

  addCanvasNode(
    el("rect", {
      x: 26,
      y: 20,
      width: 988,
      height: 520,
      rx: 26,
      fill: "rgba(255,255,255,0.7)",
      stroke: "rgba(53, 81, 104, 0.18)",
      "stroke-width": 2
    })
  );
  addCanvasNode(el("text", { x: 52, y: 52, "font-size": 18, "font-weight": 700, fill: "#142433" }, "SYSML REQUIREMENTS"));
  addCanvasNode(el("text", { x: 52, y: 74, "font-size": 12, fill: "#5b6f82" }, truncateLabel(view.summary || "", 84, 120)));

  if (!view.nodes.length) {
    const empty = el("text", { x: 72, y: 124, "font-size": 14, fill: "#5b6f82" }, view.emptyMessage || "No requirements found.");
    empty.classList.add("label-shape");
    addCanvasNode(empty);
    return;
  }

  const nodeLookup = Object.fromEntries(view.nodes.map((node) => [node.id, node]));
  view.links.forEach((link) => {
    const fromNode = nodeLookup[link.from];
    const toNode = nodeLookup[link.to];
    if (!fromNode || !toNode) {
      return;
    }
    const fromEntityId = `requirements:${link.from}`;
    const toEntityId = `requirements:${link.to}`;
    if (isHiddenEntity(fromEntityId) || isHiddenEntity(toEntityId)) {
      return;
    }
    const style = requirementLinkStyle(link.kind);
    const pathSpec = requirementLinkPath(fromNode, toNode);
    const path = addCanvasNode(
      el("path", {
        d: pathSpec.d,
        fill: "none",
        stroke: style.stroke,
        "stroke-width": 2.4,
        "marker-end": style.markerEnd
      })
    );
    path.classList.add("link-shape");
    if (style.dash) {
      path.setAttribute("stroke-dasharray", style.dash);
    }
    if (state.contextIds.has(fromEntityId) && state.contextIds.has(toEntityId)) {
      path.classList.add("is-context");
    }
    if (isMutedEntity(fromEntityId) || isMutedEntity(toEntityId)) {
      path.classList.add("is-muted");
    }
    registerRenderedLink({ from: fromEntityId, to: toEntityId, label: link.label || link.kind });
    if (state.detailMode === "full" || (state.detailMode === "standard" && link.kind !== "subject")) {
      const label = el(
        "text",
        { x: pathSpec.labelX, y: pathSpec.labelY, "font-size": 11, fill: style.stroke, "font-weight": 700 },
        truncateLabel(link.label || humanize(link.kind), 14, 22)
      );
      label.classList.add("label-shape");
      label.setAttribute("pointer-events", "none");
      addCanvasNode(label);
    }
  });

  view.nodes.forEach((node) => {
    const entityId = `requirements:${node.id}`;
    if (isHiddenEntity(entityId)) {
      return;
    }
    const palette = requirementPalette(node.category);
    const rect = el("rect", {
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      rx: 16,
      fill: palette.fill,
      stroke: palette.stroke,
      "stroke-width": 2
    });
    bindEntity(rect, entityId);
    addCanvasNode(rect);
    const header = el("rect", {
      x: node.x,
      y: node.y,
      width: node.width,
      height: 28,
      rx: 16,
      fill: palette.header
    });
    header.setAttribute("pointer-events", "none");
    addCanvasNode(header);

    const badge = el("text", { x: node.x + 14, y: node.y + 19, "font-size": 11, fill: palette.stroke, "font-weight": 700 }, palette.badge);
    applyTextState(badge, entityId);
    badge.setAttribute("pointer-events", "none");
    addCanvasNode(badge);

    const titleLines = wrapSvgText(node.label, state.detailMode === "compact" ? 20 : 28).slice(0, state.detailMode === "compact" ? 1 : 2);
    titleLines.forEach((line, index) => {
      const titleLine = el(
        "text",
        { x: node.x + 14, y: node.y + 48 + index * 16, "font-size": 14, fill: "#142433", "font-weight": 700 },
        line
      );
      applyTextState(titleLine, entityId);
      titleLine.setAttribute("pointer-events", "none");
      addCanvasNode(titleLine);
    });

    let detailY = node.y + 76;
    const detailLines = [];
    if (node.requirementId && state.detailMode !== "compact") {
      detailLines.push(`Id: ${node.requirementId}`);
    }
    if (node.typeName && state.detailMode !== "compact") {
      detailLines.push(`Type: ${node.typeName}`);
    }
    if (node.baseType && state.detailMode !== "compact") {
      detailLines.push(`Base: ${node.baseType}`);
    }
    if (node.subjectName && state.detailMode === "full") {
      detailLines.push(`Subject: ${node.subjectName}`);
    }
    if (node.category !== "element") {
      detailLines.push(`Constraints: ${node.constraintCount || 0}`);
    }
    detailSlice(detailLines, 3, 1).forEach((line) => {
      const detail = el("text", { x: node.x + 14, y: detailY, "font-size": 11, fill: "#5b6f82" }, truncateLabel(line, 28, 38));
      applyTextState(detail, entityId);
      detail.setAttribute("pointer-events", "none");
      addCanvasNode(detail);
      detailY += 14;
    });

    const nodeTextPreview = node.requirementText || node.description || node.rawText || "";
    if (nodeTextPreview && state.detailMode !== "compact") {
      const snippet = wrapSvgText(nodeTextPreview, state.detailMode === "full" ? 34 : 28).slice(0, state.detailMode === "full" ? 3 : 2);
      snippet.forEach((line, index) => {
        const description = el(
          "text",
          { x: node.x + 14, y: node.y + node.height - 18 - (snippet.length - index - 1) * 13, "font-size": 11, fill: "#344456" },
          truncateLabel(line, 30, 42)
        );
        applyTextState(description, entityId);
        description.setAttribute("pointer-events", "none");
        addCanvasNode(description);
      });
    }

    registerRenderedEntity({
      id: entityId,
      label: node.label,
      kind: node.kind,
      view: "requirements",
      bounds: { x: node.x, y: node.y, width: node.width, height: node.height }
    });
  });
}

function requirementsViewModel() {
  return model?.views?.requirements || { nodes: [], links: [], summary: "" };
}

function searchTextForRequirementNode(node) {
  return [
    node.label,
    node.name,
    node.requirementId,
    node.typeName,
    node.baseType,
    node.parentName,
    node.requirementText,
    node.subjectName,
    node.subjectType,
    node.description,
    node.rawText,
    node.fullPath,
    ...(node.constraintTexts || []),
    ...(node.requiredTargets || []).flatMap((entry) => [entry.target, entry.typeName, entry.kind]),
    ...(node.traceLinks || []).flatMap((entry) => [entry.kind, entry.target]),
    ...(node.satisfyBy || [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function formatRequirementTarget(entry) {
  const target = entry?.target || "Unnamed target";
  const typeName = entry?.typeName ? ` : ${entry.typeName}` : "";
  return `${target}${typeName}`;
}

function formatRequirementTrace(entry) {
  return `${humanize(entry?.kind || "trace")} -> ${entry?.target || "Unnamed target"}`;
}

function requirementDetailField(label, value) {
  const field = document.createElement("div");
  field.className = "requirements-field";
  const key = document.createElement("span");
  key.className = "requirements-field-label";
  key.textContent = label;
  const val = document.createElement("div");
  val.className = "requirements-field-value";
  val.textContent = value || "Not set";
  field.append(key, val);
  return field;
}

function requirementDetailSection(title, values, options = {}) {
  const { code = false } = options;
  const section = document.createElement("section");
  section.className = "requirements-detail-section";
  const heading = document.createElement("h5");
  heading.textContent = title;
  section.append(heading);
  if (!values.length) {
    const empty = document.createElement("div");
    empty.className = "requirements-detail-item";
    empty.textContent = "None parsed.";
    section.append(empty);
    return section;
  }
  const list = document.createElement("div");
  list.className = "requirements-detail-list";
  values.forEach((value) => {
    const item = document.createElement("div");
    item.className = `requirements-detail-item${code ? " is-code" : ""}`;
    item.textContent = value;
    list.append(item);
  });
  section.append(list);
  return section;
}

function isMeaningfulRequirementValue(value) {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "string") {
    return Boolean(value.trim());
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return true;
}

function requirementFieldLabel(key) {
  const labels = {
    id: "Node Id",
    label: "Display Label",
    shortName: "Short Name",
    name: "Raw Name",
    requirementId: "Requirement Id",
    typeName: "Type",
    baseType: "Base Type",
    parentName: "Parent Requirement",
    subjectName: "Subject",
    subjectType: "Subject Type",
    constraintCount: "Constraint Count",
    requiredTargets: "Required Targets",
    traceLinks: "Trace Links",
    satisfyBy: "Satisfied By",
    requirementText: "Requirement Text",
    description: "Description",
    constraintTexts: "Constraint Text",
    rawText: "Raw SysML Text",
    fullPath: "Qualified Name",
    category: "Category",
    kind: "Kind",
    relatedItems: "Related Items"
  };
  return labels[key] || humanize(key);
}

function formatGenericRequirementEntry(entry) {
  if (entry === null || entry === undefined) {
    return "";
  }
  if (typeof entry === "string") {
    return entry;
  }
  if (typeof entry === "number" || typeof entry === "boolean") {
    return String(entry);
  }
  if (Array.isArray(entry)) {
    return entry.map((value) => formatGenericRequirementEntry(value)).filter(Boolean).join(", ");
  }
  const parts = Object.entries(entry)
    .filter(([, value]) => isMeaningfulRequirementValue(value))
    .map(([key, value]) => `${requirementFieldLabel(key)}: ${formatGenericRequirementEntry(value)}`);
  return parts.join(" • ") || JSON.stringify(entry, null, 2);
}

function formatRequirementModalEntries(key, value) {
  if (!isMeaningfulRequirementValue(value)) {
    return [];
  }
  if (key === "requiredTargets") {
    return value.map((entry) => formatRequirementTarget(entry)).filter(Boolean);
  }
  if (key === "traceLinks") {
    return value.map((entry) => formatRequirementTrace(entry)).filter(Boolean);
  }
  if (key === "relatedItems") {
    return value
      .map((entry) => [entry.label, entry.kind, entry.note].filter(Boolean).join(" • "))
      .filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => formatGenericRequirementEntry(entry)).filter(Boolean);
  }
  if (typeof value === "object") {
    return [formatGenericRequirementEntry(value)].filter(Boolean);
  }
  return [String(value)];
}

function resolveRequirementModalRecord(item) {
  if (!item || item.view !== "requirements") {
    return null;
  }
  const nodeId = item.id.startsWith("requirements:") ? item.id.slice("requirements:".length) : item.id;
  const node = model?.views?.requirements?.nodes?.find((candidate) => candidate.id === nodeId) || null;
  return {
    ...(node || {}),
    id: node?.id || nodeId,
    label: item.label,
    kind: node?.kind || item.kind,
    view: item.view,
    category: node?.category || "",
    relatedItems: item.relatedItems || [],
    detailRows: item.detailRows || [],
    lists: item.lists || []
  };
}

function openRequirementsExplorerModal(itemId) {
  const item = state.catalog.find((entry) => entry.id === itemId && entry.view === "requirements");
  if (!item) {
    return;
  }
  state.requirementsModalId = item.id;
  renderRequirementsExplorerModal();
}

function closeRequirementsExplorerModal() {
  state.requirementsModalId = "";
  renderRequirementsExplorerModal();
}

function renderRequirementsExplorerModal() {
  if (
    !requirementsExplorerModalEl ||
    !requirementsExplorerModalTitleEl ||
    !requirementsExplorerModalSubtitleEl ||
    !requirementsExplorerModalContentEl
  ) {
    return;
  }

  const item = state.catalog.find((entry) => entry.id === state.requirementsModalId && entry.view === "requirements") || null;
  const record = resolveRequirementModalRecord(item);
  const isOpen = Boolean(record);
  requirementsExplorerModalEl.classList.toggle("is-hidden", !isOpen);
  requirementsExplorerModalEl.setAttribute("aria-hidden", String(!isOpen));
  requirementsExplorerModalContentEl.replaceChildren();
  if (!record) {
    state.requirementsModalId = "";
    return;
  }

  requirementsExplorerModalTitleEl.textContent = record.label || "Requirement Detail";
  requirementsExplorerModalSubtitleEl.textContent = [
    record.kind || "Requirement",
    record.requirementId ? `ID ${record.requirementId}` : "",
    record.relatedItems?.length ? `${record.relatedItems.length} related link${record.relatedItems.length === 1 ? "" : "s"}` : ""
  ]
    .filter(Boolean)
    .join(" • ");

  const hero = document.createElement("div");
  hero.className = "requirements-detail-hero";
  const chips = document.createElement("div");
  chips.className = "diagram-chip-row";
  [record.kind, record.category ? humanize(record.category) : ""].filter(Boolean).forEach((value) => {
    const chip = document.createElement("span");
    chip.className = "diagram-chip";
    chip.textContent = value;
    chips.append(chip);
  });
  hero.append(chips);
  if (record.requirementText || record.description || record.rawText) {
    const copy = document.createElement("div");
    copy.className = "requirements-detail-copy";
    copy.textContent = record.requirementText || record.description || record.rawText;
    hero.append(copy);
  }
  requirementsExplorerModalContentEl.append(hero);

  const fieldGrid = document.createElement("div");
  fieldGrid.className = "requirements-field-grid";
  const orderedKeys = [
    "label",
    "name",
    "shortName",
    "requirementId",
    "category",
    "kind",
    "typeName",
    "baseType",
    "parentName",
    "subjectName",
    "subjectType",
    "constraintCount",
    "fullPath",
    "id"
  ];
  const sectionKeys = new Set(["requirementText", "description", "constraintTexts", "requiredTargets", "traceLinks", "satisfyBy", "relatedItems", "rawText"]);
  const excludedKeys = new Set(["x", "y", "width", "height", "view", "detailRows", "lists", "searchText"]);
  const renderedScalarKeys = new Set();
  orderedKeys.forEach((key) => {
    if (!isMeaningfulRequirementValue(record[key])) {
      return;
    }
    renderedScalarKeys.add(key);
    fieldGrid.append(requirementDetailField(requirementFieldLabel(key), String(record[key])));
  });
  Object.keys(record).forEach((key) => {
    if (renderedScalarKeys.has(key) || sectionKeys.has(key) || excludedKeys.has(key) || Array.isArray(record[key]) || typeof record[key] === "object") {
      return;
    }
    if (!isMeaningfulRequirementValue(record[key])) {
      return;
    }
    fieldGrid.append(requirementDetailField(requirementFieldLabel(key), String(record[key])));
  });
  if (fieldGrid.children.length) {
    requirementsExplorerModalContentEl.append(fieldGrid);
  }

  const orderedSections = ["requirementText", "description", "requiredTargets", "traceLinks", "satisfyBy", "constraintTexts", "relatedItems", "rawText"];
  const renderedSectionKeys = new Set();
  orderedSections.forEach((key) => {
    const values = formatRequirementModalEntries(key, record[key]);
    if (!values.length) {
      return;
    }
    renderedSectionKeys.add(key);
    const isCode = key === "constraintTexts" || key === "rawText";
    requirementsExplorerModalContentEl.append(requirementDetailSection(requirementFieldLabel(key), values, { code: isCode }));
  });
  Object.keys(record).forEach((key) => {
    if (renderedScalarKeys.has(key) || renderedSectionKeys.has(key) || excludedKeys.has(key)) {
      return;
    }
    const value = record[key];
    if (!Array.isArray(value) && typeof value !== "object") {
      return;
    }
    const values = formatRequirementModalEntries(key, value);
    if (!values.length) {
      return;
    }
    requirementsExplorerModalContentEl.append(requirementDetailSection(requirementFieldLabel(key), values));
  });
}

function renderRequirementsBoard() {
  if (!requirementsBoardEl || !requirementsListEl || !requirementsDetailEl) {
    return;
  }

  const isActive = state.currentView === "requirements";
  requirementsBoardEl.classList.toggle("is-hidden", !isActive);
  if (!isActive || !model) {
    requirementsListEl.replaceChildren();
    requirementsDetailEl.replaceChildren();
    return;
  }

  const view = requirementsViewModel();
  titleEl.textContent = view.title || "Requirements Workspace";
  summaryEl.textContent = "Workspace-first requirements review with searchable IDs, readable text, and every mapped requirement field.";
  const requirementNodes = view.nodes.filter((node) => node.category !== "element");
  const definitionCount = requirementNodes.filter((node) => node.category === "definition").length;
  const requirementCount = requirementNodes.filter((node) => node.category === "requirement").length;
  const query = currentSearchQuery();
  const filteredNodes = requirementNodes
    .filter((node) => !query || searchTextForRequirementNode(node).includes(query))
    .sort((left, right) => {
      const categoryOrder = left.category.localeCompare(right.category);
      if (categoryOrder !== 0) {
        return categoryOrder;
      }
      const idOrder = String(left.requirementId || "").localeCompare(String(right.requirementId || ""));
      if (idOrder !== 0) {
        return idOrder;
      }
      return left.label.localeCompare(right.label);
    });

  if (requirementsSearchEl && requirementsSearchEl.value !== searchInputEl.value) {
    requirementsSearchEl.value = searchInputEl.value;
  }
  if (requirementsSummaryEl) {
    requirementsSummaryEl.textContent = `Parsed ${requirementCount} requirements and ${definitionCount} requirement definitions from the current SysML2 input. Select any entry to inspect its mapped text, relationships, and raw SysML fields.`;
  }
  if (requirementsListCountEl) {
    requirementsListCountEl.textContent = `${filteredNodes.length} of ${requirementNodes.length} items`;
  }

  requirementsListEl.replaceChildren();
  if (!filteredNodes.length) {
    const empty = document.createElement("div");
    empty.className = "requirements-list-empty";
    empty.textContent = query
      ? "No parsed requirements match the current search. Clear or broaden the query to see more items."
      : "No parsed requirements are available for listing.";
    requirementsListEl.append(empty);
  } else {
    filteredNodes.forEach((node) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "requirements-list-item";
      const entityId = `requirements:${node.id}`;
      button.classList.toggle("is-selected", state.selectedEntityId === entityId);
      button.classList.toggle("is-context", isContextEntity(entityId));
      button.classList.toggle("is-muted", isMutedEntity(entityId));

      const top = document.createElement("div");
      top.className = "requirements-list-top";
      const titleWrap = document.createElement("div");
      titleWrap.className = "requirements-list-title";
      const label = document.createElement("span");
      label.className = "requirements-list-label";
      label.textContent = node.requirementId ? `${node.requirementId} ${node.shortName || node.label}` : node.label;
      const meta = document.createElement("span");
      meta.className = "requirements-list-meta";
      meta.textContent = [node.typeName || node.baseType || node.kind, node.subjectName ? `subject ${node.subjectName}` : ""].filter(Boolean).join(" • ");
      titleWrap.append(label, meta);
      const pill = document.createElement("span");
      pill.className = `requirements-kind-pill is-${node.category}`.trim();
      pill.textContent = node.category === "definition" ? "Definition" : "Requirement";
      top.append(titleWrap, pill);
      button.append(top);

      const previewText = node.requirementText || node.description || node.rawText || "";
      if (previewText) {
        const copy = document.createElement("div");
        copy.className = "requirements-list-copy";
        copy.textContent = previewText;
        button.append(copy);
      }

      const tags = [
        node.parentName ? `Parent: ${node.parentName}` : "",
        `Constraints: ${node.constraintCount || 0}`,
        node.subjectType ? `Subject Type: ${node.subjectType}` : ""
      ].filter(Boolean);
      if (tags.length) {
        const tagWrap = document.createElement("div");
        tagWrap.className = "requirements-list-tags";
        tags.forEach((tag) => {
          const chip = document.createElement("span");
          chip.className = "requirements-tag";
          chip.textContent = tag;
          tagWrap.append(chip);
        });
        button.append(tagWrap);
      }

      button.addEventListener("click", () => selectEntity(entityId, { switchView: false, preserveViewport: true, center: true }));
      requirementsListEl.append(button);
    });
  }

  requirementsDetailEl.replaceChildren();
  const selectedId = state.selectedEntityId?.startsWith("requirements:") ? state.selectedEntityId.slice("requirements:".length) : "";
  const selectedNode = view.nodes.find((node) => node.id === selectedId) || null;
  if (!selectedNode) {
    const empty = document.createElement("div");
    empty.className = "requirements-detail-empty";
    empty.textContent = "Select a requirement from the list or explorer to inspect every parsed field here.";
    requirementsDetailEl.append(empty);
    return;
  }

  const hero = document.createElement("div");
  hero.className = "requirements-detail-hero";
  const chips = document.createElement("div");
  chips.className = "diagram-chip-row";
  [selectedNode.kind, humanize(selectedNode.category)].forEach((value) => {
    const chip = document.createElement("span");
    chip.className = "diagram-chip";
    chip.textContent = value;
    chips.append(chip);
  });
  const title = document.createElement("h4");
  title.className = "requirements-detail-title";
  title.textContent = selectedNode.label;
  hero.append(chips, title);
  if (selectedNode.requirementId) {
    const subhead = document.createElement("div");
    subhead.className = "requirements-detail-subhead";
    subhead.textContent = `Requirement ID: ${selectedNode.requirementId}`;
    hero.append(subhead);
  }
  const heroText = selectedNode.requirementText || selectedNode.description || selectedNode.rawText || "";
  if (heroText) {
    const copy = document.createElement("div");
    copy.className = "requirements-detail-copy";
    copy.textContent = heroText;
    hero.append(copy);
  }
  requirementsDetailEl.append(hero);

  const fieldGrid = document.createElement("div");
  fieldGrid.className = "requirements-field-grid";
  [
    ["Display Label", selectedNode.label],
    ["Node Id", selectedNode.id],
    ["Raw Name", selectedNode.name],
    ["Requirement Id", selectedNode.requirementId],
    ["Short Name", selectedNode.shortName || ""],
    ["Category", humanize(selectedNode.category)],
    ["Kind", selectedNode.kind],
    ["Type", selectedNode.typeName],
    ["Base Type", selectedNode.baseType],
    ["Parent Requirement", selectedNode.parentName],
    ["Subject", selectedNode.subjectName],
    ["Subject Type", selectedNode.subjectType],
    ["Constraint Count", String(selectedNode.constraintCount ?? 0)],
    ["Required Target Count", String((selectedNode.requiredTargets || []).length)],
    ["Trace Link Count", String((selectedNode.traceLinks || []).length)],
    ["Satisfy Count", String((selectedNode.satisfyBy || []).length)],
    ["Qualified Name", selectedNode.fullPath || selectedNode.name || ""]
  ].forEach(([label, value]) => {
    fieldGrid.append(requirementDetailField(label, value));
  });
  requirementsDetailEl.append(fieldGrid);

  const nodeLookup = Object.fromEntries(view.nodes.map((node) => [node.id, node]));
  const relatedLinks = view.links
    .filter((link) => link.from === selectedNode.id || link.to === selectedNode.id)
    .map((link) => {
      if (link.from === selectedNode.id) {
        return `${humanize(link.kind)} -> ${nodeLookup[link.to]?.label || link.to}`;
      }
      return `${humanize(link.kind)} <- ${nodeLookup[link.from]?.label || link.from}`;
    });

  requirementsDetailEl.append(
    requirementDetailSection("Requirement Text", [selectedNode.requirementText || selectedNode.description || selectedNode.rawText || "No requirement text parsed."]),
    requirementDetailSection("Constraint Text", selectedNode.constraintTexts || [], { code: true }),
    requirementDetailSection("Description", [selectedNode.description || "No description parsed."]),
    requirementDetailSection("Required Targets", (selectedNode.requiredTargets || []).map(formatRequirementTarget)),
    requirementDetailSection("Trace Links", (selectedNode.traceLinks || []).map(formatRequirementTrace)),
    requirementDetailSection("Satisfied By", selectedNode.satisfyBy || []),
    requirementDetailSection("Related Links", relatedLinks),
    requirementDetailSection("Raw SysML Text", [selectedNode.rawText || "No raw SysML text parsed."], { code: true })
  );
}

function renderAnalysisTerms(label, values, missing = false) {
  if (!values.length) {
    return null;
  }
  const wrap = document.createElement("div");
  wrap.className = "analysis-term-row";
  const title = document.createElement("div");
  title.className = "analysis-term-label";
  title.textContent = label;
  wrap.append(title);
  const list = document.createElement("div");
  list.className = "analysis-term-list";
  values.forEach((value) => {
    const pill = document.createElement("span");
    pill.className = `analysis-term${missing ? " is-missing" : ""}`;
    pill.textContent = value;
    list.append(pill);
  });
  wrap.append(list);
  return wrap;
}

function renderAnalysisView(view) {
  titleEl.textContent = view.title;
  summaryEl.textContent = view.summary;
  analysisViewEl.replaceChildren();

  const hero = document.createElement("section");
  hero.className = "analysis-hero";
  const heroHeader = document.createElement("div");
  heroHeader.className = "analysis-card-header";
  const heroMeta = document.createElement("div");
  heroMeta.className = "analysis-card-meta";
  const heroTitle = document.createElement("h3");
  heroTitle.className = "analysis-hero-title";
  heroTitle.textContent = view.hero.title;
  const heroCopy = document.createElement("p");
  heroCopy.className = "analysis-hero-copy";
  heroCopy.textContent = view.hero.copy;
  heroMeta.append(heroTitle, heroCopy);
  heroHeader.append(heroMeta);
  if (view.hero.scoreText) {
    const pill = document.createElement("div");
    pill.className = `analysis-score-pill ${scoreToneClass(view.hero.scoreValue ?? null)}`.trim();
    pill.textContent = view.hero.scoreText;
    heroHeader.append(pill);
  }
  hero.append(heroHeader);
  analysisViewEl.append(hero);

  const visibleMetrics = (view.metrics || []).filter((metric) => !isHiddenEntity(metric.id));
  if (visibleMetrics.length) {
    const metricGrid = document.createElement("div");
    metricGrid.className = "analysis-metrics";
    visibleMetrics.forEach((metric) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = `analysis-metric ${scoreToneClass(metric.scoreValue)}`.trim();
      item.classList.toggle("is-selected", metric.id === state.selectedEntityId);
      item.classList.toggle("is-context", isContextEntity(metric.id));
      item.classList.toggle("is-muted", isMutedEntity(metric.id));
      item.classList.toggle("search-hit", currentSearchQuery() && state.matchIds.has(metric.id));
      item.addEventListener("click", () => selectEntity(metric.id, { switchView: false, preserveViewport: true, center: false }));

      const label = document.createElement("span");
      label.className = "analysis-metric-label";
      label.textContent = metric.label;
      const value = document.createElement("strong");
      value.className = "analysis-metric-value";
      value.textContent = metric.valueText;
      item.append(label, value);

      if (metric.copy) {
        const copy = document.createElement("span");
        copy.className = "analysis-metric-copy";
        copy.textContent = metric.copy;
        item.append(copy);
      }

      metricGrid.append(item);
    });
    analysisViewEl.append(metricGrid);
  }

  const visibleCards = view.cards.filter((card) => !isHiddenEntity(card.id));
  if (!visibleCards.length) {
    const empty = document.createElement("div");
    empty.className = "analysis-empty";
    empty.textContent = "No analysis cards match the current scope or search filter.";
    analysisViewEl.append(empty);
    return;
  }

  const grid = document.createElement("div");
  grid.className = "analysis-grid";
  visibleCards.forEach((card, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `analysis-card${card.wide ? " is-wide" : ""}`;
    item.classList.toggle("is-selected", card.id === state.selectedEntityId);
    item.classList.toggle("is-context", isContextEntity(card.id));
    item.classList.toggle("is-muted", isMutedEntity(card.id));
    item.classList.toggle("search-hit", currentSearchQuery() && state.matchIds.has(card.id));
    item.addEventListener("click", () => selectEntity(card.id, { switchView: false, preserveViewport: true, center: false }));

    const header = document.createElement("div");
    header.className = "analysis-card-header";
    const meta = document.createElement("div");
    meta.className = "analysis-card-meta";
    const kind = document.createElement("span");
    kind.className = "analysis-card-kind";
    kind.textContent = card.kind;
    const title = document.createElement("h3");
    title.className = "analysis-card-title";
    title.textContent = card.title;
    meta.append(kind, title);
    header.append(meta);
    if (card.scoreText) {
      const pill = document.createElement("div");
      pill.className = `analysis-score-pill ${scoreToneClass(card.scoreValue)}`.trim();
      pill.textContent = card.scoreText;
      header.append(pill);
    }
    item.append(header);

    if (card.body) {
      const body = document.createElement("p");
      body.className = "analysis-card-copy";
      body.textContent = card.body;
      item.append(body);
    }

    if (card.rationale) {
      const rationale = document.createElement("p");
      rationale.className = "analysis-card-copy";
      rationale.textContent = card.rationale;
      item.append(rationale);
    }

    if (card.detailRows.length) {
      const detailGrid = document.createElement("div");
      detailGrid.className = "analysis-detail-grid";
      card.detailRows.forEach(([label, value]) => {
        const detail = document.createElement("div");
        detail.className = "analysis-detail";
        const key = document.createElement("span");
        key.className = "analysis-detail-label";
        key.textContent = label;
        const val = document.createElement("span");
        val.className = "analysis-detail-value";
        val.textContent = value;
        detail.append(key, val);
        detailGrid.append(detail);
      });
      item.append(detailGrid);
    }

    const matchedTerms = renderAnalysisTerms(card.matchedLabel || "Matched cues", detailSlice(card.matchedTerms, 6, 3));
    if (matchedTerms) {
      item.append(matchedTerms);
    }
    const missingTerms = renderAnalysisTerms(
      card.missingLabel || "Missing or weak cues",
      detailSlice(card.missingTerms, 6, 3),
      true
    );
    if (missingTerms) {
      item.append(missingTerms);
    }

    grid.append(item);
    registerRenderedEntity({
      id: card.id,
      label: card.title,
      kind: card.kind,
      view: state.currentView,
      bounds: {
        x: 0,
        y: index * 120,
        width: card.wide ? 520 : 240,
        height: 96
      }
    });
  });

  analysisViewEl.append(grid);
}

function renderExplorer() {
  explorerTreeEl.replaceChildren();
  const filterValue = explorerFilterEl.value.trim().toLowerCase();
  const grouped = [
    { title: "Operational", key: "ov1" },
    { title: "Definitions", key: "bdd" },
    { title: "Internal Structure", key: "ibd" },
    { title: "Requirements", key: "requirements" },
    { title: "Behavior", key: "activity" },
    { title: "Sequence", key: "sequence" },
    { title: "Analysis", key: "analysis" },
    { title: "Simulation", key: "simulation" }
  ];

  grouped.forEach((group) => {
    const items = state.catalog.filter(
      (item) =>
        item.view === group.key &&
        (state.scopeMode === "all" || state.visibleEntityIds.has(item.id)) &&
        (!filterValue || item.searchText.includes(filterValue))
    );
    if (!items.length) {
      return;
    }
    const section = document.createElement("section");
    section.className = "explorer-section";
    const title = document.createElement("div");
    title.className = "explorer-section-title";
    title.textContent = `${group.title} (${items.length})`;
    section.append(title);
    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "explorer-item-row";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "explorer-item";
      button.classList.toggle("is-selected", item.id === state.selectedEntityId);
      button.classList.toggle("is-context", isContextEntity(item.id));
      button.classList.toggle("search-hit", currentSearchQuery() && item.searchText.includes(currentSearchQuery()));
      const label = document.createElement("span");
      label.className = "explorer-item-label";
      label.textContent = item.label;
      const meta = document.createElement("span");
      meta.className = "explorer-item-meta";
      meta.textContent = `${item.kind} • ${item.relatedItems.length} links`;
      button.append(label, meta);
      button.addEventListener("click", () => selectEntity(item.id, { switchView: true, preserveViewport: false, center: true }));
      row.append(button);
      if (group.key === "requirements") {
        const showButton = document.createElement("button");
        showButton.type = "button";
        showButton.className = "toolbar-button toolbar-button-secondary explorer-item-show";
        showButton.textContent = "Show";
        showButton.addEventListener("click", (event) => {
          event.stopPropagation();
          openRequirementsExplorerModal(item.id);
        });
        row.append(showButton);
      }
      section.append(row);
    });
    explorerTreeEl.append(section);
  });

  if (!explorerTreeEl.children.length) {
    const empty = document.createElement("p");
    empty.className = "inspector-empty";
    empty.textContent = "No explorer items match the current filter.";
    explorerTreeEl.append(empty);
  }
}

function renderInspector() {
  inspectorEl.replaceChildren();
  const selected = state.catalog.find((item) => item.id === state.selectedEntityId && item.view === state.currentView);
  if (!selected) {
    const empty = document.createElement("div");
    empty.className = "inspector-empty";
    empty.textContent =
      isTextFirstView(state.currentView)
        ? "Select a scoring card to inspect its details, rationale, and evidence."
        : "Select a node, block, part, or activity from the diagram or explorer to inspect it.";
    inspectorEl.append(empty);

    const summaryGrid = document.createElement("div");
    summaryGrid.className = "inspector-grid";
    [
      ["View", humanize(state.currentView)],
      ["Layout", humanize(state.layoutMode)],
      ["Entities", String(state.renderEntities.length)],
      ["Connections", String(state.renderLinks.length)]
    ].forEach(([key, value]) => {
      const row = document.createElement("div");
      row.className = "inspector-row";
      const keyEl = document.createElement("span");
      keyEl.className = "inspector-key";
      keyEl.textContent = key;
      const valueEl = document.createElement("span");
      valueEl.className = "inspector-value";
      valueEl.textContent = value;
      row.append(keyEl, valueEl);
      summaryGrid.append(row);
    });
    inspectorEl.append(summaryGrid);
    return;
  }

  const chips = document.createElement("div");
  chips.className = "diagram-chip-row";
  [selected.view.toUpperCase(), selected.kind].forEach((chip) => {
    const badge = document.createElement("span");
    badge.className = "diagram-chip";
    badge.textContent = chip;
    chips.append(badge);
  });
  inspectorEl.append(chips);

  const grid = document.createElement("div");
  grid.className = "inspector-grid";
  selected.detailRows.forEach(([key, value]) => {
    const row = document.createElement("div");
    row.className = "inspector-row";
    const keyEl = document.createElement("span");
    keyEl.className = "inspector-key";
    keyEl.textContent = key;
    const valueEl = document.createElement("span");
    valueEl.className = "inspector-value";
    valueEl.textContent = value;
    row.append(keyEl, valueEl);
    grid.append(row);
  });
  inspectorEl.append(grid);

  if (selected.relatedItems.length) {
    const visibleRelated = detailSlice(selected.relatedItems, 8, 4);
    const relatedRow = document.createElement("div");
    relatedRow.className = "inspector-row";
    const key = document.createElement("span");
    key.className = "inspector-key";
    key.textContent = "Related Elements";
    relatedRow.append(key);
    const relatedWrap = document.createElement("div");
    relatedWrap.className = "inspector-related";
    visibleRelated.forEach((entry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "relation-button";
      button.textContent = entry.label;
      button.title = entry.kind;
      button.addEventListener("click", () => selectEntity(entry.id, { switchView: true, preserveViewport: false, center: true }));
      relatedWrap.append(button);
    });
    relatedRow.append(relatedWrap);
    if (selected.relatedItems.length > visibleRelated.length) {
      const note = document.createElement("span");
      note.className = "relation-note";
      note.textContent = `Showing ${visibleRelated.length} of ${selected.relatedItems.length} related elements.`;
      relatedRow.append(note);
    }
    inspectorEl.append(relatedRow);
  }

  selected.lists.forEach(([title, values]) => {
    if (!values.length) {
      return;
    }
    const row = document.createElement("div");
    row.className = "inspector-row";
    const key = document.createElement("span");
    key.className = "inspector-key";
    key.textContent = title;
    row.append(key);
    const list = document.createElement("ul");
    list.className = "inspector-list";
    values.forEach((value) => {
      const item = document.createElement("li");
      item.textContent = value;
      list.append(item);
    });
    row.append(list);
    inspectorEl.append(row);
  });
}

function renderAnalysisStatus() {
  analysisStatusEl.replaceChildren();
  const currentViewItems = state.catalog.filter((item) => item.view === state.currentView);
  const selected = state.catalog.find((item) => item.id === state.selectedEntityId && item.view === state.currentView);
  const chips =
    isTextFirstView(state.currentView)
      ? [
          ["View", humanize(state.currentView)],
          ["Cards", `${state.visibleEntityIds.size || currentViewItems.length} / ${currentViewItems.length}`],
          [
            "Score",
            model?.views[state.currentView]?.cards.find((card) => card.id === `${state.currentView}:overall`)?.scoreText ||
              "Not scored"
          ],
          ["Scope", humanize(state.scopeMode)],
          ["Detail", humanize(state.detailMode)]
        ]
      : [
          ["View", state.currentView.toUpperCase()],
          ["Visible", `${state.renderEntities.length} / ${currentViewItems.length}`],
          ["Connections", String(state.renderLinks.length)],
          ["Scope", humanize(state.scopeMode)],
          ["Detail", humanize(state.detailMode)]
        ];
  if (isEditableDiagramView(state.currentView) && state.ov1Editor.enabled) {
    chips.push(["Edit", "On"], ["Tool", humanize(state.ov1Editor.tool)]);
  }
  if (currentSearchQuery()) {
    chips.push(["Matches", String(state.catalog.filter((item) => state.matchIds.has(item.id)).length)]);
  }
  if (selected) {
    chips.push(["Selection", selected.label]);
  }
  chips.forEach(([key, value]) => {
    const chip = document.createElement("div");
    chip.className = "status-chip";
    const strong = document.createElement("strong");
    strong.textContent = `${key}:`;
    chip.append(strong, document.createTextNode(` ${value}`));
    analysisStatusEl.append(chip);
  });
}

function renderOverview() {
  overviewSvg.replaceChildren();
  if (isTextFirstView(state.currentView) || isWorkspaceFirstView(state.currentView)) {
    const summaryCopy = isWorkspaceFirstView(state.currentView)
      ? "This tab uses the main panel for searchable requirement review instead of a diagram overview."
      : "This tab is text-first, so the overview pane shows score cards in the main panel.";
    overviewSvg.append(
      el("text", { x: 18, y: 34, "font-size": 15, fill: "#4f6274", "font-weight": 700 }, `${humanize(state.currentView)} View`)
    );
    overviewSvg.append(
      el(
        "text",
        { x: 18, y: 60, "font-size": 12, fill: "#6d7f90" },
        summaryCopy
      )
    );
    return;
  }
  if (!state.renderEntities.length) {
    return;
  }
  const bounds = state.currentBounds;
  const width = Math.max(80, bounds.maxX - bounds.minX);
  const height = Math.max(60, bounds.maxY - bounds.minY);
  const scale = Math.min((OVERVIEW_WIDTH - 16) / width, (OVERVIEW_HEIGHT - 16) / height);
  const offsetX = (OVERVIEW_WIDTH - width * scale) / 2 - bounds.minX * scale;
  const offsetY = (OVERVIEW_HEIGHT - height * scale) / 2 - bounds.minY * scale;
  const centerLookup = Object.fromEntries(
    state.renderEntities.map((entity) => [
      entity.id,
      {
        x: offsetX + (entity.bounds.x + entity.bounds.width / 2) * scale,
        y: offsetY + (entity.bounds.y + entity.bounds.height / 2) * scale
      }
    ])
  );

  state.renderLinks.forEach((link) => {
    const from = centerLookup[link.from];
    const to = centerLookup[link.to];
    if (!from || !to) {
      return;
    }
    overviewSvg.append(
      el("line", {
        x1: from.x,
        y1: from.y,
        x2: to.x,
        y2: to.y,
        stroke: "#8aa1b3",
        "stroke-width": 1.5
      })
    );
  });

  state.renderEntities.forEach((entity) => {
    const isSelected = entity.id === state.selectedEntityId;
    overviewSvg.append(
      el("rect", {
        x: offsetX + entity.bounds.x * scale,
        y: offsetY + entity.bounds.y * scale,
        width: Math.max(6, entity.bounds.width * scale),
        height: Math.max(6, entity.bounds.height * scale),
        rx: 4,
        fill: isSelected ? "#ee9b00" : "#b9d7df",
        stroke: isSelected ? "#ca6702" : "#4a6a81",
        "stroke-width": isSelected ? 2 : 1
      })
    );
  });

  const visible = visibleRect();
  overviewSvg.append(
    el("rect", {
      x: offsetX + visible.x * scale,
      y: offsetY + visible.y * scale,
      width: visible.width * scale,
      height: visible.height * scale,
      fill: "none",
      stroke: "#005f73",
      "stroke-width": 2
    })
  );
}

function selectEntity(entityId, options = {}) {
  const { switchView = true, preserveViewport = true, center = false } = options;
  const target = state.catalog.find((item) => item.id === entityId);
  if (!target) {
    return;
  }
  state.selectedEntityId = entityId;
  if (switchView && target.view !== state.currentView) {
    state.currentView = target.view;
    state.pendingFocusEntityId = center ? entityId : null;
    renderCurrentView({ preserveViewport: false });
    return;
  }
  renderCurrentView({ preserveViewport });
  if (center) {
    centerEntityById(entityId);
  }
}

function renderCurrentView({ preserveViewport = true } = {}) {
  if (!model) {
    return;
  }
  if (isEditableDiagramView(state.currentView) && state.ov1Editor.enabled && state.layoutMode !== "auto") {
    state.layoutMode = "auto";
    layoutSelectEl.value = "auto";
  }
  syncViewButtons();
  refreshDerivedState();
  state.renderEntities = [];
  state.renderLinks = [];
  const isTextView = isTextFirstView(state.currentView);
  const isWorkspaceView = isWorkspaceFirstView(state.currentView);
  workbenchEl?.classList.toggle("is-requirements-focus", isWorkspaceView);
  diagramPanelEl?.classList.toggle("is-requirements-focus", isWorkspaceView);
  canvasCardEl?.classList.toggle("is-hidden", isWorkspaceView);
  inspectorPanelEl?.classList.toggle("is-hidden", isWorkspaceView);
  svg.classList.toggle("is-hidden", isTextView || isWorkspaceView);
  analysisViewEl.classList.toggle("is-hidden", !isTextView);
  svg.classList.toggle("is-editable", !isWorkspaceView && isEditableDiagramView(state.currentView) && state.ov1Editor.enabled);
  if (!isTextView) {
    analysisViewEl.replaceChildren();
    resetSvg();
  }
  const preparedView = isTextView || isWorkspaceView ? model.views[state.currentView] : getPreparedView(state.currentView);
  if (state.currentView === "ov1") {
    renderOV1(preparedView);
  } else if (state.currentView === "bdd") {
    renderBDD(preparedView);
  } else if (state.currentView === "ibd") {
    renderIBD(preparedView);
  } else if (state.currentView === "sequence") {
    renderSequence(preparedView);
  } else if (isTextView) {
    renderAnalysisView(preparedView);
  } else {
    renderActivity(preparedView);
  }
  state.currentBounds = computeBoundsFromEntities();
  if (isTextView || isWorkspaceView) {
    state.transform = { scale: 1, x: 0, y: 0 };
  } else if (preserveViewport) {
    applyTransform();
  } else {
    fitToBounds();
  }
  renderExplorer();
  renderInspector();
  renderAnalysisStatus();
  renderRequirementsBoard();
  refreshOv1EditorPanel();
  renderOverview();
  renderRequirementsExplorerModal();
  if (state.pendingFocusEntityId) {
    centerEntityById(state.pendingFocusEntityId);
    state.pendingFocusEntityId = null;
  }
}

function applyModel(nextModel, statusMessage, sourceText = modelTextEl.value, options = {}) {
  const { sourcePath = "", analysisPayload = null } = options;
  nextModel.views.analysis = buildAnalysisView(nextModel, analysisPayload, sourcePath, sourceText);
  nextModel.views.simulation = buildSimulationReadinessView(nextModel, sourcePath, sourceText);
  model = nextModel;
  modelTitleEl.textContent = model.title || "SysML2 Visualizer";
  modelDescriptionEl.textContent = model.description || "Custom model loaded.";
  modelTextEl.value = sourceText;
  state.currentModelPath = sourcePath;
  state.currentSourceText = sourceText;
  state.loadedSourceText = sourceText;
  state.analysisPayload = analysisPayload;
  state.ov1Editor.paletteSelectionId = "";
  state.ov1Editor.arrowSourceId = null;
  state.ov1Editor.dragActorId = null;
  state.ov1Editor.dragPointerId = null;
  state.ov1Editor.dragOffset = null;
  state.ov1Editor.dragMoved = false;
  state.catalog = buildCatalog(nextModel);
  const retainedSelection = state.catalog.find((item) => item.id === state.selectedEntityId && item.view === state.currentView);
  state.selectedEntityId = retainedSelection?.id || defaultSelectionIdForView(state.currentView);
  state.searchCursor = 0;
  setImportStatus(statusMessage);
  renderCurrentView({ preserveViewport: false });
}

function populateDatasetOptions(files) {
  datasetOptionsEl.replaceChildren();
  files.forEach((file) => {
    const option = document.createElement("option");
    option.value = file;
    datasetOptionsEl.append(option);
  });
}

async function loadDatasetIndex() {
  try {
    const response = await fetch("/model-index");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    state.datasetIndex = payload.files || [];
    populateDatasetOptions(state.datasetIndex);
    if (!datasetPathEl.value) {
      datasetPathEl.value = "sample_model.sysml";
    }
  } catch (error) {
    state.datasetIndex = [];
  }
}

async function loadServerModel(path) {
  const response = await fetch(`/model-text?path=${encodeURIComponent(path)}`);
  if (!response.ok) {
    throw new Error(`Unable to load ${path} (HTTP ${response.status}).`);
  }
  return response.text();
}

async function loadModelAnalysis(path) {
  if (!path) {
    return null;
  }
  try {
    const response = await fetch(`/model-analysis?path=${encodeURIComponent(path)}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
  } catch {
    return null;
  }
}

function focusNextSearchResult() {
  const matches = getCatalogMatches();
  if (!matches.length) {
    setImportStatus("No search matches were found in the current model.", true);
    return;
  }
  const target = matches[state.searchCursor % matches.length];
  state.searchCursor = (state.searchCursor + 1) % matches.length;
  selectEntity(target.id, { switchView: true, preserveViewport: false, center: true });
  setImportStatus(`Focused search result: ${target.label}.`);
}

function escapeSvgText(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapSvgText(text, maxChars = 62) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  });
  if (current) {
    lines.push(current);
  }
  return lines.length ? lines : [""];
}

function textBlockSvg(lines, x, y, lineHeight, className) {
  const tspans = lines
    .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeSvgText(line)}</tspan>`)
    .join("");
  return `<text x="${x}" y="${y}" class="${className}">${tspans}</text>`;
}

function exportTextViewSvgMarkup() {
  const metricNodes = [...analysisViewEl.querySelectorAll(".analysis-metric")];
  const cardNodes = [...analysisViewEl.querySelectorAll(".analysis-card")];
  const heroTitle = analysisViewEl.querySelector(".analysis-hero-title")?.textContent?.trim() || titleEl.textContent.trim();
  const heroCopy = analysisViewEl.querySelector(".analysis-hero-copy")?.textContent?.trim() || summaryEl.textContent.trim();
  const width = 1400;
  const margin = 48;
  const columnGap = 24;
  const cardWidth = (width - margin * 2 - columnGap) / 2;
  let y = 56;

  const sections = [];
  sections.push(`<rect x="0" y="0" width="${width}" height="100%" fill="#f7fbfd"/>`);
  sections.push(`<rect x="${margin}" y="${y}" width="${width - margin * 2}" height="140" rx="28" fill="#ffffff" stroke="#c8d4de"/>`);
  sections.push(textBlockSvg(wrapSvgText(titleEl.textContent.trim(), 44), margin + 28, y + 44, 34, "svg-title"));
  sections.push(textBlockSvg(wrapSvgText(summaryEl.textContent.trim(), 92), margin + 28, y + 90, 22, "svg-summary"));
  y += 168;

  if (heroTitle || heroCopy) {
    const heroLines = [...wrapSvgText(heroTitle, 52), "", ...wrapSvgText(heroCopy, 88)];
    const heroHeight = 58 + heroLines.length * 22;
    sections.push(`<rect x="${margin}" y="${y}" width="${width - margin * 2}" height="${heroHeight}" rx="24" fill="#ffffff" stroke="#c8d4de"/>`);
    sections.push(textBlockSvg(heroLines, margin + 24, y + 38, 22, "svg-body"));
    y += heroHeight + 24;
  }

  if (metricNodes.length) {
    const metricWidth = Math.floor((width - margin * 2 - columnGap * 2) / 3);
    let metricY = y;
    let rowBottom = y;
    metricNodes.forEach((metric, index) => {
      const column = index % 3;
      if (column === 0 && index > 0) {
        metricY = rowBottom + 16;
      }
      const x = margin + column * (metricWidth + columnGap);
      const label = metric.querySelector(".analysis-metric-label")?.textContent?.trim() || "";
      const value = metric.querySelector(".analysis-metric-value")?.textContent?.trim() || "";
      const copy = metric.querySelector(".analysis-metric-copy")?.textContent?.trim() || "";
      const copyLines = wrapSvgText(copy, 28);
      const metricHeight = 94 + copyLines.length * 18;
      sections.push(`<rect x="${x}" y="${metricY}" width="${metricWidth}" height="${metricHeight}" rx="22" fill="#ffffff" stroke="#c8d4de"/>`);
      sections.push(textBlockSvg([label], x + 18, metricY + 24, 18, "svg-label"));
      sections.push(textBlockSvg([value], x + 18, metricY + 56, 18, "svg-metric"));
      sections.push(textBlockSvg(copyLines, x + 18, metricY + 84, 18, "svg-copy"));
      rowBottom = Math.max(rowBottom, metricY + metricHeight);
    });
    y = rowBottom + 24;
  }

  let cardY = y;
  let nextColumn = 0;
  let rowMaxY = y;
  cardNodes.forEach((card, index) => {
    const isWide = card.classList.contains("is-wide");
    if (isWide && nextColumn !== 0) {
      cardY = rowMaxY + 18;
      nextColumn = 0;
    }
    const x = margin + (isWide ? 0 : nextColumn * (cardWidth + columnGap));
    const widthForCard = isWide ? width - margin * 2 : cardWidth;
    const kind = card.querySelector(".analysis-card-kind")?.textContent?.trim() || "";
    const title = card.querySelector(".analysis-card-title")?.textContent?.trim() || "";
    const score = card.querySelector(".analysis-score-pill")?.textContent?.trim() || "";
    const copyLines = [...card.querySelectorAll(".analysis-card-copy")].flatMap((node) => [...wrapSvgText(node.textContent.trim(), isWide ? 92 : 40), ""]);
    const detailLines = [...card.querySelectorAll(".analysis-detail")].map((detail) => {
      const label = detail.querySelector(".analysis-detail-label")?.textContent?.trim() || "";
      const value = detail.querySelector(".analysis-detail-value")?.textContent?.trim() || "";
      return `${label}: ${value}`;
    });
    const bodyLines = [kind, title, ...(score ? [score] : []), "", ...copyLines, ...detailLines];
    const cardHeight = 62 + bodyLines.length * 19;
    sections.push(`<rect x="${x}" y="${cardY}" width="${widthForCard}" height="${cardHeight}" rx="22" fill="#ffffff" stroke="#c8d4de"/>`);
    sections.push(textBlockSvg(bodyLines, x + 18, cardY + 26, 19, "svg-body"));

    if (isWide) {
      cardY += cardHeight + 18;
      rowMaxY = cardY;
      nextColumn = 0;
      return;
    }

    rowMaxY = Math.max(rowMaxY, cardY + cardHeight);
    nextColumn = (nextColumn + 1) % 2;
    if (nextColumn === 0) {
      cardY = rowMaxY + 18;
    }
  });

  const height = Math.max(rowMaxY + 48, y + 120);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    .svg-title { font: 700 30px "Avenir Next", "Segoe UI", sans-serif; fill: #112234; }
    .svg-summary { font: 400 16px "Avenir Next", "Segoe UI", sans-serif; fill: #5b6f82; }
    .svg-label { font: 700 12px "Avenir Next", "Segoe UI", sans-serif; fill: #5b6f82; letter-spacing: 0.08em; text-transform: uppercase; }
    .svg-metric { font: 700 28px "Avenir Next", "Segoe UI", sans-serif; fill: #112234; }
    .svg-copy { font: 400 15px "Avenir Next", "Segoe UI", sans-serif; fill: #4b6072; }
    .svg-body { font: 400 15px "Avenir Next", "Segoe UI", sans-serif; fill: #112234; }
  </style>
  ${sections.join("\n")}
</svg>`;
}

function exportCurrentSvg() {
  const payload = isTextFirstView(state.currentView)
    ? exportTextViewSvgMarkup()
    : `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(svg)}`;
  const blob = new Blob([payload], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${(model?.title || "sysml2-visualizer").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}-${state.currentView}.svg`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setImportStatus(`Exported ${state.currentView.toUpperCase()} view as SVG.`);
}

buttons.forEach((button) => {
  button.addEventListener("click", () => {
    state.currentView = button.dataset.view;
    const retainedSelection = state.catalog.find((item) => item.id === state.selectedEntityId && item.view === state.currentView);
    state.selectedEntityId = retainedSelection?.id || defaultSelectionIdForView(state.currentView);
    renderCurrentView({ preserveViewport: false });
  });
});

layoutSelectEl.addEventListener("change", () => {
  if (isEditableDiagramView(state.currentView) && state.ov1Editor.enabled && layoutSelectEl.value !== "auto") {
    layoutSelectEl.value = "auto";
    state.layoutMode = "auto";
    setImportStatus(`${editorTitleForView()} uses Auto layout so manual positions stay intact.`);
    setOv1EditorStatus(`${editorTitleForView()} uses Auto layout so manual positions stay intact.`);
    renderCurrentView({ preserveViewport: false });
    return;
  }
  state.layoutMode = layoutSelectEl.value;
  renderCurrentView({ preserveViewport: false });
});

scopeSelectEl.addEventListener("change", () => {
  state.scopeMode = scopeSelectEl.value;
  renderCurrentView({ preserveViewport: false });
});

detailSelectEl.addEventListener("change", () => {
  state.detailMode = detailSelectEl.value;
  renderCurrentView({ preserveViewport: false });
});

loadTextButton.addEventListener("click", () => {
  try {
    const parsed = parseModelText(modelTextEl.value);
    applyModel(parsed, "SysML2 text parsed successfully.", modelTextEl.value, {
      sourcePath: state.currentModelPath,
      analysisPayload: state.analysisPayload
    });
  } catch (error) {
    setImportStatus(error.message, true);
  }
});

resetModelButton.addEventListener("click", () => {
  if (sampleSource) {
    modelTextEl.value = sampleSource;
    datasetPathEl.value = "sample_model.sysml";
    applyModel(parseModelText(sampleSource), "Sample SysML2 model restored.", sampleSource, {
      sourcePath: "sample_model.sysml",
      analysisPayload: sampleAnalysisPayload
    });
  }
});

modelFileEl.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  try {
    const text = await file.text();
    modelTextEl.value = text;
    const parsed = parseModelText(text);
    applyModel(parsed, `Loaded SysML2 model from ${file.name}.`, text, { sourcePath: "", analysisPayload: null });
    datasetPathEl.value = "";
  } catch (error) {
    setImportStatus(`Unable to load ${file.name}: ${error.message}`, true);
  } finally {
    modelFileEl.value = "";
  }
});

loadDatasetButton.addEventListener("click", async () => {
  const requestedPath = datasetPathEl.value.trim();
  if (!requestedPath) {
    return;
  }
  try {
    const [text, analysisPayload] = await Promise.all([loadServerModel(requestedPath), loadModelAnalysis(requestedPath)]);
    modelTextEl.value = text;
    applyModel(parseModelText(text), `Loaded corpus model ${requestedPath}.`, text, {
      sourcePath: requestedPath,
      analysisPayload
    });
  } catch (error) {
    setImportStatus(error.message, true);
  }
});

datasetPathEl.addEventListener("keydown", async (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    loadDatasetButton.click();
  }
});

searchInputEl.addEventListener("input", () => {
  state.searchCursor = 0;
  renderCurrentView({ preserveViewport: true });
});

searchInputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    focusNextSearchResult();
  }
});

searchNextButton.addEventListener("click", focusNextSearchResult);

requirementsSearchEl?.addEventListener("input", () => {
  searchInputEl.value = requirementsSearchEl.value;
  state.searchCursor = 0;
  renderCurrentView({ preserveViewport: true });
});

requirementsSearchEl?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    focusNextSearchResult();
  }
});

requirementsClearEl?.addEventListener("click", () => {
  searchInputEl.value = "";
  if (requirementsSearchEl) {
    requirementsSearchEl.value = "";
  }
  state.searchCursor = 0;
  renderCurrentView({ preserveViewport: true });
});

requirementsExplorerModalCloseEl?.addEventListener("click", closeRequirementsExplorerModal);

requirementsExplorerModalEl?.addEventListener("click", (event) => {
  if (event.target === requirementsExplorerModalEl || event.target.classList.contains("requirements-explorer-modal-scrim")) {
    closeRequirementsExplorerModal();
  }
});

requirementsExplorerModalCardEl?.addEventListener("click", (event) => {
  event.stopPropagation();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.requirementsModalId) {
    closeRequirementsExplorerModal();
  }
});

explorerFilterEl.addEventListener("input", renderExplorer);

zoomInButton.addEventListener("click", () => zoomAt(1.15));
zoomOutButton.addEventListener("click", () => zoomAt(1 / 1.15));
fitViewButton.addEventListener("click", () => fitToBounds());
resetViewButton.addEventListener("click", () => {
  state.transform = { scale: 1, x: 0, y: 0 };
  applyTransform();
});
exportSvgButton.addEventListener("click", exportCurrentSvg);

ov1EditToggleEl?.addEventListener("click", () => {
  state.ov1Editor.enabled = !state.ov1Editor.enabled;
  state.ov1Editor.paletteSelectionId = "";
  state.ov1Editor.arrowSourceId = null;
  state.ov1Editor.dragActorId = null;
  state.ov1Editor.dragPointerId = null;
  state.ov1Editor.dragOffset = null;
  state.ov1Editor.dragMoved = false;
  if (state.ov1Editor.enabled && state.layoutMode !== "auto" && isEditableDiagramView(state.currentView)) {
    state.layoutMode = "auto";
    layoutSelectEl.value = "auto";
  }
  renderCurrentView({ preserveViewport: true });
  setOv1EditorStatus(
    state.ov1Editor.enabled
      ? `Editing is enabled. Drag ${editorPaletteLabelForView().toLowerCase()}, reposition visible elements, or switch to ${editorLinkToolLabelForView()}.`
      : `Editing is disabled. The ${editorTitleForView().replace(" Editor", "")} view is back in browse mode.`
  );
});

ov1ArrowToolEl?.addEventListener("click", () => {
  if (!state.ov1Editor.enabled) {
    return;
  }
  const nextIsArrow = state.ov1Editor.tool !== "arrow";
  state.ov1Editor.tool = nextIsArrow ? "arrow" : "move";
  state.ov1Editor.arrowSourceId = null;
  state.ov1Editor.paletteSelectionId = "";
  renderCurrentView({ preserveViewport: true });
  setOv1EditorStatus(
    nextIsArrow
      ? `${editorLinkToolLabelForView()} is active. Click a source element, then a target element, to add a ${editorTitleForView().replace(" Editor", "")} link.`
      : `Move mode is active. Drag visible elements or place ${editorPaletteLabelForView().toLowerCase()} from the file.`
  );
});

ov1SaveButtonEl?.addEventListener("click", saveCurrentModelToWorkspace);

ov1ResetButtonEl?.addEventListener("click", () => {
  if (!state.ov1Editor.enabled) {
    return;
  }
  try {
    const resetSource = state.loadedSourceText || state.currentSourceText || modelTextEl.value;
    const reparsed = parseModelText(resetSource);
    applyModel(reparsed, `${editorTitleForView()} edits were reset to the loaded SysML source semantics.`, resetSource, {
      sourcePath: state.currentModelPath,
      analysisPayload: state.analysisPayload
    });
    state.ov1Editor.enabled = true;
    renderCurrentView({ preserveViewport: false });
    setOv1EditorStatus(`${editorTitleForView()} edits were reset. You can start arranging the view again.`);
  } catch (error) {
    setOv1EditorStatus(`Unable to reset ${editorTitleForView()} edits: ${error.message}`, true);
  }
});

svg.addEventListener("click", (event) => {
  if (isEditableDiagramView(state.currentView) && state.ov1Editor.enabled && state.ov1Editor.paletteSelectionId) {
    const point = clientToDiagramPoint(event.clientX, event.clientY);
    placeEditorComponent(state.ov1Editor.paletteSelectionId, point);
    event.stopPropagation();
    return;
  }
  if (!event.target.getAttribute("data-entity-id")) {
    state.selectedEntityId = null;
    renderCurrentView({ preserveViewport: true });
  }
});

svg.addEventListener("wheel", (event) => {
  event.preventDefault();
  const rect = svg.getBoundingClientRect();
  const centerX = ((event.clientX - rect.left) / rect.width) * VIEWBOX_WIDTH;
  const centerY = ((event.clientY - rect.top) / rect.height) * VIEWBOX_HEIGHT;
  zoomAt(event.deltaY < 0 ? 1.1 : 1 / 1.1, centerX, centerY);
}, { passive: false });

svg.addEventListener("pointerdown", (event) => {
  if (event.target.getAttribute("data-entity-id")) {
    return;
  }
  if (isEditableDiagramView(state.currentView) && state.ov1Editor.enabled && (state.ov1Editor.paletteSelectionId || state.ov1Editor.tool === "arrow")) {
    return;
  }
  state.isPanning = true;
  state.panOrigin = { x: event.clientX, y: event.clientY, tx: state.transform.x, ty: state.transform.y };
  svg.setPointerCapture(event.pointerId);
});

svg.addEventListener("pointermove", (event) => {
  if (isEditableDiagramView(state.currentView) && state.ov1Editor.enabled && state.ov1Editor.dragActorId && state.ov1Editor.dragOffset) {
    const point = clientToDiagramPoint(event.clientX, event.clientY);
    if (state.currentView === "bdd") {
      const block = findBddBlock(state.ov1Editor.dragActorId);
      if (!block) {
        return;
      }
      const height = bddBlockHeight(block);
      const position = clampBddBlockPosition(point.x - state.ov1Editor.dragOffset.x, point.y - state.ov1Editor.dragOffset.y, block.width, height);
      block.x = position.x;
      block.y = position.y;
    } else if (state.currentView === "ibd") {
      const part = findIbdPart(state.ov1Editor.dragActorId);
      if (!part) {
        return;
      }
      const position = clampIbdPartPosition(point.x - state.ov1Editor.dragOffset.x, point.y - state.ov1Editor.dragOffset.y, part.width, part.height);
      part.x = position.x;
      part.y = position.y;
    } else {
      const actor = findOv1Actor(state.ov1Editor.dragActorId);
      if (!actor) {
        return;
      }
      const position = clampOv1ActorPosition(point.x - state.ov1Editor.dragOffset.x, point.y - state.ov1Editor.dragOffset.y);
      actor.x = position.x;
      actor.y = position.y;
    }
    state.ov1Editor.dragMoved = true;
    renderCurrentView({ preserveViewport: true });
    return;
  }
  if (!state.isPanning || !state.panOrigin) {
    return;
  }
  state.transform.x = state.panOrigin.tx + (event.clientX - state.panOrigin.x);
  state.transform.y = state.panOrigin.ty + (event.clientY - state.panOrigin.y);
  applyTransform();
});

svg.addEventListener("pointerup", (event) => {
  if (isEditableDiagramView(state.currentView) && state.ov1Editor.enabled && state.ov1Editor.dragActorId && state.ov1Editor.dragPointerId === event.pointerId) {
    const movedLabel =
      state.currentView === "bdd"
        ? findBddBlock(state.ov1Editor.dragActorId)?.name
        : state.currentView === "ibd"
          ? findIbdPart(state.ov1Editor.dragActorId)?.name
          : findOv1Actor(state.ov1Editor.dragActorId)?.label;
    syncSourceTextFromModel();
    state.ov1Editor.dragActorId = null;
    state.ov1Editor.dragPointerId = null;
    state.ov1Editor.dragOffset = null;
    if (state.ov1Editor.dragMoved && movedLabel) {
      setOv1EditorStatus(`${movedLabel} was repositioned.`);
      setImportStatus(`Updated ${humanize(state.currentView)} placement for ${movedLabel}.`);
    }
    state.ov1Editor.dragMoved = false;
    refreshOv1EditorPanel();
    if (svg.hasPointerCapture(event.pointerId)) {
      svg.releasePointerCapture(event.pointerId);
    }
    return;
  }
  state.isPanning = false;
  state.panOrigin = null;
  if (svg.hasPointerCapture(event.pointerId)) {
    svg.releasePointerCapture(event.pointerId);
  }
});

svg.addEventListener("dragover", (event) => {
  if (!isEditableDiagramView(state.currentView) || !state.ov1Editor.enabled) {
    return;
  }
  event.preventDefault();
  svg.classList.add("is-dragover");
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
});

svg.addEventListener("dragleave", () => {
  svg.classList.remove("is-dragover");
});

svg.addEventListener("drop", (event) => {
  if (!isEditableDiagramView(state.currentView) || !state.ov1Editor.enabled) {
    return;
  }
  event.preventDefault();
  svg.classList.remove("is-dragover");
  const componentId = event.dataTransfer?.getData("text/sysml-editor-component") || state.ov1Editor.paletteSelectionId;
  if (!componentId) {
    return;
  }
  const point = clientToDiagramPoint(event.clientX, event.clientY);
  placeEditorComponent(componentId, point);
});

overviewSvg.addEventListener("click", (event) => {
  if (!state.renderEntities.length) {
    return;
  }
  const bounds = state.currentBounds;
  const width = Math.max(80, bounds.maxX - bounds.minX);
  const height = Math.max(60, bounds.maxY - bounds.minY);
  const scale = Math.min((OVERVIEW_WIDTH - 16) / width, (OVERVIEW_HEIGHT - 16) / height);
  const offsetX = (OVERVIEW_WIDTH - width * scale) / 2 - bounds.minX * scale;
  const offsetY = (OVERVIEW_HEIGHT - height * scale) / 2 - bounds.minY * scale;
  const rect = overviewSvg.getBoundingClientRect();
  const clickedX = ((event.clientX - rect.left) / rect.width) * OVERVIEW_WIDTH;
  const clickedY = ((event.clientY - rect.top) / rect.height) * OVERVIEW_HEIGHT;
  const modelX = (clickedX - offsetX) / scale;
  const modelY = (clickedY - offsetY) / scale;
  state.transform.x = VIEWBOX_WIDTH / 2 - modelX * state.transform.scale;
  state.transform.y = VIEWBOX_HEIGHT / 2 - modelY * state.transform.scale;
  applyTransform();
});

async function bootstrap() {
  await loadDatasetIndex();
  const embeddedSource = embeddedSysmlEl?.textContent?.trim() || "";
  try {
    [sampleSource, sampleAnalysisPayload] = await Promise.all([
      loadServerModel("sample_model.sysml"),
      loadModelAnalysis("sample_model.sysml")
    ]);
    if (!sampleSource.trim()) {
      throw new Error("Received an empty SysML2 sample.");
    }
    modelTextEl.value = sampleSource;
    datasetPathEl.value = "sample_model.sysml";
    applyModel(parseModelText(sampleSource), "Sample SysML2 text loaded from the bundled data set.", sampleSource, {
      sourcePath: "sample_model.sysml",
      analysisPayload: sampleAnalysisPayload
    });
  } catch (error) {
    if (!embeddedSource) {
      throw error;
    }
    sampleSource = embeddedSource;
    sampleAnalysisPayload = null;
    modelTextEl.value = sampleSource;
    applyModel(parseModelText(sampleSource), "Loaded the embedded SysML2 fallback sample.", sampleSource, {
      sourcePath: "",
      analysisPayload: null
    });
  }
}

bootstrap().catch((error) => {
  titleEl.textContent = "Unable to load model";
  summaryEl.textContent = "Check the Python server and sample_model.sysml payload.";
  modelDescriptionEl.textContent = String(error);
  setImportStatus("Initial model load failed.", true);
});
