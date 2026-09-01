# Telegram Gateway Setup — Detailed Workflow

## One-Shot Send with `hermes send`

`hermes send` reusa gateway credentials but does NOT require the gateway service to be running. Ideal for scripts, CI, cron jobs, and ad-hoc messages.

### Target formats

```
telegram                    → home channel (TELEGRAM_HOME_CHANNEL)
telegram:-1001234567890     → specific chat/group by numeric ID
telegram:#ops               → channel by name (Discord-style, for some platforms)
```

### Common patterns

```bash
# Direct message text
hermes send --to telegram:"-1001234567890" "Deploy completed"

# Pipe from stdin
echo "Memory: 92%" | hermes send --to telegram:"-1001234567890"

# From file
hermes send --to telegram:#ops --file /tmp/report.md

# With subject header
hermes send --to telegram:#eng --subject "[CI]" --file build.log

# Media attachment (image/document)
hermes send --to telegram:"-1001234567890" "MEDIA:/tmp/chart.png"
```

### List and verify targets

```bash
hermes send --list                  # all platforms
hermes send --list telegram         # filter by platform
```

## Permanent Gateway Setup

### Step 1: Configure bot token

```
# ~/.hermes/.env
TELEGRAM_BOT_TOKEN=8695210239:AAHVqb7da2weSGLaqcyf_5N_vVAcCZSTApg
```

### Step 2: Configure allowlist and home channel

```
# ~/.hermes/.env (append after TELEGRAM_BOT_TOKEN)
TELEGRAM_ALLOWED_USERS=8165713004
TELEGRAM_HOME_CHANNEL=8165713004
TELEGRAM_HOME_CHANNEL_NAME=Jh
```

If no allowlist is set, the gateway defaults to pairing/denial and will reject unknown users.

### Step 3: Start/restart gateway

```bash
hermes gateway restart
sleep 15
hermes gateway status
```

The gateway uses long polling. For cloud deployments (Fly.io, Railway) use webhook mode instead:

```
TELEGRAM_WEBHOOK_URL=https://mi-app.fly.dev/telegram
TELEGRAM_WEBHOOK_PORT=8443
TELEGRAM_WEBHOOK_SECRET=recommended-for-production
```

### Step 4: Verify

```bash
# Token valid?
curl -s "https://api.telegram.org/bot<TOKEN>/getMe" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result']['first_name']) if d['ok'] else print('ERROR')"

# Gateway connected?
hermes gateway status | grep -E "telegram|Connected"

# End-to-end test
hermes send --to telegram "Connection test"
```

## Obtaining chat_id

### Individual DM

1. Open Telegram, search for `@GetChatID_bot` or `@userinfobot`
2. Send any message — it replies with your numeric user ID
3. Use that ID as the chat_id

### Group chat

1. Add the bot to the group
2. Send a message in the group
3. Query updates: `curl -s "https://api.telegram.org/bot<TOKEN>/getUpdates" | python3 -m json.tool`
4. Find `message.chat.id` in the response

### From gateway logs

When the gateway receives an unauthorized message, it logs:

```
Unauthorized user: 8165713004 (Jh) on telegram
```

That numeric ID is the chat_id.

## Polling Conflict — Most Common Failure

### Symptom

```
Telegram polling conflict (N/5) — previous session still held open
Error: Conflict: terminated by other getUpdates request
```

### Root cause

Another process holds an active polling connection with the same bot token. Common sources:

- A `bot.py` script running in the background (e.g., `~/telegram-bot/bot.py`)
- A second gateway instance started accidentally
- A stale process after a system reboot

### Diagnosis

```bash
# Check for competing Telegram processes
ps aux | grep -i telegram | grep -v grep

# Common locations to check
ls -la ~/telegram-bot/ 2>/dev/null
ps aux | grep bot.py | grep -v grep
```

### Fix

```bash
# 1. Kill the conflicting process
kill <PID>

# 2. Restart gateway
hermes gateway restart
```

If the conflict persists after killing visible processes, wait 30-60 seconds — Telegram servers sometimes hold stale sessions for a short time before releasing them.

## Security Notes

- The bot token is a credential — never include it in LLM context, never share it in chat
- Prefer `TELEGRAM_ALLOWED_USERS` over `GATEWAY_ALLOW_ALL_USERS=true`
- The gateway rejects unauthorized users by default when no allowlist is configured
- For production use, consider webhook mode with a secret to avoid polling attacks
