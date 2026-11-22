export const SAMPLE_CSV_BY_MODULE = {
  capability: `Measurement\n25.02\n24.98\n25.05\n25.01\n24.96\n25.04\n24.99\n25.07\n25.00\n24.95\n25.03\n25.06\n24.97\n25.02\n25.08\n25.04\n25.09\n25.11\n25.13\n25.18`,
  oee: `Date\tShift\tLine\tPlanned_Min\tDowntime_Min\tCycle_Sec\tTotal_Output\tScrap_Qty\n2026-11-20\tDay\tLine-A\t480\t28\t24\t1040\t14\n2026-11-20\tNight\tLine-A\t480\t52\t24\t950\t22\n2026-11-21\tDay\tLine-B\t480\t19\t24\t1090\t9\n2026-11-21\tNight\tLine-B\t480\t44\t24\t990\t18`,
  pareto: `Defect_Reason,Scrap_Cost_USD,Line\nBurr,$48,Cell-1\nBurr,$55,Cell-1\nScratch,$32,Cell-2\nTolerance,$215,Cell-2\nBurr,$42,Cell-2\nTolerance,$190,Cell-2\nTorque,$88,Cell-1\nTolerance,$240,Cell-1\nScratch,$29,Cell-1\nFinish,$64,Cell-2`,
  takt: `Workstation,VA_Sec,BNVA_Sec,Waste_Sec\nLoad,12,6,3\nRough Mill,44,10,8\nFinish Bore,52,12,9\nDeburr,22,7,11\nCMM Check,28,9,4`,
  vsm: `Step,Cycle_Sec,Changeover_Min,Uptime_Pct,Operators,Queue_Hrs\nBlanking,35,12,97,1,3.5\nStamping,62,28,91,2,6.0\nHeat Treat,88,15,95,1,8.5\nGrind,54,18,93,2,4.0\nFinal Test,40,5,99,1,2.0`,
};

export function isNumericToken(val) {
  if (typeof val === 'number') return Number.isFinite(val);
  const s = String(val == null ? '' : val).trim();
  if (!s) return false;
  const cleaned = s.replace(/[$,%\s]/g, '').replace(/,/g, '');
  if (!cleaned) return false;
  const num = Number(cleaned);
  return Number.isFinite(num);
}

/**
 * Inspects up to 5 non-empty lines to distinguish TSV (Excel Ctrl+V), CSV, or semicolon CSV.
 */
export function detectDelimiter(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 5);

  if (lines.length === 0) return ',';

  const countOutsideQuotes = (line, delim) => {
    let inQuotes = false;
    let count = 0;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (!inQuotes && ch === delim) {
        count++;
      }
    }
    return count;
  };

  const candidates = ['\t', ',', ';'];
  let bestDelim = ',';
  let bestScore = -1;

  for (const delim of candidates) {
    const counts = lines.map((ln) => countOutsideQuotes(ln, delim));
    const nonZero = counts.filter((c) => c > 0);
    if (nonZero.length === 0) continue;
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const consistent = counts.every((c) => c === counts[0]) ? 1.5 : 1.0;
    const score = avg * consistent;
    if (score > bestScore) {
      bestScore = score;
      bestDelim = delim;
    }
  }
  return bestDelim;
}

/**
 * RFC-4180 compliant delimiter parser supporting quoted fields, escaped quotes,
 * CRLF/LF, and headerless single-column numeric Excel pastes.
 */
export function parseDelimitedText(text, forcedDelimiter = null) {
  const raw = String(text || '').replace(/^\uFEFF/, '').trim();
  if (!raw) return { headers: [], rows: [], delimiter: ',' };

  const delimiter = forcedDelimiter || detectDelimiter(raw);
  const matrix = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inQuotes) {
      if (ch === '"') {
        if (raw[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\r') {
      if (raw[i + 1] === '\n') i++;
      row.push(cell.trim());
      if (row.some((c) => c !== '')) matrix.push(row);
      row = [];
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.trim());
      if (row.some((c) => c !== '')) matrix.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  row.push(cell.trim());
  if (row.some((c) => c !== '')) matrix.push(row);

  if (matrix.length === 0) return { headers: [], rows: [], delimiter };

  // Handle headerless numeric pastes (e.g., copying a column of numbers directly from Excel)
  const firstRow = matrix[0];
  const firstRowAllNumeric = firstRow.length > 0 && firstRow.every((c) => isNumericToken(c));
  if (firstRowAllNumeric) {
    const synthHeaders = firstRow.length === 1 ? ['Value'] : firstRow.map((_, idx) => `Value_${idx + 1}`);
    return { ...normalizeTable([synthHeaders, ...matrix]), delimiter };
  }

  return { ...normalizeTable(matrix), delimiter };
}

/**
 * Ensures unique non-empty header names and rectangular row lengths.
 */
export function normalizeTable(matrix) {
  if (!Array.isArray(matrix) || matrix.length === 0) {
    return { headers: [], rows: [] };
  }

  const maxCols = matrix.reduce((m, r) => Math.max(m, Array.isArray(r) ? r.length : 0), 0);
  if (maxCols === 0) return { headers: [], rows: [] };

  const rawHeaders = Array.isArray(matrix[0]) ? matrix[0] : [];
  const seen = new Map();
  const headers = [];

  for (let c = 0; c < maxCols; c++) {
    let base = String(rawHeaders[c] == null ? '' : rawHeaders[c]).trim();
    if (!base) base = `Column ${c + 1}`;
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    headers.push(count === 0 ? base : `${base} (${count + 1})`);
  }

  const rows = [];
  for (let r = 1; r < matrix.length; r++) {
    const src = Array.isArray(matrix[r]) ? matrix[r] : [];
    const normalized = new Array(maxCols);
    let nonEmpty = false;
    for (let c = 0; c < maxCols; c++) {
      const val = src[c] == null ? '' : String(src[c]).trim();
      if (val !== '') nonEmpty = true;
      normalized[c] = val;
    }
    if (nonEmpty) rows.push(normalized);
  }

  return { headers, rows };
}

/**
 * Browser spreadsheet parser supporting .xlsx/.xls via SheetJS (window.XLSX)
 * and text formats (.csv, .tsv, .txt) via parseDelimitedText.
 */
export async function parseSpreadsheetFile(file) {
  if (!file) throw new Error('No file provided');
  const name = String(file.name || 'data.csv');
  const lower = name.toLowerCase();

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const xlsxLib = typeof window !== 'undefined' ? window.XLSX : null;
    if (!xlsxLib) {
      throw new Error('Excel parser (SheetJS) not loaded. Export to CSV or paste cells directly.');
    }
    const buf = await file.arrayBuffer();
    const workbook = xlsxLib.read(buf, { type: 'array' });
    const sheetNames = workbook.SheetNames || [];
    if (sheetNames.length === 0) throw new Error('Workbook contains no sheets');
    const firstSheet = workbook.Sheets[sheetNames[0]];
    const matrix = xlsxLib.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
    const normalized = normalizeTable(matrix);
    return { ...normalized, sheetNames, sourceName: name };
  }

  const text = await file.text();
  const parsed = parseDelimitedText(text);
  return { headers: parsed.headers, rows: parsed.rows, sheetNames: [], sourceName: name };
}
