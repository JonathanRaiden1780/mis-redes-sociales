# Debugging useEffect Infinite Loops in React+Firebase

## Pattern

A `useEffect` that depends on callbacks passed as props from a parent component can cause an infinite render loop if those callbacks are recreated each render.

**Symptom:** Browser console floods with `Maximum update depth exceeded` and thousands of failed Firestore requests (400/permission-denied).

**Root cause:** Functions like `setSalesNote(data)`, `setSchedule(data)`, `setStartsModule(data)` are recreated on every render of the parent. When they appear in the dependency array of `useEffect` in a child hook, the effect re-runs on every render → calls setState → parent re-renders → new function references → effect re-runs again.

## Example

```typescript
// Parent passes callbacks to hook
const salesNoteApi = useSalesNoteApi(); // returns new object each render
useSettingsBusinessData({
  onReady: (data) => setSalesNote(data), // new function each render
});

// Child hook - BUG
useEffect(() => {
  fetchData().then(result => onReady(result));
}, [onReady]); // onReady changes every render → infinite loop
```

## Fix: useRef pattern

```typescript
export function useSettingsBusinessData(callbacks: Callbacks) {
  // Store callbacks in refs to hold stable references
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks; // update on each render, no loop

  useEffect(() => {
    // Use callbacksRef.current inside the effect
    fetchData().then(result => callbacksRef.current.onReady(result));
    // No dependency on callbacks — effect runs once
  }, []); // empty deps = run once
}
```

## Verification

1. Before fix: browser console shows thousands of failed Firestore requests
2. After fix: single successful fetch, no loop
3. `tsc --noEmit` passes
4. `pnpm run lint` passes (if timeout, run `npx tsc --noEmit` directly)

## When to apply

- Hook depends on callbacks/props that are inline functions
- Error is `Maximum update depth exceeded`
- Firestore/HTTP requests flood the network tab
