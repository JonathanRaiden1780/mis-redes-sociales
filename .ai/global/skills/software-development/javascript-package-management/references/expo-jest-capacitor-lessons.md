# Expo + Jest + Capacitor Lessons

## Jest Version Mismatch (Expo 54)

**Symptom:** `TypeError: this._moduleMocker.clearMocksOnScope is not a function`

**Root cause:** Jest 30 + jest-expo 57 is incompatible with Expo 54's internal mocking.

**Fix:**
```bash
pnpm add -D jest@29 jest-expo@54 babel-jest@29 @types/jest@29
```

| Expo | Jest | jest-expo | Works? |
|------|------|-----------|--------|
| ~54 | 29.7.0 | 54.0.18 | ✅ |
| ~54 | 30.4.2 | 57.0.4 | ❌ |

## Firebase Module Resolution in Jest

**Symptom:** `Cannot find module './firebase'` or `Cannot find module 'firebase/firestore'`

**Fix:** Mock in `jest.setup.js`:
```js
jest.mock('./firebase', () => ({
  auth: { currentUser: { uid: 'test-user-123' } },
  db: {},
}));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  doc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
}));
```

## Angular + Capacitor Web Output

Angular + Ionic outputs to `www/browser` (not `dist`). Update `capacitor.config.ts`:
```typescript
const config: CapacitorConfig = {
  webDir: 'www/browser',  // NOT 'dist'
};
```

## pnpm Store Location Errors

**Symptom:** `ERR_PNPM_UNEXPECTED_STORE` — pnpm wants to use a different store.

**Fix:** Delete `node_modules` and reinstall:
```bash
rm -rf node_modules && pnpm install
```

## Floating Point in Tests

Use `toBeCloseTo` instead of `toBe` for amortization calculations:
```typescript
// Bad
expect(schedule[last].balance).toBe(0);

// Good
expect(schedule[last].balance).toBeCloseTo(0, 2);
```
