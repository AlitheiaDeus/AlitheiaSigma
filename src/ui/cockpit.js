import { clearBaseline, getState, persistState, pinBaseline } from '../state.js';
import { escapeHtml } from '../utils.js';
import { computeCockpitHealth, computeModuleInsights } from './diagnostics.js';
import { switchTab } from './navigation.js';
import { showToast } from './toast.js';

function getCurrentBaselineKPIs(state) {
  const tiles = computeCockpitHealth(state);
  const map = {};
  tiles.forEach((t) => {
    map[t.tab] = t.value;
  });
  return map;
}

export function renderCockpitHUD() {
  const state = getState();
  const strip = document.getElementById('cockpit-tiles');
  const wrap = document.getElementById('cockpit-strip');
  if (!strip || !wrap) return;

  const expanded = state.ui?.cockpitExpanded !== false;
  strip.classList.toggle('hidden', !expanded);
  const toggleBtn = document.getElementById('btn-toggle-cockpit');
  if (toggleBtn) toggleBtn.textContent = expanded ? 'Hide HUD' : 'Show HUD';

  const tiles = computeCockpitHealth(state);
  const base = state.baselines?.global?.kpis || {};

  strip.innerHTML = tiles
    .map((t) => {
      const ledCls = t.status === 'ok' ? 'led-ok' : t.status === 'warn' ? 'led-warn' : 'led-bad';
      const baseVal = base[t.tab];
      const deltaTag = baseVal && baseVal !== t.value ? `<span class="text-[10px] font-mono text-magenta ml-1" title="Baseline: ${escapeHtml(baseVal)}">(${escapeHtml(baseVal)})</span>` : '';
      return `
        <button type="button" data-cockpit-tab="${t.tab}" class="cockpit-tile ind-well px-3 py-1.5 flex items-center gap-2 text-left cursor-pointer hover:border-magenta transition-colors">
          <span class="led-dot ${ledCls}"></span>
          <div>
            <div class="text-[10px] font-bold uppercase text-teal-slate leading-none">${t.label}</div>
            <div class="font-mono text-xs font-bold text-icemint mt-0.5">${escapeHtml(t.value)}${deltaTag}</div>
          </div>
        </button>`;
    })
    .join('');

  strip.querySelectorAll('.cockpit-tile').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.cockpitTab));
  });

  // Update active insight banner
  const insights = computeModuleInsights(state);
  const activeTab = state.activeTab || 'capability';
  const banner = document.getElementById('cockpit-insight-banner');
  const bannerTxt = document.getElementById('cockpit-insight-text');
  if (banner && bannerTxt) {
    const list = insights[activeTab];
    if (list && list.length > 0) {
      banner.classList.remove('hidden');
      bannerTxt.textContent = list[0];
    } else {
      banner.classList.add('hidden');
    }
  }

  const basePill = document.getElementById('btn-pin-baseline');
  if (basePill) {
    const pinned = Boolean(state.baselines?.global);
    basePill.textContent = pinned ? 'Baseline Pinned (Clear)' : 'Pin Baseline';
    basePill.classList.toggle('ind-btn-ok', pinned);
  }
}

export function bindCockpitEvents() {
  document.getElementById('btn-toggle-cockpit')?.addEventListener('click', () => {
    const state = getState();
    state.ui.cockpitExpanded = state.ui.cockpitExpanded === false;
    renderCockpitHUD();
    persistState({ recordHistory: false });
  });

  document.getElementById('btn-pin-baseline')?.addEventListener('click', () => {
    const state = getState();
    if (state.baselines?.global) {
      clearBaseline('global');
      showToast('Baseline snapshot cleared');
    } else {
      pinBaseline('global', getCurrentBaselineKPIs(state));
      showToast('Baseline snapshot pinned — edit values to compare');
    }
    renderCockpitHUD();
  });
}
