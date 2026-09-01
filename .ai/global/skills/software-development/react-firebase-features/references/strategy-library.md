# Strategy Library: WhatsApp, Clipboard, Personalize, Custom

**Used in:** `src/components/leads/StrategyLibrary.tsx`
**Date:** 2026-08-20

## Pattern

A multi-action strategy picker that lets users apply predefined marketing strategies to leads, with multiple ways to deliver the message.

## Three delivery modes per strategy

| Mode | Icon | Behavior |
|------|------|----------|
| **Copy** | `Copy` | Copies template to clipboard, shows "Copied" feedback for 2s |
| **Send** | `Send` | Opens WhatsApp (`wa.me/<phone>?text=<encoded>`) with template |
| **Personalize** | `Edit3` | Opens inline textarea pre-filled with template for editing before sending |

## Template variables

```typescript
const applyTemplate = (template: string) => {
  return template
    .replace('{name}', leadName || 'cliente')
    .replace('{phone}', leadPhone || '');
};
```

## WhatsApp integration

```typescript
const handleSendWhatsApp = (message: string) => {
  const phone = leadPhone?.replace(/[^0-9]/g, '') || '';
  const encodedMsg = encodeURIComponent(message);
  if (phone) {
    window.open(`https://wa.me/${phone}?text=${encodedMsg}`, '_blank');
  } else {
    navigator.clipboard.writeText(message).then(() => {
      alert('Teléfono no disponible. Mensaje copiado al portapapeles.');
    });
  }
};
```

## Custom strategy mode

A dashed-border button at the top opens a free-form textarea pre-filled with `¡Hola {name}!`:

```typescript
const handleStartCustomStrategy = () => {
  setCustomMode(true);
  setCustomMessage(`¡Hola${leadName ? ' ' + leadName : ''}! `);
};
```

This gives users a third path: write from scratch while still having the name/phone variables available.

## Pitfall

Don't auto-send on strategy selection. The user explicitly asked for three SEPARATE actions (copy, send, personalize) so they control when and how the message reaches the client. Auto-send would be aggressive and reduce trust.

## Props interface

```typescript
interface StrategyLibraryProps {
  strategies: LeadStrategy[];
  onSelectStrategy: (strategy: LeadStrategy) => void;
  onCancel: () => void;
  leadName?: string;
  leadPhone?: string;  // NEW: required for WhatsApp
}
```

## Visual layout

```
┌─────────────────────────────────────┐
│  Estrategias para [Client Name]     │
├─────────────────────────────────────┤
│  ┌─ Dashed border ──────────────┐   │
│  │ ✏️ Estrategia Nueva          │   │
│  │   Crea un mensaje personalizado│  │
│  └──────────────────────────────┘   │
│                                     │
│  Estrategias predefinidas:          │
│  ┌─────────────────────────────┐    │
│  │ Pink Bazar                  │    │
│  │ [template preview]          │    │
│  │ [📋 Copiar] [📤 Enviar] [✏️ Personalizar] │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │ Sesión de Belleza           │    │
│  │ ...                         │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```
