import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeAttributeChart,
  computeEmpiricalCapability,
  computeSubgroupSPC,
  evaluateNelsonRules,
  runMonteCarloStackup,
} from '../src/modules/capabilityMath.js';
import { computeParetoSorted } from '../src/modules/paretoMath.js';
import { computeGageRR } from '../src/modules/msaMath.js';
import { computeABComparison } from '../src/modules/comparatorMath.js';
import { computeFMEAMetrics } from '../src/modules/fmeaMath.js';

test('evaluateNelsonRules detects Rules 3, 4, 5, 6, 7, and 8 accurately', () => {
  const trend = [1, 2, 3, 4, 5, 6, 7];
  const r3 = evaluateNelsonRules(trend, 4, 2, { r1: false, r2: false, r3: true });
  assert.ok(r3.ruleHits.r3.length >= 6);

  const alt = [1, 5, 1, 5, 1, 5, 1, 5, 1, 5, 1, 5, 1, 5];
  const r4 = evaluateNelsonRules(alt, 3, 2, { r1: false, r2: false, r4: true });
  assert.equal(r4.ruleHits.r4.length, 14);

  const zoneA = [10, 12.5, 12.6, 10];
  const r5 = evaluateNelsonRules(zoneA, 10, 1, { r1: false, r2: false, r5: true });
  assert.ok(r5.ruleHits.r5.includes(1) && r5.ruleHits.r5.includes(2));

  const strat = Array(15).fill(10.2);
  const r7 = evaluateNelsonRules(strat, 10, 1, { r1: false, r2: false, r7: true });
  assert.equal(r7.ruleHits.r7.length, 15);
});

test('computeEmpiricalCapability supports outlier masking and Taguchi Cpm', () => {
  const raw = [50, 50.2, 49.8, 50.1, 49.9, 50.3, 49.7, 68.5];
  const unmasked = computeEmpiricalCapability(raw, 45, 55, 'normal', { target: 50 });
  const masked = computeEmpiricalCapability(raw, 45, 55, 'normal', { target: 50, maskedIndices: [7] });

  assert.equal(unmasked.n, 8);
  assert.equal(masked.n, 7);
  assert.equal(masked.maskedCount, 1);
  assert.ok(masked.cpk > unmasked.cpk * 3, 'Masking extreme outlier should sharply improve Cpk');
  assert.ok(masked.cpm > 1.5, 'Centered masked process should have high Taguchi Cpm');
});

test('computeSubgroupSPC and computeAttributeChart compute Xbar-R/S and p/u limits', () => {
  const samples = [10, 11, 9, 10, 12, 11, 10, 11, 9, 10, 11, 10, 10, 11, 9, 10];
  const sg = computeSubgroupSPC(samples, 4);
  assert.ok(sg);
  assert.equal(sg.subgroups.length, 4);
  assert.ok(sg.uclXbarR > sg.xDoubleBar && sg.lclXbarR < sg.xDoubleBar);

  const pChart = computeAttributeChart([
    { label: 'L1', defects: 2, size: 100 },
    { label: 'L2', defects: 3, size: 100 },
    { label: 'L3', defects: 15, size: 100 },
  ], 'p');
  assert.ok(pChart);
  assert.ok(pChart.oocIndices.includes(2));
});

test('runMonteCarloStackup is deterministic and normalizes variance sensitivity to 100%', () => {
  const su = runMonteCarloStackup({
    trials: 4000,
    lsl: 9,
    usl: 15,
    components: [
      { name: 'A', sign: 1, dist: 'normal', mean: 8, sigma: 0.3 },
      { name: 'B', sign: 1, dist: 'uniform', mean: 4, sigma: 0.4 },
    ],
  });
  assert.ok(su);
  assert.ok(Math.abs(su.mean - 12) < 0.1);
  const sumPct = su.sensitivity.reduce((s, c) => s + c.pct, 0);
  assert.ok(Math.abs(sumPct - 100) < 0.01);
});

test('computeParetoSorted respects custom cutoffPct', () => {
  const items = [
    { id: 1, name: 'A', count: 55 },
    { id: 2, name: 'B', count: 25 },
    { id: 3, name: 'C', count: 20 },
  ];
  const r60 = computeParetoSorted(items, 60);
  const r90 = computeParetoSorted(items, 90);
  assert.equal(r60.vitalCount, 2); // 55% < 60%, 80% >= 60%
  assert.equal(r90.vitalCount, 3);
});

test('computeGageRR computes ANOVA and Range %GRR and ndc', () => {
  const msa = {
    tolerance: 20,
    method: 'anova',
    operators: ['Op1', 'Op2'],
    parts: ['P1', 'P2', 'P3', 'P4'],
    trials: 2,
    readings: [
      [10.0, 10.1], [12.0, 12.1], [14.0, 14.1], [16.0, 15.9],
      [10.1, 10.0], [12.1, 12.0], [14.1, 14.0], [15.9, 16.0],
    ],
  };
  const res = computeGageRR(msa);
  assert.ok(res);
  assert.equal(res.verdict, 'Acceptable');
  assert.ok(res.pctGRRStudy < 10);
  assert.ok(res.ndc >= 5);
});

test('computeABComparison detects statistically significant shift via Welch t-test and Mann-Whitney', () => {
  const cmp = computeABComparison({
    alpha: 0.05,
    beforeSamples: [54, 55, 53.5, 56, 54.8, 55.2, 54.1, 55.7],
    afterSamples: [50.1, 49.9, 50.3, 49.8, 50.0, 50.2, 49.7, 50.1],
  });
  assert.ok(cmp);
  assert.equal(cmp.significant, true);
  assert.ok(cmp.pValue < 0.001);
  assert.ok(cmp.pMannWhitney < 0.001);
  assert.ok(cmp.meanDiff < -4);
});

test('computeFMEAMetrics ranks failure modes by RPN and counts critical items', () => {
  const fmea = computeFMEAMetrics({
    chains: [{ id: 1, cause: 'Drift', whys: ['W1'] }],
    rows: [
      { id: 1, mode: 'Low', sev: 2, occ: 2, det: 2, status: 'Closed' },
      { id: 2, mode: 'Crit', sev: 9, occ: 6, det: 5, status: 'Open' },
    ],
  });
  assert.equal(fmea.maxRPN, 270);
  assert.equal(fmea.criticalCount, 1);
  assert.equal(fmea.openCount, 1);
  assert.equal(fmea.rows[0].mode, 'Crit');
});
