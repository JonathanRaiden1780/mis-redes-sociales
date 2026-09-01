# Firestore Backward Compatibility Pattern — Session 2026-08-20

## Context

When refactoring Firestore data structures (e.g., splitting `statuses` into `prospectStatuses`/`inicioStatuses`), old documents in Firestore retain the original field names. The app crashes at runtime with errors like `"statuses is not iterable"` because the new code expects the new fields.

## The Fix — Two Layers

### Layer 1: Normalize in the hook

Add normalization at the hook level to handle both old and new field names:

```typescript
const normalized = initial
  ? {
      ...initial,
      prospectStatuses:
        initial.prospectStatuses ?? (initial as unknown as { statuses: ProspectStatusDefinition[] }).statuses ?? [],
      inicioStatuses:
        initial.inicioStatuses ?? [],
      thresholds:
        initial.thresholds ?? [],
    }
  : DEFAULT_STARTS_SETTINGS;
const base = normalized;
```

### Layer 2: Guard every array iteration

Even after normalization, every component that renders an array must guard against `undefined`:

```typescript
// In grid components that map over arrays:
const safeArray = possiblyUndefined ?? [];
return safeArray.map((item) => <Row key={item.id} ... />);
```

This includes:
- `StatusesGrid` — `statuses?.length`, `statuses.map()`
- `ThresholdsGrid` — `form.thresholds?.length`, `form.thresholds.map()`
- `SuggestionsGrid` — `form.defaultSuggestions?.length`, `form.defaultSuggestions.map()`
- `StrategyGrid` — `form.strategyLog?.length`, `form.strategyLog.map()`

### Layer 3: Null-safe validation functions

Functions that iterate arrays passed from external sources must also guard:

```typescript
export const validateStatusDefinitionsUnique = (
  statuses: ProspectStatusDefinition[] | undefined | null
): { ok: boolean; duplicateId?: string } => {
  const safeStatuses = Array.isArray(statuses) ? statuses : [];
  const seen = new Set<string>();
  // ... iterate safeStatuses
};
```

## Common Pitfalls

1. **useEffect depends on `initial` but uses `normalized`** — When the `useEffect` that syncs state runs, it should read from `normalized`, not `initial`. Otherwise, old-format data triggers the effect but writes raw `initial.prospectStatuses` (undefined) into state.

2. **Default values for missing fields** — Always provide `[]` for arrays to avoid `undefined` iteration errors in `validateStatusDefinitionsUnique()` and similar functions.

3. **Type casting** — Use `as unknown as { ... }` to safely access legacy fields without TypeScript complaining about non-existent properties.

4. **Only normalizing the hook is not enough** — Components that receive arrays as props or read them from the form context still crash if the array is undefined. Every `.map()` and `.length` access needs a guard.

## Error Messages

| Error | Cause |
|-------|-------|
| `"statuses is not iterable"` | Code reads `.statuses` on a document that now has `.prospectStatuses` |
| `"prospectStatuses is not iterable"` | Old Firestore document doesn't have the new field |
| `"Cannot read properties of undefined (reading 'map')"` | Grid component receives undefined array (e.g., `form.thresholds`) |
| `"Cannot read properties of undefined (reading 'length')"` | `.length` accessed on undefined array in template |
| `TS2339: Property 'statuses' does not exist` | TypeScript type doesn't include the legacy field |

## Verification

```bash
# After normalization, both formats should work:
# 1. Old format: { statuses: [...], ... }
# 2. New format: { prospectStatuses: [...], inicioStatuses: [...], ... }
# 3. Missing fields: {} → falls back to DEFAULT_STARTS_SETTINGS
```
