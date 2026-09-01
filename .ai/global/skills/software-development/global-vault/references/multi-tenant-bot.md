# Multi-Tenant Telegram Bot Pattern

## Overview

A Telegram bot where multiple users share the same bot token but get complete data isolation. Each user has their own reminders, memories, conversations, and business linkage.

## Architecture

```
user_manager.py (SQLite database)
├── bot_users table
│   ├── telegram_id (PRIMARY KEY)
│   ├── telegram_username
│   ├── telegram_first_name
│   ├── telegram_last_name
│   ├── business_id (nullable, linked to MiNegocio)
│   ├── minegocio_user_id (nullable)
│   ├── minegocio_role (nullable: admin, seller, client)
│   ├── is_registered (boolean)
│   ├── created_at
│   └── last_active
├── user_reminders table
│   ├── id, telegram_id (FK), title, description, due_date, recurrence, completed, created_at, notified
├── user_memories table
│   ├── id, telegram_id (FK), key, value, category, created_at
└── user_conversations table
    ├── id, telegram_id (FK), mode, role, content, created_at
```

## Isolation Rules

1. **Every query filters by telegram_id** — User A cannot see User B's data
2. **Register on first /start** — No authentication required, just Telegram ID
3. **Business linking via /link** — User provides business code from MiNegocio
4. **Business ID is private** — Other users cannot see who is linked to what business
5. **Data deletion via /borratodo CONFIRMAR** — GDPR-style complete wipe

## Bot Commands

| Command | Function | Isolation |
|---------|----------|-----------|
| /start | Register + welcome | New user registration |
| /ayuda | List commands | Public |
| /link | Link MiNegocio business | User-specific |
| /unlink | Remove business link | User-specific |
| /modo | Set chat mode | User-specific memory |
| /recordatorios | List pending reminders | User-specific |
| /recuerda | Create reminder | User-specific |
| /borrareminder | Delete reminder | User-specific (must own it) |
| /memorias | List saved memories | User-specific |
| /borramemoria | Delete memory | User-specific |
| /misdatos | Show user profile | User-specific |
| /borratodo | Delete ALL user data | User-specific |

## Integration with NAS LLM Server

```python
# Bot sends context to LLM Server
payload = {
    "mode": "mi_negocio",  # or chat, night, secretary
    "message": user_message,
    "telegram_id": user.id,  # For context tracking
    "business_id": user.business_id,  # For business context
}
response = requests.post(f"{LLM_SERVER_URL}/api/chat", json=payload)
```

## Key Patterns

1. **telegram_id is the tenant key** — All data partitioned by this
2. **business_id is optional** — Users can use bot without MiNegocio
3. **No cross-user queries** — Never return data without `WHERE telegram_id = ?`
4. **Confirmation for destructive ops** — `/borratodo CONFIRMAR` required
5. **Telegram commands menu** — `app.bot.set_my_commands()` for auto-complete

## Security

- Bot token in env var only (NEVER hardcoded)
- No admin endpoints — each user is admin of their own data
- SQL injection prevention via parameterized queries
- Foreign key constraints enforce data integrity
