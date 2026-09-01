# npm to pnpm Migration Recipe

## Overview

Step-by-step migration from npm to pnpm for Angular/Ionic projects.

## Step 1: Clean Install

```bash
# Remove old artifacts
rm -rf node_modules package-lock.json

# Install with pnpm
pnpm install
```

## Step 2: Handle Build Scripts

pnpm blocks postinstall/build scripts by default. Common packages needing approval:

- `esbuild` (used by Angular build)
- `puppeteer` (for testing)
- `protobufjs` (Firebase dependency)
- `nice-napi` (native module)

### Option A: Approve All (Recommended)

```bash
pnpm approve-builds --all
```

### Option B: Whitelist in pnpm-workspace.yaml

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

## Step 3: Fix Dependency Issues

### ESLint 7 Incompatibility

**Symptom**: `Cannot find module 'eslint/use-at-your-own-risk'`

**Fix**: Upgrade ESLint to v8+
```json
"eslint": "^8.57.0"
```

### Missing @firebase/auth

**Symptom**: `Cannot find module '@firebase/auth'`

**Fix**: Add explicit dependency
```json
"@firebase/auth": "^1.7.9"
```

### Missing @ionic/core

**Symptom**: `Cannot find module '@ionic/core/components'`

**Fix**: Add explicit dependency
```json
"@ionic/core": "^7.5.0"
```

## Step 4: Update CI/CD

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

## Step 5: Update .gitignore

Add:
```
pnpm-lock.yaml.bak
.pnpm-store
```

## Step 6: Verify

```bash
pnpm run lint
pnpm run build:prod
pnpm run test:ci
```

## Common Test Fixes

### Standalone Components

Use `imports` not `declarations`:
```typescript
// Correct
TestBed.configureTestingModule({
  imports: [HomePage],
});

// Wrong (for standalone components)
TestBed.configureTestingModule({
  declarations: [HomePage],
});
```

### Mocking Services with Getters

When mocking services that have getters (like `userState$`):
```typescript
const authServiceMock = {
  signOut: jasmine.createSpy('signOut'),
  userState$: of(null),
};
```

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot find module 'eslint/use-at-your-own-risk'` | ESLint 7 + @typescript-eslint/utils 7.x | Upgrade ESLint to ^8.57.0 |
| `Cannot find module '@firebase/auth'` | Missing explicit dependency | Add `@firebase/auth` to devDependencies |
| `Cannot find module '@ionic/core/components'` | Missing explicit dependency | Add `@ionic/core` to devDependencies |
| `No binary for ChromeHeadless browser` | Chrome not installed | Set `CHROME_BIN` env var or use puppeteer's bundled Chrome |
| `Unexpected component in declarations` | Standalone component in wrong array | Use `imports: [Component]` instead |
| `Command failed: pnpm install` during build | Build scripts blocked | Run `pnpm approve-builds --all` |
