import { computeEmpiricalCapability, computeParametricCapability } from '../modules/capabilityMath.js';
import { computeShiftLogOEE, computeSingleOEE } from '../modules/oeeMath.js';
import { computeTaktMetrics } from '../modules/taktMath.js';
import { aggregateParetoEvents, computeParetoSorted } from '../modules/paretoMath.js';
import { computeVSMMetrics, identifyVSMBottleneck } from '../modules/vsmMath.js';
import { compute5SMetrics } from '../modules/fivesMath.js';
import { computeGageRR } from '../modules/msaMath.js';
import { computeABComparison } from '../modules/comparatorMath.js';
import { computeFMEAMetrics } from '../modules/fmeaMath.js';

/**
 * Computes actionable engineering insights per module (centering gains, OEE loss levers,
 * Takt waste headroom, VSM queue impact, MSA AIAG verdict, and FMEA top risk).
 */
export function computeModuleInsights(state) {
  const insights = {};

  // 1. Capability
  const cap = state.capability;
  if (cap.mode === 'data' && Array.isArray(cap.samples) && cap.samples.length >= 2) {
    const m = computeEmpiricalCapability(cap.samples, cap.lsl, cap.usl, cap.distModel, {
      target: cap.target,
      subgroupSize: cap.subgroupSize,
      maskedIndices: cap.maskedIndices,
      nelsonRules: cap.nelsonRules,
    });
    if (m) {
      const msgs = [];
      if (m.cp - m.cpk > 0.15) {
        const target = Number.isFinite(cap.target) ? cap.target : (m.lsl + m.usl) / 2;
        const centered = computeParametricCapability({ mu: target, sigma: m.withinSigma, lsl: m.lsl, usl: m.usl });
        const ppmGain = Math.max(0, m.expectedPPM - centered.ppm);
        const shift = target - m.mean;
        msgs.push(
          `Off-center: Cp=${m.cp.toFixed(2)} vs Cpk=${m.cpk.toFixed(2)}. Shifting mean by ${shift >= 0 ? '+' : ''}${shift.toFixed(3)} toward ${target.toFixed(2)} recovers ~${Math.round(ppmGain).toLocaleString('en-US')} PPM.`
        );
      } else if (m.cpk >= 1.33) {
        msgs.push(`Capable & centered (Cpk=${m.cpk.toFixed(2)}).`);
      } else {
        msgs.push(`Excess variation (Cp=${m.cp.toFixed(2)} < 1.33): reduce within-subgroup σ̂ (${m.withinSigma.toFixed(3)}).`);
      }
      if (!m.imr.isStable) {
        msgs.push(`${m.imr.oocIndices.length} special-cause point(s) flagged — click points on the control chart to mask assignable causes.`);
      }
      if (m.ppk < m.cpk * 0.85) {
        msgs.push(`Between-subgroup drift: Ppk (${m.ppk.toFixed(2)}) lags Cpk (${m.cpk.toFixed(2)}) by ${((1 - m.ppk / m.cpk) * 100).toFixed(0)}%.`);
      }
      insights.capability = msgs;
    }
  } else {
    const m = computeParametricCapability(cap);
    insights.capability = [
      m.cp - m.cpk > 0.15
        ? `Centering opportunity: shifting μ by ${(((m.lsl + m.usl) / 2) - m.mu).toFixed(2)} raises Cpk from ${m.cpk.toFixed(2)} to ${m.cp.toFixed(2)}.`
        : `Simulated process at ${m.zMin.toFixed(2)}σ (${Math.round(m.ppm).toLocaleString('en-US')} PPM).`,
    ];
  }

  // 2. OEE
  const oeeState = state.oee;
  const isLog = oeeState.mode === 'log' && Array.isArray(oeeState.logs) && oeeState.logs.length > 0;
  const oee = isLog ? computeShiftLogOEE(oeeState.logs, oeeState.filterLine) : computeSingleOEE(oeeState);
  const losses = [
    { key: 'Availability (Downtime)', min: oee.availLoss },
    { key: 'Performance (Speed/Minor Stops)', min: oee.perfLoss },
    { key: 'Quality (Scrap/Rework)', min: oee.qualLoss },
  ].sort((a, b) => b.min - a.min);
  const topLoss = losses[0];
  insights.oee = [
    oee.oee >= 0.85
      ? `World-Class OEE (${(oee.oee * 100).toFixed(1)}%). Primary remaining loss: ${topLoss.key} (${topLoss.min.toFixed(0)}m).`
      : `Gap to 85% World Class: ${(85 - oee.oee * 100).toFixed(1)} pts. #1 lever is ${topLoss.key} (${topLoss.min.toFixed(0)}m lost).`,
  ];

  // 3. Takt
  const takt = computeTaktMetrics(state.takt);
  const overStations = (state.takt.stations || []).filter((s) => (s.va || 0) + (s.bnva || 0) + (s.waste || 0) > takt.takt);
  const totalWaste = (state.takt.stations || []).reduce((acc, s) => acc + (s.waste || 0), 0);
  insights.takt = [
    overStations.length > 0
      ? `${overStations.length} station(s) exceed Takt (${takt.takt.toFixed(1)}s). Eliminating ${totalWaste.toFixed(0)}s of Waste can rebalance without extra headcount.`
      : `All stations balanced under ${takt.takt.toFixed(1)}s Takt (${takt.eff.toFixed(1)}% line efficiency).`,
  ];

  // 4. Pareto
  const parItems =
    state.pareto.mode === 'events'
      ? aggregateParetoEvents(state.pareto.events, { metric: state.pareto.metric, filterValue: state.pareto.filterValue })
      : state.pareto.items;
  const par = computeParetoSorted(parItems, state.pareto.cutoffPct ?? 80);
  insights.pareto = [
    par.rows.length > 0
      ? `${par.vitalCount} of ${par.rows.length} categories drive ${state.pareto.cutoffPct ?? 80}% of total impact; #1 "${par.rows[0].name}" accounts for ${par.rows[0].share.toFixed(1)}%.`
      : 'No Pareto events logged.',
  ];

  // 5. VSM
  const vsm = computeVSMMetrics(state.vsm.steps);
  const vsmBottle = identifyVSMBottleneck(state.vsm.steps);
  const maxQueueStep = [...(state.vsm.steps || [])].sort((a, b) => (b.queue || 0) - (a.queue || 0))[0];
  insights.vsm = [
    maxQueueStep && maxQueueStep.queue > 0
      ? `PCE is ${vsm.pce.toFixed(2)}%. Halving the ${maxQueueStep.queue}h queue before "${maxQueueStep.name}" cuts total Lead Time by ${((maxQueueStep.queue / 2 / Math.max(0.01, vsm.totalLeadHrs)) * 100).toFixed(1)}%.`
      : `Value-Added Time: ${vsm.totalVASec.toFixed(0)}s across ${vsm.count} steps (Cycle bottleneck: ${vsmBottle?.name || '-'}).`,
  ];

  // 6. 5S
  const f5 = compute5SMetrics(state.fives);
  insights.fives = [
    `5S Score ${f5.overallPct.toFixed(1)}% (${f5.overallMean.toFixed(2)} vs ${f5.target.toFixed(2)} target). Focus on "${f5.lowest.name}" (${f5.lowest.avg.toFixed(2)}) & ${f5.openActions} open action(s).`,
  ];

  // 7. MSA
  const msa = computeGageRR(state.msa);
  if (msa) {
    insights.msa = [
      `AIAG Verdict: ${msa.verdict} (%GRR=${msa.pctGRRStudy.toFixed(1)}%, ndc=${msa.ndc}). Dominant error: ${msa.ev >= msa.av ? 'Repeatability (Equipment)' : 'Reproducibility (Operator)'}.`,
    ];
  }

  // 8. Comparator
  const cmp = computeABComparison(state.comparator);
  if (cmp) {
    insights.comparator = [
      `${cmp.significant ? 'Statistically significant shift' : 'No significant mean shift'} (Welch p=${cmp.pValue < 0.0001 ? '<0.0001' : cmp.pValue.toFixed(4)}, Δμ=${cmp.meanDiff >= 0 ? '+' : ''}${cmp.meanDiff.toFixed(3)}).`,
    ];
  }

  // 9. FMEA
  const fmea = computeFMEAMetrics(state.fmea);
  insights.fmea = [
    fmea.topRow
      ? `Max RPN ${fmea.maxRPN} ("${fmea.topRow.mode}"). ${fmea.criticalCount} Critical (≥200) & ${fmea.openCount} open action(s).`
      : 'No failure modes logged.',
  ];

  return insights;
}

/**
 * Returns live status tiles for the top-level Plant / Cell Health Cockpit HUD.
 */
export function computeCockpitHealth(state) {
  const cap = state.capability;
  const capEmp =
    cap.mode === 'data' && Array.isArray(cap.samples) && cap.samples.length >= 2
      ? computeEmpiricalCapability(cap.samples, cap.lsl, cap.usl, cap.distModel, {
          target: cap.target,
          subgroupSize: cap.subgroupSize,
          maskedIndices: cap.maskedIndices,
          nelsonRules: cap.nelsonRules,
        })
      : null;
  const capVal = capEmp ? capEmp.cpk : computeParametricCapability(cap).cpk;

  const oeeState = state.oee;
  const oee =
    oeeState.mode === 'log' && Array.isArray(oeeState.logs) && oeeState.logs.length > 0
      ? computeShiftLogOEE(oeeState.logs, oeeState.filterLine)
      : computeSingleOEE(oeeState);
  const oeePct = oee.oee * 100;

  const takt = computeTaktMetrics(state.takt);
  const taktGap = takt.bottleneck.total - takt.takt;

  const vsm = computeVSMMetrics(state.vsm.steps);
  const f5 = compute5SMetrics(state.fives);
  const msa = computeGageRR(state.msa);
  const fmea = computeFMEAMetrics(state.fmea);

  return [
    {
      tab: 'capability',
      label: 'Cpk',
      value: capVal.toFixed(2),
      status: capVal >= 1.33 ? 'ok' : capVal >= 1.0 ? 'warn' : 'bad',
    },
    {
      tab: 'oee',
      label: 'OEE',
      value: `${oeePct.toFixed(1)}%`,
      status: oeePct >= 85 ? 'ok' : oeePct >= 65 ? 'warn' : 'bad',
    },
    {
      tab: 'takt',
      label: 'Takt Gap',
      value: `${taktGap >= 0 ? '+' : ''}${taktGap.toFixed(1)}s`,
      status: taktGap <= 0 ? 'ok' : taktGap <= 10 ? 'warn' : 'bad',
    },
    {
      tab: 'vsm',
      label: 'VSM PCE',
      value: `${vsm.pce.toFixed(2)}%`,
      status: vsm.pce >= 5 ? 'ok' : vsm.pce >= 1 ? 'warn' : 'bad',
    },
    {
      tab: 'fives',
      label: '5S Score',
      value: `${f5.overallPct.toFixed(0)}%`,
      status: f5.overallMean >= f5.target ? 'ok' : f5.overallMean >= f5.target - 0.5 ? 'warn' : 'bad',
    },
    {
      tab: 'msa',
      label: 'Gage R&R',
      value: msa ? `${msa.pctGRRStudy.toFixed(1)}%` : 'N/A',
      status: !msa ? 'warn' : msa.pctGRRStudy < 10 ? 'ok' : msa.pctGRRStudy <= 30 ? 'warn' : 'bad',
    },
    {
      tab: 'fmea',
      label: 'Max RPN',
      value: String(fmea.maxRPN),
      status: fmea.maxRPN < 100 ? 'ok' : fmea.maxRPN < 200 ? 'warn' : 'bad',
    },
  ];
}
