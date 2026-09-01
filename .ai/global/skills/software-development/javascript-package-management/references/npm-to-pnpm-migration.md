# npm to pnpm Migration Checklist (Angular/Ionic Project)

## Pre-Migration

- [ ] Back up current `package.json` and `package-lock.json`
- [ ] Document current working state (tests pass, build succeeds)

## Migration Steps

### 1. Install pnpm
```bash
npm install -g pnpm
pnpm --version
```

### 2. Clean Old State
```bash
rm -rf node_modules package-lock.json
```

### 3. Initial Install
```bash
pnpm install
```

### 4. Approve Build Scripts
pnpm blocks build scripts by default. Angular projects require:
```bash
pnpm approve-builds --all
```

### 5. Create/Update pnpm-workspace.yaml
```yaml
onlyBuiltDependencies:
  - esbuild
  - puppeteer
  - puppeteer-core
  - protobufjs
  - nice-napi
```

### 6. Fix Peer Dependency Issues
Add explicit deps to package.json devDependencies:
- `@ionic/core: ^7.5.0`
- `@firebase/auth: ^1.7.9`

### 7. Upgrade ESLint
ESLint 7 is incompatible with @typescript-eslint/utils 7.x:
```json
"eslint": "^8.57.0"
```

### 8. Fix Angular Provider API
Remove `importProvidersFrom` wrappers for Angular 17.1+:
```typescript
// Before (broken with @angular/fire 17.1+)
importProvidersFrom(provideFirestore(() => getFirestore()))

// After
provideFirestore(() => getFirestore())
```

## Post-Migration Verification

```bash
pnpm run lint
pnpm run build:prod
export CHROME_BIN=$(find ~/.cache/puppeteer -name 'chrome' -type f | head -1)
pnpm run test:ci
```

## CI/CD Updates

### GitHub Actions
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

## Test Mocking Patterns

### Firestore Mock
```typescript
import { Firestore } from '@angular/fire/firestore';

TestBed.configureTestingModule({
  providers: [
    MyService,
    { provide: Firestore, useValue: {} },
  ],
});
```

### Firebase Auth Mock
```typescript
import { Auth } from '@angular/fire/auth';
import { GoogleAuthProvider } from '@angular/fire/auth';

TestBed.configureTestingModule({
  providers: [
    AuthService,
    { provide: Auth, useValue: { currentUser: null, signOut: jasmine.createSpy('signOut') } },
    { provide: GoogleAuthProvider, useValue: {} },
  ],
});
```

## Troubleshooting

| Error | Solution |
|-------|----------|
| `[ERR_PNPM_IGNORED_BUILDS]` | Run `pnpm approve-builds --all` |
| `Cannot find module 'eslint/use-at-your-own-risk'` | Upgrade ESLint to ^8.57.0 |
| `Cannot find module '@ionic/core/components'` | Add `@ionic/core` to devDependencies |
| `No provider for Firestore!` in tests | Add `{ provide: Firestore, useValue: {} }` to TestBed |
| `Cannot match any routes` in tests | Add `RouterTestingModule` to imports |
| `Argument of type 'EnvironmentProviders' is not assignable` | Remove `importProvidersFrom` wrappers |
