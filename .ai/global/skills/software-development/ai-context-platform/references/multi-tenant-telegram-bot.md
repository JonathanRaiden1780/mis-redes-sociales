# Multi-Tenant Telegram Bot Pattern

When a single Telegram bot serves multiple users, each user's data MUST be isolated. This reference documents the architecture.

## Architecture

```
bot_users.db (SQLite)
├── bot_users
│   ├── telegram_id (PK) — unique per Telegram user
│   ├── telegram_username, first_name, last_name
│   ├── business_id — linked MiNegocio business
│   ├── minegocio_user_id — user ID in MiNegocio
│   └── minegocio_role — admin, seller, client
├── user_reminders
│   ├── telegram_id (FK) — isolates per user
│   ├── title, description, due_date, recurrence
│   └── completed, notified
├── user_memories
│   ├── telegram_id (FK) — isolates per user
│   ├── key, value, category
│   └── created_at
└── user_conversations
    ├── telegram_id (FK) — isolates per user
    ├── mode, role (user/assistant), content
    └── created_at
```

## Key Principles

### 1. Automatic Registration
Every `/start` command registers the user:
```python
user_mgr.register_user(
    telegram_id=user.id,
    first_name=user.first_name,
    last_name=user.last_name,
    username=user.username,
)
```

### 2. Business Linking
Users can link to MiNegocio via `/link <business_code>`:
```python
user_mgr.link_business(
    telegram_id=user.id,
    business_id=business_code,
    minegocio_user_id=f"user_{user.id}",
    minegocio_role="admin",
)
```

### 3. Data Isolation
ALL queries filter by `telegram_id`:
```python
# GOOD — user A can only see their own data
def get_reminders(self, telegram_id: int, ...):
    return self.conn.execute(
        "SELECT * FROM user_reminders WHERE telegram_id = ?",
        (telegram_id,)
    )

# BAD — would leak data between users
def get_all_reminders(self):
    return self.conn.execute("SELECT * FROM user_reminders")
```

### 4. Conversation History Isolation
Each user has their own conversation history:
```python
def get_conversation_history(self, telegram_id: int, ...):
    return self.conn.execute(
        "SELECT * FROM user_conversations WHERE telegram_id = ?",
        (telegram_id,)
    )
```

### 5. Memory Isolation
User memories (including settings like chat mode) are per-user:
```python
def get_memories(self, telegram_id: int, category=None):
    if category:
        return self.conn.execute(
            "SELECT * FROM user_memories WHERE telegram_id = ? AND category = ?",
            (telegram_id, category)
        )
    return self.conn.execute(
        "SELECT * FROM user_memories WHERE telegram_id = ?",
        (telegram_id,)
    )
```

### 6 rights-Style Deletion
```python
def delete_all_user_data(self, telegram_id: int):
    conn.execute("DELETE FROM user_reminders WHERE telegram_id = ?", (telegram_id,))
    conn.execute("DELETE FROM user_memories WHERE telegram_id = ?", (telegram_id,))
    conn.execute("DELETE FROM user_conversations WHERE telegram_id = ?", (telegram_id,))
    conn.execute("DELETE FROM bot_users WHERE telegram_id = ?", (telegram_id,))
```

## Command Handler Pattern

```python
async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    
    # Get user-specific mode
    mode_memories = user_mgr.get_memories(user.id, category="settings")
    mode = "chat"
    for m in mode_memories:
        if m["key"] == "chat_mode":
            mode = m["value"]
    
    # Get user-specific business context
    bot_user = user_mgr.get_user(user.id)
    business_id = bot_user.business_id if bot_user else None
    
    # Send to LLM with user-specific context
    payload = json.dumps({
        "mode": mode,
        "message": message_text,
        "telegram_id": user.id,
        "business_id": business_id,
    })
    
    # Log conversation (isolated by telegram_id)
    user_mgr.log_conversation(user.id, mode, "user", message_text)
    user_mgr.log_conversation(user.id, mode, "assistant", response_text)
```

## Bot Server Healthcheck

Since the bot uses long-polling (not HTTP), the healthcheck approach:

```yaml
# Option 1: Process-based check
healthcheck:
  test: ["CMD", "pgrep", "-f", "bot_server.py"]
  interval: 60s
  timeout: 5s
  retries: 3

# Option 2: HTTP sidecar (if you add a health endpoint)
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
  interval: 60s
  timeout: 5s
  retries: 3
```

## Integration with LLM Server

The bot delegates AI processing to nas-llm-server:

```
User → Telegram → nas-bot → nas-llm-server → Ollama
         ↓              ↓
    user_manager    response
    (isolate)       (return)
```

This keeps the bot lightweight — all AI logic stays in the LLM server.

## Bot Commands

| Command | Purpose |
|---------|---------|
| `/start` | Register user, show welcome |
| `/ayuda` | Show available commands |
| `/link <code>` | Link to MiNegocio business |
| `/unlink` | Unlink business |
| `/modo <mode>` | Set chat mode (stored as user memory) |
| `/recordatorios` | List user's reminders |
| `/recuerda <date> <title>` | Create reminder |
| `/borrarecordatorio <id>` | Delete user's reminder |
| `/memorias` | List user's memories |
| `/borramemoria <key>` | Delete user's memory |
| `/misdatos` | Show user profile |
| `/borratodo CONFIRMAR` | Delete ALL user data (GDPR) |

## Pattern: File-Age Healthcheck for Batch Jobs

When a service is a batch job (like music-syncer) and you need to report its status:

1. **Don't modify the batch job** — it generates a report file (e.g., `summary_report.txt`)
2. **Add an HTTP sidecar** that:
   - Parses the report file
   - Checks file age (stale if > threshold)
   - Returns combined health status
3. **Entrypoint starts both**:
   ```bash
   # Start sidecar in background
   python3 /app/syncer_server.py &
   # Run batch job in foreground
   exec bash /app/sync.sh
   ```
4. **Healthcheck queries the sidecar**:
   ```yaml
   healthcheck:
     test: ["CMD", "curl", "-f", "http://localhost:8088/health"]
   ```

## Pitfalls

- **Forgetting telegram_id filter** — every query MUST filter by telegram_id or users see each other's data
- **Storing business_id in plain memory** — always use the user_manager, not global variables
- **Healthcheck for long-polling services** — use process check or HTTP sidecar, not port check
- **Bot token exposure** — never expose the token in healthcheck output or logs
- **Not confirming data deletion** — `/borratodo` requires explicit `CONFIRMAR` argument
- **Mode stored globally** — chat mode is per-user, store in user_memories not global state
