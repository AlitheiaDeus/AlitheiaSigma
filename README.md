<div align="center">
  <img src="favicon.svg" alt="SigmaShack" width="64" height="64" />
  <h1>SigmaShack</h1>
  <p><strong>Zero-build, local-first Lean &amp; Six Sigma analytical workbench for turning messy shop-floor spreadsheets into SPC, OEE, Pareto, VSM, and Root-Cause visuals.</strong></p>

  <p>
    <img src="https://img.shields.io/badge/Architecture-Zero--Build%20ESM-45E1A5?style=flat-square&labelColor=0A113E" alt="Zero-Build ESM" />
    <img src="https://img.shields.io/badge/Privacy-100%25%20Browser--Local-D929CF?style=flat-square&labelColor=0A113E" alt="100% Browser-Local" />
    <img src="https://img.shields.io/badge/Ingestion-.xlsx%20%7C%20.csv%20%7C%20Excel%20Paste-59A8A2?style=flat-square&labelColor=0A113E" alt="Ingestion" />
  </p>
</div>

---

## Chart Previews

| Capability & SPC | OEE Trend & Time-Loss | Takt (Yamazumi) |
| :---: | :---: | :---: |
| <img src="docs/screenshots/capability.png" alt="SigmaShack Capability & SPC" width="280" /> | <img src="docs/screenshots/oee.png" alt="SigmaShack OEE" width="280" /> | <img src="docs/screenshots/takt.png" alt="SigmaShack Takt" width="280" /> |

| Pareto 80/20 | Value Stream Map (VSM) | 5S Audit Radar |
| :---: | :---: | :---: |
| <img src="docs/screenshots/pareto.png" alt="SigmaShack Pareto" width="280" /> | <img src="docs/screenshots/vsm.png" alt="SigmaShack VSM" width="280" /> | <img src="docs/screenshots/fives.png" alt="SigmaShack 5S" width="280" /> |

| Gage R&R (MSA) | A/B Kaizen Comparator | 5-Whys & PFMEA |
| :---: | :---: | :---: |
| <img src="docs/screenshots/msa.png" alt="SigmaShack Gage R&R" width="280" /> | <img src="docs/screenshots/comparator.png" alt="SigmaShack A/B Comparator" width="280" /> | <img src="docs/screenshots/fmea.png" alt="SigmaShack 5-Whys & PFMEA" width="280" /> |

<p align="center">
  <strong>Ishikawa 6M Fishbone</strong><br />
  <img src="docs/screenshots/ishikawa.png" alt="SigmaShack Ishikawa" width="320" />
</p>

---

## Core Capabilities

### 1. Universal Spreadsheet & Clipboard Ingestion (`Import Data` or `i`)
- **Multi-Sheet Excel & CSV**: Drop `.xlsx`, `.xls`, `.csv`, `.tsv`, or `.txt` files directly in the browser (powered locally by SheetJS + an RFC-4180 delimiter parser) and switch between workbook sheets without re-uploading.
- **Direct Excel / Sheets `Ctrl+V` Paste**: Copy cells—or even a single headerless column of numbers—straight from Excel and paste.
- **Messy-Sheet Cleanup**: Auto-skips leading blank rows, single-cell title banners, and empty leading columns, with manual **First row is headers** and **Start Row #** overrides.
- **Data Provenance**: Every module displays a live **Data Source badge** (imported file/sheet/column vs. manual edit vs. cross-link vs. sample demo) and a **Raw Data** modal to inspect the underlying rows.

### 2. Eleven Modules (`1`–`9`, `0`, `e` Shortcuts · `#capability`..`#export` URL Hash)
1. **Capability & SPC** — Empirical $C_p/C_{pk}$ (within-subgroup via $\overline{MR}/d_2$), $P_p/P_{pk}$ (overall), Taguchi $C_{pm}$, **Anderson-Darling** normality test badge, **Normal / Lognormal / Weibull / Log-Logistic / Non-Parametric (ISO 22514-2)** toggle, draggable `LSL` / `Target (T)` / `USL` lines, **I-MR / Xbar-R / Xbar-S / p / u Control Charts** with **Nelson Rules 1–8**, **click-to-mask outliers**, and a **10,000-trial Monte Carlo Tolerance Stack-Up Simulator**, plus an interactive Simulator toggle.
2. **OEE** — Multi-shift production log with line filtering, OEE/Availability/Performance/Quality trendlines (vs. 85% World Class), hover telemetry, and time-loss waterfall, plus Single Shift sliders.
3. **Takt** — Yamazumi stacked cycle balance (`VA`, `BNVA`, `Waste`) with a **vertically draggable Takt line**, segment tooltips, and bottleneck handoff to Ishikawa.
4. **Pareto** — Group raw defect/downtime logs by **Count** or **Weighted Impact** (cost/minutes) with group filtering, a **vertically draggable Vital Few cutoff (`50%–95%`)**, and one-click **→ Ishikawa** seeding.
5. **VSM** — Value Stream Map with queue triangles, process data boxes, sawtooth lead-time ladder, PCE calculation, hover tooltips, **Sync Steps → Takt**, and **Bottleneck → Ishikawa**.
6. **5S** — 5-axis workplace audit radar chart, 5×4 scoring matrix, benchmark slider, and corrective action log.
7. **Ishikawa** — Six-rib Fishbone (6M) root cause builder with root-suspect highlighting and direct **5-Whys** / **→ FMEA** drill-down.
8. **Gage R&R (MSA)** — Crossed **ANOVA & Xbar-R Range** Measurement System Analysis (`%GRR`, `%Tolerance`, `ndc`, Repeatability `EV` vs. Reproducibility `AV`), Variance Components bar chart, and Operator × Part interaction plot.
9. **A/B Compare** — Before/After Kaizen hypothesis comparator with **Welch's 2-sample $t$-test**, **Brown-Forsythe** variance test, **Mann-Whitney $U$**, **Cohen's $d$**, and overlaid distributions + box-whisker plot.
10. **5-Whys & FMEA** — Linked 5-Whys root-cause chains with one-click **Promote → PFMEA**, `S × O × D = RPN` prioritization matrix, and RPN risk bar chart.
11. **Data & Export Hub** — Inspect all module data sources, manage **Saved Studies** (multi-workspace persistence), load demo scenarios, and export **JSON**, **CSV**, **Copy TSV** (Excel-ready), **SVG**, **2x PNG**, **Markdown (`.md`)**, standalone **HTML**, or light-mode **Print / PDF**.

### 3. Power-User Controls & Cockpit HUD
- **Cell Health Cockpit HUD**: Live Red/Amber/Green LED strip across key KPIs (`Cpk`, `OEE`, `Takt Gap`, `VSM PCE`, `5S`, `Gage R&R`, `Max RPN`) with actionable engineering **Insights** and **Pin Baseline** before/after comparisons.
- **Command Palette (`Ctrl+K` / `/`)**: Fuzzy-search launcher for switching modules, loading scenarios, pinning baselines, toggling **High-Contrast Shop-Floor Theme**, and running exports.
- **Undo / Redo (`Ctrl+Z` / `Ctrl+Y`)**: 40-step workspace history stack.

---

## Reference Sample Data

Built-in demo scenarios (*Precision CNC Cell*, *SMT Electronics Line*, *High-Speed Packaging*) are available under **Data & Export → Demo Scenarios**, and standalone reference CSVs are included in [`samples/`](samples/):

- [`samples/capability_measurements.csv`](samples/capability_measurements.csv) — 20 numeric inspection readings
- [`samples/oee_shift_log.csv`](samples/oee_shift_log.csv) — Multi-shift, multi-line OEE production log
- [`samples/pareto_defect_log.csv`](samples/pareto_defect_log.csv) — Raw defect events with scrap cost & line
- [`samples/takt_workstations.csv`](samples/takt_workstations.csv) — Workstation VA / BNVA / Waste cycle times
- [`samples/vsm_process_steps.csv`](samples/vsm_process_steps.csv) — Process chain steps with changeover, uptime & queue wait

---

## Running Locally

Because ES Modules require an HTTP origin, serve the repository root with any static server:

```bash
python -m http.server 8000
# or: npx serve .
```

Then open **http://localhost:8000** (or `http://localhost:3000`).

### Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| `1` – `9`, `0`, `e` | Switch between modules (`0` = 5-Whys & FMEA, `e` = Data & Export) |
| `Ctrl+K` / `/` | Open Command Palette |
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo workspace changes |
| `i` | Open Import Data modal |
| `Esc` | Close open modal |

---

## Project Structure

```text
SigmaShack/
├── index.html                 # Application shell & 11 module views
├── favicon.svg / favicon.ico  # App icons
├── styles/theme.css           # Industrial navy & high-contrast tokens, print stylesheet
├── docs/screenshots/          # UI previews
├── samples/                   # Reference CSV datasets for testing & import
├── src/
│   ├── constants.js           # Palette tokens, tab config, sample scenarios
│   ├── state.js               # localStorage persistence, undo/redo, workspaces, baselines
│   ├── utils.js               # Formatters, CSV/TSV builders, clipboard & downloads
│   ├── main.js                # Application bootstrap
│   ├── data/                  # parser.js, mapper.js, importDrawer.js
│   ├── modules/               # Pure *Math.js engines + DOM/SVG module controllers (incl. msa, comparator, fmea)
│   ├── export/                # json.js, csv.js, svg.js, png.js, markdown.js, htmlReport.js
│   └── ui/                    # cockpit.js, commandPalette.js, diagnostics.js, navigation.js, sourceBadge.js, svgTooltip.js, toast.js
└── tests/                     # Native Node unit tests (node --test)
```

## Running Tests

Requires Node.js v20+ (zero external npm dependencies):

```bash
npm test
# or: node --test tests/*.test.mjs
```
