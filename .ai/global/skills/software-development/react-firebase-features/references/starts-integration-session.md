# Starts Module Integration Session

**Date:** 2026-08-19
**Project:** MiNegocio (React 19 + Firestore + Vite + Capacitor)
**Task:** Integrate divergent branches, add profile type selection, fix error handling

## Context

Two branches existed with overlapping work on the "Inicios/Prospects" module:
- `origin/feat/inicios` — had Prospect types, TrafficPill, SettingsStartsSection, useProspectsList, startsDomain, prospectsPersistence
- `feat/leads-prospects-module` — had Lead types, LeadForm, BitacoraForm, StrategyLibrary, useLeadsCollection

## Integration strategy

1. **Data model**: Used `Prospect` from remote (more complete: `autoStatusId`, `followUps`, `startDateMillis`)
2. **UI components**: Kept local's `BitacoraForm` + `StrategyLibrary` (more actionable)
3. **Visualization**: Adopted remote's `TrafficPill` (semáforo: green/yellow/red/gray)
4. **Settings**: Adopted remote's `SettingsStartsSection` (configurable statuses/suggestions)
5. **Conversion**: Adopted remote's batch write approach
6. **Demo mode**: Adopted remote's mock prospects

## Profile type selection

Added a two-mode selector at the top of the new prospect flow:

- **Basic**: Only contact data (name, phone, email, source). For prospects who haven't decided.
- **MK**: Full beauty profile (skin type, concerns, makeup preferences). For those who want to start.

Plus a checkbox: "Solo quiere ser cliente (no iniciar)" — saves data for potential future conversion without beauty profile.

```typescript
interface Lead {
  wantsToBeClient?: boolean;  // Client without starting
  profileType?: 'basic' | 'mk';  // Capture mode
}
```

## Error handling improvement

Before:
```typescript
alert('Error al crear el prospecto');
```

After:
```typescript
const message = error instanceof Error ? error.message : 'Error desconocido';
alert(`Error al crear el prospecto: ${message}`);
```

This surfaces Firebase errors like "Missing or insufficient permissions" or "The caller does not have permission" which usually means the user's document lacks `businessId`.

## Common error causes

1. **Missing `businessId` in user doc** — `sameBusiness()` fails because `userDoc().businessId` is empty
2. **Firestore rules not deployed** — Rules only exist locally until deployed
3. **Not authenticated** — `request.auth` is null

## Branch merge conflicts

When both branches modify `DashboardLayout.tsx` and `navItems.tsx`:
- Use `git merge --no-commit --no-ff` to preview
- Expect conflicts in nav item arrays and import lists
- Resolve by combining both sides' additions

## Verification

- Build: ✅ 12s, 19 chunks
- Tests: 144/146 (2 preexistent failures)
- Lint: 1 error (react-refresh in navItems) + 18 warnings
