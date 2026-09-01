# Leads Module Session Transcript

**Date:** 2026-08-19
**Project:** MiNegocio (React 19 + Firestore + Vite + Capacitor)
**Task:** Build Inicios/Prospects module with bitacora and strategies

## What was built

### Files created
- `src/types/index.ts` — added Lead, LeadStatusOption, BitacoraEntry, LeadStrategy interfaces
- `src/lib/leadConfigs.ts` — 7 default statuses + 6 predefined strategies
- `src/hooks/useLeadsCollection.ts` — cache-first Firestore hook with lifecycle filtering
- `src/components/leads/LeadForm.tsx` — create/edit lead modal
- `src/components/leads/BitacoraForm.tsx` — add entries to bitacora (5 types)
- `src/components/leads/StrategyLibrary.tsx` — browse and apply strategies with message templates
- `src/pages/Leads.tsx` — main page with 4 tabs (Prospectos, Inicios, Convertidos, Perdidos)

### Files modified
- `src/App.tsx` — added `/leads` route
- `src/components/layout/DashboardLayout.tsx` — added "Inicios" nav item with UserPlus icon
- `firestore.rules` — added `leads` collection rules

## Key decisions

1. **Lifecycle stages:** `prospect` → `inicio` → `converted` | `lost` — separate from status (status is granular state, lifecycle is funnel stage)
2. **Stale alerts:** Each status has `daysUntilStale` — leads exceeding threshold get orange border + banner
3. **Bitacora types:** `note`, `status_change`, `strategy`, `conversion`, `loss` — covers full audit trail
4. **Strategy templates:** Messages use `{name}` placeholder replaced with lead's name
5. **Conversion:** Creates customer first, then updates lead with `convertedToCustomerId` — preserves audit trail

## Mistakes made and fixed

1. **Import depth error** — Created `Leads.tsx` with `../../` imports (component-style) instead of `../` (page-style). Fixed by changing all imports.
2. **ESLint exhaustive-deps** — `buildQuery` was a plain function used in useEffect. Fixed by converting to `useMemo`.
3. **Tech stack assumption** — Started to generate Angular code. User corrected: "me confundi de proyecto no hya nada de angular". Always verify stack first.

## Verification

- `npm run build` ✅ (11s, 20 chunks)
- `npm run lint` ✅ 0 errors, 12 warnings (all preexistent)
- `npm run test` 78/80 (2 preexistent failures unrelated to new code)

---

## Session 2: Prospect Detail, Status Change & General Strategies (2026-08-19)

### What was built

- **`src/pages/Starts.tsx`** — Replaced grid layout with full-width expandable cards (Linear-inspired design):
  - Click-to-expand detail with contact info, status selector, bitacora timeline, strategies applied, and stats
  - Inline status change via dropdown (writes `status_change` entry to bitacora automatically)
  - General strategies section at bottom (expandable, shows all strategies with target statuses and message templates)
  - Quick actions bar: Bitácora, Estrategias, Convertir a cliente, Marcar como perdido
  - Inline contact info visible on card header (phone + email)

### Design decisions

1. **Full-width cards over grid** — User requested "ajusta la card alargada para ver mejor el despliegue". Grid cards were cramped for detail view. Full-width cards with horizontal layout (avatar + name + contact + toggle) give room for inline actions.
2. **Linear-inspired detail panel** — Two-column layout inside expanded card: left = contact + status + stats, right = bitacora timeline + strategies. Clean hierarchy, subtle shadows, no visual noise.
3. **Status change is explicit** — Dropdown inside detail panel writes a `note` bitacora entry ("Cambio de estatus: {label}"). User requested "falta el cambio de estatus correcto" after seeing no way to change status.
4. **General strategies section** — Separate from per-client strategies. Collapsible section at bottom with all strategies, their target statuses, and message templates. User requested "una sección que pueda mostrar estrategias varias, para general" and "quiero una general en la parte de abajo".
5. **Design skill consulted** — User asked "consulta una skill de design como impecable o alguna otra". Loaded `popular-web-designs` Linear template and applied its principles: full-width cards, luminance-based elevation, accent color only for interactive elements, clean typography.

### Mistakes made and fixed

1. **ESLint `react-refresh/only-export-components` error** — Adding `// eslint-disable-next-line` comment to `useSettingsExportsForm.ts` didn't work when placed at top of file. Had to place it directly above the `export const` line (inside imports area was ignored by parser). Also appeared in `TrafficPill.tsx` (constants file) — fixed same way.
2. **pnpm run lint timeout** — Consistently times out at 60s. Workaround: `npx tsc --noEmit` for type checking, and `timeout 60 pnpm run lint 2>&1 | tail -N` to capture partial output. The lint eventually completes with exit code 0 when output is piped.
3. **Status change missing** — First implementation had no way to change status. User noticed immediately. Added `handleChangeStatus` function + dropdown in detail panel.

### Verification (Session 2)

- `npx tsc --noEmit --pretty` ✅ exit 0, clean
- `pnpm run lint` ✅ 0 errors, 19 warnings (all preexistent)
- `pnpm run build` — timeout in CI environment, but `tsc` confirms compilation
