# Lifecycle-Specific Status Models

**Used in:** `src/lib/leadConfigs.ts`, `src/pages/Starts.tsx`
**Date:** 2026-08-20

## Pattern

Different lifecycle stages often need different status vocabularies. A prospect's status (nuevo, contactado, interesado) is different from an active client's status (activo, pausa, recurrente).

## Implementation

```typescript
// Prospect statuses — sales pipeline
export const PROSPECT_STATUSES: LeadStatusOption[] = [
  { id: 'nuevo', label: 'Nuevo', color: 'bg-blue-100', textColor: 'text-blue-800', daysUntilStale: 7 },
  { id: 'contactado', label: 'Contactado', color: 'bg-yellow-100', textColor: 'text-yellow-800', daysUntilStale: 5 },
  { id: 'interesado', label: 'Interesado', color: 'bg-purple-100', textColor: 'text-purple-800', daysUntilStale: 10 },
  { id: 'en_seguimiento', label: 'En Seguimiento', color: 'bg-orange-100', textColor: 'text-orange-800', daysUntilStale: 7 },
  { id: 'listo_para_iniciar', label: 'Listo para Iniciar', color: 'bg-green-100', textColor: 'text-green-800', daysUntilStale: 3 },
  { id: 'no_responde', label: 'No Responde', color: 'bg-gray-100', textColor: 'text-gray-800', daysUntilStale: 14 },
  { id: 'no_interesado', label: 'No Interesado', color: 'bg-red-100', textColor: 'text-red-800', daysUntilStale: 30 },
];

// Inicio statuses — already started in business
export const INICIO_STATUSES: LeadStatusOption[] = [
  { id: 'activo', label: 'Activo', color: 'bg-green-100', textColor: 'text-green-800', daysUntilStale: 14 },
  { id: 'pausa', label: 'En Pausa', color: 'bg-yellow-100', textColor: 'text-yellow-800', daysUntilStale: 7 },
  { id: 'primera_compra', label: 'Primera Compra', color: 'bg-indigo-100', textColor: 'text-indigo-800', daysUntilStale: 7 },
  { id: 'recurrente', label: 'Recurrente', color: 'bg-emerald-100', textColor: 'text-emerald-800', daysUntilStale: 30 },
  { id: 'en_riesgo', label: 'En Riesgo', color: 'bg-orange-100', textColor: 'text-orange-800', daysUntilStale: 5 },
  { id: 'inactivo', label: 'Inactivo', color: 'bg-gray-100', textColor: 'text-gray-800', daysUntilStale: 30 },
];

export const getStatusesForLifecycle = (lifecycle: string): LeadStatusOption[] => {
  return lifecycle === 'inicio' ? INICIO_STATUSES : PROSPECT_STATUSES;
};
```

## Usage across the page

When a lifecycle-based page has multiple tabs, use `getStatusesForLifecycle(activeTab)` everywhere:

```typescript
// Status filter dropdown
{getStatusesForLifecycle(activeTab).map(s => (
  <option key={s.id} value={s.id}>{s.label}</option>
))}

// Status change in detail view
<select value={lead.statusId} onChange={...}>
  {getStatusesForLifecycle(activeTab).map(s => (
    <option key={s.id} value={s.id}>{s.label}</option>
  ))}
</select>

// Stale detection
const statuses = getStatusesForLifecycle(activeTab);
for (const lead of leads) {
  const status = statuses.find(s => s.id === lead.statusId);
  if (!status) continue;
  // ...
}
```

## Pitfall

Don't mix lifecycle statuses with prospect statuses when rendering badges. If a lead has `inicio` lifecycle but their status badge is searched in `PROSPECT_STATUSES`, it won't find a match and will fall through to the raw `statusId` display (e.g., "activo" instead of "Activo" with green background).

## Tab-aware stale thresholds

Each status has its own `daysUntilStale` threshold. Make sure stale detection uses the correct status set for the current tab, otherwise prospect thresholds would incorrectly flag inicio leads.
