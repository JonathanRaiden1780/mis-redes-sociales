# Days Since Created Calculation for Firestore Timestamps

**Used in:** `src/pages/Starts.tsx` (Inicios/Prospectos module)
**Date:** 2026-08-19

## The bug

When displaying "Días" (days since creation) for a lead, the original code treated `createdAt` as a raw number:

```typescript
// BROKEN: Firestore Timestamps are objects, not numbers
{lead.createdAt ? Math.floor((Date.now() - (lead.createdAt as any)) / (1000 * 60 * 60 * 24)) : 0}
```

This produced incorrect values (often `NaN` or wildly wrong numbers) because `createdAt` from Firestore is a `Timestamp` object with `toDate()` and `seconds` properties, not a millisecond number.

## The fix

Create a helper function that handles multiple Timestamp formats:

```typescript
const daysSinceCreated = (createdAt: unknown): number => {
  if (!createdAt) return 0;
  if (typeof createdAt === 'number') {
    return Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24));
  }
  if (typeof createdAt === 'object' && createdAt !== null) {
    const ts = createdAt as { toDate?: () => Date; seconds?: number };
    if (typeof ts.toDate === 'function') {
      return Math.floor((Date.now() - ts.toDate().getTime()) / (1000 * 60 * 60 * 24));
    }
    if (typeof ts.seconds === 'number') {
      return Math.floor((Date.now() - ts.seconds * 1000) / (1000 * 60 * 60 * 24));
    }
  }
  return 0;
};
```

## Why multiple formats?

Firestore Timestamps can appear as:
1. **Full Timestamp object** — `{toDate(): Date, seconds: number, nanoseconds: number}` (from live queries)
2. **Plain object with seconds** — `{seconds: 1234567890}` (from JSON serialization or cache)
3. **Millisecond number** — `1234567890000` (from local state or fallback)

## Pitfall

Always test with real Firestore data — the SDK converts Timestamps transparently in most cases, but when data passes through JSON serialization (localStorage, API boundaries, cache), the Timestamp object loses its prototype methods and becomes a plain object with `seconds`. The helper handles both cases.
