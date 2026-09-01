# Expandable Detail Cards Pattern

**Used in:** `src/pages/Starts.tsx` (Inicios/Prospectos module)
**Date:** 2026-08-19

## When to use

When a list needs inline expansion to show detailed history, actions, and metadata without navigating away. Better than modals for quick scanning and better than separate pages for context preservation.

## Layout structure

```
┌─────────────────────────────────────────────────────┐
│ [Avatar]  Name                    [contact info] [▼]│
│           Status badge | Last activity               │
├─────────────────────────────────────────────────────┤
│ [Bitácora] [Estrategias] [Convertir] [Perdido]       │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐ (expanded)
│  Historial del Prospecto           Created: date    │
│                                                     │
│  ┌ Contacto ──────┐  ┌ Bitácora ──────────────────┐ │
│  │ Phone          │  │ [icon] Type    Date        │ │
│  │ Email          │  │        content              │ │
│  │ Notes          │  │ [icon] Type    Date        │ │
│  └────────────────┘  │        content              │ │
│                      └─────────────────────────────┘ │
│  ┌ Estatus ───────┐  ┌ Stats ─────────────────────┐ │
│  │ [Badge]        │  │  5    3     12              │ │
│  │ [Dropdown ▼]   │  │ Activ  Estr  Días           │ │
│  └────────────────┘  └─────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## Key patterns

### 1. Toggle expansion via state

```typescript
const [viewingLead, setViewingLead] = useState<Lead | null>(null);

// In render:
<div onClick={() => setViewingLead(viewingLead?.id === lead.id ? null : lead)}>
  {/* card header */}
</div>

{viewingLead?.id === lead.id && (
  <div className="border-t ...">
    {/* expanded detail */}
  </div>
)}
```

### 2. Status change with audit trail

Always write a bitacora entry when status changes — never silent mutation:

```typescript
const handleChangeStatus = async (lead: Lead, newStatusId: string) => {
  if (lead.statusId === newStatusId) return;
  const status = STATUSES.find(s => s.id === newStatusId);
  const entry: BitacoraEntry = {
    id: Date.now().toString(),
    type: 'note', // or 'status_change' if your schema supports it
    content: `Cambio de estatus: ${status?.label || newStatusId}`,
    createdAt: Date.now(),
    authorUid: userProfile?.uid,
    authorName: userProfile?.displayName,
  };
  await updateDoc(doc(db, 'leads', lead.id), {
    statusId: newStatusId,
    bitacora: [...(lead.bitacora || []), entry],
    updatedAt: serverTimestamp(),
    lastActivityAt: Date.now(),
  });
};
```

### 3. Two-column detail layout

Use CSS Grid for the expanded section:
- Left column (narrower): Contact info, status change, stats
- Right column (wider): Bitacora timeline (scrollable if long)

```typescript
<div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
  <div className="space-y-4">
    {/* Contact card + Status card + Stats */}
  </div>
  <div className="bg-white rounded-xl p-4 border border-gray-200">
    {/* Bitacora timeline */}
  </div>
</div>
```

### 4. Timeline scroll

Bitacora should be scrollable with max-height:
```typescript
<div className="space-y-3 max-h-64 overflow-y-auto pr-1">
  {[...lead.bitacora].reverse().map(entry => (
    <div key={entry.id} className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center">
        {getIcon(entry.type)}
      </div>
      <div className="flex-1">
        <div className="text-xs text-gray-400">
          {getLabel(entry.type)} · {formatDate(entry.createdAt)}
        </div>
        <p className="text-sm text-gray-700">{entry.content}</p>
      </div>
    </div>
  ))}
</div>
```

## Design principles (from Linear design system)

- **Full-width cards** — No grid, cards span container width. More room for inline actions and metadata.
- **Subtle borders** — `border-gray-200` or `border-gray-100`, never heavy borders.
- **Luminance-based elevation** — `bg-white` for cards, `bg-gray-50/50` for expanded section. No drop-shadows needed.
- **Accent only for interactive** — Indigo for buttons/links, purple for strategies, green for conversion, red for destructive. Gray for everything else.
- **Compact but readable** — `text-sm` for body, `text-xs` for metadata, `text-lg` for stat numbers.
- **Inline contact info** — Show phone + email on card header (hidden on mobile) so user doesn't need to expand to see basic info.

## Pitfalls

1. **Click propagation** — Card header has `onClick={toggle}`, but action buttons inside must call `e.stopPropagation()` or they'll toggle the card when clicked.
2. **Empty state** — Always show "Sin actividad registrada" when bitacora is empty. Don't leave blank space.
3. **Status dropdown disabled during save** — Add `disabled={saving}` to prevent double-submit.
4. **Scroll on timeline** — Use `overflow-y-auto` with `max-h-48` or `max-h-64` to prevent the expanded card from growing infinitely.
5. **Stats calculation** — Days calculation must handle both `Timestamp` objects and raw numbers. Use `(lead.createdAt as any)` pattern or check for `.toDate?.()` method.
