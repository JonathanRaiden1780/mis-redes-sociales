# React Native Jest + Supabase Testing

**Project:** FinanzeasyReact  
**Date:** 2026-08-18

## Jest Configuration for React Native + Supabase

### Working Versions

```json
// package.json devDependencies
"jest": "^29.7.0",
"jest-expo": "^54.0.18",
"babel-jest": "^29.7.0",
"@types/jest": "^29.5.14",
"babel-preset-expo": "^54.0.12"
```

**Pitfall:** jest@30 + jest-expo@57 causes `TypeError: this._moduleMocker.clearMocksOnScope is not a function`. The jest-runtime@30.x removed internal methods that jest-expo@57 relies on. Use jest@29 + jest-expo@54.

### Jest Config

```javascript
// jest.config.js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  coveragePathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  moduleNameMapper: {
    '^react-native$': '<rootDir>/src/__mocks__/react-native.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|expo|@expo|react-navigation|@react-navigation|@unimodules|unimodules|sentry-expo|native-base|react-native-svg|date-fns)',
  ],
};
```

### React Native Mock

```javascript
// src/__mocks__/react-native.js
const mock = {
  Platform: { OS: 'ios', select: (obj) => obj.ios },
  StyleSheet: { create: (s) => s, flatten: (s) => s },
  View: () => null,
  Text: () => null,
  TouchableOpacity: () => null,
  ScrollView: () => null,
  FlatList: () => null,
  Alert: { alert: () => {} },
  Linking: { openURL: () => {}, canOpenURL: () => {} },
  Dimensions: { get: () => ({ width: 375, height: 812 }) },
  PixelRatio: { get: () => 2 },
  AppState: { currentState: 'active', addEventListener: () => ({ remove: () => {} }), removeEventListener: () => {} },
  Appearance: { getColorScheme: () => 'light', addChangeListener: () => ({ remove: () => {} }), removeChangeListener: () => {} },
  Keyboard: { addListener: () => ({ remove: () => {} }), removeAllListeners: () => {}, removeListener: () => {}, dismiss: () => {} },
  DeviceEventEmitter: { addListener: () => ({ remove: () => {} }), removeAllListeners: () => {}, removeListener: () => {} },
  NativeEventEmitter: () => ({ addListener: () => ({ remove: () => {} }), removeAllListeners: () => {}, removeListener: () => {} }),
  NativeModules: {},
  Animated: {
    Value: () => ({ setValue: () => {}, addListener: () => ({ remove: () => {} }), removeAllListeners: () => {}, removeListener: () => {}, interpolate: () => ({ inputRange: [], outputRange: [] }) }),
    timing: () => ({ start: () => {} }),
    spring: () => ({ start: () => {} }),
    View: () => null,
    Text: () => null,
    ScrollView: () => null,
    FlatList: () => null,
    Image: () => null,
    createAnimatedComponent: () => () => null,
  },
  Easing: { linear: () => ({}), ease: () => ({}), quad: () => ({}) },
  InteractionManager: { runAfterInteractions: () => {} },
  LayoutAnimation: { configureNext: () => {}, Presets: {} },
  UIManager: {},
  AccessibilityInfo: {},
  Share: { share: () => {} },
  PermissionsAndroid: { requestMultiple: () => ({}), PERMISSIONS: {}, RESULTS: {} },
  Settings: {},
  Systrace: {},
  TurboModuleRegistry: {},
  DeviceInfo: {},
};

module.exports = mock;
```

### Supabase Mock Pattern

```typescript
// src/services/__tests__/supabase-sync.test.ts
const mockSupabase = {
  from: jest.fn(),
  auth: {
    getSession: jest.fn(),
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    signInWithOAuth: jest.fn(),
    resetPasswordForEmail: jest.fn(),
    onAuthStateChange: jest.fn(),
  },
  rpc: jest.fn(),
};

jest.mock('../services/supabase', () => ({
  getSupabaseClient: () => mockSupabase,
  initializeSupabase: jest.fn(),
  signInWithGoogle: jest.fn(),
  signUp: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
  resetPassword: jest.fn(),
}));
```

### Zustand Store Test Pattern

```typescript
// src/store/__tests__/financeStore.test.ts
import { useFinanceStore } from '../financeStore';

jest.mock('../../services/accountService', () => ({
  accountService: { getAll: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
}));
// ... mock other services

describe('FinanceStore', () => {
  beforeEach(() => {
    useFinanceStore.setState({
      accounts: [], transactions: [], // ... reset all state
      isLoading: false, error: null,
    });
    jest.clearAllMocks();
  });

  it('should fetch accounts successfully', async () => {
    const { accountService } = require('../../services/accountService');
    accountService.getAll.mockResolvedValue(mockAccounts);

    await useFinanceStore.getState().fetchAccounts();

    const state = useFinanceStore.getState();
    expect(state.accounts).toEqual(mockAccounts);
  });
});
```

**Important:** Use `require()` inside tests to get the mocked module, not top-level imports. Jest's `jest.mock` hoisting means top-level imports may not be mocked yet.

### SupabaseService Expose Client Getter

```typescript
// Angular SupabaseService needs to expose client for AIService etc.
export class SupabaseService {
  private readonly _client: SupabaseClient;
  // ...
  get client(): SupabaseClient {
    return this._client;
  }
}
```

### Common Pitfalls

1. **jest@30 + jest-expo@57 incompatibility** — causes `clearMocksOnScope` error. Use jest@29.
2. **Missing react-native mock** — Import errors on `react-native/jest/setup.js`. Create `src/__mocks__/react-native.js`.
3. **transformIgnorePatterns too strict** — Must include `date-fns`, `react-native-svg`, etc.
4. **expo-secure-store not installed** — Don't mock it in jest.setup.js if not a dependency.
5. **Service import paths in tests** — Use `require()` inside test bodies after `jest.mock` calls.
6. **Zustand state persistence** — Reset state in `beforeEach` with `setState`.
7. **Promise vs Observable mismatch** — Angular services use Promises (`Promise.resolve`) not Observables (`of()`) for mocked return values.

## Verification

```bash
pnpm test
# Should output: Test Suites: 5 passed, 5 total | Tests: 61 passed, 61 total
```
