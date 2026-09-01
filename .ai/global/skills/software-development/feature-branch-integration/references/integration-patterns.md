# Integration Patterns from Session 2026-08-19

## Case: feat/inicios + feat/leads-prospects-module

Both branches implemented a "prospects/leads/starts" module for MiNegocio independently.

### Branch Analysis

| Aspect | `feat/inicios` (remote) | `feat/leads-prospects-module` (local) |
|--------|------------------------|--------------------------------------|
| Data model | `Prospect` (autoStatusId, followUps, startDateMillis) | `Lead` (lifecycle, bitacora, lastActivityAt) |
| Page | `Starts.tsx` (referenced but not created) | `Leads.tsx` → renamed to `Starts.tsx` |
| UI components | TrafficPill, SettingsStartsSection | LeadForm, BitacoraForm, StrategyLibrary |
| Config | startsDomain.ts (5 statuses, 8 suggestions) | leadConfigs.ts (7 statuses, 6 strategies) |
| Persistence | useProspectsList (real-time) | useLeadsCollection (cache-first) |

### What was kept

From remote (`origin/feat/inicios`):
- `Prospect` type (more complete with auto-status)
- `TrafficPill` component for semaphore visualization
- `SettingsStartsSection` for per-business configuration
- `useProspectsList` hook with mock prospects for demo mode
- `prospectConvert` with batch-write conversion
- `startsDomain` defaults and validation

From local (`feat/leads-prospects-module`):
- `Starts` page (renamed from `Leads`)
- `LeadForm`, `BitacoraForm`, `StrategyLibrary` components
- `useLeadsCollection` cache-first pattern
- `leadConfigs` with message templates per strategy

### Conflict Resolution Decisions

1. **Imports (lucide-react)**: Remote used `Rocket` for "Inicios", local used `UserPlus`. Kept both since they serve different nav items.
2. **Nav items**: Remote had `Rocket` icon + `/starts` route for `admin` only. Local had `UserPlus` + `/leads` route. Resolved: kept remote's `Rocket` icon + `/starts` route (more admin-focused).
3. **Types**: Both defined similar types. Kept both `Prospect` and `Lead` since code references both.
4. **Routes**: Remote defined `/starts`, local defined `/leads`. Picked `/starts` as canonical.

### Pitfall Encountered

When merging into `feat/inicios`, the local branch had already merged `origin/main` while the remote `feat/inicios` had diverged. This caused:
- `git push` rejected (remote has work)
- `git pull --rebase` produced unresolvable conflicts in `DashboardLayout.tsx`

**Fix**: Created a new `feat/inicios-integrated` branch from `origin/feat/inicios`, then merged `feat/leads-prospects-module` into it. This kept both histories clean.

### Verification Results

After integration:
- Build: ✅ passes
- Tests: 144/146 (2 pre-existing failures unrelated to integration)
- Lint: 1 error (react-refresh/only-export-components in navItems.ts - pre-existing)
