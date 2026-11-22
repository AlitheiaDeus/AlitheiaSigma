# MudaSlayer

A single-file, zero-build Lean & Operational Excellence interactive suite for process analysis, bottleneck hunting, and continuous improvement.

## Modules

1. **Capability** — Interactive Process Capability Simulator ($C_p$, $C_{pk}$, specification limits, distribution visualization)
2. **OEE** — Overall Equipment Effectiveness calculator (Availability, Performance, Quality)
3. **Takt** — Takt Time & line balancing analyzer
4. **Pareto** — Pareto chart builder for defect/loss prioritization
5. **VSM** — Value Stream Mapping workspace
6. **5S** — 5S workplace organization audit
7. **Ishikawa** — Fishbone (cause-and-effect) diagram builder
8. **Export** — Workspace JSON, CSV, SVG, and HTML report exports (with `localStorage` persistence)

## Running Locally

Open `index.html` directly in your browser, or serve it with any static file server:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.
