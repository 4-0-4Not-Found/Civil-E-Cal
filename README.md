# Structural Steel Calculators

Structural Steel Calculators is a web-based engineering tool for civil engineering students. It runs AISC-style checks in the browser using **local TypeScript calculation modules** and provides a lightweight, mobile-friendly UI with offline support via a **Progressive Web App (PWA)**.

Repository: `github.com/4-0-4Not-Found/Civil-E-Cal`

---

## Description

This project is designed to support coursework and self-study by:

- Providing clear inputs, outputs, and step-by-step breakdowns where available
- Saving work locally in the browser as you iterate
- Generating a combined **Report** view suitable for printing or exporting as a PDF

All engineering computations are performed locally (no external calculation service). The project is intended for **educational use**.

---

## Features

- **Multiple calculators (modules)**: Tension, Compression, and Beam
- **Report**: Combined snapshot of saved module work from this browser
- **Info**: Capabilities, units, limitations, and workflow tips
- **Local persistence**: Inputs auto-save to `localStorage`
- **Exports**: CSV/JSON where offered in-module
- **Responsive + accessible UI**: Mobile-first layouts, keyboard-friendly controls
- **PWA + offline support**: Works offline after an initial load (see details below)

---

## Modules overview

| Module | Route | Summary |
|---|---|---|
| **Tension** | `/tension` | Gross yielding, net-section fracture, block shear (with an optional stagger helper) |
| **Compression** | `/compression` | Member compression/buckling-style checks with K and length inputs |
| **Beam (Bending & Shear)** | `/bending-shear` | Flexure, shear, and deflection checks; includes a load-to-demand helper |
| **Report** | `/report` | Reads saved module state and renders a printable project summary |
| **Info** | `/info` | What the tool covers, units/conventions, limitations, and tips |

---

## Tech stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19 + TypeScript
- **Styling**: Tailwind CSS v4
- **PWA**: `next-pwa`
- **Tests**: Vitest (calculation regression tests)

---

## Project structure

The project uses the **Next.js App Router**. These folders are the main entry points for both users and developers:

```text
src/
├── app/                      # App Router routes (pages) and route handlers (API)
│   ├── page.tsx              # Home dashboard
│   ├── tension/page.tsx      # Tension module page
│   ├── compression/page.tsx  # Compression module page
│   ├── bending-shear/page.tsx# Beam module page
│   ├── report/page.tsx       # Report page (reads saved browser state)
│   ├── info/page.tsx         # Help, units, limitations
│   ├── offline/page.tsx      # Offline fallback page (PWA)
│   └── api/                  # Route handlers used for logging/diagnostics (see below)
│
├── components/               # Reusable UI components (cards, fields, buttons, nav, tables, etc.)
└── lib/                      # Calculation logic, domain data, formatting, and storage keys

public/                       # Static assets + generated service worker files (PWA)
```

### Notes for developers

- **Engineering logic** lives under `src/lib/` (pure TypeScript modules).
- **UI components** should remain reusable and calculation-agnostic where possible.
- **Routes/pages** under `src/app/` wire inputs to calculations and render results.

---

## Installation guide

### Prerequisites

- Node.js (LTS recommended)
- npm

### Install and run (development)

```bash
git clone https://github.com/4-0-4Not-Found/Civil-E-Cal.git
cd Civil-E-Cal
npm install
npm run dev
```

Then open `http://localhost:3000`.

### Production build

```bash
npm run build
npm run start
```

### Quality checks

```bash
npm run lint
npm test
```

---

## Usage guide

### How students typically use the tool

1. Start on **Home** (`/`) and open a module.
2. Enter the required inputs (steel, section, demands, method, etc.).
3. Review results and (when available) step-by-step calculation tables.
4. Use the in-module actions to **copy**, **export**, and navigate to key sections (Results/Steps).
5. Open **Report** (`/report`) to generate a combined summary from the values saved in this browser.

### Report behavior (important)

The Report page reads module state from **this device + this browser** via `localStorage`. If you switch browsers, clear site data, or use a different device, your saved module inputs will not be present unless you restore them using the app’s backup/restore flow (when used).

---

## PWA and offline support

This project is configured as a **Progressive Web App** using `next-pwa`.

- After the app loads once, the service worker caches core assets.
- If you later open the app with no network, the app may show the **Offline** page (`/offline`) depending on what is cached.
- Installation is supported via the browser’s “Install” UX (where available).

---

## Design and UX principles

- **Mobile-first** layouts with sensible spacing and tap targets
- **Readable engineering output** (tabular numbers, clear labels, minimal visual noise)
- **Keyboard navigation** and visible focus states
- **Avoid horizontal scrolling** except where tables intentionally scroll

---

## API routes (logging & diagnostics)

API routes live under `src/app/api/`.

- These endpoints are intended for **development diagnostics**.
- In production builds, diagnostic routes are designed to be **no-ops or unavailable** to keep deployments safe and lightweight.

---

## Contribution guidelines

- Keep changes **small and focused**.
- Do not change correct engineering formulas or behavior without adding/adjusting tests under `src/lib/`.
- Before opening a PR, run:

```bash
npm run lint
npm test
npm run build
```

---

## License

MIT License. (If your repository includes a `LICENSE` file, GitHub will display the license automatically.)

---

## Disclaimer

This tool is for **educational use**. It does not replace professional engineering judgment, peer review, or building code compliance. Verify critical designs with appropriate standards and qualified personnel.
