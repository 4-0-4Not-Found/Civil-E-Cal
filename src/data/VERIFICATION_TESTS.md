# Manual verification tests

**Automated:** The same numerical expectations are asserted in Vitest — `src/lib/calculations/calculations-verification.test.ts`. Run **`npm run test`** in `aisc-pwa` (no browser required).

**Purpose:** Regression-style checks for the app’s calculation engine. **Numbers** follow AISC 360 in TypeScript; final answers are typically **~3 decimals** in the UI.

### App field names ↔ `localStorage` (for manual entry)

| Module | Route | JSON keys saved under `STORAGE.*` |
|--------|--------|-----------------------------------|
| Tension | `/tension` | `material`, `shapeName`, `designMethod`, `mode`, `Pu`, `U`, `Ag`, `An`, `Agv`, `Anv`, `Agt`, `Ant`, `ubs`, stagger: `stagW`, `stagDh`, `stagN`, `stagS`, `stagG`, `stagT`, `shapeFamily` |
| Compression | `/compression` | `material`, `shapeFamily`, `shapeName`, `k`, `L`, `Pu`, `designMethod` |
| Bending | `/bending-shear` | `designMethod`, `material`, `shapeName`, `mode`, `Mu`, `Vu`, `L`, `wLive`, `deadLoadKft`, `liveLoadKft`, `spanFt`, `unbracedLbIn`, `cbFactor` |
| Report | `/report` | Reads all of the above keys (see `src/lib/storage/keys.ts`). |

**How to use this file**

- **Inputs** = fields in the PWA at the route shown.
- **Expected (app engine)** = values produced by the same calculation code the UI uses (run `npx tsx scripts/compute-verification-fixtures.ts` to regenerate).
- **“Like Excel”:** Enter the same inputs in the **Jason** workbook. The app should **agree within rounding**; Excel may differ slightly if cells round at each step.

---

## 1. Tension — `/tension`

| ID | Use case | Fields & values | Expected (app engine) |
|----|-----------|-----------------|------------------------|
| **T1** | LRFD check — block shear governs, **NOT SAFE** | Mode: **Check**. Steel: **A992**. Shape: **W24X131** (Ag auto 38.6 if linked). **Ag** 38.6, **An** 32, **U** 0.9, **Pu** 900, **Agv** 24, **Anv** 20, **Agt** 8, **Ant** 6.5, **Ubs** 0.5, Design: **LRFD** | Governing: **block shear**. Capacities (kips): gross yielding **1737**, net fracture **1404**, block shear **698.438**. Controlling **698.438**. Demand **900**. **NOT SAFE**. |
| **T2** | ASD — same geometry, lower allowable | Same as T1, Design: **ASD** | Governing: **block shear**. Gross **1155.689**, net **936**, block **465.625**. Controlling **465.625**. Demand **900**. **NOT SAFE**. |
| **T3** | Staggered net width helper (D3) | Open stagger section: **Gross width W** 10, **dh** 0.875, **# holes** 2, **s** 3, **g** 3, **t** 0.75 | Net width **9.000** in, **A_n** **6.750** in² |
| **T4** | LRFD — **SAFE** (demand below block shear) | Same as T1 but **Pu** **650** | Governing still block shear. Controlling **698.438**. Demand **650**. **SAFE**. |
| **T5** | Design — lightest W in family | Mode: **Design**. Same material/block areas as T1, **Pu** **650**, pick a **shape family** (e.g. W). | First passing shape in **ascending weight (W)** should appear as suggestion; table lists candidates with pass/fail. |

---

## 2. Compression — `/compression`

| ID | Use case | Fields & values | Expected (app engine) |
|----|-----------|-----------------|------------------------|
| **C1** | LRFD — W-shape, major/minor KL/r, **SAFE** | Steel **A992**, family **W**, shape **W24X131**, **K** 1.0, **L** 240 (in), **Pu** 700, **LRFD** | **KL/r_x** ≈ **23.529**, **KL/r_y** ≈ **80.808** (governing slenderness uses max). φPn ≈ **1077.569** kips. **SAFE**. |
| **C2** | ASD — same section & length | Same as C1, **ASD**, **Pa** 700 | Allowable Pn/Ω ≈ **716.945** kips (from same nominal capacity as C1). **SAFE**. |
| **C3** | LRFD — **NOT SAFE** | Same as C1, **Pu** **1200** | Capacity unchanged ≈ **1077.569** kips. **NOT SAFE**. |

---

## 3. Bending & shear — `/bending-shear`

| ID | Use case | Fields & values | Expected (app engine) |
|----|-----------|-----------------|------------------------|
| **B1** | LRFD — **Option A** dead/live/span drives M,V; deflection D+L | Steel **A992**, **W24X131**, **LRFD**. **w_D** 0.8 klf, **w_L** 3.2 klf, **span** 30 ft. **C_b** 1.14, unbraced blank. | w for strength ≈ **6.08** klf → **M_u** ≈ **684** kip·ft, **V_u** ≈ **91.2** kips. Service w for δ ≈ **0.333333** kip/in. φM_n ≈ **1032.333** kip·ft, φV_n ≈ **409.827** kips, δ ≈ **0.625** in, δ_allow **1** in. Governing **bending**. **SAFE**. |
| **B2** | ASD — same D+L **strength** w (D+L klf) | Same geometry, **ASD**, same D/L/span so required M,V from **4.0** klf → **M** **450** kip·ft, **V** **60** kips (auto-filled path) | M_n/Ω ≈ **686.848** kip·ft, V_n/Ω ≈ **273.218** kips. Governing **bending**. **SAFE**. |
| **B3** | Manual **Option B** — user M, V, L, w | Clear D/L/span; set **M_u** 200, **V_u** 40, **L** 360 in, **w** (deflection) 0.05 kip/in, same shape | Compare φM_n, φV_n, δ vs limits; SAFE if all ratios ≤ 1. (Exact numbers depend on shape.) |
| **B4** | Design — least weight W | Mode **Design**, set loads/span or M,V,L/w, material | Suggestion = lightest **W** that passes bending, shear, deflection (per Ej). |

---

## Regenerating numbers

```bash
cd aisc-pwa
npx tsx scripts/compute-verification-fixtures.ts
```
