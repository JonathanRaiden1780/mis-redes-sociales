# WhatsApp Messenger Abstraction

Session: Fase 1 implementation for MiNegocio (August 2026)

## Problem

The app needed to send WhatsApp messages to leads/clients, but:
- Hardcoding `wa.me` links limits future API migration
- No tracking of what was sent, when, to whom
- Phone numbers in Mexican format need normalization (10-digit local → E.164)

## Solution: Provider Pattern

```
src/lib/messenger/
├── types.ts                  — SendMessageArgs, SendResult, MessengerProvider
├── index.ts                  — Factory: getProvider() + re-exports
├── waMeProvider.ts           — Free wa.me link provider
├── whatsAppApiProvider.ts    — Placeholder for Meta Cloud API
├── templates.ts              — Template variables + resolveTemplate()
└── sendWhatsApp.ts           — High-level: send + log to Firestore

src/hooks/useMessenger.ts     — React hook (send + sending state)
```

## Phone Normalization (Mexico)

Input formats handled:
- `5512345678` (10 digits) → `525512345678`
- `15512345678` (11 digits, cell prefix) → `525512345678`
- `525512345678` (already E.164) → pass through
- `+52 55 1234 5678` → strip non-numeric → `525512345678`

## Message Logging

Every send (manual or automated) records to `message_log` collection:
```typescript
{
  leadId, phone, message, source, templateId,
  method: 'wa.me', businessId, sentAt: serverTimestamp()
}
```

Firestore rules: sameBusiness read/write, admin update/delete.

## Template Engine

Variables: `{name}`, `{phone}`, `{business}`

```typescript
resolveTemplate('¡Hola {name}!', { name: 'María' })
// → '¡Hola María!'
```

## Future Migration Path

When Meta Cloud API is approved:
1. Set `VITE_WHATSAPP_PROVIDER=whatsapp-api`
2. Implement `whatsAppApiProvider` with fetch calls to Meta endpoint
3. No changes needed in components — they use `sendMessage()` from index.ts

## Key Decision

Why `wa.me` and not direct API?
- No Meta Business verification needed
- No API key management
- Works immediately on web + mobile
- User sees message before sending (consent)

Trade-off: not truly automatic (user must tap send in WhatsApp). Acceptable for Phase 1.
