---
name: cross-platform-frontend-parity
description: "Audit frontend feature parity across web and mobile repos."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [frontend, parity, multi-repo, web-mobile, feature-gap]
    related_skills: [javascript-package-management, angular-supabase-security]
---

# Cross-Platform Frontend Parity

## Overview

Audit feature parity across multiple frontend repos (web + mobile) for the same product, then execute work to close gaps.

## When to Use

- Two+ frontend repos (e.g., Angular web + React Native mobile) for the same product
- Need to identify which features exist in one repo but not the other
- Planning work to bring both repos to the same feature level
- Hardening security, tests, or docs across multiple repos consistently

## Workflow

### 1. Audit Both Repos

```bash
# Count files, screens, services per repo
find src -name "*.tsx" -o -name "*.ts" | wc -l
ls src/screens/ | wc -l
ls src/services/ | wc -l

# Extract features from routes/navigation
grep -r "path:" src/app/app.routes.ts
grep -r "Screen" src/navigation/AppNavigator.tsx
```

Build a comparison matrix:

| Feature | Web (Angular) | Mobile (React) |
|---------|--------------|----------------|
| Dashboard | ✅ | ✅ |
| Transactions | ✅ | ✅ |
| Loans | ❌ | ✅ |

### 2. Identify Gaps

For each feature present in one repo but not the other:
- Note the service layer (Firebase vs Supabase)
- Note the UI components needed
- Note the routes/navigation entries
- Note the types/interfaces
- Estimate complexity (low/medium/high)

### 3. Prioritize Work

Order by user priority or dependency chain:
1. Core features (transactions, dashboard)
2. Financial features (budgets, goals, loans, investments, debts)
3. Automation (recurring, notifications)
4. Polish (dark mode, i18n, PWA)

### 4. Execute Parity Work

For each feature to add:
1. Create interface/types
2. Create service with repository pattern
3. Create SQL migration (Supabase) or Firestore collection
4. Create page/screen with CRUD
5. Add route/navigation entry
6. Add to header/tab navigator
7. Write tests
8. Update MASTERPROMPT and ROADMAP

### 5. Verify Consistency

After each feature addition:
- Both repos have the same feature set
- Same security patterns (RLS, CSP, env vars)
- Same testing approach
- Same documentation style (README + ARCHITECTURE)

## Cross-Stack Patterns

| Concern | Angular/Supabase | React/Supabase |
|---------|-----------------|----------------|
| State | Services + Signals | Zustand |
| Backend | Supabase JS | Supabase JS |
| Auth | Supabase Auth | Supabase Auth |
| DB | PostgreSQL | PostgreSQL |
| Types | snake_case (SQL) | snake_case (SQL) |
| Guards | CanActivate | Conditional render |
| Tests | Karma + Jasmine | Jest |
| Mobile | Capacitor (native) | Expo (OTA) |

## Migration: Firebase → Supabase (Mobile)

When migrating mobile from Firebase while web is already on Supabase:

1. Both repos share the same Supabase project
2. Types must align to snake_case (PostgreSQL convention)
3. Services use identical Supabase query patterns
4. Auth state management differs (BehaviorSubject vs onAuthStateChange)
5. Environment variables: `environment.ts` (Angular) vs `EXPO_PUBLIC_` prefix (Expo)

## Pitfalls

- **Don't assume feature parity means code parity** — each stack has its own idioms
- **Don't copy-paste Angular code into React** — translate patterns, not syntax
- **Don't forget RLS/Row Level Security** for new tables
- **Don't skip tests** when adding features to close gaps
- **Don't hardcode credentials** during parity work — use env vars from the start
- **Don't update only one repo's docs** — keep READMEs and architecture docs in sync
- **Don't use date-fns in Angular if native Intl.DateTimeFormat suffices** — fewer deps, same result
- **Don't test async services first** — start with pure logic (currency, loan utils) for easy wins
- **Don't forget to register routes/navigation** when adding a new feature page
- **Don't forget Capacitor config** — `webDir` must match Angular's output directory (`www/browser` for Ionic)
- **Don't use `detectSessionInUrl: true` in React Native** — no URL-based auth in mobile
- **Don't mock Supabase as Observable in React tests** — use Promise.resolve() since async/await is idiomatic
- **Don't use jest 30 with jest-expo** — jest 29 + jest-expo 54 is the stable combo; jest 30 causes `clearMocksOnScope` errors
- **Don't put business logic in store files** — keep Zustand stores thin; extract services for Supabase calls
- **Don't forget to reset store state in test beforeEach** — Zustand stores persist between tests unless explicitly reset
- **Don't ignore LSP diagnostics in test files** — they catch real type errors that will break CI
- **Don't mock expo-sqlite/expo-print/expo-sharing/NetInfo as default** — they don't work in Jest; create manual mocks
- **Don't use `enablePromise(true)` with expo-sqlite** — it's not exported; expo-sqlite uses async APIs natively
- **Don't forget `PRAGMA journal_mode = WAL`** for SQLite — improves concurrent read performance
- **Don't store sync queue as a Zustand signal** — use AsyncStorage directly for persistence across app restarts
- **Don't use `addEventListener` from NetInfo in tests** — mock it to return a cleanup function
- **Don't forget to update BOTH MASTERPROMPT AND ROADMAP** after completing a feature — they're the continuity docs
- **Don't run tests after adding packages with native builds** — run `echo "y" | pnpm approve-builds --all` first or pnpm blocks with ERR_PNPM_IGNORED_BUILDS
- **Don't port Angular code verbatim to React** — translate patterns (Zustand↔Signals, Stack↔Router, Paper↔Ionic), not syntax
- **Don't forget type exports in React's index.ts** — when porting features, add interfaces to `src/types/index.ts` so TypeScript resolves imports
- **Don't use duplicate imports** — when adding imports to a service, check the file doesn't already import the same module (causes TS2300)
- **Don't use private method access in Angular tests** — cast component as `any` to test private methods, or test via public API
- **Don't forget `getCurrentUser()` mock in React services** — services that need auth should have a `getCurrentUser()` method that returns `{ id: 'demo-user' }` for tests

## References

- `references/finanzeasy-parity-audit.md` — Full audit and parity work from Finanzeasy (Angular web + React Native mobile), updated v1.7
