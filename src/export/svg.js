import { SVG_NS, TAB_NAMES } from '../constants.js';
import { dateStamp, triggerDownload } from '../utils.js';
import { showToast } from '../ui/toast.js';

const SVG_ELEMENT_MAP = {
  capability: 'svg-capability',
  oee: 'svg-oee',
  takt: 'svg-takt',
  pareto: 'svg-pareto',
  vsm: 'svg-vsm',
  fives: 'svg-fives',
  ishikawa: 'svg-ishikawa',
};

export function serializeStandaloneSVG(moduleKey) {
  const id = SVG_ELEMENT_MAP[moduleKey];
  const svgEl = id ? document.getElementById(id) : null;
  if (!svgEl) return null;

  const clone = svgEl.cloneNode(true);
  // Strip hidden groups (e.g. inactive Capability Data vs Simulator mode layer)
  clone.querySelectorAll('[data-export-hidden="true"], .hidden').forEach((el) => el.remove());

  clone.setAttribute('xmlns', SVG_NS);
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  const vb = (clone.getAttribute('viewBox') || '0 0 1000 480').split(/\s+/);
  clone.setAttribute('width', vb[2] || '1000');
  clone.setAttribute('height', vb[3] || '480');

  const styleEl = document.createElementNS(SVG_NS, 'style');
  styleEl.textContent = `text { font-family: Inter, system-ui, -apple-system, sans-serif; }`;
  clone.insertBefore(styleEl, clone.firstChild);

  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
}

export function downloadSVG(moduleKey, renderAll) {
  if (renderAll) renderAll();
  const svgStr = serializeStandaloneSVG(moduleKey);
  if (!svgStr) {
    showToast('Switch to an analytical module to export SVG', true);
    return;
  }
  triggerDownload(`mudaslayer_${moduleKey}_${dateStamp()}.svg`, svgStr, 'image/svg+xml;charset=utf-8');
  showToast(`Exported ${TAB_NAMES[moduleKey] || moduleKey} SVG`);
}
