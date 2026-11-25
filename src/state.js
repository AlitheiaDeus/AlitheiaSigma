import { SAMPLE_SCENARIOS, STORAGE_KEY, WORKSPACES_STORAGE_KEY } from './constants.js';

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function defaultSource(label) {
  return { kind: 'sample', label: `Sample: ${label}` };
}

function defaultNelsonRules() {
  return { r1: true, r2: true, r3: true, r4: true, r5: false, r6: false, r7: false, r8: false };
}

function defaultStackup(cap) {
  const lsl = Number.isFinite(Number(cap?.lsl)) ? Number(cap.lsl) : 30;
  const usl = Number.isFinite(Number(cap?.usl)) ? Number(cap.usl) : 70;
  const mid = (lsl + usl) / 2;
  return {
    trials: 10000,
    lsl,
    usl,
    components: [
      { id: 1, name: 'Housing Bore', sign: 1, dist: 'normal', mean: mid * 0.6, sigma: 0.8 },
      { id: 2, name: 'Bearing OD', sign: 1, dist: 'normal', mean: mid * 0.4, sigma: 0.6 },
      { id: 3, name: 'Thermal Offset', sign: -1, dist: 'uniform', mean: 0, sigma: 0.5 },
    ],
  };
}

function defaultMSA() {
  return {
    tolerance: 40.0,
    method: 'anova',
    operators: ['Op A', 'Op B', 'Op C'],
    parts: ['P1', 'P2', 'P3', 'P4', 'P5'],
    trials: 2,
    readings: [
      [49.8, 50.1], [52.4, 52.6], [47.2, 47.5], [55.1, 54.9], [44.6, 44.8],
      [50.2, 49.9], [52.8, 52.3], [47.6, 47.4], [55.4, 55.0], [45.0, 44.7],
      [49.6, 50.0], [52.2, 52.5], [47.1, 47.3], [54.8, 55.2], [44.5, 44.9],
    ],
  };
}

function defaultComparator() {
  return {
    metricName: 'Cycle / Dimension',
    unit: 'mm',
    alpha: 0.05,
    lsl: 30,
    usl: 70,
    beforeLabel: 'Before Kaizen',
    afterLabel: 'After Kaizen',
    beforeSamples: [53.2, 54.1, 53.6, 55.2, 54.4, 56.1, 55.8, 57.3, 54.7, 52.9],
    afterSamples: [50.1, 49.8, 50.4, 49.7, 50.2, 49.9, 50.5, 49.6, 50.0, 50.3],
  };
}

function defaultFMEA() {
  return {
    chains: [
      {
        id: 1,
        rib: 'Machine',
        cause: 'Spindle thermal drift',
        whys: [
          'Bore diameter drifts after startup',
          'Bearing housing expands with heat',
          'Machining begins from cold spindle',
        ],
      },
    ],
    rows: [
      {
        id: 1,
        cause: 'Spindle thermal drift',
        mode: 'Oversize bore in first hour',
        effect: 'Loose bearing fit',
        sev: 8,
        occ: 6,
        det: 5,
        action: 'Add 8-min warm-up cycle',
        owner: 'R. Lim',
        due: '2026-12-05',
        status: 'In Progress',
      },
    ],
  };
}

/**
 * Generates deep-cloned factory defaults for all 10 analytical modules + UI preferences.
 */
export function createDefaultState(scenarioKey = 'cnc') {
  const src = SAMPLE_SCENARIOS[scenarioKey] || SAMPLE_SCENARIOS.cnc;
  const cloned = deepClone(src);
  const srcBadge = defaultSource(cloned.label);
  const capTarget = Number(((cloned.capability.lsl + cloned.capability.usl) / 2).toFixed(3));
  return {
    activeTab: 'capability',
    scenarioKey: cloned.key,
    scenarioName: cloned.label,
    capability: {
      ...cloned.capability,
      target: cloned.capability.target ?? capTarget,
      subgroupSize: cloned.capability.subgroupSize ?? 1,
      maskedIndices: cloned.capability.maskedIndices ?? [],
      nelsonRules: cloned.capability.nelsonRules ?? defaultNelsonRules(),
      spcChartMode: cloned.capability.spcChartMode ?? 'imr',
      attrSubgroups: cloned.capability.attrSubgroups ?? [
        { label: 'Lot 1', defects: 3, size: 100 },
        { label: 'Lot 2', defects: 2, size: 100 },
        { label: 'Lot 3', defects: 5, size: 100 },
        { label: 'Lot 4', defects: 1, size: 100 },
        { label: 'Lot 5', defects: 4, size: 100 },
        { label: 'Lot 6', defects: 8, size: 100 },
      ],
      stackup: cloned.capability.stackup ?? defaultStackup(cloned.capability),
      source: { ...srcBadge },
    },
    oee: { ...cloned.oee, source: { ...srcBadge } },
    takt: { ...cloned.takt, source: { ...srcBadge } },
    pareto: { ...cloned.pareto, cutoffPct: cloned.pareto.cutoffPct ?? 80, source: { ...srcBadge } },
    vsm: { ...cloned.vsm, source: { ...srcBadge } },
    fives: { ...cloned.fives, source: { ...srcBadge } },
    ishikawa: { ...cloned.ishikawa, source: { ...srcBadge } },
    msa: { ...(cloned.msa || defaultMSA()), source: { ...srcBadge } },
    comparator: { ...(cloned.comparator || defaultComparator()), source: { ...srcBadge } },
    fmea: { ...(cloned.fmea || defaultFMEA()), source: { ...srcBadge } },
    baselines: {},
    ui: {
      theme: 'navy',
      showGrid: true,
      cockpitExpanded: true,
      globalLine: 'ALL',
    },
  };
}

/**
 * Deep-merges saved v1/v2/v3 workspace payloads against current defaults so older
 * JSON snapshots or localStorage state migrate cleanly without missing fields.
 */
export function migrateState(parsed) {
  const def = createDefaultState(parsed?.scenarioKey || 'cnc');
  if (!parsed || typeof parsed !== 'object') return def;

  const fallbackSource = (mod, defSrc) =>
    mod && mod.source && mod.source.label ? mod.source : { ...defSrc };

  const cap = { ...def.capability, ...(parsed.capability || {}) };
  if (!Array.isArray(cap.samples)) cap.samples = def.capability.samples;
  if (!cap.mode) cap.mode = Array.isArray(parsed.capability?.samples) ? 'data' : 'simulator';
  if (!cap.distModel) cap.distModel = 'auto';
  if (!Number.isFinite(Number(cap.target))) cap.target = Number(((cap.lsl + cap.usl) / 2).toFixed(3));
  if (!Number.isFinite(Number(cap.subgroupSize)) || cap.subgroupSize < 1) cap.subgroupSize = 1;
  if (!Array.isArray(cap.maskedIndices)) cap.maskedIndices = [];
  cap.nelsonRules = { ...defaultNelsonRules(), ...(cap.nelsonRules || {}) };
  if (!cap.spcChartMode) cap.spcChartMode = 'imr';
  if (!Array.isArray(cap.attrSubgroups) || cap.attrSubgroups.length === 0) cap.attrSubgroups = def.capability.attrSubgroups;
  if (!cap.stackup || !Array.isArray(cap.stackup.components)) cap.stackup = def.capability.stackup;
  cap.source = fallbackSource(parsed.capability, def.capability.source);

  const oee = { ...def.oee, ...(parsed.oee || {}) };
  if (!Array.isArray(oee.logs)) oee.logs = def.oee.logs;
  if (!oee.mode) oee.mode = Array.isArray(parsed.oee?.logs) ? 'log' : 'single';
  if (!oee.filterLine) oee.filterLine = 'ALL';
  oee.source = fallbackSource(parsed.oee, def.oee.source);

  const takt = { ...def.takt, ...(parsed.takt || {}) };
  if (!Array.isArray(takt.stations) || takt.stations.length === 0) takt.stations = def.takt.stations;
  takt.source = fallbackSource(parsed.takt, def.takt.source);

  const pareto = { ...def.pareto, ...(parsed.pareto || {}) };
  if (!Array.isArray(pareto.items) || pareto.items.length === 0) pareto.items = def.pareto.items;
  if (!Array.isArray(pareto.events)) pareto.events = def.pareto.events;
  if (!pareto.mode) pareto.mode = Array.isArray(parsed.pareto?.events) ? 'events' : 'summary';
  if (!pareto.metric) pareto.metric = 'count';
  if (!pareto.filterValue) pareto.filterValue = 'ALL';
  if (!Number.isFinite(Number(pareto.cutoffPct))) pareto.cutoffPct = 80;
  pareto.source = fallbackSource(parsed.pareto, def.pareto.source);

  const vsm = { ...def.vsm, ...(parsed.vsm || {}) };
  if (!Array.isArray(vsm.steps) || vsm.steps.length === 0) vsm.steps = def.vsm.steps;
  vsm.source = fallbackSource(parsed.vsm, def.vsm.source);

  const fives = { ...def.fives, ...(parsed.fives || {}) };
  if (!Array.isArray(fives.pillars) || fives.pillars.length === 0) fives.pillars = def.fives.pillars;
  if (!Array.isArray(fives.actions)) fives.actions = def.fives.actions;
  fives.source = fallbackSource(parsed.fives, def.fives.source);

  const ishikawa = {
    ...def.ishikawa,
    ...(parsed.ishikawa || {}),
    ribs: {
      ...def.ishikawa.ribs,
      ...((parsed.ishikawa && parsed.ishikawa.ribs) || {}),
    },
  };
  ishikawa.source = fallbackSource(parsed.ishikawa, def.ishikawa.source);

  const msa = { ...def.msa, ...(parsed.msa || {}) };
  if (!Array.isArray(msa.operators) || msa.operators.length < 2) msa.operators = def.msa.operators;
  if (!Array.isArray(msa.parts) || msa.parts.length < 2) msa.parts = def.msa.parts;
  if (!Array.isArray(msa.readings) || msa.readings.length === 0) msa.readings = def.msa.readings;
  msa.source = fallbackSource(parsed.msa, def.msa.source);

  const comparator = { ...def.comparator, ...(parsed.comparator || {}) };
  if (!Array.isArray(comparator.beforeSamples)) comparator.beforeSamples = def.comparator.beforeSamples;
  if (!Array.isArray(comparator.afterSamples)) comparator.afterSamples = def.comparator.afterSamples;
  comparator.source = fallbackSource(parsed.comparator, def.comparator.source);

  const fmea = { ...def.fmea, ...(parsed.fmea || {}) };
  if (!Array.isArray(fmea.chains)) fmea.chains = def.fmea.chains;
  if (!Array.isArray(fmea.rows)) fmea.rows = def.fmea.rows;
  fmea.source = fallbackSource(parsed.fmea, def.fmea.source);

  const baselines = parsed.baselines && typeof parsed.baselines === 'object' ? parsed.baselines : {};
  const ui = { ...def.ui, ...(parsed.ui || {}) };

  return {
    activeTab: parsed.activeTab || def.activeTab,
    scenarioKey: parsed.scenarioKey || def.scenarioKey,
    scenarioName: parsed.scenarioName || def.scenarioName,
    capability: cap,
    oee,
    takt,
    pareto,
    vsm,
    fives,
    ishikawa,
    msa,
    comparator,
    fmea,
    baselines,
    ui,
  };
}

let state = loadInitialState();
const MAX_HISTORY = 40;
let undoStack = [];
let redoStack = [];
let lastSnapshotJson = JSON.stringify(state);
let historyListeners = [];
let persistListeners = [];

export function onPersist(fn) {
  persistListeners.push(fn);
}

function loadInitialState() {
  if (typeof localStorage === 'undefined') return createDefaultState();
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.capability && parsed.oee && parsed.takt && parsed.pareto && parsed.vsm && parsed.fives && parsed.ishikawa) {
        return migrateState(parsed);
      }
    }
  } catch (err) {
    console.warn('Workspace restore fallback to defaults:', err);
  }
  return createDefaultState();
}

function notifyHistoryListeners() {
  historyListeners.forEach((fn) => fn({ canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 }));
}

export function onHistoryChange(fn) {
  historyListeners.push(fn);
}

/**
 * Captures the previous state into the undo stack whenever state has mutated.
 * Call right before a user action or on persistState() for automatic checkpointing.
 */
export function recordUndoSnapshot(label = 'Edit') {
  const curJson = JSON.stringify(state);
  if (curJson === lastSnapshotJson) return false;
  undoStack.push({ label, snapshot: JSON.parse(lastSnapshotJson) });
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack = [];
  lastSnapshotJson = curJson;
  notifyHistoryListeners();
  return true;
}

export function canUndo() {
  return undoStack.length > 0;
}

export function canRedo() {
  return redoStack.length > 0;
}

export function undoState() {
  if (undoStack.length === 0) return false;
  const prev = undoStack.pop();
  redoStack.push({ label: prev.label, snapshot: deepClone(state) });
  const activeTab = state.activeTab;
  state = migrateState(prev.snapshot);
  state.activeTab = activeTab;
  lastSnapshotJson = JSON.stringify(state);
  persistRaw();
  notifyHistoryListeners();
  return prev.label;
}

export function redoState() {
  if (redoStack.length === 0) return false;
  const next = redoStack.pop();
  undoStack.push({ label: next.label, snapshot: deepClone(state) });
  const activeTab = state.activeTab;
  state = migrateState(next.snapshot);
  state.activeTab = activeTab;
  lastSnapshotJson = JSON.stringify(state);
  persistRaw();
  notifyHistoryListeners();
  return next.label;
}

export function clearHistory() {
  undoStack = [];
  redoStack = [];
  lastSnapshotJson = JSON.stringify(state);
  notifyHistoryListeners();
}

export function getState() {
  return state;
}

export function setState(next) {
  recordUndoSnapshot('Load Workspace');
  state = migrateState(next);
  lastSnapshotJson = JSON.stringify(state);
  persistRaw();
  return state;
}

export function setModuleSource(moduleKey, kind, label) {
  if (state[moduleKey]) {
    state[moduleKey].source = { kind, label };
  }
}

export function resetState(scenarioKey = 'cnc') {
  recordUndoSnapshot('Reset Defaults');
  const prevTab = state.activeTab;
  state = createDefaultState(scenarioKey);
  state.activeTab = prevTab;
  lastSnapshotJson = JSON.stringify(state);
  persistRaw();
  return state;
}

export function loadScenario(scenarioKey) {
  recordUndoSnapshot(`Load ${scenarioKey}`);
  const prevTab = state.activeTab;
  state = createDefaultState(scenarioKey);
  state.activeTab = prevTab;
  lastSnapshotJson = JSON.stringify(state);
  persistRaw();
  return state;
}

function persistRaw() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('LocalStorage write skipped:', err);
  }
}

let historyDebounceTimer = null;
export function persistState({ recordHistory = true } = {}) {
  persistRaw();
  persistListeners.forEach((fn) => fn());
  if (!recordHistory) return;
  if (typeof setTimeout === 'undefined') {
    recordUndoSnapshot('Edit');
    return;
  }
  clearTimeout(historyDebounceTimer);
  historyDebounceTimer = setTimeout(() => {
    recordUndoSnapshot('Edit');
  }, 450);
}

/* Baseline Snapshot Pinning */
export function pinBaseline(moduleKey, kpis) {
  if (!state.baselines) state.baselines = {};
  state.baselines[moduleKey] = {
    timestamp: new Date().toISOString(),
    kpis: deepClone(kpis),
  };
  persistRaw();
}

export function clearBaseline(moduleKey) {
  if (!state.baselines) return;
  if (moduleKey === 'all') {
    state.baselines = {};
  } else {
    delete state.baselines[moduleKey];
  }
  persistRaw();
}

/* Multi-Study Workspace Manager */
function readWorkspacesMap() {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(WORKSPACES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeWorkspacesMap(map) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(WORKSPACES_STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn('Workspaces write skipped:', err);
  }
}

export function listWorkspaces() {
  const map = readWorkspacesMap();
  return Object.values(map).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export function saveWorkspaceAs(name) {
  const cleanName = String(name || '').trim() || `Study ${new Date().toLocaleDateString()}`;
  const map = readWorkspacesMap();
  const id = `ws_${Date.now().toString(36)}`;
  map[id] = {
    id,
    name: cleanName,
    updatedAt: new Date().toISOString(),
    data: deepClone(state),
  };
  writeWorkspacesMap(map);
  return map[id];
}

export function loadWorkspaceById(id) {
  const map = readWorkspacesMap();
  const entry = map[id];
  if (!entry || !entry.data) return null;
  setState(entry.data);
  state.scenarioName = entry.name;
  persistRaw();
  return entry;
}

export function deleteWorkspaceById(id) {
  const map = readWorkspacesMap();
  if (!map[id]) return false;
  delete map[id];
  writeWorkspacesMap(map);
  return true;
}

export function nextId(list) {
  return list.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1;
}
