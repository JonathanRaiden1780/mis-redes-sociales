# Cross-Tab Actions in Lifecycle-Based Pages

**Used in:** `src/pages/Starts.tsx` (Inicios/Prospectos module)
**Date:** 2026-08-19

## Pattern

When a page has multiple tabs representing lifecycle stages (prospect → inicio → converted → lost), action handlers must work consistently across ALL tabs — not just the primary "active" one.

## The rule

| Tab | Status Change | Bitácora | Estrategias | Convert to Client | Mark as Lost |
|-----|---------------|----------|-------------|-------------------|--------------|
| prospect | ✅ | ✅ | ✅ | ✅ | ✅ |
| inicio | ✅ | ✅ | ✅ | ✅ | ✅ |
| converted | ✅ | ✅ | ✅ | ❌ | ❌ |
| lost | ✅ | ✅ | ✅ | ❌ | ❌ |

**Key insight:** Status change, bitacora, and strategies remain accessible even on terminal tabs (converted/lost) so users can still annotate and reclassify. Only the destructive/state-changing actions (convert, mark as lost) are hidden on terminal tabs.

## Implementation

```typescript
const canModify = activeTab !== 'converted' && activeTab !== 'lost';

// In JSX:
{canModify && (
  <>
    <button onClick={() => handleConvertToClient(lead)}>Convertir</button>
    <button onClick={() => handleMarkAsLost(lead)}>Perdido</button>
  </>
)}
```

## Pitfall

Don't wrap the entire action bar in `canModify` — that would hide bitácora and strategies from converted/lost leads, making the detail view read-only when it shouldn't be.
