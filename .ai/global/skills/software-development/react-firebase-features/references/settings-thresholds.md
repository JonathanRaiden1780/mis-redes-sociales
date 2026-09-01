# Settings: Threshold Configuration

**Used in:** `src/components/settings/SettingsStartsSection.tsx`, `src/hooks/useSettingsStartsForm.ts`, `src/lib/startsDomain.ts`
**Date:** 2026-08-20

## Pattern

For lifecycle-based features, users need configurable inactivity thresholds that trigger notifications. This allows fine-grained control over when alerts fire.

## Data model

```typescript
export interface ThresholdConfig {
  id: string;
  label: string;
  days: number;
  notify: boolean;
  color: 'green' | 'yellow' | 'orange' | 'red';
}

export interface StartsModuleSettings {
  prospectStatuses: ProspectStatusDefinition[];
  inicioStatuses: ProspectStatusDefinition[];
  defaultSuggestions: ProspectSuggestionDefinition[];
  stagnationDays: number;
  thresholds: ThresholdConfig[];
  strategyLog: StartsStrategyLogEntry[];
}
```

## UI Pattern

Card-based grid where each threshold is a colored card:

```
┌─────────────────────────────────────────┐
│  Umbrales de inactividad                │
│  Alertas automáticas por días sin actividad │
├─────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ Amarillo │ │ Naranja  │ │ Rojo     │ │
│  │ Días: 5  │ │ Días: 10 │ │ Días: 14 │ │
│  │ ☑ Notif  │ │ ☑ Notif  │ │ ☑ Notif  │ │
│  │ [color ▼]│ │ [color ▼]│ │ [color ▼]│ │
│  │ [✕]      │ │ [✕]      │ │ [✕]      │ │
│  └──────────┘ └──────────┘ └──────────┘ │
│  + Agregar umbral                       │
└─────────────────────────────────────────┘
```

Each card contains:
- Editable label input
- Day count input (1-90)
- Notify toggle checkbox
- Color selector dropdown
- Remove button

## Hook methods

```typescript
const [thresholds, setThresholds] = useState<ThresholdConfig[]>(base.thresholds);

const addThreshold = (t: Omit<ThresholdConfig, 'id'>) =>
  setThresholds((p) => [...p, { id: uid(), ...t }]);

const updateThreshold = (id: string, patch: Partial<ThresholdConfig>) =>
  setThresholds((p) => p.map((t) => (t.id === id ? { ...t, ...patch } : t)));

const removeThreshold = (id: string) =>
  setThresholds((p) => p.filter((t) => t.id !== id));
```

## Why multiple thresholds?

Users want granular control:
- **Yellow at 5 days** — gentle reminder (WhatsApp check-in)
- **Orange at 10 days** — urgent (call or visit)
- **Red at 14 days** — critical (last attempt before marking lost)

Each threshold can independently trigger notifications, giving users control over their re-engagement workflow.

## Default thresholds

```typescript
thresholds: [
  { id: 't1', label: 'Amarillo (atención)', days: 5, notify: true, color: 'yellow' },
  { id: 't2', label: 'Naranja (urgente)', days: 10, notify: true, color: 'orange' },
  { id: 't3', label: 'Rojo (crítico)', days: 14, notify: true, color: 'red' },
],
```

## Color map

```typescript
const THRESHOLD_COLORS: Record<ThresholdConfig['color'], string> = {
  green: 'border-green-300 bg-green-50',
  yellow: 'border-yellow-300 bg-yellow-50',
  orange: 'border-orange-300 bg-orange-50',
  red: 'border-red-300 bg-red-50'
};
```

## Pitfall

Don't confuse `stagnationDays` (legacy single threshold) with `thresholds` (new multi-threshold config). Migrate existing settings to use `thresholds` array and deprecate `stagnationDays`.
