import { PALETTE } from '../constants.js';
import { getState, persistState, setModuleSource } from '../state.js';
import { renderAllSourceBadges } from '../ui/sourceBadge.js';
import { bindSvgHoverTargets } from '../ui/svgTooltip.js';
import { showToast } from '../ui/toast.js';
import { escapeHtml } from '../utils.js';
import { computeGageRR } from './msaMath.js';

function renderMSACharts(m, msaState) {
  const svg = document.getElementById('svg-msa');
  if (!svg) return;
  if (!m) {
    svg.innerHTML = `<rect x="0" y="0" width="960" height="360" fill="${PALETTE.canvas}" /><text x="480" y="180" text-anchor="middle" fill="${PALETTE.teal}" font-family="ui-monospace, monospace" font-size="13">Need at least 2 operators × 2 parts × 2 trials</text>`;
    return;
  }

  let html = `<rect x="0" y="0" width="960" height="360" fill="${PALETTE.canvas}" />`;

  // Left Half: Variance Components (% Study Var vs 10% / 30% AIAG Thresholds)
  const lx = 64;
  const rx = 440;
  const top = 46;
  const bot = 304;
  const plotH = bot - top;
  const maxPct = Math.max(40, m.pctGRRStudy * 1.15, m.pctPVStudy * 1.1, m.pctGRRTol * 1.1);
  const yPct = (p) => bot - (Math.min(maxPct, p) / maxPct) * plotH;

  html += `<text x="${lx}" y="24" fill="${PALETTE.rose}" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="700">VARIANCE COMPONENTS (% STUDY VAR)</text>`;
  for (let p = 0; p <= maxPct; p += 20) {
    const y = yPct(p);
    html += `<line x1="${lx}" y1="${y.toFixed(1)}" x2="${rx}" y2="${y.toFixed(1)}" stroke="${PALETTE.border}" stroke-width="1" />`;
    html += `<text x="${lx - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="${PALETTE.icemint}" font-family="ui-monospace, monospace" font-size="10">${p}%</text>`;
  }

  [
    { v: 10, lbl: '10% AIAG OK', col: PALETTE.emerald },
    { v: 30, lbl: '30% MAX', col: PALETTE.crimson },
  ].forEach((t) => {
    if (t.v <= maxPct) {
      const y = yPct(t.v);
      html += `<line x1="${lx}" y1="${y.toFixed(1)}" x2="${rx}" y2="${y.toFixed(1)}" stroke="${t.col}" stroke-width="1.6" stroke-dasharray="5 4" />`;
      html += `<text x="${rx}" y="${(y - 4).toFixed(1)}" text-anchor="end" fill="${t.col}" font-family="ui-monospace, monospace" font-size="9.5" font-weight="700">${t.lbl}</text>`;
    }
  });
  html += `<line x1="${lx}" y1="${bot}" x2="${rx}" y2="${bot}" stroke="${PALETTE.icemint}" stroke-width="1.8" />`;

  const bars = [
    { lbl: 'Gage R&R', val: m.pctGRRStudy, col: m.pctGRRStudy < 10 ? PALETTE.emerald : m.pctGRRStudy <= 30 ? PALETTE.copper : PALETTE.crimson },
    { lbl: 'Repeat (EV)', val: m.pctEVStudy, col: PALETTE.teal },
    { lbl: 'Reprod (AV)', val: m.pctAVStudy, col: PALETTE.magenta },
    { lbl: 'Part (PV)', val: m.pctPVStudy, col: PALETTE.indigo },
    { lbl: '%Tol GRR', val: m.pctGRRTol, col: PALETTE.rose },
  ];
  const slotW = (rx - lx) / bars.length;
  const bw = Math.min(52, slotW * 0.62);
  bars.forEach((b, idx) => {
    const cx = lx + slotW * idx + slotW / 2;
    const bx = cx - bw / 2;
    const yTop = yPct(b.val);
    const h = Math.max(2, bot - yTop);
    html += `<rect class="msa-bar" data-lbl="${b.lbl}" data-val="${b.val.toFixed(2)}" x="${bx.toFixed(1)}" y="${yTop.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="${b.col}" rx="2" />`;
    html += `<text x="${cx.toFixed(1)}" y="${(yTop - 6).toFixed(1)}" text-anchor="middle" fill="${PALETTE.icemint}" font-family="ui-monospace, monospace" font-size="10.5" font-weight="700">${b.val.toFixed(1)}%</text>`;
    html += `<text x="${cx.toFixed(1)}" y="${bot + 18}" text-anchor="middle" fill="${PALETTE.rose}" font-family="Inter, system-ui, sans-serif" font-size="10.5" font-weight="700">${b.lbl}</text>`;
  });

  // Right Half: Operator × Part Interaction Plot
  const rl = 510;
  const rr = 930;
  const rw = rr - rl;
  const allMeans = m.cellMeans.flat();
  const minM = Math.min(...allMeans);
  const maxM = Math.max(...allMeans);
  const pad = Math.max(1e-6, (maxM - minM) * 0.16);
  const yVal = (v) => bot - ((v - (minM - pad)) / (maxM - minM + 2 * pad)) * plotH;
  const xPart = (j) => rl + (m.b === 1 ? rw / 2 : (j / (m.b - 1)) * rw);

  html += `<text x="${rl}" y="24" fill="${PALETTE.rose}" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="700">OPERATOR × PART INTERACTION</text>`;
  html += `<line x1="${rl}" y1="${bot}" x2="${rr}" y2="${bot}" stroke="${PALETTE.icemint}" stroke-width="1.8" />`;

  const opColors = [PALETTE.emerald, PALETTE.magenta, PALETTE.copper, PALETTE.teal, PALETTE.crimson];
  for (let i = 0; i < m.a; i++) {
    const col = opColors[i % opColors.length];
    const pts = [];
    for (let j = 0; j < m.b; j++) {
      pts.push(`${xPart(j).toFixed(1)},${yVal(m.cellMeans[i][j]).toFixed(1)}`);
    }
    html += `<polyline points="${pts.join(' ')}" fill="none" stroke="${col}" stroke-width="2.2" />`;
    for (let j = 0; j < m.b; j++) {
      const cx = xPart(j);
      const cy = yVal(m.cellMeans[i][j]);
      html += `<circle class="msa-pt" data-op="${escapeHtml(msaState.operators[i])}" data-part="${escapeHtml(msaState.parts[j])}" data-mean="${m.cellMeans[i][j].toFixed(3)}" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4.5" fill="${PALETTE.canvas}" stroke="${col}" stroke-width="2" />`;
    }
    // Legend pill
    const lxLeg = rl + i * 84;
    html += `<circle cx="${lxLeg + 6}" cy="342" r="4" fill="${col}" />`;
    html += `<text x="${lxLeg + 14}" y="346" fill="${PALETTE.icemint}" font-family="ui-monospace, monospace" font-size="10">${escapeHtml(msaState.operators[i])}</text>`;
  }

  for (let j = 0; j < m.b; j++) {
    html += `<text x="${xPart(j).toFixed(1)}" y="${bot + 18}" text-anchor="middle" fill="${PALETTE.teal}" font-family="ui-monospace, monospace" font-size="10">${escapeHtml(msaState.parts[j])}</text>`;
  }

  svg.innerHTML = html;
  bindSvgHoverTargets(svg, '.msa-bar', (el) => `<strong>${el.dataset.lbl}</strong>: ${el.dataset.val}%`);
  bindSvgHoverTargets(svg, '.msa-pt', (el) => `<strong>${escapeHtml(el.dataset.op)}</strong> · ${escapeHtml(el.dataset.part)}: Mean <strong>${el.dataset.mean}</strong>`);
}

function renderMSATable(msaState) {
  const tbody = document.getElementById('msa-table-body');
  if (!tbody) return;
  const a = msaState.operators.length;
  const b = msaState.parts.length;
  const r = Math.max(2, Number(msaState.trials) || 2);

  let rowsHtml = '';
  for (let i = 0; i < a; i++) {
    for (let j = 0; j < b; j++) {
      const cellIdx = i * b + j;
      const vals = msaState.readings[cellIdx] || Array(r).fill(0);
      const trialInputs = Array.from({ length: r }, (_, k) => {
        const v = vals[k] ?? 0;
        return `<td class="py-1 px-1"><input type="number" step="any" data-cell="${cellIdx}" data-trial="${k}" value="${v}" class="ind-input w-20 text-right text-xs msa-cell-edit" /></td>`;
      }).join('');
      rowsHtml += `
        <tr class="hover:bg-navy-panel text-xs">
          <td class="py-1.5 pr-2 font-bold text-rose-dusty">${escapeHtml(msaState.operators[i])}</td>
          <td class="py-1.5 px-2 font-mono text-teal-slate">${escapeHtml(msaState.parts[j])}</td>
          ${trialInputs}
        </tr>
      `;
    }
  }
  tbody.innerHTML = rowsHtml;

  tbody.querySelectorAll('.msa-cell-edit').forEach((inp) => {
    inp.addEventListener('input', (e) => {
      const cIdx = parseInt(e.target.dataset.cell, 10);
      const tIdx = parseInt(e.target.dataset.trial, 10);
      const val = parseFloat(e.target.value);
      if (!Number.isFinite(val)) return;
      if (!msaState.readings[cIdx]) msaState.readings[cIdx] = [];
      msaState.readings[cIdx][tIdx] = val;
      setModuleSource('msa', 'manual', 'Manual Edit');
      renderMSA({ skipTable: true });
      renderAllSourceBadges();
      persistState();
    });
  });
}

export function renderMSA({ skipTable = false } = {}) {
  const msaState = getState().msa;
  if (!msaState) return;

  const tolEl = document.getElementById('msa-in-tol');
  if (tolEl && document.activeElement !== tolEl) tolEl.value = msaState.tolerance;
  document.getElementById('msa-method-anova')?.classList.toggle('active', msaState.method !== 'range');
  document.getElementById('msa-method-range')?.classList.toggle('active', msaState.method === 'range');

  const m = computeGageRR(msaState);
  if (m) {
    const grrEl = document.getElementById('msa-val-grr');
    const bdg = document.getElementById('msa-badge-verdict');
    grrEl.textContent = `${m.pctGRRStudy.toFixed(1)}%`;
    grrEl.style.color = m.pctGRRStudy < 10 ? PALETTE.emerald : m.pctGRRStudy <= 30 ? PALETTE.copper : PALETTE.crimson;
    if (bdg) {
      bdg.textContent = m.verdict;
      bdg.style.borderColor = grrEl.style.color;
      bdg.style.color = grrEl.style.color;
    }
    document.getElementById('msa-val-tol').textContent = `${m.pctGRRTol.toFixed(1)}%`;
    document.getElementById('msa-val-ndc').textContent = String(m.ndc);
    document.getElementById('msa-val-ndc').style.color = m.ndc >= 5 ? PALETTE.emerald : PALETTE.crimson;
    document.getElementById('msa-val-ev').textContent = m.ev.toFixed(4);
    document.getElementById('msa-val-av').textContent = m.av.toFixed(4);
  }

  renderMSACharts(m, msaState);
  if (!skipTable) renderMSATable(msaState);
}

export function bindMSAEvents({ onOpenImport }) {
  document.getElementById('msa-in-tol')?.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    if (Number.isFinite(v) && v > 0) {
      getState().msa.tolerance = v;
      renderMSA({ skipTable: true });
      persistState();
    }
  });
  document.getElementById('msa-method-anova')?.addEventListener('click', () => {
    getState().msa.method = 'anova';
    renderMSA({ skipTable: true });
    persistState();
  });
  document.getElementById('msa-method-range')?.addEventListener('click', () => {
    getState().msa.method = 'range';
    renderMSA({ skipTable: true });
    persistState();
  });
  document.getElementById('btn-msa-import')?.addEventListener('click', () => {
    if (onOpenImport) onOpenImport('msa');
  });
  document.getElementById('btn-msa-reseed')?.addEventListener('click', () => {
    showToast('Gage R&R matrix refreshed');
    renderMSA();
  });
}
