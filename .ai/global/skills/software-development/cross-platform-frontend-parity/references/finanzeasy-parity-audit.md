# Finanzeasy Parity Audit

**Date:** 2026-08-20
**Version:** 2.1.0
**Repos:** Finanzeasy (Angular web + Supabase) vs FinanzeasyReact (React Native + Supabase)

## Current State

| Metric | Angular (Web) | React (Mobile) |
|--------|--------------|----------------|
| Tests | 264 | 116 |
| Pages/Screens | 19 | 28 |
| Services | 38 | 28 |
| Lines of code | ~5,400 | ~17,500 |
| Package Manager | pnpm | pnpm |
| CI/CD | GitHub Actions | GitHub Actions |
| Backend | Supabase | Supabase |

## Feature Comparison Matrix (Post-Parity Sprint 24)

| Feature | Angular (Web) | React (Mobile) |
|---------|--------------|----------------|
| Dashboard | ✅ | ✅ |
| Transactions (CRUD) | ✅ | ✅ |
| Accounts | ✅ | ✅ |
| Budgets | ✅ | ✅ |
| Savings Goals | ✅ | ✅ |
| Transfers | ✅ | ✅ |
| Loans | ✅ | ✅ |
| Investments | ✅ | ✅ |
| Debts | ✅ | ✅ |
| Subscriptions/Recurring | ✅ | ✅ |
| Credit Cards | ✅ | ✅ |
| Calendar | ✅ | ✅ |
| Currency Converter | ✅ | ✅ |
| Dark Mode | ✅ | ✅ |
| i18n | ✅ | ✅ |
| AI Analysis | ✅ | ❌ |
| Auto-Categorization | ✅ | ❌ |
| Smart Reminders | ✅ | ❌ |
| Debt Planner | ✅ | ❌ |
| Reports PDF | ✅ | ✅ |
| Excel Export | ✅ | ❌ |
| Gamificación | ✅ | ✅ |
| Modo Vacaciones | ✅ | ✅ |
| Backup en Nube | ✅ | ✅ |
| Modo Demo | ✅ | ✅ |
| Gamificación Comunitaria | ✅ | ✅ |
| Open Banking | ✅ | ✅ |
| PWA | ✅ | ❌ |
| Offline Sync | ❌ | ✅ |
| Split Bill | ❌ | ✅ |
| Biometría | ❌ | ✅ |
| Push Notifications | ❌ | ✅ |
| Native Widgets | ✅ | ❌ |

## Remaining Gaps (v2.1)

### Mobile (React) — Still Missing

| Feature | Angular Implementation | Complexity |
|---------|----------------------|------------|
| AI Analysis | ai.service.ts | High |
| Auto-Categorization | auto-categorization.service.ts | Medium |
| Smart Reminders | smart-reminder.service.ts | Medium |
| Debt Planner | debt-planner.service.ts | Medium |
| Excel Export | excel-export.service.ts | Low |

### Web (Angular) — Still Missing

| Feature | React Implementation | Complexity |
|---------|---------------------|------------|
| Offline Sync | offline.ts + SyncStatusBar | High |
| Split Bill | SplitBillScreen.tsx | Low |
| Biometría | expo-local-authentication | Medium |
| Push Notifications | expo-notifications | Medium |

## SDD → TDD → Implement Workflow (User Preference)

When implementing features in this project, follow this exact sequence:

1. **Specification** — Write interfaces/types first
2. **Tasks** — Break into discrete testable units
3. **TDD** — Write tests BEFORE implementation
4. **Implementation** — Make tests pass
5. **Commit** — One atomic commit per feature
6. **Merge** — `git merge feature/name --no-ff -m "Merge feature/name into testing/Ai"`
7. **Docs** — Update MASTERPROMPT + ROADMAP in same commit

## GitFlow Pattern

```
feature/feature-name → testing/Ai (Angular) or test/ia (React Native)
```

- Always use `--no-ff` for merges
- Keep commits atomic (one feature per commit)
- Update MASTERPROMPT + ROADMAP in same commit as feature
- Push after merge: `git push origin testing/Ai`

## Pitfalls Encountered

### pnpm approve-builds Blocking Tests
When adding packages with native builds (jspdf, html2canvas, xlsx), pnpm may block test runs with:
```
[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: core-js@3.50.0
```

**Fix:** Run `echo "y" | pnpm approve-builds --all` before running tests.

### Feature Parity ≠ Code Parity
When porting features from Angular to React Native:
- Translate patterns, not syntax
- Zustand ↔ Angular Signals/Services
- Stack/Tabs navigation ↔ Router routes
- React Native Paper ↔ Ionic Components
- Keep service layer structure similar

### Test File Location
- Angular: `src/app/services/service-name.spec.ts` (co-located with service)
- React: `src/services/__tests__/serviceName.test.ts` (in __tests__ subdirectory)

### Type Duplication Between Stacks
When adding types for a feature ported to React Native:
- Add to `src/types/index.ts`
- Keep snake_case field names (PostgreSQL convention)
- Align interfaces with Angular versions

## Sprint History

| Sprint | Features | Tests (Angular) |
|--------|----------|-----------------|
| 17-21 | Excel Export, Notificaciones, Modo Familiar, Widgets, OCR | 191 |
| 22-23 | MSI Calculator, Vacaciones, Backup, Demo, Gamificación | 232 |
| 24 | Widgets Nativos, PDF Gráficos, Comunidad, Open Banking | 258 |
| Parity | Trip Mode, MSI, Backup, Demo, Gamificación, Comunidad, Open Banking (React) | 264 |
