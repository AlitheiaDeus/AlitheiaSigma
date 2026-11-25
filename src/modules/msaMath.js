// Pure Gage R&R (Measurement System Analysis) Engine: Crossed ANOVA & Xbar-R Range Method

const D2_TABLE = {
  2: 1.128, 3: 1.693, 4: 2.059, 5: 2.326, 6: 2.534,
  7: 2.704, 8: 2.847, 9: 2.970, 10: 3.078,
};

const D4_TABLE = {
  2: 3.267, 3: 2.574, 4: 2.282, 5: 2.114, 6: 2.004,
  7: 1.924, 8: 1.864, 9: 1.816, 10: 1.777,
};

function d2Star(g, m) {
  // Effective d2* approximation for small g, m (AIAG MSA 4th Ed)
  if (m <= 1) return 1.128;
  const base = D2_TABLE[Math.min(10, Math.max(2, m))] || 1.128;
  if (g === 1 && m === 2) return 1.41;
  if (g === 1 && m === 3) return 1.91;
  if (g === 1 && m === 4) return 2.24;
  if (g === 1 && m === 5) return 2.48;
  return base;
}

/**
 * Computes Crossed Gage R&R (ANOVA or Range method) from operators × parts × trials readings.
 * readings is a flat array of length (a * b) where each item is an array of r numeric trial values.
 */
export function computeGageRR(msaState) {
  if (!msaState || !Array.isArray(msaState.operators) || !Array.isArray(msaState.parts)) return null;
  const a = msaState.operators.length;
  const b = msaState.parts.length;
  const r = Math.max(2, Number(msaState.trials) || 2);
  const readings = Array.isArray(msaState.readings) ? msaState.readings : [];
  if (a < 2 || b < 2 || readings.length < a * b) return null;

  // Build 3D matrix y[i][j][k]
  const y = [];
  const flat = [];
  for (let i = 0; i < a; i++) {
    y[i] = [];
    for (let j = 0; j < b; j++) {
      const cell = readings[i * b + j] || [];
      y[i][j] = [];
      for (let k = 0; k < r; k++) {
        const val = Number(cell[k]);
        if (!Number.isFinite(val)) return null;
        y[i][j].push(val);
        flat.push(val);
      }
    }
  }

  const N = a * b * r;
  const grandMean = flat.reduce((s, v) => s + v, 0) / N;

  const opMeans = [];
  const partMeans = Array(b).fill(0);
  const cellMeans = [];
  const cellRanges = [];

  for (let i = 0; i < a; i++) {
    let opSum = 0;
    cellMeans[i] = [];
    for (let j = 0; j < b; j++) {
      const vals = y[i][j];
      const cm = vals.reduce((s, v) => s + v, 0) / r;
      cellMeans[i][j] = cm;
      opSum += cm;
      partMeans[j] += cm / a;
      cellRanges.push(Math.max(...vals) - Math.min(...vals));
    }
    opMeans.push(opSum / b);
  }

  // Sums of Squares (Two-Way Random Effects ANOVA)
  let ssOp = 0;
  for (let i = 0; i < a; i++) ssOp += b * r * (opMeans[i] - grandMean) ** 2;

  let ssPart = 0;
  for (let j = 0; j < b; j++) ssPart += a * r * (partMeans[j] - grandMean) ** 2;

  let ssRepeat = 0;
  let ssInter = 0;
  for (let i = 0; i < a; i++) {
    for (let j = 0; j < b; j++) {
      ssInter += r * (cellMeans[i][j] - opMeans[i] - partMeans[j] + grandMean) ** 2;
      for (let k = 0; k < r; k++) {
        ssRepeat += (y[i][j][k] - cellMeans[i][j]) ** 2;
      }
    }
  }

  const dfOp = a - 1;
  const dfPart = b - 1;
  const dfInter = (a - 1) * (b - 1);
  const dfRepeat = a * b * (r - 1);

  const msOp = ssOp / Math.max(1, dfOp);
  const msPart = ssPart / Math.max(1, dfPart);
  const msInter = ssInter / Math.max(1, dfInter);
  const msRepeat = ssRepeat / Math.max(1, dfRepeat);

  const method = msaState.method === 'range' ? 'range' : 'anova';
  let varRepeat = msRepeat;
  let varOp = Math.max(0, (msOp - msInter) / (b * r));
  let varInter = Math.max(0, (msInter - msRepeat) / r);
  let varPart = Math.max(0, (msPart - msInter) / (a * r));

  // If interaction MS <= repeatability MS, pool interaction in ANOVA
  const interRatio = msRepeat > 0 ? msInter / msRepeat : 1;
  if (interRatio < 1.25) {
    const msPooled = (ssInter + ssRepeat) / Math.max(1, dfInter + dfRepeat);
    varInter = 0;
    varRepeat = msPooled;
    varOp = Math.max(0, (msOp - msPooled) / (b * r));
    varPart = Math.max(0, (msPart - msPooled) / (a * r));
  }

  const rDoubleBar = cellRanges.reduce((s, v) => s + v, 0) / cellRanges.length;
  const uclR = (D4_TABLE[Math.min(10, r)] || 3.267) * rDoubleBar;

  let ev, av, interStd, pv;
  if (method === 'range') {
    const k1 = 1 / d2Star(a * b, r);
    const k2 = 1 / d2Star(1, a);
    const k3 = 1 / d2Star(1, b);
    const xDiff = Math.max(...opMeans) - Math.min(...opMeans);
    const rp = Math.max(...partMeans) - Math.min(...partMeans);
    ev = rDoubleBar * k1;
    av = Math.sqrt(Math.max(0, (xDiff * k2) ** 2 - (ev ** 2) / (b * r)));
    interStd = 0;
    pv = rp * k3;
  } else {
    ev = Math.sqrt(Math.max(0, varRepeat));
    av = Math.sqrt(Math.max(0, varOp));
    interStd = Math.sqrt(Math.max(0, varInter));
    pv = Math.sqrt(Math.max(0, varPart));
  }

  const grr = Math.sqrt(ev ** 2 + av ** 2 + interStd ** 2);
  const tv = Math.max(1e-9, Math.sqrt(grr ** 2 + pv ** 2));

  const pctGRRStudy = (grr / tv) * 100;
  const pctEVStudy = (ev / tv) * 100;
  const pctAVStudy = (Math.sqrt(av ** 2 + interStd ** 2) / tv) * 100;
  const pctPVStudy = (pv / tv) * 100;

  const tol = Math.max(1e-9, Number(msaState.tolerance) || 1);
  const pctGRRTol = ((6 * grr) / tol) * 100;
  const ndc = grr > 1e-9 ? Math.max(1, Math.floor(1.41 * (pv / grr))) : 10;

  const verdict =
    pctGRRStudy < 10 ? 'Acceptable' : pctGRRStudy <= 30 ? 'Marginal' : 'Unacceptable';

  return {
    method,
    a,
    b,
    r,
    grandMean,
    opMeans,
    partMeans,
    cellMeans,
    rDoubleBar,
    uclR,
    ev,
    av,
    interStd,
    grr,
    pv,
    tv,
    pctGRRStudy,
    pctEVStudy,
    pctAVStudy,
    pctPVStudy,
    pctGRRTol,
    ndc,
    verdict,
    anova: { ssOp, ssPart, ssInter, ssRepeat, msOp, msPart, msInter, msRepeat },
  };
}
