import { PALETTE } from '../constants.js';
import { getState, persistState, setModuleSource } from '../state.js';
import { renderAllSourceBadges } from '../ui/sourceBadge.js';
import { bindSvgHoverTargets } from '../ui/svgTooltip.js';
import { showToast } from '../ui/toast.js';
import { escapeHtml } from '../utils.js';
import { computeABComparison } from './comparatorMath.js';

function parseNumList(str) {
  return String(str || '')
    .split(/[\n\t;]+|,(?!\d{3}(?:\D|$))|\s+/)
    .map((s) => Number(s.trim().replace(/,/g, '')))
    .filter(Number.isFinite);
}

function renderComparatorSVG(cmp, cmpState) {
  const svg = document.getElementById('svg-comparator');
  if (!svg) return;
  if (!cmp) {
    svg.innerHTML = `<rect x="0" y="0" width="960" height="360" fill="${PALETTE.canvas}" /><text x="480" y="180" text-anchor="middle" fill="${PALETTE.teal}" font-family="ui-monospace, monospace" font-size="13">Provide at least 2 samples in both Before and After groups</text>`;
    return;
  }

  const left = 72;
  const right = 920;
  const top = 44;
  const bot = 286;
  const plotW = right - left;
  const plotH = bot - top;

  const domMin = Math.min(cmp.before.min, cmp.after.min) - Math.max(cmp.before.sd, cmp.after.sd) * 0.6;
  const domMax = Math.max(cmp.before.max, cmp.after.max) + Math.max(cmp.before.sd, cmp.after.sd) * 0.6;
  const span = Math.max(1e-6, domMax - domMin);
  const xAt = (v) => left + ((v - domMin) / span) * plotW;

  const normalPdf = (x, mu, sd) => {
    const s = Math.max(1e-9, sd);
    const z = (x - mu) / s;
    return Math.exp(-0.5 * z * z) / (s * Math.sqrt(2 * Math.PI));
  };

  const steps = 140;
  let peak = 1e-6;
  for (let i = 0; i <= steps; i++) {
    const x = domMin + (i / steps) * span;
    peak = Math.max(peak, normalPdf(x, cmp.before.mean, cmp.before.sd), normalPdf(x, cmp.after.mean, cmp.after.sd));
  }
  const yAt = (d) => bot - (d / (peak * 1.15)) * (plotH * 0.72);

  let html = `<rect x="0" y="0" width="960" height="360" fill="${PALETTE.canvas}" />`;
  for (let i = 0; i <= 4; i++) {
    const y = top + (plotH * i) / 4;
    html += `<line x1="${left}" y1="${y.toFixed(1)}" x2="${right}" y2="${y.toFixed(1)}" stroke="${PALETTE.border}" stroke-width="1" />`;
  }
  html += `<line x1="${left}" y1="${bot}" x2="${right}" y2="${bot}" stroke="${PALETTE.icemint}" stroke-width="1.8" />`;

  const buildCurve = (mu, sd) => {
    let d = `M ${xAt(domMin).toFixed(1)} ${bot}`;
    for (let i = 0; i <= steps; i++) {
      const xv = domMin + (i / steps) * span;
      d += ` L ${xAt(xv).toFixed(1)} ${yAt(normalPdf(xv, mu, sd)).toFixed(1)}`;
    }
    d += ` L ${xAt(domMax).toFixed(1)} ${bot} Z`;
    return d;
  };

  html += `<path d="${buildCurve(cmp.before.mean, cmp.before.sd)}" fill="${PALETTE.crimson}" fill-opacity="0.22" stroke="${PALETTE.crimson}" stroke-width="2.5" />`;
  html += `<path d="${buildCurve(cmp.after.mean, cmp.after.sd)}" fill="${PALETTE.emerald}" fill-opacity="0.24" stroke="${PALETTE.emerald}" stroke-width="2.8" />`;

  // Box-whisker summary strips below X axis (y = 304 and 326)
  const drawBox = (s, yMid, col, label) => {
    const xMin = xAt(s.min);
    const xQ1 = xAt(s.q1);
    const xMed = xAt(s.median);
    const xQ3 = xAt(s.q3);
    const xMax = xAt(s.max);
    html += `<g class="cmp-box" data-lbl="${escapeHtml(label)}" data-mean="${s.mean.toFixed(3)}" data-sd="${s.sd.toFixed(3)}" data-med="${s.median.toFixed(3)}" data-n="${s.n}">`;
    html += `<line x1="${xMin.toFixed(1)}" y1="${yMid}" x2="${xMax.toFixed(1)}" y2="${yMid}" stroke="${col}" stroke-width="1.6" />`;
    html += `<rect x="${xQ1.toFixed(1)}" y="${yMid - 6}" width="${Math.max(3, xQ3 - xQ1).toFixed(1)}" height="12" rx="2" fill="${col}" fill-opacity="0.45" stroke="${col}" stroke-width="1.5" />`;
    html += `<line x1="${xMed.toFixed(1)}" y1="${yMid - 7}" x2="${xMed.toFixed(1)}" y2="${yMid + 7}" stroke="#FFFFFF" stroke-width="2" />`;
    html += `</g>`;
  };
  drawBox(cmp.before, 304, PALETTE.crimson, cmpState.beforeLabel || 'Before');
  drawBox(cmp.after, 324, PALETTE.emerald, cmpState.afterLabel || 'After');

  // Mean vertical markers
  html += `<line x1="${xAt(cmp.before.mean).toFixed(1)}" y1="${top}" x2="${xAt(cmp.before.mean).toFixed(1)}" y2="${bot}" stroke="${PALETTE.crimson}" stroke-width="1.8" stroke-dasharray="5 3" />`;
  html += `<line x1="${xAt(cmp.after.mean).toFixed(1)}" y1="${top}" x2="${xAt(cmp.after.mean).toFixed(1)}" y2="${bot}" stroke="${PALETTE.emerald}" stroke-width="1.8" stroke-dasharray="5 3" />`;

  for (let i = 0; i <= 6; i++) {
    const v = domMin + (span * i) / 6;
    html += `<text x="${xAt(v).toFixed(1)}" y="${bot + 16}" text-anchor="middle" fill="${PALETTE.icemint}" font-family="ui-monospace, monospace" font-size="10">${v.toFixed(2)}</text>`;
  }

  html += `<text x="${left}" y="24" fill="${PALETTE.rose}" font-family="ui-monospace, monospace" font-size="11.5" font-weight="700">${escapeHtml(cmpState.metricName || 'Comparison')} — Δμ = ${cmp.meanDiff >= 0 ? '+' : ''}${cmp.meanDiff.toFixed(3)} ${escapeHtml(cmpState.unit || '')} (p = ${cmp.pValue < 0.0001 ? '<0.0001' : cmp.pValue.toFixed(4)})</text>`;

  svg.innerHTML = html;
  bindSvgHoverTargets(svg, '.cmp-box', (el) => {
    return `<strong>${escapeHtml(el.dataset.lbl)}</strong> (n=${el.dataset.n})<br/>Mean: ${el.dataset.mean} · SD: ${el.dataset.sd} · Median: ${el.dataset.med}`;
  });
}

export function renderComparator() {
  const cmpState = getState().comparator;
  if (!cmpState) return;

  const sync = (id, val) => {
    const el = document.getElementById(id);
    if (el && document.activeElement !== el) el.value = val;
  };
  sync('cmp-in-metric', cmpState.metricName || '');
  sync('cmp-in-before-lbl', cmpState.beforeLabel || 'Before');
  sync('cmp-in-after-lbl', cmpState.afterLabel || 'After');
  sync('cmp-in-before-raw', (cmpState.beforeSamples || []).join(', '));
  sync('cmp-in-after-raw', (cmpState.afterSamples || []).join(', '));

  const cmp = computeABComparison(cmpState);
  if (cmp) {
    const pEl = document.getElementById('cmp-val-p');
    const bdg = document.getElementById('cmp-badge-sig');
    pEl.textContent = cmp.pValue < 0.0001 ? '<0.0001' : cmp.pValue.toFixed(4);
    pEl.style.color = cmp.significant ? PALETTE.emerald : PALETTE.copper;
    if (bdg) {
      bdg.textContent = cmp.significant ? `Significant (p<${cmp.alpha})` : 'Not Significant';
      bdg.style.borderColor = cmp.significant ? PALETTE.emerald : PALETTE.copper;
      bdg.style.color = cmp.significant ? PALETTE.emerald : PALETTE.copper;
    }
    document.getElementById('cmp-val-diff').textContent = `${cmp.meanDiff >= 0 ? '+' : ''}${cmp.meanDiff.toFixed(3)}`;
    document.getElementById('cmp-sub-ci').textContent = `95% CI [${cmp.ciLow.toFixed(2)}, ${cmp.ciHigh.toFixed(2)}]`;
    document.getElementById('cmp-val-varp').textContent = cmp.pVariance < 0.0001 ? '<0.0001' : cmp.pVariance.toFixed(4);
    document.getElementById('cmp-sub-sd').textContent = `SD: ${cmp.before.sd.toFixed(3)} → ${cmp.after.sd.toFixed(3)}`;
    document.getElementById('cmp-val-mw').textContent = cmp.pMannWhitney < 0.0001 ? '<0.0001' : cmp.pMannWhitney.toFixed(4);
    document.getElementById('cmp-sub-d').textContent = `Cohen's d = ${cmp.cohenD.toFixed(2)}`;
  }

  renderComparatorSVG(cmp, cmpState);
}

export function bindComparatorEvents({ onOpenImport }) {
  document.getElementById('btn-cmp-import')?.addEventListener('click', () => {
    if (onOpenImport) onOpenImport('comparator');
  });
  document.getElementById('cmp-in-metric')?.addEventListener('input', (e) => {
    getState().comparator.metricName = e.target.value;
    renderComparator();
    persistState();
  });
  document.getElementById('cmp-in-before-lbl')?.addEventListener('input', (e) => {
    getState().comparator.beforeLabel = e.target.value;
    renderComparator();
    persistState();
  });
  document.getElementById('cmp-in-after-lbl')?.addEventListener('input', (e) => {
    getState().comparator.afterLabel = e.target.value;
    renderComparator();
    persistState();
  });
  document.getElementById('btn-cmp-apply')?.addEventListener('click', () => {
    const cmp = getState().comparator;
    const b = parseNumList(document.getElementById('cmp-in-before-raw')?.value);
    const a = parseNumList(document.getElementById('cmp-in-after-raw')?.value);
    if (b.length < 2 || a.length < 2) {
      showToast('Enter at least 2 numeric values in both Before and After', true);
      return;
    }
    cmp.beforeSamples = b;
    cmp.afterSamples = a;
    setModuleSource('comparator', 'manual', `Manual (${b.length} vs ${a.length})`);
    renderComparator();
    renderAllSourceBadges();
    persistState();
    showToast(`Compared ${b.length} Before vs ${a.length} After samples`);
  });
}
