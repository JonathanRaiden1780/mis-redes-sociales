# Settings Page with Lifecycle Tabs

Pattern for configuring lifecycle-based features (like Inicios/Prospectos) where each lifecycle stage needs independent status configurations, plus thresholds and strategies.

## When to use

- Feature has multiple lifecycle stages (prospect, inicio, converted, lost)
- Each stage needs its own status vocabulary
- Admin wants configurable inactivity thresholds with notifications
- Strategies need to be organized by lifecycle stage

## Tab structure

```
[Prospectos] [Inicios] [Sugerencias] [Umbrales] [Estrategia]
```

### Tab 1: Prospectos
- CRUD for prospect statuses (nuevo, contactado, interesado, en_seguimiento, listo_para_iniciar, no_responde, no_interesado)
- Each status has: id, label, trafficColor (green/yellow/orange/red/gray), isDefault, isHistoric

### Tab 2: Inicios
- CRUD for inicio statuses (activo, pausa, primera_compra, recurrente, en_riesgo, inactivo)
- Same structure as prospect but different vocabulary

### Tab 3: Sugerencias
- Seed suggestions organized by lifecycle context
- Contexts: 'new', 'pending', 'lagged', 'successful', 'general'

### Tab 4: Umbrales
- Multiple configurable inactivity thresholds
- Each threshold: id, label, days, notify (boolean), color
- Example: yellow at 5 days, orange at 10, red at 14

### Tab 5: Estrategia
- Strategy log for audit trail
- Applied strategies history

## Data model

```typescript
interface StartsModuleSettings {
  prospectStatuses: ProspectStatusDefinition[];
  inicioStatuses: ProspectStatusDefinition[];
  defaultSuggestions: ProspectSuggestionDefinition[];
  stagnationDays: number;
  thresholds: ThresholdConfig[];
  strategyLog: StartsStrategyLogEntry[];
}
```

## Key components

- `SettingsStartsSection` - tab container with 5 tabs
- `StatusesGrid` - renders status list for one lifecycle
- `StatusRow` - individual status editor
- `TrafficSelect` - color picker for traffic light
- `ThresholdsGrid` - threshold configuration
- `SuggestionsGrid` - suggestion management

## Backward compatibility

Old Firestore documents may have `statuses` instead of `prospectStatuses`. Normalize at hook level:

```typescript
const normalized = initial
  ? {
      ...initial,
      prospectStatuses: initial.prospectStatuses ?? (initial as unknown as { statuses: ProspectStatusDefinition[] }).statuses ?? [],
      inicioStatuses: initial.inicioStatuses ?? [],
      thresholds: initial.thresholds ?? [],
    }
  : DEFAULT_STARTS_SETTINGS;
```

**CRITICAL:** Always normalize in BOTH the initial state AND the useEffect that updates from Firestore. Missing either causes runtime crashes.
