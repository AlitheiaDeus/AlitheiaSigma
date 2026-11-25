// Pure Hypothesis Testing & Before/After Kaizen Comparator Engine
import { normalCDF } from './capabilityMath.js';

function logGamma(z) {
  // Lanczos approximation
  const g = 7;
  const p = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = p[0];
  for (let i = 1; i < g + 2; i++) x += p[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function betacf(a, b, x) {
  const MAXIT = 120;
  const EPS = 3e-12;
  const FPMIN = 1e-30;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

function regIncompleteBeta(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

export function studentTCdfTwoTailP(tStat, df) {
  const x = df / (df + tStat * tStat);
  return Math.max(0, Math.min(1, regIncompleteBeta(df / 2, 0.5, x)));
}

export function fDistUpperP(fStat, df1, df2) {
  if (fStat <= 0) return 1;
  const x = (df1 * fStat) / (df1 * fStat + df2);
  return Math.max(0, Math.min(1, 1 - regIncompleteBeta(df1 / 2, df2 / 2, x)));
}

function summarize(arr) {
  const n = arr.length;
  const sorted = [...arr].sort((a, b) => a - b);
  const mean = arr.reduce((s, v) => s + v, 0) / n;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, n - 1);
  const sd = Math.sqrt(variance);
  const q = (p) => {
    const pos = p * (n - 1);
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  };
  return { n, sorted, min: sorted[0], max: sorted[n - 1], mean, variance, sd, q1: q(0.25), median: q(0.5), q3: q(0.75) };
}

/**
 * Computes Welch's 2-sample t-test, Brown-Forsythe variance test, Mann-Whitney U test,
 * Cohen's d effect size, and capability (Cpk/PPM) shift between Before and After samples.
 */
export function computeABComparison(cmpState) {
  const before = (Array.isArray(cmpState?.beforeSamples) ? cmpState.beforeSamples : [])
    .map(Number)
    .filter(Number.isFinite);
  const after = (Array.isArray(cmpState?.afterSamples) ? cmpState.afterSamples : [])
    .map(Number)
    .filter(Number.isFinite);

  if (before.length < 2 || after.length < 2) return null;

  const s1 = summarize(before);
  const s2 = summarize(after);
  const alpha = Math.max(0.001, Math.min(0.25, Number(cmpState.alpha) || 0.05));

  // Welch's t-test (After - Before)
  const v1 = Math.max(1e-12, s1.variance) / s1.n;
  const v2 = Math.max(1e-12, s2.variance) / s2.n;
  const se = Math.sqrt(v1 + v2);
  const meanDiff = s2.mean - s1.mean;
  const tStat = meanDiff / se;
  const df = (v1 + v2) ** 2 / ((v1 ** 2) / (s1.n - 1) + (v2 ** 2) / (s2.n - 1));
  const pValue = studentTCdfTwoTailP(tStat, df);

  // 95% CI using normal/t approx
  const tCrit = df >= 30 ? 1.96 : 2.04;
  const ciLow = meanDiff - tCrit * se;
  const ciHigh = meanDiff + tCrit * se;

  // Pooled SD & Cohen's d
  const pooledSd = Math.max(
    1e-9,
    Math.sqrt(((s1.n - 1) * s1.variance + (s2.n - 1) * s2.variance) / (s1.n + s2.n - 2))
  );
  const cohenD = meanDiff / pooledSd;

  // Brown-Forsythe (Levene on median) variance test
  const z1 = before.map((x) => Math.abs(x - s1.median));
  const z2 = after.map((x) => Math.abs(x - s2.median));
  const zm1 = z1.reduce((s, v) => s + v, 0) / s1.n;
  const zm2 = z2.reduce((s, v) => s + v, 0) / s2.n;
  const zGrand = (z1.reduce((s, v) => s + v, 0) + z2.reduce((s, v) => s + v, 0)) / (s1.n + s2.n);
  const ssBetween = s1.n * (zm1 - zGrand) ** 2 + s2.n * (zm2 - zGrand) ** 2;
  const ssWithin =
    z1.reduce((s, v) => s + (v - zm1) ** 2, 0) + z2.reduce((s, v) => s + (v - zm2) ** 2, 0);
  const fLevene = ssWithin > 0 ? (ssBetween / 1) / (ssWithin / (s1.n + s2.n - 2)) : 0;
  const pVariance = fDistUpperP(fLevene, 1, s1.n + s2.n - 2);

  // Mann-Whitney U (normal approximation with tie correction)
  const combined = [
    ...before.map((v) => ({ v, grp: 1 })),
    ...after.map((v) => ({ v, grp: 2 })),
  ].sort((a, b) => a.v - b.v);

  const N = combined.length;
  let rankSum1 = 0;
  let tieSum = 0;
  let idx = 0;
  while (idx < N) {
    let end = idx + 1;
    while (end < N && combined[end].v === combined[idx].v) end++;
    const avgRank = (idx + 1 + end) / 2;
    const tCount = end - idx;
    if (tCount > 1) tieSum += tCount ** 3 - tCount;
    for (let k = idx; k < end; k++) {
      if (combined[k].grp === 1) rankSum1 += avgRank;
    }
    idx = end;
  }
  const u1 = rankSum1 - (s1.n * (s1.n + 1)) / 2;
  const muU = (s1.n * s2.n) / 2;
  const sigmaU = Math.sqrt(
    Math.max(1e-9, ((s1.n * s2.n) / 12) * (N + 1 - tieSum / (N * (N - 1))))
  );
  const zU = (u1 - muU) / sigmaU;
  const pMannWhitney = Math.max(0, Math.min(1, 2 * (1 - normalCDF(Math.abs(zU)))));

  // Capability shift if LSL/USL provided
  const lsl = Number(cmpState.lsl);
  const usl = Number(cmpState.usl);
  let capBefore = null;
  let capAfter = null;
  if (Number.isFinite(lsl) && Number.isFinite(usl) && usl > lsl) {
    const calc = (s) => {
      const sig = Math.max(1e-9, s.sd);
      const cpk = Math.min((usl - s.mean) / (3 * sig), (s.mean - lsl) / (3 * sig));
      const ppm = (normalCDF((lsl - s.mean) / sig) + normalCDF((s.mean - usl) / sig)) * 1e6;
      return { cpk, ppm };
    };
    capBefore = calc(s1);
    capAfter = calc(s2);
  }

  return {
    before: s1,
    after: s2,
    alpha,
    meanDiff,
    sdRatio: s1.sd > 1e-9 ? s2.sd / s1.sd : 1,
    tStat,
    df,
    pValue,
    significant: pValue < alpha,
    ciLow,
    ciHigh,
    cohenD,
    fLevene,
    pVariance,
    varianceSignificant: pVariance < alpha,
    uStat: u1,
    pMannWhitney,
    capBefore,
    capAfter,
  };
}
