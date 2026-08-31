# TASK-005: WhatsApp Diffusion Bot

## Scope

Build a WhatsApp bot for diffusing promotional offers and deals to contacts via broadcast messages.

## Approach: Twilio WhatsApp Business API

Twilio provides the most reliable programmatic WhatsApp messaging with:
- Official WhatsApp Business API
- Template message system
- Opt-in management
- Sandbox for testing
- Python SDK (`pip install twilio`)

## Setup

### Twilio WhatsApp Sandbox (Testing)
```python
from twilio.rest import Client

client = Client(account_sid, auth_token)
message = client.messages.create(
    from_="whatsapp:+14155238886",  # Twilio sandbox number
    to="whatsapp:+user_phone_number",
    body="🔥 OFERTA: 2x800 en perfumes! Responde QUERO para más info"
)
```

### Production (WhatsApp Business API)
- Need a WhatsApp Business account
- Template messages must be approved by Meta
- Opt-in from recipients required
- Use `content_sid` for template messages

## Features

1. **Broadcast diffusion**: Send offer messages to multiple contacts
2. **Template messages**: Pre-approved templates for different offer types
3. **Media attachment**: Send generated image/video with message
4. **Campaign tracking**: Log sent messages, delivery status
5. **Group diffusion**: Send to WhatsApp groups if authorized

## Data Model

### WhatsAppDiffusion
- `id` (UUID)
- `campaign_id` (FK)
- `message_template` (text)
- `recipients` (JSON list of phone numbers)
- `status` (pending | sending | sent | failed)
- `sent_at`
- `delivered_count`, `failed_count`

## API Endpoints

- `POST /api/whatsapp/send` — Send diffusion message
- `POST /api/whatsapp/broadcast` — Broadcast to multiple recipients
- `GET /api/whatsapp/status/{message_id}` — Check delivery status
- `GET /api/whatsapp/history` — Message history

## Files

```
src/server/api/whatsapp.py
src/server/core/social_clients/whatsapp.py
```

## Acceptance Criteria
- Send single WhatsApp messages via Twilio
- Broadcast to multiple recipients
- Template message support
- Delivery status tracking
- Tests with Twilio fake/mock
- Works with Twilio sandbox

## Dependencies
- Twilio account SID + auth token
- Twilio Python SDK (`pip install twilio`)
- WhatsApp Business API / sandbox number