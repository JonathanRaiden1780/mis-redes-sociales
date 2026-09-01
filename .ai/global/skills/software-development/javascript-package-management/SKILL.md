---
name: javascript-package-management
description: "Migrate and configure npm/pnpm/yarn for frontend projects."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [package-manager, npm, pnpm, yarn, dependencies, migration]
    related_skills: [test-driven-development, systematic-debugging]
---

# JavaScript Package Management

## Overview

Migration and configuration strategies for npm, pnpm, and yarn in frontend projects. Covers lockfile management, dependency resolution, and build script compatibility.

## When to Use

- Migrating between package managers (npm → pnpm, npm → yarn, etc.)
- Resolving peer dependency conflicts
- Configuring build scripts for strict package managers
- Setting up CI/CD with package managers

## Expo (React Native) + pnpm Migration

### Setup

Expo projects use pnpm similarly but with different build scripts:

```bash
# Remove old lockfile
rm -rf node_modules package-lock.json

# Install with pnpm
pnpm install

# Expo uses Metro bundler — approve native module builds
# Create .npmrc to auto-approve
echo "approve-builds=true" >> .npmrc
```

### .npmrc for Expo

```ini
# Auto-approve native builds (required for expo-modules-core, firebase, etc.)
approve-builds=true

# Peer deps
strict-peer-dependencies=false
auto-install-peers=true
```

### Build Scripts (Expo)

Unlike Angular, Expo uses Metro and EAS:

```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "web": "expo start --web",
    "test": "jest",
    "lint": "eslint . --ext .ts,.tsx"
  }
}
```

### Common Expo + pnpm Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| `ERR_PNPM_IGNORED_BUILDS` | Native modules need scripts | Add `approve-builds=true` to `.npmrc` |
| `Cannot find module 'expo-modules-core'` | pnpm strict peer deps | Add to `.npmrc`: `strict-peer-dependencies=false` |
| `Metro bundler fails` | Lockfile mismatch | Delete `node_modules`, `pnpm install` |
| `EAS Build fails` | Missing native deps | Run `pnpm install --frozen-lockfile` in CI |

### Testing with Jest + Expo (Version Matrix)

Expo 54 requires specific Jest versions. Mismatches cause `clearMocksOnScope is not a function` errors:

| Expo Version | Jest Version | jest-expo | Status |
|--------------|--------------|-----------|--------|
| ~54.0.31 | 29.7.0 | 54.0.18 | ✅ WORKS |
| ~54.0.31 | 30.4.2 | 57.0.4 | ❌ FAILS (`clearMocksOnScope` error) |

**Working configuration:**
```bash
pnpm add -D jest@29 jest-expo@54 @testing-library/react-native @testing-library/jest-native
```

```js
// jest.config.js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  coveragePathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
};
```

**Firebase mocking for Jest:**
Firebase Auth/Firestore tests fail with module resolution errors. Either:
1. Mock Firebase in `jest.setup.js`:
```js
jest.mock('./firebase', () => ({
  auth: { currentUser: { uid: 'test-user-123' } },
  db: {},
}));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  addDoc: jest.fn(),
  // ... other methods
}));
```
2. Or skip Firebase-dependent tests if mocking becomes too complex

**React Native manual mock:**
Create `src/__mocks__/react-native.js` with Platform, StyleSheet, View, Text, etc. when `transformIgnorePatterns` alone doesn't resolve imports.

### Capacitor Setup for Angular + Ionic

Angular + Ionic outputs to `www/browser` by default (not `dist`):

```typescript
// capacitor.config.ts
const config: CapacitorConfig = {
  appId: 'com.finanzeasy.app',
  appName: 'Finanzeasy',
  webDir: 'www/browser',  // NOT 'dist'
  server: { androidScheme: 'https' },
};
```

```bash
npx cap add android
npx cap add ios
npx cap sync
```

Add to `package.json` scripts:
```json
{
  "cap:sync": "npx cap sync",
  "cap:build": "pnpm build:prod && npx cap sync"
}
```

## Package Manager Migration: npm → pnpm

### Core Steps

```bash
# 1. Install pnpm globally (if not already)
npm install -g pnpm

# 2. Remove old lockfile and node_modules
rm -rf node_modules package-lock.json

# 3. Install dependencies with pnpm
pnpm install

# 4. Approve build scripts (see below)
pnpm approve-builds --all

# 5. Rebuild native modules
pnpm rebuild esbuild puppeteer protobufjs nice-napi
```

### Critical: Build Script Configuration

pnpm by default blocks build scripts for security. Angular/Ionic projects require explicit approval:

**pnpm-workspace.yaml:**
```yaml
onlyBuiltDependencies:
  - esbuild
  - puppeteer
  - puppeteer-core
  - protobufjs
  - nice-napi
```

Then run:
```bash
pnpm approve-builds --all
```

### Common Post-Migration Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| `Cannot find module 'eslint/use-at-your-own-risk'` | ESLint 7 incompatible with newer @typescript-eslint | Upgrade to `eslint: ^8.57.0` |
| `Cannot find module '@ionic/core/components'` | pnpm strict peer deps | Add `@ionic/core: ^7.5.0` to devDependencies |
| `Cannot find module '@firebase/auth'` | pnpm doesn't resolve transitive deps | Add `@firebase/auth: ^1.7.9` explicitly |
| `No provider for Firestore!` in tests | Firestore not properly mocked | Use `{ provide: Firestore, useValue: {} }` in TestBed |
| `importProvidersFrom` type error | Angular 17.1+ API change | Remove `importProvidersFrom` wrappers, pass providers directly |
| `Cannot find name 'Buffer'` or `NodeJS.ReadableStream` | Supabase storage-js needs Node types | Install `@types/node` and add `"types": ["node"]` to tsconfig |
| `skipLibCheck` required | Supabase storage-js types conflict with browser | Add `"skipLibCheck": true` to tsconfig.json |

### Supabase-Specific pnpm Configuration

When using Supabase with pnpm:

```bash
# 1. Install Supabase JS
pnpm add @supabase/supabase-js

# 2. Install Node types (required by Supabase storage-js)
pnpm add -D @types/node

# 3. Update tsconfig.json
{
  "compilerOptions": {
    "types": ["node"],
    "skipLibCheck": true
  }
}

# 4. Approve build scripts
pnpm approve-builds --all

# 5. Rebuild native modules
pnpm rebuild esbuild puppeteer protobufjs nice-napi
```

### CI/CD Migration

**GitHub Actions:**
```yaml
- name: Setup pnpm
  uses: pnpm/action-setup@v4
  with:
    version: 11

- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'pnpm'

- name: Install dependencies
  run: pnpm install --frozen-lockfile
```

## Dependency Resolution

### Strict Peer Dependencies

pnpm enforces strict peer dependency resolution by default. Use `.npmrc` to configure:

```ini
strict-peer-dependencies=false
auto-install-peers=true
```

Or add missing peers explicitly to `package.json`.

### Transitive Dependency Issues

If a module imports a package that's only available as a transitive dependency, add it explicitly:

```json
{
  "devDependencies": {
    "@ionic/core": "^7.5.0",
    "@firebase/auth": "^1.7.9"
  }
}
```

## Testing with pnpm

### Chrome/Puppeteer for CI

Puppeteer downloads Chrome to `~/.cache/puppeteer/`. Set `CHROME_BIN` for Karma:

```bash
export CHROME_BIN=$(find ~/.cache/puppeteer -name 'chrome' -type f | head -1)
```

### Mocking Firebase in Tests

```typescript
import { Firestore } from '@angular/fire/firestore';

TestBed.configureTestingModule({
  providers: [
    { provide: Firestore, useValue: {} },
  ],
});
```

## Verification Checklist

After migration:
- [ ] `pnpm install` completes without errors
- [ ] `pnpm run lint` passes
- [ ] `pnpm run build:prod` succeeds
- [ ] `pnpm run test:ci` passes
- [ ] CI pipeline green with pnpm

## Pitfalls

- **Don't skip `pnpm approve-builds --all`** — without it, esbuild and puppeteer won't work
- **Don't mix lockfiles** — delete `package-lock.json` and `yarn.lock` when migrating
- **Don't ignore peer dependency warnings** — they cause runtime errors in pnpm
- **Don't assume transitive deps are available** — pnpm's strict resolution requires explicit declarations

## pnpm v11+ Changes (Important)

In pnpm v11, `onlyBuiltDependencies` configuration moved:
- ❌ `.npmrc` with `only-built-packages[]=` — **silently ignored**
- ❌ `package.json#pnpm.onlyBuiltDependencies` — **no longer read**
- ❌ `pnpm config set onlyBuiltDependencies` — **unsupported**
- ✅ **`pnpm-workspace.yaml`** — **the only supported location**

See [references/npm-to-pnpm-migration-real-project-lessons.md](references/npm-to-pnpm-migration-real-project-lessons.md) for a real-world migration walkthrough including failed attempts and the exact configuration that worked.
