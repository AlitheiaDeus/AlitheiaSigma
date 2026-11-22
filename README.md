# MudaSlayer

A zero-build, local-first Lean & Operational Excellence analytical workbench for inspecting real process data, hunting bottlenecks, and exporting executive reports.

## What's Inside

### Universal Data Ingestion (`Import Data` or press `i`)
- **Excel & CSV Dropzone**: Parse `.xlsx`, `.xls`, `.csv`, `.tsv`, or `.txt` files 100% locally in the browser (powered by SheetJS for Excel workbooks and an RFC-4180 delimiter parser).
- **Direct Excel / Sheets `Ctrl+V` Paste**: Copy cells or a single raw column of numbers from Excel/Google Sheets and paste directly—MudaSlayer auto-detects tab/comma/semicolon delimiters and synthesizes headers for headerless numeric pastes.
- **Heuristic Column Mapper**: Suggests target fields by header aliases and column types (`number`, `date`, `text`), with dropdown overrides and live 5-row previews.

### 8 Analytical & Reporting Modules (`1`–`8` keyboard shortcuts, URL hash `#capability`..`#export`)
1. **Capability & SPC** — Dual mode:
   - *Data Mode*: Empirical process capability ($C_p$, $C_{pk}$ within-subgroup via $\overline{MR}/d_2$; $P_p$, $P_{pk}$ overall), observed vs expected PPM, auto-scaled histogram + fitted normal curves, and companion **I-MR Statistical Control Chart** with Western Electric Rule 1 & 8-point run detection.
   - *Simulator Mode*: Interactive draggable normal bell curve, sigma bands, and tolerance bounds.
2. **OEE** — Multi-shift production log with line filter, OEE/Availability/Performance/Quality trend chart (against 85% World Class benchmark), and time-loss waterfall, plus Single Shift slider mode.
3. **Takt** — Yamazumi stacked workstation cycle balance chart (`VA`, `BNVA`, `Waste`) against Takt pace, with direct bottleneck handoff to Ishikawa.
4. **Pareto** — Dual mode: group raw defect/downtime event logs by **Frequency Count** or **Weighted Impact** (cost/minutes) with group filtering, or edit a Summary Table directly. Send any driver directly to Ishikawa.
5. **VSM** — Value Stream Map with inventory queue triangles, process data boxes, sawtooth lead-time ladder, Process Cycle Efficiency (PCE), one-click **Sync Steps → Takt**, and **Bottleneck → Ishikawa**.
6. **5S** — 5-axis workplace audit radar chart, 5×4 scoring matrix, benchmark target slider, and corrective action log.
7. **Ishikawa** — Six-rib Fishbone (6M) root cause builder with root-suspect highlighting and cross-module seeding.
8. **Export Hub** — Download **JSON** workspace snapshots, **CSV** tables, **Copy TSV** (Excel paste-ready), **SVG** vectors, **2x PNG** charts (+ copy image), **Markdown (`.md`)** executive summaries, standalone **HTML** bundles, and light-mode **Print / PDF** reports.

### Sample Factory Scenarios
Switch between **Precision CNC Cell**, **SMT Electronics Line**, and **High-Speed Packaging** in the top bar to explore complete multi-module datasets.

## Project Structure

```text
MudaSlayer/
├── index.html                 # Application shell & module sections
├── styles/theme.css           # Industrial navy/mint/crimson tokens & print stylesheet
├── src/
│   ├── constants.js           # Palette tokens, tab config, sample factory scenarios
│   ├── state.js               # localStorage persistence & v1->v2 state migration
│   ├── utils.js               # Formatters, CSV/TSV builders, clipboard & downloads
│   ├── main.js                # Application bootstrap
│   ├── data/                  # parser.js, mapper.js, importDrawer.js
│   ├── modules/               # Pure *Math.js engines + DOM/SVG module controllers
│   ├── export/                # json.js, csv.js, svg.js, png.js, markdown.js, htmlReport.js
│   └── ui/                    # toast.js, navigation.js
└── tests/                     # Native Node unit tests (node --test)
```

## Running Locally

Because ES Modules require an HTTP origin, serve the root directory with any static server:

```bash
npx serve .
# or: python -m http.server 8000
```

Then open `http://localhost:3000` (or `http://localhost:8000`).

## Running Tests

Requires Node.js v20+ (no npm dependencies needed):

```bash
npm test
# or: node --test tests/*.test.mjs
```
