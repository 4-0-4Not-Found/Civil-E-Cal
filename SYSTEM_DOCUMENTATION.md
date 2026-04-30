# Structural Steel Calculators — System Documentation

## Introduction

### Purpose of the system
Structural Steel Calculators is a web-based engineering tool that helps users run **AISC 360–style structural steel checks** directly in the browser. It is built for learning and iterative design/checking workflows: enter inputs, review results and steps, then compile a combined report.

### Target users
- **Primary**: civil/structural engineering students completing steel design coursework.
- **Secondary**: instructors/TAs who want a quick, consistent tool for demonstrations and homework support.

This tool is intended for **educational use** and does not replace professional engineering judgment.

---

## System overview

### How the system works (high level)
- The UI is implemented as a **multi-page Next.js App Router** application.
- Each calculator module is a client-rendered page that:
  - manages form state in React,
  - persists inputs to `localStorage`,
  - calls **local TypeScript calculation functions** under `src/lib/`,
  - renders results, limit states, and a step-by-step breakdown.
- The **Report** module reads saved module inputs from `localStorage` and recomputes summaries using the same calculation engine, ensuring consistency between modules and report output.
- The app is configured as a **PWA** so it can be installed and used offline after an initial load (subject to cache state).

### Key features and capabilities
- Dedicated modules for:
  - Tension
  - Compression
  - Beam (bending, shear, deflection)
  - Report (combined snapshot)
  - Info (capabilities, units, limitations, tips)
- **Local persistence**: module inputs auto-save in the browser.
- **Exports**: module actions include copy/export options where implemented.
- **Responsive UI**: mobile-first layout and touch-friendly controls.
- **Offline support**: service worker caching + offline fallback route (`/offline`).

---

## System architecture

### Frontend (Next.js App Router)
The app uses Next.js 16’s **App Router**. Pages are located under `src/app/` and are routed by folder name.

Key user-facing routes:
- `/` (Home)
- `/tension`
- `/compression`
- `/bending-shear`
- `/report`
- `/info`
- `/offline` (PWA fallback page)

Redirect:
- `/scope` → `/info` (permanent redirect configured in `next.config.ts`)

### Component structure
Reusable UI and feature components live under `src/components/`. Examples include:
- layout shell (`AppShell`) and navigation (`AppHeader`, `PageFooterNav`, `PageSectionNav`)
- UI primitives (`Card`, `Button`, `Field`, inputs)
- results display (`ResultHero`, `UtilizationBar`)
- step-by-step tables (`StepsTable`)
- action controls (`CalculatorActionRail`, export/copy helpers)

### “Backend” logic (local TypeScript modules)
All engineering logic is implemented as local, importable TypeScript functions under `src/lib/`. These modules do not depend on a remote API for computations.

Key calculation entry points include:
- `src/lib/calculations/tension.ts`: `calculateTensionDesign(...)`
- `src/lib/calculations/compression.ts`: `calculateCompressionDesign(...)`
- `src/lib/calculations/bending.ts`: `calculateBendingShearDesign(...)`

Calculation functions return a structured output (see `src/lib/types/calculation`) that includes:
- a numeric **capacity/strength** (and demand),
- a **governing case** identifier,
- a set of **limit-state results**,
- and a structured **step list** (for step-by-step tables).

### API routes overview (`src/app/api/`)
The project includes a small set of API route handlers used for logging/diagnostics during development.

Routes present in this repository:
- `POST /api/agent-log`: development logging endpoint (no-op in production)
- `GET /api/agent-beacon`: development diagnostic beacon (no-op in production)
- `POST /api/debug-log`: development diagnostic logging (no-op in production)
- `GET /api/where`: development-only environment info (**returns 404 in production**)

These routes are intentionally restricted in production builds to keep deployments safe and lightweight.

---

## Modules description

### Tension
**Route**: `/tension`  
**Purpose**: Evaluate axial tension member capacity using gross yielding, net-section rupture, and block shear checks, and provide learning-focused steps.

**Key functions (calculation layer)**:
- `calculateTensionDesign(...)` (`src/lib/calculations/tension.ts`)
- `staggeredNetWidthInches(...)` (`src/lib/calculations/net-area.ts`) — helper used by the UI tool

**Key inputs (UI-level)**:
- Material (Fy, Fu) via `src/lib/data/materials.ts`
- Shape selection (AISC v16 database) via `src/lib/aisc/data.ts`
- Areas and factors: \(A_g\), \(A_n\), \(U\)
- Demand: \(P_u\) / \(P_a\) depending on design method
- Optional block shear areas: \(A_{gv}, A_{nv}, A_{gt}, A_{nt}\) and \(U_{bs}\)

**Outputs**:
- Governing case + controlling strength (kips)
- Limit-state capacities (yielding, rupture, block shear)
- Step-by-step trail suitable for display in `StepsTable`

### Compression
**Route**: `/compression`  
**Purpose**: Evaluate axial compression capacity with a focus on member buckling behavior and KL/r sensitivity.

**Key functions (calculation layer)**:
- `calculateCompressionDesign(...)` (`src/lib/calculations/compression.ts`)

**Key inputs (UI-level)**:
- Material (Fy) via `src/lib/data/materials.ts`
- Shape selection via `src/lib/aisc/data.ts` and family filters (`src/lib/aisc/shape-filters.ts`)
- Effective length factor \(K\), unbraced length \(L\)
- Section properties (e.g., \(r_x\), \(r_y\), \(A_g\)) from the shape database

**Outputs**:
- Controlling compression strength (kips) and safe/unsafe status for the entered demand
- Step-by-step values including slenderness, Euler stress, and critical stress selection

### Beam (Bending and Shear)
**Route**: `/bending-shear`  
**Purpose**: Evaluate a simply supported strong-axis member for flexure, shear, and deflection, and provide a quick load-to-demand helper workflow.

**Key functions (calculation layer)**:
- `calculateBendingShearDesign(...)` (`src/lib/calculations/bending.ts`)
- Load helper utilities under `src/lib/excel-parity` (used to convert D/L inputs into demands)
- `flangeWebSlenderness(...)` (`src/lib/calculations/section-slenderness.ts`) — classification info displayed in UI

**Key inputs (UI-level)**:
- Material selection (Fy)
- Shape selection (W-shapes and (in check mode) HSS are supported by the UI)
- Demands: \(M_u\), \(V_u\)
- Length/span: \(L\) (inches) and service load used for deflection
- Lateral-torsional buckling inputs: \(L_b\) and \(C_b\)

**Outputs**:
- Limit-state utilization ratios (bending, shear, deflection) and a governing check
- Summary results rendered in `ResultHero` + limit-state cards
- Step-by-step calculation output

### Report
**Route**: `/report`  
**Purpose**: Present a combined project summary derived from saved module inputs in the current browser.

**How it works**:
- Reads module input blobs from `localStorage` (`src/lib/storage/keys.ts`)
- Summarizes modules using `src/lib/report/snapshot-store.ts` which calls module-specific summarizers
- Renders tables designed for print/PDF workflows

**Inputs**:
- Saved browser state only (no manual inputs on the Report page)

**Outputs**:
- A combined summary for Tension, Compression, and Beam
- Print/PDF-friendly layout, including calculation step tables when available

### Info
**Route**: `/info`  
**Purpose**: Provide in-app documentation: capabilities, limitations, units, and tips.

**Content**:
- Summarizes what each module covers and what the system does not replace
- Documents common unit conventions used in the calculators

---

## Data and calculations

### How calculations are handled
- Calculations are executed locally by calling deterministic TypeScript functions in `src/lib/calculations/`.
- UI pages pass parsed numeric inputs (strings from inputs → numbers) to calculation functions.
- Calculation functions return a structured output including:
  - limit-state results and governing case
  - demand vs capacity comparisons
  - step-by-step values for educational review

### Engineering data sources
- **AISC v16 shapes**: loaded from `data/aisc-shapes-v16.json` and exposed via `src/lib/aisc/data.ts`.
- **Material presets**: defined in `src/lib/data/materials.ts` (Fy/Fu for common grades used by the UI).
- **Bolt data**: defined in `src/lib/data/bolts.ts` (areas, nominal strengths, pretension values used by slip-critical checks).

---

## User workflow

### End-to-end flow (typical)
1. **Open Home** (`/`) and select a module.
2. **Enter inputs** (material, shape, demands, geometry, method) as prompted.
3. The module **auto-saves** inputs locally (per-module key in `localStorage`).
4. The UI recomputes and displays:
   - status (safe/unsafe/invalid),
   - governing case,
   - limit-state capacities/utilizations,
   - step-by-step table(s).
5. Use module actions to:
   - jump to results/steps sections,
   - copy a summary,
   - export data where provided.
6. Open **Report** (`/report`) to generate a combined snapshot from the saved module inputs in this browser.

---

## Project structure (folders)

### `src/app/`
Holds page routes and route handlers:
- module pages (`/tension`, `/compression`, `/bending-shear`)
- supporting routes (`/report`, `/info`, `/offline`)
- development diagnostic API routes under `src/app/api/`

### `src/components/`
Reusable presentation and interaction components: layout shells, UI primitives, navigation, step tables, results cards, and action rails.

### `src/lib/`
Domain logic and shared utilities:
- calculation engines (`src/lib/calculations/`)
- engineering data access (`src/lib/aisc/`, `src/lib/data/`)
- report summarization (`src/lib/report/`)
- persistence keys (`src/lib/storage/`)

### `src/app/api/`
Small set of development diagnostics/logging routes. In production, these are gated to be no-ops or unavailable.

---

## Technical stack

- **Next.js 16** (App Router)
- **React 19** + **TypeScript**
- **Tailwind CSS v4**
- **next-pwa** for service worker generation and offline fallback routing
- **Vitest** for calculation regression testing

---

## PWA and offline functionality

PWA behavior is configured in `next.config.ts` via `next-pwa`:
- Service worker output is written to `public/`
- PWA is disabled in development (`disable: process.env.NODE_ENV === "development"`)
- Offline fallback document route is `/offline`

In practice:
- After a successful online load, core assets can be cached.
- When offline, navigation may fall back to `/offline` if a route is not available in cache.

---

## System limitations

The in-app Info page documents key limitations. Examples include:
- The tool does not replace full connection design (eccentric bolt groups, full end-plate/T-stub prying, combined weld limit states beyond the implemented checks).
- Beam design mode does not search HSS (HSS is intended for check mode with the module’s stated simplifications).
- Not all advanced AISC provisions are implemented for every possible shape and condition; some checks are simplified for education.

See `/info` for the canonical, user-facing limitations list.

---

## Future improvements (realistic)

Suggestions that fit the existing architecture (UI pages + pure calculation modules):
- **More explicit input validation UX**: tighter per-field validation messaging and disabling exports when required inputs are missing.
- **Expanded test coverage**: add more regression cases for edge inputs (very small/large values, boundary conditions).
- **More report configurability**: include optional “key steps only” sections per module (reusing existing step filtering logic where applicable).
- **Performance profiling pass**: reduce unnecessary recalculations by memoizing derived UI-only structures (while keeping calculations correct and readable).
