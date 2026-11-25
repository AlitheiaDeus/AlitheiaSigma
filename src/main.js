import { bindCapabilityEvents, initCapabilityGrid, renderCapability } from './modules/capability.js';
import { bindOEEEvents, renderOEE } from './modules/oee.js';
import { bindTaktEvents, renderTakt } from './modules/takt.js';
import { bindParetoEvents, renderPareto } from './modules/pareto.js';
import { bindVSMEvents, renderVSM } from './modules/vsm.js';
import { bind5SEvents, render5S } from './modules/fives.js';
import { bindIshikawaEvents, renderIshikawa } from './modules/ishikawa.js';
import { bindMSAEvents, renderMSA } from './modules/msa.js';
import { bindComparatorEvents, renderComparator } from './modules/comparator.js';
import { bindFMEAEvents, renderFMEA } from './modules/fmea.js';
import { bindExportAndHeaderEvents, syncScenarioSelect, updateExportClock } from './modules/export.js';
import { bindImportDrawer, closeImportDrawer, isImportDrawerOpen, openImportDrawer } from './data/importDrawer.js';
import { bindNavigationEvents, resolveInitialTab, switchTab } from './ui/navigation.js';
import { renderAllSourceBadges } from './ui/sourceBadge.js';
import { bindCockpitEvents, renderCockpitHUD } from './ui/cockpit.js';
import { bindCommandPalette } from './ui/commandPalette.js';
import { canRedo, canUndo, getState, onHistoryChange, onPersist, persistState, redoState, undoState } from './state.js';
import { showToast } from './ui/toast.js';

export function renderAllModules() {
  renderCapability();
  renderOEE();
  renderTakt();
  renderPareto();
  renderVSM();
  render5S();
  renderIshikawa();
  renderMSA();
  renderComparator();
  renderFMEA();
  renderAllSourceBadges();
  renderCockpitHUD();
  applyTheme();
}

function applyTheme() {
  const theme = getState().ui?.theme || 'navy';
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

function syncHistoryButtons() {
  const u = document.getElementById('btn-undo');
  const r = document.getElementById('btn-redo');
  if (u) u.disabled = !canUndo();
  if (r) r.disabled = !canRedo();
}

function bootstrap() {
  initCapabilityGrid();

  const ctx = {
    renderAll: renderAllModules,
    onOpenImport: openImportDrawer,
    onCloseImport: closeImportDrawer,
    isImportOpen: isImportDrawerOpen,
  };

  bindCapabilityEvents(ctx);
  bindOEEEvents(ctx);
  bindTaktEvents(ctx);
  bindParetoEvents(ctx);
  bindVSMEvents(ctx);
  bind5SEvents();
  bindIshikawaEvents();
  bindMSAEvents(ctx);
  bindComparatorEvents(ctx);
  bindFMEAEvents();
  bindImportDrawer(ctx);
  bindExportAndHeaderEvents(ctx);
  bindNavigationEvents(ctx);
  bindCockpitEvents();
  bindCommandPalette(ctx);

  onHistoryChange(syncHistoryButtons);
  onPersist(renderCockpitHUD);
  syncHistoryButtons();

  document.getElementById('btn-undo')?.addEventListener('click', () => {
    const lbl = undoState();
    if (lbl) {
      renderAllModules();
      showToast(`Undid: ${lbl}`);
    }
  });
  document.getElementById('btn-redo')?.addEventListener('click', () => {
    const lbl = redoState();
    if (lbl) {
      renderAllModules();
      showToast(`Redid: ${lbl}`);
    }
  });
  document.getElementById('btn-toggle-theme')?.addEventListener('click', () => {
    const st = getState();
    st.ui.theme = st.ui.theme === 'contrast' ? 'navy' : 'contrast';
    applyTheme();
    persistState({ recordHistory: false });
    showToast(`Theme: ${st.ui.theme === 'contrast' ? 'High-Contrast Shop-Floor' : 'Industrial Navy'}`);
  });

  syncScenarioSelect();
  renderAllModules();
  switchTab(resolveInitialTab(), { updateHash: false });
  updateExportClock();
  setInterval(updateExportClock, 1000);
}

bootstrap();
