import { SAMPLE_SCENARIOS } from '../constants.js';
import { getState, loadScenario, resetState } from '../state.js';
import { showToast } from '../ui/toast.js';
import { downloadSVG } from '../export/svg.js';
import { copyPNGToClipboard, downloadPNG } from '../export/png.js';
import { copyModuleTSV, downloadCSV } from '../export/csv.js';
import { copyMarkdown, downloadMarkdown } from '../export/markdown.js';
import { downloadJSONWorkspace, importJSONFile } from '../export/json.js';
import { downloadHTMLReport } from '../export/htmlReport.js';

export function updateExportClock() {
  const now = new Date();
  const clockEl = document.getElementById('exp-clock');
  const dateEl = document.getElementById('exp-date');
  if (clockEl) clockEl.textContent = now.toLocaleTimeString();
  if (dateEl) dateEl.textContent = now.toLocaleDateString();
}

export function syncScenarioSelect() {
  const sel = document.getElementById('scenario-select');
  if (!sel) return;
  const key = getState().scenarioKey || 'cnc';
  if (SAMPLE_SCENARIOS[key]) sel.value = key;
}

export function bindExportAndHeaderEvents({ renderAll, onOpenImport }) {
  // Header quick actions
  document.getElementById('btn-open-import')?.addEventListener('click', () => {
    const active = getState().activeTab;
    const target = ['capability', 'oee', 'pareto', 'takt', 'vsm'].includes(active) ? active : 'capability';
    if (onOpenImport) onOpenImport(target);
  });

  document.getElementById('scenario-select')?.addEventListener('change', (e) => {
    const next = loadScenario(e.target.value);
    if (renderAll) renderAll();
    showToast(`Loaded Scenario: ${next.scenarioName}`);
  });

  document.getElementById('btn-quick-svg')?.addEventListener('click', () => {
    const target = getState().activeTab === 'export' ? 'capability' : getState().activeTab;
    downloadSVG(target, renderAll);
  });

  document.getElementById('btn-quick-png')?.addEventListener('click', () => {
    const target = getState().activeTab === 'export' ? 'capability' : getState().activeTab;
    downloadPNG(target, renderAll);
  });

  document.getElementById('btn-quick-json-save')?.addEventListener('click', downloadJSONWorkspace);

  const fileInput = document.getElementById('global-json-file-input');
  document.getElementById('btn-quick-json-load')?.addEventListener('click', () => fileInput?.click());
  document.getElementById('exp-btn-json-import')?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      importJSONFile(e.target.files[0], () => {
        if (renderAll) renderAll();
        syncScenarioSelect();
      });
      e.target.value = '';
    }
  });

  // Export Hub actions
  document.getElementById('exp-btn-json-export')?.addEventListener('click', downloadJSONWorkspace);
  document.getElementById('exp-btn-html')?.addEventListener('click', () => downloadHTMLReport(renderAll));
  document.getElementById('exp-btn-print')?.addEventListener('click', () => window.print());
  document.getElementById('exp-btn-md-download')?.addEventListener('click', downloadMarkdown);
  document.getElementById('exp-btn-md-copy')?.addEventListener('click', copyMarkdown);
  document.getElementById('exp-btn-png-copy')?.addEventListener('click', () => {
    const target = getState().activeTab === 'export' ? 'capability' : getState().activeTab;
    copyPNGToClipboard(target, renderAll);
  });

  document.querySelectorAll('.exp-csv-btn').forEach((btn) => {
    btn.addEventListener('click', () => downloadCSV(btn.dataset.csv));
  });
  document.querySelectorAll('.exp-tsv-btn').forEach((btn) => {
    btn.addEventListener('click', () => copyModuleTSV(btn.dataset.tsv));
  });
  document.querySelectorAll('.exp-svg-btn').forEach((btn) => {
    btn.addEventListener('click', () => downloadSVG(btn.dataset.svg, renderAll));
  });
  document.querySelectorAll('.exp-png-btn').forEach((btn) => {
    btn.addEventListener('click', () => downloadPNG(btn.dataset.png, renderAll));
  });

  // Inline confirmation for Reset Defaults
  const confirmBox = document.getElementById('exp-reset-confirm');
  document.getElementById('exp-btn-reset')?.addEventListener('click', () => {
    confirmBox?.classList.remove('hidden');
  });
  document.getElementById('exp-btn-reset-no')?.addEventListener('click', () => {
    confirmBox?.classList.add('hidden');
  });
  document.getElementById('exp-btn-reset-yes')?.addEventListener('click', () => {
    resetState('cnc');
    syncScenarioSelect();
    if (renderAll) renderAll();
    confirmBox?.classList.add('hidden');
    showToast('Factory Defaults Restored');
  });
}
