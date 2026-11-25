import { TAB_NAMES, TAB_ORDER } from '../constants.js';
import { clearBaseline, getState, loadScenario, persistState, pinBaseline, redoState, undoState } from '../state.js';
import { escapeHtml } from '../utils.js';
import { computeCockpitHealth } from './diagnostics.js';
import { switchTab } from './navigation.js';
import { showToast } from './toast.js';
import { downloadJSONWorkspace } from '../export/json.js';
import { copyMarkdown } from '../export/markdown.js';
import { downloadPNG } from '../export/png.js';
import { downloadSVG } from '../export/svg.js';

let paletteOpen = false;
let selectedIdx = 0;
let filteredCommands = [];

function buildCommands(ctx) {
  const cmds = [];
  TAB_ORDER.forEach((key, idx) => {
    const kbd = idx < 9 ? String(idx + 1) : idx === 9 ? '0' : 'e';
    cmds.push({
      id: `nav-${key}`,
      group: 'Navigate',
      title: `Go to ${TAB_NAMES[key]}`,
      hint: `Key ${kbd}`,
      run: () => switchTab(key),
    });
  });

  cmds.push(
    {
      id: 'act-import',
      group: 'Actions',
      title: 'Import Spreadsheet / Paste from Excel',
      hint: 'i',
      run: () => ctx.onOpenImport?.(getState().activeTab),
    },
    {
      id: 'act-undo',
      group: 'Actions',
      title: 'Undo Last Change',
      hint: 'Ctrl+Z',
      run: () => {
        const lbl = undoState();
        if (lbl) {
          ctx.renderAll?.();
          showToast(`Undid: ${lbl}`);
        } else showToast('Nothing to undo', true);
      },
    },
    {
      id: 'act-redo',
      group: 'Actions',
      title: 'Redo Last Change',
      hint: 'Ctrl+Y',
      run: () => {
        const lbl = redoState();
        if (lbl) {
          ctx.renderAll?.();
          showToast(`Redid: ${lbl}`);
        } else showToast('Nothing to redo', true);
      },
    },
    {
      id: 'act-baseline',
      group: 'Actions',
      title: getState().baselines?.global ? 'Clear Pinned Baseline' : 'Pin Current KPIs as Baseline',
      hint: 'HUD',
      run: () => document.getElementById('btn-pin-baseline')?.click(),
    },
    {
      id: 'act-unmask',
      group: 'Actions',
      title: 'Unmask All Capability Outliers',
      hint: 'SPC',
      run: () => {
        getState().capability.maskedIndices = [];
        ctx.renderAll?.();
        persistState();
        showToast('All masked points restored');
      },
    },
    {
      id: 'act-theme',
      group: 'View',
      title: 'Toggle High-Contrast Shop-Floor Theme',
      hint: 'Theme',
      run: () => document.getElementById('btn-toggle-theme')?.click(),
    },
    {
      id: 'act-json',
      group: 'Export',
      title: 'Download Workspace JSON Snapshot',
      hint: 'JSON',
      run: () => downloadJSONWorkspace(),
    },
    {
      id: 'act-md',
      group: 'Export',
      title: 'Copy Executive Markdown Report',
      hint: 'MD',
      run: () => copyMarkdown(),
    },
    {
      id: 'act-png',
      group: 'Export',
      title: 'Export Active Module Chart as 2x PNG',
      hint: 'PNG',
      run: () => downloadPNG(getState().activeTab, ctx.renderAll),
    },
    {
      id: 'act-svg',
      group: 'Export',
      title: 'Export Active Module Chart as Vector SVG',
      hint: 'SVG',
      run: () => downloadSVG(getState().activeTab, ctx.renderAll),
    }
  );

  ['cnc', 'smt', 'packaging'].forEach((sc) => {
    cmds.push({
      id: `sc-${sc}`,
      group: 'Scenarios',
      title: `Load Demo Scenario: ${sc.toUpperCase()}`,
      hint: 'Sample',
      run: () => {
        const next = loadScenario(sc);
        ctx.renderAll?.();
        showToast(`Loaded: ${next.scenarioName}`);
      },
    });
  });

  // Quick baseline helper using computeCockpitHealth if needed
  void computeCockpitHealth;
  void pinBaseline;
  void clearBaseline;

  return cmds;
}

function renderPaletteList(ctx) {
  const input = document.getElementById('cmd-palette-input');
  const listEl = document.getElementById('cmd-palette-list');
  if (!listEl) return;

  const q = (input?.value || '').trim().toLowerCase();
  const all = buildCommands(ctx);
  filteredCommands = q
    ? all.filter((c) => `${c.group} ${c.title} ${c.hint}`.toLowerCase().includes(q))
    : all;

  if (selectedIdx >= filteredCommands.length) selectedIdx = 0;

  listEl.innerHTML =
    filteredCommands.length === 0
      ? '<div class="p-4 text-xs font-mono text-teal-slate">No matching commands</div>'
      : filteredCommands
          .map(
            (c, idx) => `
          <button type="button" data-cmd-idx="${idx}" class="cmd-item w-full px-4 py-2.5 flex items-center justify-between text-left border-b border-navy-border/50 cursor-pointer ${idx === selectedIdx ? 'bg-indigo-royal text-rose-dusty' : 'text-icemint hover:bg-navy-panel'}">
            <div class="flex items-center gap-2.5">
              <span class="px-1.5 py-0.5 text-[10px] font-mono uppercase rounded-xs bg-navy-canvas border border-navy-border text-teal-slate">${escapeHtml(c.group)}</span>
              <span class="text-xs font-semibold">${escapeHtml(c.title)}</span>
            </div>
            <span class="kbd-chip">${escapeHtml(c.hint)}</span>
          </button>`
          )
          .join('');

  listEl.querySelectorAll('.cmd-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cmd = filteredCommands[parseInt(btn.dataset.cmdIdx, 10)];
      closeCommandPalette();
      if (cmd) cmd.run();
    });
  });
}

export function openCommandPalette(ctx) {
  const modal = document.getElementById('cmd-palette-modal');
  const input = document.getElementById('cmd-palette-input');
  if (!modal || !input) return;
  paletteOpen = true;
  selectedIdx = 0;
  input.value = '';
  modal.classList.remove('hidden');
  renderPaletteList(ctx);
  setTimeout(() => input.focus(), 10);
}

export function closeCommandPalette() {
  const modal = document.getElementById('cmd-palette-modal');
  if (modal) modal.classList.add('hidden');
  paletteOpen = false;
}

export function isCommandPaletteOpen() {
  return paletteOpen;
}

export function bindCommandPalette(ctx) {
  const modal = document.getElementById('cmd-palette-modal');
  const input = document.getElementById('cmd-palette-input');

  document.getElementById('btn-open-cmd')?.addEventListener('click', () => openCommandPalette(ctx));
  modal?.addEventListener('click', (e) => {
    if (e.target.id === 'cmd-palette-modal') closeCommandPalette();
  });

  input?.addEventListener('input', () => {
    selectedIdx = 0;
    renderPaletteList(ctx);
  });

  input?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredCommands.length) selectedIdx = (selectedIdx + 1) % filteredCommands.length;
      renderPaletteList(ctx);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredCommands.length) selectedIdx = (selectedIdx - 1 + filteredCommands.length) % filteredCommands.length;
      renderPaletteList(ctx);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = filteredCommands[selectedIdx];
      closeCommandPalette();
      if (cmd) cmd.run();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeCommandPalette();
    }
  });
}
