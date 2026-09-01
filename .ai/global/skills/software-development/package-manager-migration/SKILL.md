---
name: package-manager-migration
description: Migrate JS/TS projects between npm, yarn, and pnpm.
tags: [npm, yarn, pnpm, migration, package-manager, node, toolchain]
trigger: Use when migrating from one package manager to another, switching lockfiles, or resolving post-migration dependency/build issues.
---

# Package Manager Migration

Migrate JavaScript/TypeScript projects between package managers (npm, yarn, pnpm) while preserving dependency integrity and CI/CD functionality.

## Pre-migration Checklist

1. Document current state: package manager version, lockfile type, Node version
2. Ensure all current tests pass before migration
3. Commit all pending changes (clean working tree)
4. Note any postinstall/build scripts in dependencies

## Migration Steps

### 1. Remove Old Artifacts

```bash
rm -rf node_modules package-lock.json yarn.lock
```

### 2. Install with New Manager

```bash
pnpm install
# or: yarn install / npm ci
```

### 3. Handle Build Scripts (pnpm-specific)

pnpm blocks build scripts by default. Dependencies like `esbuild`, `puppeteer`, `protobufjs`, `nice-napi` require explicit approval.

**Approve all (recommended for known projects)**
```bash
pnpm approve-builds --all
```

**Or whitelist via pnpm-workspace.yaml**
```yaml
onlyBuiltDependencies:
  - esbuild
  - puppeteer
  - protobufjs
  - nice-napi
  - puppeteer-core
```

Then rebuild:
```bash
pnpm rebuild esbuild puppeteer protobufjs nice-napi
```

### 4. Fix Common Compatibility Issues

- **ESLint 7 + @typescript-eslint/utils 7.x**: Incompatible. Upgrade ESLint to `^8.57.0`
- **Missing peer dependencies**: pnpm is stricter than npm. Add missing peers (e.g., `@firebase/auth`, `@ionic/core`) explicitly to `package.json`
- **Standalone component tests**: Use `imports: [Component]` not `declarations: [Component]` in TestBed

### 5. Update CI/CD

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

### 6. Update .gitignore

```
pnpm-lock.yaml.bak
.pnpm-store
```

### 7. Verify

```bash
pnpm run lint
pnpm run build:prod
pnpm run test:ci
```

## Pitfalls

- **ESLint 7 + @typescript-eslint/utils 7.x**: Cannot resolve `eslint/use-at-your-own-risk`. Always upgrade ESLint to 8+ when migrating
- **Missing @firebase/auth**: @angular/fire v17 splits auth into @firebase/auth package. Must be explicit dependency
- **Missing @ionic/core**: @ionic/angular does not always pull @ionic/core as peer. Add explicitly if import errors occur
- **Build script blocking**: pnpm requires explicit approval for postinstall scripts. Without it, builds fail silently
- **Peer dependency conflicts**: pnpm strict peer deps can cause install failures. Use `strict-peer-dependencies=false` in `.npmrc` if needed
- **Firebase build scripts**: `@firebase/util` requires explicit `onlyBuiltDependencies` whitelist in `pnpm-workspace.yaml` (it's a postinstall script)
- **package-lock.json not in .gitignore**: After migrating to pnpm, add `package-lock.json` to `.gitignore` so npm lockfile doesn't accidentally get recreated
- **packageManager field**: Add `"packageManager": "pnpm"` to `package.json` to pin the manager for the project
