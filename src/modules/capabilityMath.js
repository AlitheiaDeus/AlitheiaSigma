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
 * Computes empirical Process Capability (Cp/Cpk within-subgroup via MR-bar/d2,
 * Pp/Ppk overall sample std dev), observed defects, histogram bins, and I-MR
 * statistical control limits + Western Electric Run Rules 1 & 2.
 */
export function computeEmpiricalCapability(rawSamples, lslInput, uslInput) {
  const samples = (Array.isArray(rawSamples) ? rawSamples : [])
    .map(Number)
    .filter((v) => Number.isFinite(v));

  if (samples.length < 2) {
    return null;
  }

  const n = samples.length;
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
  const specW = usl - lsl;
  const upperM = usl - mean;
  const lowerM = mean - lsl;

  // Potential / Within-subgroup capability
  const cp = specW / (6 * withinSigma);
  const cpu = upperM / (3 * withinSigma);
  const cpl = lowerM / (3 * withinSigma);
  const cpk = Math.min(cpu, cpl);

  // Overall performance indices
  const pp = specW / (6 * overallSigma);
  const ppu = upperM / (3 * overallSigma);
  const ppl = lowerM / (3 * overallSigma);
  const ppk = Math.min(ppu, ppl);

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

  // Expected normal tail defect rate using overall sigma
  const pLower = normalCDF((lsl - mean) / overallSigma);
  const pUpper = normalCDF((mean - usl) / overallSigma);
  const expectedPPM = (pLower + pUpper) * 1e6;
  const expectedYieldPct = Math.max(0, (1 - (pLower + pUpper)) * 100);
  const zMin = Math.min(upperM / overallSigma, lowerM / overallSigma);

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

  // I-MR Control Chart & Western Electric Run Rules
  const clI = mean;
  const uclI = mean + 2.66 * mrBar;
  const lclI = mean - 2.66 * mrBar;
  const clMR = mrBar;
  const uclMR = 3.267 * mrBar;

  const oocRule1 = [];
  const oocRule2Set = new Set();
  let runSide = 0;
  let runStart = 0;

  for (let i = 0; i < n; i++) {
    const x = samples[i];
    if (x > uclI || x < lclI) {
      oocRule1.push(i);
    }
    const side = x > clI ? 1 : x < clI ? -1 : 0;
    if (side === 0 || side !== runSide) {
      runSide = side;
      runStart = i;
    } else if (i - runStart + 1 >= 8) {
      for (let k = runStart; k <= i; k++) oocRule2Set.add(k);
    }
  }

  const oocRule2 = Array.from(oocRule2Set).sort((a, b) => a - b);
  const oocIndices = Array.from(new Set([...oocRule1, ...oocRule2])).sort((a, b) => a - b);

  return {
    n,
    samples,
    mean,
    overallSigma,
    withinSigma,
    mrBar,
    lsl,
    usl,
    specW,
    upperM,
    lowerM,
    cp,
    cpu,
    cpl,
    cpk,
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
      isStable: oocIndices.length === 0,
    },
  };
}
