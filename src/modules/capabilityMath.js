export function erfc(x) {
  const z = Math.abs(x);
  const t = 1.0 / (1.0 + 0.5 * z);
  const ans =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t *
                          (0.27886807 +
                            t *
                              (-1.13520398 +
                                t *
                                  (1.48851587 +
                                    t * (-0.82215223 + t * 0.17087277))))))))
    );
  return x >= 0.0 ? ans : 2.0 - ans;
}

export function normalCDF(z) {
  return 0.5 * erfc(-z / Math.SQRT2);
}

/**
 * Anderson-Darling Normality Test (Stephens 1986 modified A^2* and p-value).
 */
export function computeAndersonDarling(rawSamples) {
  const samples = (Array.isArray(rawSamples) ? rawSamples : [])
    .map(Number)
    .filter((v) => Number.isFinite(v));
  const n = samples.length;
  if (n < 4) {
    return { a2: 0, a2Star: 0, pValue: 1, isNormal: true, testable: false };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  const variance = sorted.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1);
  const s = Math.sqrt(variance);
  if (s <= 1e-12) {
    return { a2: 0, a2Star: 0, pValue: 0.0001, isNormal: false, testable: true };
  }

  let sum = 0;
  const eps = 1e-12;
  for (let i = 0; i < n; i++) {
    const phiLow = Math.min(1 - eps, Math.max(eps, normalCDF((sorted[i] - mean) / s)));
    const phiHigh = Math.min(1 - eps, Math.max(eps, normalCDF((sorted[n - 1 - i] - mean) / s)));
    sum += ((2 * (i + 1) - 1) / n) * (Math.log(phiLow) + Math.log(1 - phiHigh));
  }
  const a2 = -n - sum;
  const a2Star = a2 * (1 + 0.75 / n + 2.25 / (n * n));

  let p;
  if (a2Star >= 0.6) {
    p = Math.exp(1.2937 - 5.709 * a2Star + 0.0186 * a2Star * a2Star);
  } else if (a2Star > 0.34) {
    p = Math.exp(0.9177 - 4.279 * a2Star - 1.38 * a2Star * a2Star);
  } else if (a2Star > 0.2) {
    p = 1 - Math.exp(-8.318 + 42.796 * a2Star - 59.938 * a2Star * a2Star);
  } else {
    p = 1 - Math.exp(-13.436 + 101.14 * a2Star - 223.73 * a2Star * a2Star);
  }
  const pValue = Math.min(0.9999, Math.max(0.0001, p));
  return { a2, a2Star, pValue, isNormal: pValue >= 0.05, testable: true };
}

export function empiricalQuantile(sorted, q) {
  if (!sorted.length) return NaN;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const frac = pos - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

function computeADFromSortedCDF(sortedU) {
  const n = sortedU.length;
  if (n < 2) return Infinity;
  const eps = 1e-12;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const uLow = Math.min(1 - eps, Math.max(eps, sortedU[i]));
    const uHigh = Math.min(1 - eps, Math.max(eps, sortedU[n - 1 - i]));
    sum += ((2 * (i + 1) - 1) / n) * (Math.log(uLow) + Math.log(1 - uHigh));
  }
  return -n - sum;
}

function olsSlopeIntercept(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    num += dx * (ys[i] - my);
    den += dx * dx;
  }
  const slope = den > 1e-12 ? num / den : 1;
  const intercept = my - slope * mx;
  return { slope, intercept };
}

/**
 * Fits Normal, Lognormal, Weibull, and Log-Logistic to samples and ranks them
 * by Anderson-Darling A^2 statistic.
 */
export function fitCandidateDistributions(sorted, mean, overallSigma, adNorm) {
  const n = sorted.length;
  const candidates = {};

  // 1. Normal
  const normU = sorted.map((x) => normalCDF((x - mean) / overallSigma));
  candidates.normal = {
    key: 'normal',
    label: 'Normal',
    a2: adNorm.testable ? adNorm.a2 : computeADFromSortedCDF(normU),
    qLow: mean - 3 * overallSigma,
    qMid: mean,
    qHigh: mean + 3 * overallSigma,
    cdf: (x) => normalCDF((x - mean) / overallSigma),
    pdf: (x) => {
      const z = (x - mean) / overallSigma;
      return Math.exp(-0.5 * z * z) / (overallSigma * Math.sqrt(2 * Math.PI));
    },
  };

  if (sorted[0] > 0 && n >= 3) {
    const logs = sorted.map((x) => Math.log(x));
    const muLog = logs.reduce((a, b) => a + b, 0) / n;
    const varLog = logs.reduce((a, v) => a + (v - muLog) ** 2, 0) / (n - 1);
    const sigLog = Math.max(1e-9, Math.sqrt(varLog));

    // 2. Lognormal
    const lnU = logs.map((y) => normalCDF((y - muLog) / sigLog));
    candidates.lognormal = {
      key: 'lognormal',
      label: 'Lognormal',
      muLog,
      sigLog,
      a2: computeADFromSortedCDF(lnU),
      qLow: Math.exp(muLog - 3 * sigLog),
      qMid: Math.exp(muLog),
      qHigh: Math.exp(muLog + 3 * sigLog),
      cdf: (x) => (x > 0 ? normalCDF((Math.log(x) - muLog) / sigLog) : 0),
      pdf: (x) => {
        if (x <= 0) return 0;
        const z = (Math.log(x) - muLog) / sigLog;
        return Math.exp(-0.5 * z * z) / (x * sigLog * Math.sqrt(2 * Math.PI));
      },
    };

    // Benard's median ranks for probability plotting
    const ranks = sorted.map((_, i) => (i + 1 - 0.3) / (n + 0.4));

    // 3. Weibull (2-parameter via rank regression on ln(x) vs ln(-ln(1-F)))
    const wY = ranks.map((f) => Math.log(-Math.log(1 - f)));
    const wFit = olsSlopeIntercept(logs, wY);
    const k = Math.max(0.05, wFit.slope);
    const lambda = Math.exp(-wFit.intercept / k);
    if (Number.isFinite(lambda) && lambda > 0) {
      const wCdf = (x) => (x > 0 ? 1 - Math.exp(-Math.pow(x / lambda, k)) : 0);
      const wQuant = (p) => lambda * Math.pow(-Math.log(1 - p), 1 / k);
      candidates.weibull = {
        key: 'weibull',
        label: 'Weibull',
        k,
        lambda,
        a2: computeADFromSortedCDF(sorted.map(wCdf)),
        qLow: wQuant(0.00135),
        qMid: wQuant(0.5),
        qHigh: wQuant(0.99865),
        cdf: wCdf,
        pdf: (x) => {
          if (x <= 0) return 0;
          const r = x / lambda;
          return (k / lambda) * Math.pow(r, k - 1) * Math.exp(-Math.pow(r, k));
        },
      };
    }

    // 4. Log-Logistic (2-parameter via rank regression on ln(x) vs ln(F/(1-F)))
    const llY = ranks.map((f) => Math.log(f / (1 - f)));
    const llFit = olsSlopeIntercept(logs, llY);
    const beta = Math.max(0.05, llFit.slope);
    const alpha = Math.exp(-llFit.intercept / beta);
    if (Number.isFinite(alpha) && alpha > 0) {
      const llCdf = (x) => (x > 0 ? 1 / (1 + Math.pow(x / alpha, -beta)) : 0);
      const llQuant = (p) => alpha * Math.pow(p / (1 - p), 1 / beta);
      candidates.loglogistic = {
        key: 'loglogistic',
        label: 'Log-Logistic',
        beta,
        alpha,
        a2: computeADFromSortedCDF(sorted.map(llCdf)),
        qLow: llQuant(0.00135),
        qMid: alpha,
        qHigh: llQuant(0.99865),
        cdf: llCdf,
        pdf: (x) => {
          if (x <= 0) return 0;
          const r = x / alpha;
          const rb = Math.pow(r, beta);
          return ((beta / alpha) * Math.pow(r, beta - 1)) / Math.pow(1 + rb, 2);
        },
      };
    }
  }

  const rankings = Object.values(candidates)
    .filter((c) => Number.isFinite(c.a2))
    .sort((a, b) => a.a2 - b.a2);

  let bestKey = rankings[0]?.key || 'normal';
  if (adNorm.testable && adNorm.isNormal && candidates.normal && rankings[0]) {
    if (candidates.normal.a2 - rankings[0].a2 < 0.08) {
      bestKey = 'normal';
    }
  }

  return { candidates, rankings, bestKey };
}

export function computeParametricCapability({ mu, sigma, lsl, usl }) {
  const safeSigma = Math.max(1e-9, sigma);
  const specW = usl - lsl;
  const upperM = usl - mu;
  const lowerM = mu - lsl;
  const cp = specW / (6 * safeSigma);
  const cpu = upperM / (3 * safeSigma);
  const cpl = lowerM / (3 * safeSigma);
  const cpk = Math.min(cpu, cpl);
  const pLower = normalCDF((lsl - mu) / safeSigma);
  const pUpper = normalCDF((mu - usl) / safeSigma);
  const ppm = (pLower + pUpper) * 1e6;
  const yieldPct = Math.max(0, (1 - (pLower + pUpper)) * 100);
  const zMin = Math.min(upperM / safeSigma, lowerM / safeSigma);
  return { mu, sigma: safeSigma, lsl, usl, specW, upperM, lowerM, cp, cpu, cpl, cpk, ppm, yieldPct, zMin };
}

/**
 * Evaluates Nelson / Western Electric Rules 1–8 on a series with center line `cl` and 1-sigma `sigma`.
 * Returns { oocIndices, ruleHits: { r1: [], ... }, pointRules: Map<index, string[]> }.
 */
export function evaluateNelsonRules(series, cl, sigma, enabledRules = {}) {
  const rules = {
    r1: enabledRules.r1 !== false,
    r2: enabledRules.r2 !== false,
    r3: Boolean(enabledRules.r3),
    r4: Boolean(enabledRules.r4),
    r5: Boolean(enabledRules.r5),
    r6: Boolean(enabledRules.r6),
    r7: Boolean(enabledRules.r7),
    r8: Boolean(enabledRules.r8),
  };
  const safeSig = Math.max(1e-9, sigma);
  const n = series.length;
  const hits = { r1: new Set(), r2: new Set(), r3: new Set(), r4: new Set(), r5: new Set(), r6: new Set(), r7: new Set(), r8: new Set() };
  const pointRules = new Map();
  const addHit = (rKey, idx, label) => {
    hits[rKey].add(idx);
    if (!pointRules.has(idx)) pointRules.set(idx, []);
    const arr = pointRules.get(idx);
    if (!arr.includes(label)) arr.push(label);
  };

  // Rule 1: 1 pt > 3σ
  if (rules.r1) {
    for (let i = 0; i < n; i++) {
      if (Math.abs(series[i] - cl) > 3 * safeSig) addHit('r1', i, 'R1 (>3σ)');
    }
  }

  // Rule 2: 8 consecutive pts on same side of CL
  if (rules.r2) {
    let runSide = 0;
    let runStart = 0;
    for (let i = 0; i < n; i++) {
      const side = series[i] > cl ? 1 : series[i] < cl ? -1 : 0;
      if (side === 0 || side !== runSide) {
        runSide = side;
        runStart = i;
      } else if (i - runStart + 1 >= 8) {
        for (let k = runStart; k <= i; k++) addHit('r2', k, 'R2 (8-pt run)');
      }
    }
  }

  // Rule 3: 6 consecutive pts strictly increasing or decreasing
  if (rules.r3 && n >= 6) {
    let dir = 0;
    let start = 0;
    for (let i = 1; i < n; i++) {
      const d = series[i] > series[i - 1] ? 1 : series[i] < series[i - 1] ? -1 : 0;
      if (d === 0 || d !== dir) {
        dir = d;
        start = i - 1;
      } else if (i - start + 1 >= 6) {
        for (let k = start; k <= i; k++) addHit('r3', k, 'R3 (6-pt trend)');
      }
    }
  }

  // Rule 4: 14 consecutive pts alternating up & down
  if (rules.r4 && n >= 14) {
    let altStart = 0;
    let prevDir = 0;
    for (let i = 1; i < n; i++) {
      const d = series[i] > series[i - 1] ? 1 : series[i] < series[i - 1] ? -1 : 0;
      if (d === 0 || (prevDir !== 0 && d === prevDir)) {
        altStart = d === 0 ? i : i - 1;
      } else if (i - altStart + 1 >= 14) {
        for (let k = altStart; k <= i; k++) addHit('r4', k, 'R4 (14-pt alt)');
      }
      prevDir = d;
    }
  }

  // Rule 5: 2 of 3 consecutive pts > 2σ on same side
  if (rules.r5 && n >= 3) {
    for (let i = 2; i < n; i++) {
      const win = [i - 2, i - 1, i];
      const hi = win.filter((k) => (series[k] - cl) / safeSig > 2);
      const lo = win.filter((k) => (series[k] - cl) / safeSig < -2);
      if (hi.length >= 2) hi.forEach((k) => addHit('r5', k, 'R5 (2/3 >2σ)'));
      if (lo.length >= 2) lo.forEach((k) => addHit('r5', k, 'R5 (2/3 >2σ)'));
    }
  }

  // Rule 6: 4 of 5 consecutive pts > 1σ on same side
  if (rules.r6 && n >= 5) {
    for (let i = 4; i < n; i++) {
      const win = [i - 4, i - 3, i - 2, i - 1, i];
      const hi = win.filter((k) => (series[k] - cl) / safeSig > 1);
      const lo = win.filter((k) => (series[k] - cl) / safeSig < -1);
      if (hi.length >= 4) hi.forEach((k) => addHit('r6', k, 'R6 (4/5 >1σ)'));
      if (lo.length >= 4) lo.forEach((k) => addHit('r6', k, 'R6 (4/5 >1σ)'));
    }
  }

  // Rule 7: 15 consecutive pts within ±1σ (stratification)
  if (rules.r7 && n >= 15) {
    let start = 0;
    for (let i = 0; i < n; i++) {
      if (Math.abs(series[i] - cl) <= safeSig) {
        if (i - start + 1 >= 15) {
          for (let k = start; k <= i; k++) addHit('r7', k, 'R7 (15-pt <1σ)');
        }
      } else {
        start = i + 1;
      }
    }
  }

  // Rule 8: 8 consecutive pts outside ±1σ on both sides (mixture)
  if (rules.r8 && n >= 8) {
    let start = 0;
    for (let i = 0; i < n; i++) {
      if (Math.abs(series[i] - cl) > safeSig) {
        if (i - start + 1 >= 8) {
          let hasPos = false;
          let hasNeg = false;
          for (let k = start; k <= i; k++) {
            if (series[k] > cl) hasPos = true;
            else hasNeg = true;
          }
          if (hasPos && hasNeg) {
            for (let k = start; k <= i; k++) addHit('r8', k, 'R8 (8-pt >1σ mix)');
          }
        }
      } else {
        start = i + 1;
      }
    }
  }

  const ruleHits = {};
  const all = new Set();
  Object.keys(hits).forEach((k) => {
    ruleHits[k] = Array.from(hits[k]).sort((a, b) => a - b);
    ruleHits[k].forEach((idx) => all.add(idx));
  });

  return {
    oocIndices: Array.from(all).sort((a, b) => a - b),
    ruleHits,
    pointRules,
  };
}

/**
 * Computes empirical Process Capability (Cp/Cpk within-subgroup via MR-bar/d2,
 * Pp/Ppk overall sample std dev, Taguchi Cpm), observed defects, histogram bins,
 * outlier masking, and I-MR / Nelson Rules 1–8 statistical control limits.
 */
export function computeEmpiricalCapability(rawSamples, lslInput, uslInput, distModel = 'auto', options = {}) {
  const allRaw = (Array.isArray(rawSamples) ? rawSamples : [])
    .map(Number)
    .filter((v) => Number.isFinite(v));

  if (allRaw.length < 2) {
    return null;
  }

  const maskedSet = new Set(Array.isArray(options.maskedIndices) ? options.maskedIndices : []);
  const activePairs = allRaw
    .map((v, idx) => ({ v, idx }))
    .filter(({ idx }) => !maskedSet.has(idx));
  const samples = activePairs.length >= 2 ? activePairs.map((p) => p.v) : allRaw;
  const activeOriginalIndices = activePairs.length >= 2 ? activePairs.map((p) => p.idx) : allRaw.map((_, i) => i);

  const n = samples.length;
  const sorted = [...samples].sort((a, b) => a - b);
  const median = empiricalQuantile(sorted, 0.5);
  const ad = computeAndersonDarling(samples);
  const mean = samples.reduce((a, b) => a + b, 0) / n;
  const variance = samples.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1);
  const overallSigma = Math.max(1e-9, Math.sqrt(variance));

  const movingRanges = [];
  for (let i = 1; i < n; i++) {
    movingRanges.push(Math.abs(samples[i] - samples[i - 1]));
  }
  const mrBar = movingRanges.reduce((a, b) => a + b, 0) / movingRanges.length;
  const d2 = 1.128; // Shewhart constant for n=2 moving range
  const withinSigma = mrBar > 0 ? mrBar / d2 : overallSigma;

  const lsl = Number.isFinite(Number(lslInput)) ? Number(lslInput) : mean - 3 * overallSigma;
  const usl = Number.isFinite(Number(uslInput)) ? Number(uslInput) : mean + 3 * overallSigma;
  const target = Number.isFinite(Number(options.target)) ? Number(options.target) : (lsl + usl) / 2;
  const specW = usl - lsl;
  const upperM = usl - mean;
  const lowerM = mean - lsl;

  // Potential / Within-subgroup capability (Normal)
  const cp = specW / (6 * withinSigma);
  const cpu = upperM / (3 * withinSigma);
  const cpl = lowerM / (3 * withinSigma);
  const cpk = Math.min(cpu, cpl);
  const cpm = specW / (6 * Math.sqrt(overallSigma ** 2 + (mean - target) ** 2));

  // Overall performance indices (Normal default)
  let pp = specW / (6 * overallSigma);
  let ppu = upperM / (3 * overallSigma);
  let ppl = lowerM / (3 * overallSigma);
  let ppk = Math.min(ppu, ppl);

  // Observed out-of-spec defects
  let oobLow = 0;
  let oobHigh = 0;
  for (const x of samples) {
    if (x < lsl) oobLow++;
    else if (x > usl) oobHigh++;
  }
  const oobCount = oobLow + oobHigh;
  const observedPPM = (oobCount / n) * 1e6;
  const observedYieldPct = ((n - oobCount) / n) * 100;

  // Expected tail defect rate
  const pLower = normalCDF((lsl - mean) / overallSigma);
  const pUpper = normalCDF((mean - usl) / overallSigma);
  let expectedPPM = (pLower + pUpper) * 1e6;
  let expectedYieldPct = Math.max(0, (1 - (pLower + pUpper)) * 100);
  const zMin = Math.min(upperM / overallSigma, lowerM / overallSigma);

  // Fit candidate distributions (Normal, Lognormal, Weibull, Log-Logistic)
  const fit = fitCandidateDistributions(sorted, mean, overallSigma, ad);
  const p00135 = empiricalQuantile(sorted, 0.00135);
  const p99865 = empiricalQuantile(sorted, 0.99865);

  const requestedModel = distModel || 'auto';
  let activeDistModel = requestedModel === 'auto' ? fit.bestKey : requestedModel;
  if (activeDistModel !== 'nonparametric' && !fit.candidates[activeDistModel]) {
    activeDistModel = 'normal';
  }

  if (activeDistModel !== 'normal' && activeDistModel !== 'nonparametric') {
    const c = fit.candidates[activeDistModel];
    pp = specW / Math.max(1e-9, c.qHigh - c.qLow);
    ppu = (usl - c.qMid) / Math.max(1e-9, c.qHigh - c.qMid);
    ppl = (c.qMid - lsl) / Math.max(1e-9, c.qMid - c.qLow);
    ppk = Math.min(ppu, ppl);
    const fLow = c.cdf(lsl);
    const fHigh = 1 - c.cdf(usl);
    expectedPPM = (fLow + fHigh) * 1e6;
    expectedYieldPct = Math.max(0, (1 - (fLow + fHigh)) * 100);
  } else if (activeDistModel === 'nonparametric') {
    pp = specW / Math.max(1e-9, p99865 - p00135);
    ppu = (usl - median) / Math.max(1e-9, p99865 - median);
    ppl = (median - lsl) / Math.max(1e-9, median - p00135);
    ppk = Math.min(ppu, ppl);
    expectedPPM = observedPPM;
    expectedYieldPct = observedYieldPct;
  }

  // Histogram bins
  let minVal = samples[0];
  let maxVal = samples[0];
  for (const x of samples) {
    if (x < minVal) minVal = x;
    if (x > maxVal) maxVal = x;
  }
  const dataSpan = maxVal - minVal;
  const safeSpan = dataSpan > 1e-9 ? dataSpan : overallSigma * 6;
  const binCount = Math.max(7, Math.min(20, Math.ceil(Math.sqrt(n))));
  const padMin = dataSpan > 1e-9 ? minVal : minVal - safeSpan / 2;
  const binWidth = safeSpan / binCount;

  const bins = Array.from({ length: binCount }, (_, idx) => {
    const x0 = padMin + idx * binWidth;
    const x1 = padMin + (idx + 1) * binWidth;
    const mid = (x0 + x1) / 2;
    return {
      x0,
      x1,
      mid,
      count: 0,
      density: 0,
      outOfSpec: mid < lsl || mid > usl,
    };
  });

  for (const x of samples) {
    let idx = Math.floor((x - padMin) / binWidth);
    if (idx < 0) idx = 0;
    if (idx >= binCount) idx = binCount - 1;
    bins[idx].count++;
  }
  bins.forEach((b) => {
    b.density = b.count / (n * binWidth);
  });

  // I-MR Control Chart & Nelson Rules 1–8
  const clI = mean;
  const uclI = mean + 2.66 * mrBar;
  const lclI = mean - 2.66 * mrBar;
  const clMR = mrBar;
  const uclMR = 3.267 * mrBar;

  const nelson = evaluateNelsonRules(samples, clI, withinSigma, options.nelsonRules || {});
  // Map active-index OOC back to original raw indices
  const mapIdx = (arr) => arr.map((k) => activeOriginalIndices[k]);
  const oocRule1 = mapIdx(nelson.ruleHits.r1);
  const oocRule2 = mapIdx(nelson.ruleHits.r2);
  const oocIndices = mapIdx(nelson.oocIndices);
  const oocOriginalSet = new Set(oocIndices);

  const imrPoints = allRaw.map((v, origIdx) => {
    const activePos = activeOriginalIndices.indexOf(origIdx);
    const rules = activePos >= 0 ? (nelson.pointRules.get(activePos) || []) : [];
    return {
      index: origIdx,
      value: v,
      masked: maskedSet.has(origIdx) && activePairs.length >= 2,
      ooc: oocOriginalSet.has(origIdx),
      rules,
    };
  });

  return {
    n,
    totalN: allRaw.length,
    maskedCount: allRaw.length - n,
    samples,
    allRaw,
    mean,
    median,
    overallSigma,
    withinSigma,
    mrBar,
    ad,
    requestedModel,
    distModel: activeDistModel,
    bestFitKey: fit.bestKey,
    fitRankings: fit.rankings.map((r) => ({ key: r.key, label: r.label, a2: r.a2 })),
    activeFit: fit.candidates[activeDistModel] || null,
    lognormal: fit.candidates.lognormal || null,
    quantiles: { p00135, p50: median, p99865 },
    lsl,
    usl,
    target,
    specW,
    upperM,
    lowerM,
    cp,
    cpu,
    cpl,
    cpk,
    cpm,
    pp,
    ppu,
    ppl,
    ppk,
    oobLow,
    oobHigh,
    oobCount,
    observedPPM,
    observedYieldPct,
    expectedPPM,
    expectedYieldPct,
    zMin,
    min: minVal,
    max: maxVal,
    binWidth,
    bins,
    imr: {
      clI,
      uclI,
      lclI,
      clMR,
      uclMR,
      movingRanges,
      oocRule1,
      oocRule2,
      oocIndices,
      ruleHits: Object.fromEntries(
        Object.entries(nelson.ruleHits).map(([k, arr]) => [k, mapIdx(arr)])
      ),
      points: imrPoints,
      isStable: oocIndices.length === 0,
    },
  };
}

// Shewhart constants for subgroup size n = 2..10
const SPC_CONSTANTS = {
  2: { A2: 1.880, D3: 0, D4: 3.267, A3: 2.659, B3: 0, B4: 3.267, d2: 1.128, c4: 0.7979 },
  3: { A2: 1.023, D3: 0, D4: 2.574, A3: 1.954, B3: 0, B4: 2.568, d2: 1.693, c4: 0.8862 },
  4: { A2: 0.729, D3: 0, D4: 2.282, A3: 1.628, B3: 0, B4: 2.266, d2: 2.059, c4: 0.9213 },
  5: { A2: 0.577, D3: 0, D4: 2.114, A3: 1.427, B3: 0, B4: 2.089, d2: 2.326, c4: 0.9400 },
  6: { A2: 0.483, D3: 0, D4: 2.004, A3: 1.287, B3: 0.030, B4: 1.970, d2: 2.534, c4: 0.9515 },
  7: { A2: 0.419, D3: 0.076, D4: 1.924, A3: 1.182, B3: 0.118, B4: 1.882, d2: 2.704, c4: 0.9594 },
  8: { A2: 0.373, D3: 0.136, D4: 1.864, A3: 1.099, B3: 0.185, B4: 1.815, d2: 2.847, c4: 0.9650 },
  9: { A2: 0.337, D3: 0.184, D4: 1.816, A3: 1.032, B3: 0.239, B4: 1.761, d2: 2.970, c4: 0.9693 },
  10: { A2: 0.308, D3: 0.223, D4: 1.777, A3: 0.975, B3: 0.284, B4: 1.716, d2: 3.078, c4: 0.9727 },
};

/**
 * Computes subgrouped Xbar-R and Xbar-S control chart limits and Nelson rule flags.
 */
export function computeSubgroupSPC(rawSamples, subgroupSize = 4, nelsonRules = {}) {
  const n = Math.max(2, Math.min(10, Math.round(Number(subgroupSize) || 4)));
  const clean = (Array.isArray(rawSamples) ? rawSamples : []).map(Number).filter(Number.isFinite);
  const subgroups = [];
  for (let i = 0; i + n <= clean.length; i += n) {
    const grp = clean.slice(i, i + n);
    const mean = grp.reduce((s, v) => s + v, 0) / n;
    const range = Math.max(...grp) - Math.min(...grp);
    const sd = Math.sqrt(grp.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1));
    subgroups.push({ index: subgroups.length, values: grp, mean, range, sd });
  }
  if (subgroups.length < 2) return null;

  const c = SPC_CONSTANTS[n];
  const xDoubleBar = subgroups.reduce((s, g) => s + g.mean, 0) / subgroups.length;
  const rBar = subgroups.reduce((s, g) => s + g.range, 0) / subgroups.length;
  const sBar = subgroups.reduce((s, g) => s + g.sd, 0) / subgroups.length;

  const uclXbarR = xDoubleBar + c.A2 * rBar;
  const lclXbarR = xDoubleBar - c.A2 * rBar;
  const uclR = c.D4 * rBar;
  const lclR = c.D3 * rBar;

  const uclXbarS = xDoubleBar + c.A3 * sBar;
  const lclXbarS = xDoubleBar - c.A3 * sBar;
  const uclS = c.B4 * sBar;
  const lclS = c.B3 * sBar;

  const withinSigmaR = rBar / c.d2;
  const withinSigmaS = sBar / c.c4;
  const nelson = evaluateNelsonRules(
    subgroups.map((g) => g.mean),
    xDoubleBar,
    withinSigmaR / Math.sqrt(n),
    nelsonRules
  );

  return {
    n,
    subgroups,
    xDoubleBar,
    rBar,
    sBar,
    uclXbarR,
    lclXbarR,
    uclR,
    lclR,
    uclXbarS,
    lclXbarS,
    uclS,
    lclS,
    withinSigmaR,
    withinSigmaS,
    oocIndices: nelson.oocIndices,
    pointRules: nelson.pointRules,
    isStable: nelson.oocIndices.length === 0,
  };
}

/**
 * Computes Attribute Control Chart (p-chart for proportion defective, u-chart for defects/unit)
 * with variable-width control limits per subgroup.
 */
export function computeAttributeChart(subgroups, type = 'p') {
  const list = (Array.isArray(subgroups) ? subgroups : [])
    .map((g, idx) => ({
      label: g.label || `Lot ${idx + 1}`,
      defects: Math.max(0, Number(g.defects) || 0),
      size: Math.max(1, Number(g.size) || 1),
    }));
  if (list.length < 2) return null;

  const totalDefects = list.reduce((s, g) => s + g.defects, 0);
  const totalUnits = list.reduce((s, g) => s + g.size, 0);
  const cl = totalDefects / Math.max(1, totalUnits);

  const points = list.map((g, idx) => {
    const val = g.defects / g.size;
    const sigmaI =
      type === 'u'
        ? Math.sqrt(Math.max(1e-9, cl / g.size))
        : Math.sqrt(Math.max(1e-9, (cl * (1 - cl)) / g.size));
    const ucl = type === 'p' ? Math.min(1, cl + 3 * sigmaI) : cl + 3 * sigmaI;
    const lcl = Math.max(0, cl - 3 * sigmaI);
    const ooc = val > ucl || val < lcl;
    return { index: idx, ...g, val, ucl, lcl, ooc };
  });

  const oocIndices = points.filter((p) => p.ooc).map((p) => p.index);
  return {
    type,
    cl,
    totalDefects,
    totalUnits,
    points,
    oocIndices,
    isStable: oocIndices.length === 0,
  };
}

/**
 * Deterministic 10,000-trial Monte Carlo Tolerance Stack-Up Simulator (Mulberry32 PRNG).
 * Linear assembly model: Y = sum(component.sign * X_i).
 */
export function runMonteCarloStackup({ components = [], lsl = 30, usl = 70, trials = 10000 } = {}) {
  const active = (Array.isArray(components) ? components : []).filter(
    (c) => Number.isFinite(Number(c.mean)) && Number.isFinite(Number(c.sigma))
  );
  if (active.length === 0) return null;

  const safeTrials = Math.max(500, Math.min(50000, Math.round(Number(trials) || 10000)));
  let seed = 0x516A7 ^ (active.length * 997);
  const rand = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const randNorm = () => {
    const u1 = Math.max(1e-12, rand());
    const u2 = rand();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };

  const results = new Float64Array(safeTrials);
  let sum = 0;
  let oos = 0;

  for (let t = 0; t < safeTrials; t++) {
    let y = 0;
    for (let i = 0; i < active.length; i++) {
      const c = active[i];
      const sign = Number(c.sign) < 0 ? -1 : 1;
      const mu = Number(c.mean);
      const sig = Math.max(0, Number(c.sigma));
      let x = mu;
      if (c.dist === 'uniform') {
        const half = sig * Math.sqrt(3);
        x = mu + (rand() * 2 - 1) * half;
      } else if (c.dist === 'triangular') {
        const half = sig * Math.sqrt(6);
        const u = rand();
        x = mu + (u < 0.5 ? Math.sqrt(2 * u) - 1 : 1 - Math.sqrt(2 * (1 - u))) * half;
      } else {
        x = mu + randNorm() * sig;
      }
      y += sign * x;
    }
    results[t] = y;
    sum += y;
    if (y < lsl || y > usl) oos++;
  }

  const mean = sum / safeTrials;
  let sq = 0;
  let min = results[0];
  let max = results[0];
  for (let t = 0; t < safeTrials; t++) {
    const v = results[t];
    sq += (v - mean) ** 2;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const sigma = Math.max(1e-9, Math.sqrt(sq / (safeTrials - 1)));
  const cp = (usl - lsl) / (6 * sigma);
  const cpk = Math.min((usl - mean) / (3 * sigma), (mean - lsl) / (3 * sigma));
  const ppm = (oos / safeTrials) * 1e6;

  // Variance sensitivity contribution %
  const totalVar = Math.max(1e-12, active.reduce((s, c) => s + Number(c.sigma) ** 2, 0));
  const sensitivity = active
    .map((c) => ({
      name: c.name,
      pct: ((Number(c.sigma) ** 2) / totalVar) * 100,
    }))
    .sort((a, b) => b.pct - a.pct);

  // 16-bin histogram
  const binCount = 16;
  const span = Math.max(1e-6, max - min);
  const bw = span / binCount;
  const bins = Array.from({ length: binCount }, (_, idx) => {
    const x0 = min + idx * bw;
    const x1 = x0 + bw;
    const mid = (x0 + x1) / 2;
    return { x0, x1, mid, count: 0, outOfSpec: mid < lsl || mid > usl };
  });
  for (let t = 0; t < safeTrials; t++) {
    let idx = Math.floor((results[t] - min) / bw);
    if (idx < 0) idx = 0;
    if (idx >= binCount) idx = binCount - 1;
    bins[idx].count++;
  }

  return {
    trials: safeTrials,
    mean,
    sigma,
    lsl,
    usl,
    cp,
    cpk,
    oos,
    ppm,
    min,
    max,
    bins,
    sensitivity,
  };
}

