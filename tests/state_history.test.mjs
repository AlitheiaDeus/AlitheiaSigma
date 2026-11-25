import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearBaseline,
  clearHistory,
  createDefaultState,
  getState,
  migrateState,
  pinBaseline,
  recordUndoSnapshot,
  redoState,
  resetState,
  undoState,
} from '../src/state.js';
import { computeCockpitHealth, computeModuleInsights } from '../src/ui/diagnostics.js';

test('migrateState upgrades legacy v1 payload cleanly with new modules', () => {
  const legacy = {
    activeTab: 'oee',
    capability: { mu: 50, sigma: 4, lsl: 35, usl: 65, samples: [49, 50, 51, 52] },
  };
  const migrated = migrateState(legacy);
  assert.equal(migrated.activeTab, 'oee');
  assert.ok(migrated.msa && Array.isArray(migrated.msa.readings));
  assert.ok(migrated.comparator && Array.isArray(migrated.comparator.beforeSamples));
  assert.ok(migrated.fmea && Array.isArray(migrated.fmea.rows));
  assert.equal(migrated.pareto.cutoffPct, 80);
});

test('undoState and redoState restore snapshots cleanly', () => {
  resetState('cnc');
  clearHistory();
  const st = getState();
  const origProb = st.ishikawa.problem;
  st.ishikawa.problem = 'Modified Problem';
  assert.equal(recordUndoSnapshot('Change Problem'), true);

  const undone = undoState();
  assert.equal(undone, 'Change Problem');
  assert.equal(getState().ishikawa.problem, origProb);

  const redone = redoState();
  assert.equal(redone, 'Change Problem');
  assert.equal(getState().ishikawa.problem, 'Modified Problem');
});

test('Baseline pinning and diagnostics engine return valid KPIs and insights', () => {
  const st = createDefaultState('cnc');
  const tiles = computeCockpitHealth(st);
  assert.equal(tiles.length, 7);
  const insights = computeModuleInsights(st);
  assert.ok(insights.capability.length >= 1);
  assert.ok(insights.msa.length >= 1);

  pinBaseline('global', { oee: '70.0%' });
  assert.equal(getState().baselines.global.kpis.oee, '70.0%');
  clearBaseline('global');
  assert.equal(getState().baselines.global, undefined);
});
