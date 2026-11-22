import { getState, persistState } from '../state.js';
import { escapeHtml } from '../utils.js';
import { showToast } from '../ui/toast.js';
import { switchTab } from '../ui/navigation.js';
import { computeEmpiricalCapability } from '../modules/capabilityMath.js';
import { parseDelimitedText, parseSpreadsheetFile, SAMPLE_CSV_BY_MODULE } from './parser.js';
import { MODULE_SCHEMAS, suggestMapping, transformMappedRows } from './mapper.js';

let parsedTable = { headers: [], rows: [], sourceName: '' };
let currentMapping = {};

export function isImportDrawerOpen() {
  const modal = document.getElementById('import-modal');
  return Boolean(modal && !modal.classList.contains('hidden'));
}

export function openImportDrawer(defaultModule = 'capability') {
  const modal = document.getElementById('import-modal');
  const sel = document.getElementById('imp-target-module');
  if (sel && MODULE_SCHEMAS[defaultModule]) {
    sel.value = defaultModule;
  }
  modal?.classList.remove('hidden');
  refreshMapperAndPreview();
}

export function closeImportDrawer() {
  document.getElementById('import-modal')?.classList.add('hidden');
}

function getTargetModule() {
  return document.getElementById('imp-target-module')?.value || 'capability';
}

function refreshCapSpecSuggestion() {
  const target = getTargetModule();
  const capBox = document.getElementById('imp-cap-specs');
  if (!capBox) return;
  capBox.classList.toggle('hidden', target !== 'capability');
  if (target !== 'capability') return;

  const cap = getState().capability;
  const lblEl = document.getElementById('imp-cap-label');
  const lslEl = document.getElementById('imp-cap-lsl');
  const uslEl = document.getElementById('imp-cap-usl');

  if (parsedTable.headers.length > 0 && parsedTable.rows.length >= 2) {
    const res = transformMappedRows(parsedTable.headers, parsedTable.rows, currentMapping, 'capability');
    if (res.data.length >= 2) {
      const emp = computeEmpiricalCapability(res.data, NaN, NaN);
      if (emp) {
        if (lslEl && !lslEl.dataset.userEdited) lslEl.value = (emp.mean - 3.5 * emp.overallSigma).toFixed(3);
        if (uslEl && !uslEl.dataset.userEdited) uslEl.value = (emp.mean + 3.5 * emp.overallSigma).toFixed(3);
      }
    }
  } else {
    if (lslEl && !lslEl.value) lslEl.value = cap.lsl;
    if (uslEl && !uslEl.value) uslEl.value = cap.usl;
  }
  if (lblEl && !lblEl.value) lblEl.value = cap.label || 'Measurements';
}

function refreshMapperAndPreview() {
  const target = getTargetModule();
  const schema = MODULE_SCHEMAS[target];
  const metaEl = document.getElementById('imp-preview-meta');
  const previewTable = document.getElementById('imp-preview-table');
  const mapperGrid = document.getElementById('imp-mapper-grid');
  const applyBtn = document.getElementById('imp-btn-apply');

  if (!parsedTable.headers.length || !parsedTable.rows.length) {
    if (metaEl) metaEl.textContent = 'Drop a .xlsx / .csv file or paste Excel cells above to preview and map columns.';
    if (previewTable) previewTable.innerHTML = '';
    if (mapperGrid) mapperGrid.innerHTML = '<div class="text-xs font-mono text-teal-slate">Waiting for tabular data...</div>';
    if (applyBtn) applyBtn.disabled = true;
    refreshCapSpecSuggestion();
    return;
  }

  currentMapping = suggestMapping(parsedTable.headers, parsedTable.rows, target);

  if (metaEl) {
    metaEl.textContent = `Parsed ${parsedTable.rows.length} rows × ${parsedTable.headers.length} columns${parsedTable.sourceName ? ` from ${parsedTable.sourceName}` : ''}`;
  }

  // Render preview (first 5 rows)
  if (previewTable) {
    const thead = `<thead><tr class="border-b border-navy-border text-teal-slate font-mono text-[11px]">${parsedTable.headers
      .map((h) => `<th class="py-1.5 px-2 text-left whitespace-nowrap">${escapeHtml(h)}</th>`)
      .join('')}</tr></thead>`;
    const tbody = `<tbody>${parsedTable.rows
      .slice(0, 5)
      .map(
        (r) =>
          `<tr class="border-b border-navy-border/50 text-icemint font-mono text-[11px]">${r
            .map((c) => `<td class="py-1 px-2 whitespace-nowrap max-w-[160px] truncate">${escapeHtml(c)}</td>`)
            .join('')}</tr>`
      )
      .join('')}</tbody>`;
    previewTable.innerHTML = thead + tbody;
  }

  // Render mapping selectors
  if (mapperGrid && schema) {
    mapperGrid.innerHTML = schema.fields
      .map((f) => {
        const selectedIdx = currentMapping[f.key] ?? -1;
        return `
          <div class="ind-well p-2.5 space-y-1">
            <label class="block text-[11px] font-bold uppercase ${f.required ? 'text-rose-dusty' : 'text-teal-slate'}">
              ${escapeHtml(f.label)}${f.required ? ' *' : ''}
            </label>
            <select data-field="${f.key}" class="ind-input ind-input-text w-full text-xs imp-map-sel">
              <option value="-1">— Skip / Default —</option>
              ${parsedTable.headers
                .map(
                  (h, idx) =>
                    `<option value="${idx}" ${selectedIdx === idx ? 'selected' : ''}>${escapeHtml(h)}</option>`
                )
                .join('')}
            </select>
          </div>
        `;
      })
      .join('');

    mapperGrid.querySelectorAll('.imp-map-sel').forEach((sel) => {
      sel.addEventListener('change', (e) => {
        currentMapping[e.target.dataset.field] = parseInt(e.target.value, 10);
        refreshCapSpecSuggestion();
      });
    });
  }

  if (applyBtn) applyBtn.disabled = false;
  refreshCapSpecSuggestion();
}

function handleParsedResult(result) {
  parsedTable = {
    headers: result.headers || [],
    rows: result.rows || [],
    sourceName: result.sourceName || 'Pasted Data',
  };
  document.getElementById('imp-cap-lsl')?.removeAttribute('data-user-edited');
  document.getElementById('imp-cap-usl')?.removeAttribute('data-user-edited');
  refreshMapperAndPreview();
}

export function bindImportDrawer({ renderAll }) {
  const dropzone = document.getElementById('imp-dropzone');
  const fileInput = document.getElementById('imp-file-input');
  const pasteArea = document.getElementById('imp-paste-text');

  document.getElementById('imp-btn-close')?.addEventListener('click', closeImportDrawer);
  document.getElementById('imp-btn-cancel')?.addEventListener('click', closeImportDrawer);
  document.getElementById('import-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'import-modal') closeImportDrawer();
  });

  document.getElementById('imp-target-module')?.addEventListener('change', refreshMapperAndPreview);

  ['imp-cap-lsl', 'imp-cap-usl'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', (e) => {
      e.target.setAttribute('data-user-edited', 'true');
    });
  });

  const processFile = async (file) => {
    if (!file) return;
    try {
      const res = await parseSpreadsheetFile(file);
      handleParsedResult(res);
      showToast(`Loaded ${res.rows.length} rows from ${file.name}`);
    } catch (err) {
      showToast(err.message || 'Could not read file', true);
    }
  };

  dropzone?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
      e.target.value = '';
    }
  });

  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  });

  pasteArea?.addEventListener('input', (e) => {
    const val = e.target.value;
    if (!val.trim()) {
      parsedTable = { headers: [], rows: [], sourceName: '' };
      refreshMapperAndPreview();
      return;
    }
    const parsed = parseDelimitedText(val);
    handleParsedResult({ ...parsed, sourceName: 'Clipboard Paste' });
  });

  document.getElementById('imp-btn-sample')?.addEventListener('click', () => {
    const target = getTargetModule();
    const sample = SAMPLE_CSV_BY_MODULE[target] || SAMPLE_CSV_BY_MODULE.capability;
    if (pasteArea) pasteArea.value = sample;
    const parsed = parseDelimitedText(sample);
    handleParsedResult({ ...parsed, sourceName: `${target} sample` });
  });

  document.getElementById('imp-btn-apply')?.addEventListener('click', () => {
    const target = getTargetModule();
    const res = transformMappedRows(parsedTable.headers, parsedTable.rows, currentMapping, target);
    if (res.warnings.length > 0) {
      showToast(res.warnings[0], true);
      return;
    }
    if (res.importedCount === 0) {
      showToast('No valid rows found for the selected column mapping', true);
      return;
    }

    const state = getState();
    if (target === 'capability') {
      if (res.data.length < 2) {
        showToast('Capability requires at least 2 numeric measurements', true);
        return;
      }
      state.capability.mode = 'data';
      state.capability.samples = res.data;
      const lbl = document.getElementById('imp-cap-label')?.value.trim();
      const lsl = parseFloat(document.getElementById('imp-cap-lsl')?.value);
      const usl = parseFloat(document.getElementById('imp-cap-usl')?.value);
      if (lbl) state.capability.label = lbl;
      if (Number.isFinite(lsl)) state.capability.lsl = lsl;
      if (Number.isFinite(usl)) state.capability.usl = usl;
    } else if (target === 'oee') {
      state.oee.mode = 'log';
      state.oee.filterLine = 'ALL';
      state.oee.logs = res.data;
    } else if (target === 'pareto') {
      state.pareto.mode = 'events';
      state.pareto.filterValue = 'ALL';
      state.pareto.events = res.data;
      if (currentMapping.weight >= 0) {
        state.pareto.metric = 'weight';
        state.pareto.weightLabel = parsedTable.headers[currentMapping.weight] || 'Weight';
      } else {
        state.pareto.metric = 'count';
      }
    } else if (target === 'takt') {
      state.takt.stations = res.data;
    } else if (target === 'vsm') {
      state.vsm.steps = res.data.slice(0, 7);
    }

    persistState();
    if (renderAll) renderAll();
    switchTab(target);
    closeImportDrawer();

    const skippedNote = res.skippedCount > 0 ? ` (${res.skippedCount} skipped)` : '';
    showToast(`Imported ${res.importedCount} rows into ${MODULE_SCHEMAS[target].label}${skippedNote}`);
  });
}
