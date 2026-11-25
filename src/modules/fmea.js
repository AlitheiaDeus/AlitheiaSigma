import { PALETTE } from '../constants.js';
import { getState, nextId, persistState, setModuleSource } from '../state.js';
import { switchTab } from '../ui/navigation.js';
import { renderAllSourceBadges } from '../ui/sourceBadge.js';
import { bindSvgHoverTargets } from '../ui/svgTooltip.js';
import { showToast } from '../ui/toast.js';
import { escapeHtml, truncateText } from '../utils.js';
import { computeFMEAMetrics } from './fmeaMath.js';

function renderFMEASVG(m) {
  const svg = document.getElementById('svg-fmea');
  if (!svg) return;
  const rows = m.rows.slice(0, 8);
  if (rows.length === 0) {
    svg.innerHTML = `<rect x="0" y="0" width="960" height="300" fill="${PALETTE.canvas}" /><text x="480" y="150" text-anchor="middle" fill="${PALETTE.teal}" font-family="ui-monospace, monospace" font-size="13">No PFMEA rows logged</text>`;
    return;
  }

  const left = 220;
  const right = 910;
  const top = 34;
  const bot = 264;
  const plotW = right - left;
  const maxRpn = Math.max(250, ...rows.map((r) => r.rpn));

  let html = `<rect x="0" y="0" width="960" height="300" fill="${PALETTE.canvas}" />`;
  const xRpn = (v) => left + (v / maxRpn) * plotW;

  [100, 200].forEach((thr) => {
    if (thr <= maxRpn) {
      const x = xRpn(thr);
      html += `<line x1="${x.toFixed(1)}" y1="${top}" x2="${x.toFixed(1)}" y2="${bot}" stroke="${thr >= 200 ? PALETTE.crimson : PALETTE.copper}" stroke-width="1.5" stroke-dasharray="5 4" />`;
      html += `<text x="${x.toFixed(1)}" y="${top - 8}" text-anchor="middle" fill="${thr >= 200 ? PALETTE.crimson : PALETTE.copper}" font-family="ui-monospace, monospace" font-size="10" font-weight="700">RPN ${thr}</text>`;
    }
  });

  const rowH = Math.min(26, (bot - top) / rows.length - 4);
  rows.forEach((r, idx) => {
    const y = top + idx * ((bot - top) / rows.length) + 4;
    const w = Math.max(4, xRpn(r.rpn) - left);
    const col = r.rpn >= 200 ? PALETTE.crimson : r.rpn >= 100 ? PALETTE.copper : r.rpn >= 50 ? PALETTE.indigo : PALETTE.teal;
    html += `<text x="${left - 10}" y="${(y + rowH / 2 + 4).toFixed(1)}" text-anchor="end" fill="${PALETTE.rose}" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="600">${escapeHtml(truncateText(r.mode || r.cause, 26))}</text>`;
    html += `<rect class="fmea-bar" data-mode="${escapeHtml(r.mode)}" data-cause="${escapeHtml(r.cause)}" data-rpn="${r.rpn}" data-sod="${r.sev}×${r.occ}×${r.det}" data-status="${escapeHtml(r.status)}" x="${left}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${rowH.toFixed(1)}" fill="${col}" rx="3" />`;
    html += `<text x="${(left + w + 8).toFixed(1)}" y="${(y + rowH / 2 + 4).toFixed(1)}" fill="${PALETTE.icemint}" font-family="ui-monospace, monospace" font-size="11" font-weight="700">${r.rpn} (${r.sev}×${r.occ}×${r.det})</text>`;
  });

  svg.innerHTML = html;
  bindSvgHoverTargets(svg, '.fmea-bar', (el) => {
    return `<strong>${escapeHtml(el.dataset.mode)}</strong><br/>Cause: ${escapeHtml(el.dataset.cause)}<br/>RPN: <strong>${el.dataset.rpn}</strong> (${el.dataset.sod}) · ${escapeHtml(el.dataset.status)}`;
  });
}

export function renderFMEA() {
  const fmeaState = getState().fmea;
  if (!fmeaState) return;
  const m = computeFMEAMetrics(fmeaState);

  document.getElementById('fmea-val-max').textContent = String(m.maxRPN);
  document.getElementById('fmea-val-max').style.color = m.maxRPN >= 200 ? PALETTE.crimson : m.maxRPN >= 100 ? PALETTE.copper : PALETTE.emerald;
  document.getElementById('fmea-val-crit').textContent = String(m.criticalCount);
  document.getElementById('fmea-val-open').textContent = String(m.openCount);
  document.getElementById('fmea-val-chains').textContent = String(m.chainsCount);

  renderFMEASVG(m);

  // Render 5-Whys Chains
  const chainsEl = document.getElementById('fmea-chains-list');
  if (chainsEl) {
    chainsEl.innerHTML = (fmeaState.chains || [])
      .map((ch, cIdx) => {
        const whysHtml = (ch.whys || [])
          .map(
            (w, wIdx) => `
            <div class="flex items-center gap-2">
              <span class="font-mono text-[11px] text-teal-slate w-12 shrink-0">Why ${wIdx + 1}</span>
              <input type="text" data-cidx="${cIdx}" data-widx="${wIdx}" value="${escapeHtml(w)}" class="ind-input ind-input-text flex-1 text-xs py-1 fmea-why-edit" />
            </div>`
          )
          .join('');
        return `
          <div class="ind-well p-3 space-y-2">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 text-[10px] font-mono font-bold rounded-xs bg-navy-card border border-magenta text-rose-dusty">${escapeHtml(ch.rib || 'Cause')}</span>
                <strong class="text-xs text-icemint">${escapeHtml(ch.cause)}</strong>
              </div>
              <div class="flex items-center gap-1.5">
                <button type="button" data-cidx="${cIdx}" class="ind-btn py-0.5 px-2 text-[11px] fmea-why-add">+ Why</button>
                <button type="button" data-cidx="${cIdx}" class="ind-btn ind-btn-primary py-0.5 px-2 text-[11px] fmea-why-promote">Promote → PFMEA</button>
                <button type="button" data-cidx="${cIdx}" class="ind-btn ind-btn-danger py-0.5 px-2 text-[11px] fmea-why-del">X</button>
              </div>
            </div>
            <div class="space-y-1.5">${whysHtml}</div>
          </div>`;
      })
      .join('');

    chainsEl.querySelectorAll('.fmea-why-edit').forEach((inp) => {
      inp.addEventListener('input', (e) => {
        const ci = parseInt(e.target.dataset.cidx, 10);
        const wi = parseInt(e.target.dataset.widx, 10);
        fmeaState.chains[ci].whys[wi] = e.target.value;
        persistState();
      });
    });
    chainsEl.querySelectorAll('.fmea-why-add').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const ci = parseInt(e.target.dataset.cidx, 10);
        if (fmeaState.chains[ci].whys.length < 7) {
          fmeaState.chains[ci].whys.push('');
          renderFMEA();
          persistState();
        }
      });
    });
    chainsEl.querySelectorAll('.fmea-why-promote').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const ch = fmeaState.chains[parseInt(e.target.dataset.cidx, 10)];
        const rootWhy = [...(ch.whys || [])].reverse().find((w) => w.trim()) || ch.cause;
        fmeaState.rows.unshift({
          id: nextId(fmeaState.rows),
          cause: rootWhy,
          mode: ch.cause,
          effect: 'Process defect / scrap',
          sev: 7,
          occ: 5,
          det: 5,
          action: `Address root cause: ${rootWhy}`,
          owner: 'TBD',
          due: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          status: 'Open',
        });
        renderFMEA();
        persistState();
        showToast('Promoted 5-Whys root cause to PFMEA');
      });
    });
    chainsEl.querySelectorAll('.fmea-why-del').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        fmeaState.chains.splice(parseInt(e.target.dataset.cidx, 10), 1);
        renderFMEA();
        persistState();
      });
    });
  }

  // Render PFMEA Table
  const tbody = document.getElementById('fmea-table-body');
  if (tbody) {
    tbody.innerHTML = m.rows
      .map((r) => {
        const origIdx = fmeaState.rows.findIndex((x) => x.id === r.id);
        const rpnCol = r.rpn >= 200 ? 'border-crimson text-crimson' : r.rpn >= 100 ? 'border-copper text-copper' : 'border-emerald-mint text-emerald-mint';
        return `
          <tr class="hover:bg-navy-panel text-xs">
            <td class="py-1.5 pr-1"><input type="text" data-idx="${origIdx}" data-f="mode" value="${escapeHtml(r.mode)}" class="ind-input ind-input-text w-36 text-xs fmea-row-edit" /></td>
            <td class="py-1.5 px-1"><input type="text" data-idx="${origIdx}" data-f="cause" value="${escapeHtml(r.cause)}" class="ind-input ind-input-text w-36 text-xs fmea-row-edit" /></td>
            <td class="py-1.5 px-1"><input type="number" min="1" max="10" data-idx="${origIdx}" data-f="sev" value="${r.sev}" class="ind-input w-12 text-right text-xs fmea-row-edit" /></td>
            <td class="py-1.5 px-1"><input type="number" min="1" max="10" data-idx="${origIdx}" data-f="occ" value="${r.occ}" class="ind-input w-12 text-right text-xs fmea-row-edit" /></td>
            <td class="py-1.5 px-1"><input type="number" min="1" max="10" data-idx="${origIdx}" data-f="det" value="${r.det}" class="ind-input w-12 text-right text-xs fmea-row-edit" /></td>
            <td class="py-1.5 px-1"><span class="px-2 py-0.5 font-mono font-bold rounded-xs border bg-navy-canvas ${rpnCol}">${r.rpn}</span></td>
            <td class="py-1.5 px-1"><input type="text" data-idx="${origIdx}" data-f="action" value="${escapeHtml(r.action)}" class="ind-input ind-input-text w-44 text-xs fmea-row-edit" /></td>
            <td class="py-1.5 px-1"><input type="text" data-idx="${origIdx}" data-f="owner" value="${escapeHtml(r.owner)}" class="ind-input ind-input-text w-20 text-xs fmea-row-edit" /></td>
            <td class="py-1.5 px-1">
              <select data-idx="${origIdx}" data-f="status" class="ind-input ind-input-text text-xs fmea-row-edit">
                <option value="Open" ${r.status === 'Open' ? 'selected' : ''}>Open</option>
                <option value="In Progress" ${r.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                <option value="Closed" ${r.status === 'Closed' ? 'selected' : ''}>Closed</option>
              </select>
            </td>
            <td class="py-1.5 pl-1 text-right"><button type="button" data-idx="${origIdx}" class="ind-btn ind-btn-danger py-0.5 px-2 text-xs fmea-row-del">X</button></td>
          </tr>`;
      })
      .join('');

    tbody.querySelectorAll('.fmea-row-edit').forEach((el) => {
      el.addEventListener('change', (e) => {
        const i = parseInt(e.target.dataset.idx, 10);
        const f = e.target.dataset.f;
        const row = fmeaState.rows[i];
        if (!row) return;
        if (['sev', 'occ', 'det'].includes(f)) {
          row[f] = Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1));
        } else {
          row[f] = e.target.value;
        }
        renderFMEA();
        persistState();
      });
    });
    tbody.querySelectorAll('.fmea-row-del').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        fmeaState.rows.splice(parseInt(e.target.dataset.idx, 10), 1);
        renderFMEA();
        persistState();
      });
    });
  }
}

export function seed5WhysFromCause({ rib = 'Machine', cause }) {
  const fmea = getState().fmea;
  if (!fmea.chains.some((c) => c.cause.toLowerCase() === cause.toLowerCase())) {
    fmea.chains.unshift({
      id: nextId(fmea.chains),
      rib,
      cause,
      whys: ['', '', ''],
    });
  }
  setModuleSource('fmea', 'link', `Cross-linked (${rib})`);
  renderFMEA();
  renderAllSourceBadges();
  persistState();
  switchTab('fmea');
  showToast(`Opened 5-Whys for: ${truncateText(cause, 30)}`);
}

export function seedFMEAFromCause({ rib = 'Machine', cause, problem = '' }) {
  const fmea = getState().fmea;
  fmea.rows.unshift({
    id: nextId(fmea.rows),
    cause,
    mode: `${rib}: ${cause}`,
    effect: problem || 'Quality / downtime impact',
    sev: 7,
    occ: 5,
    det: 5,
    action: `Contain and eliminate: ${cause}`,
    owner: 'TBD',
    due: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    status: 'Open',
  });
  setModuleSource('fmea', 'link', `Cross-linked (${rib})`);
  renderFMEA();
  renderAllSourceBadges();
  persistState();
  switchTab('fmea');
  showToast(`Added to PFMEA: ${truncateText(cause, 30)}`);
}

export function bindFMEAEvents() {
  document.getElementById('btn-fmea-add-chain')?.addEventListener('click', () => {
    const fmea = getState().fmea;
    fmea.chains.unshift({
      id: nextId(fmea.chains),
      rib: 'Method',
      cause: 'New Investigation',
      whys: ['', '', ''],
    });
    renderFMEA();
    persistState();
  });
  document.getElementById('btn-fmea-add-row')?.addEventListener('click', () => {
    const fmea = getState().fmea;
    fmea.rows.unshift({
      id: nextId(fmea.rows),
      cause: 'New Potential Cause',
      mode: 'New Failure Mode',
      effect: 'Customer / process impact',
      sev: 5,
      occ: 5,
      det: 5,
      action: 'Define containment action',
      owner: 'TBD',
      due: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      status: 'Open',
    });
    renderFMEA();
    persistState();
  });
}
