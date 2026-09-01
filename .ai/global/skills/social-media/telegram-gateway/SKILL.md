---
name: telegram-gateway
description: "Hermes Telegram gateway: token, allowlist, sends, conflicts."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [linux, macos]
metadata:
  hermes:
    tags: [telegram, messaging, gateway, bot, cron-delivery]
    homepage: https://hermes-agent.nousresearch.com/docs/
    created_by: agent
---

# Telegram Gateway — Hermes Agent

Use this skill when the user wants to send messages to Telegram from Hermes or set up the Telegram gateway for persistent messaging. Covers `hermes send`, bot token configuration, allowlist setup, and polling-conflict troubleshooting.

## Quick Reference

| Task | Command |
|---|---|
| One-shot message (no gateway) | `hermes send --to telegram:"<chat_id>" "msg"` |
| Send to home channel | `hermes send --to telegram "msg"` |
| From file / stdin | `hermes send -f file.md` or `echo "..." \| hermes send` |
| Media attachment | `hermes send --to telegram "MEDIA:/path/img.png"` |
| List targets | `hermes send --list` |
| Gateway status / restart | `hermes gateway status` / `hermes gateway restart` |
| Verify token | `curl -s "https://api.telegram.org/bot<TOKEN>/getMe"` |
| Get updates | `curl -s "https://api.telegram.org/bot<TOKEN>/getUpdates"` |

## Prerequisites

- Telegram bot token from @BotFather (format: `NUMBER:AAH...`)
- chat_id of the destination (see `references/setup-workflow.md`)

## One-Shot Send (no gateway running)

`hermes send` reuses gateway credentials but does NOT require the gateway service running. It works from scripts, CI, and cron jobs.

Target formats: `telegram` (home channel), `telegram:<chat_id>`, `telegram:#channel`.

```bash
hermes send --to telegram:"-1001234567890" "Deploy done"
echo "RAM 92%" | hermes send --to telegram:"-1001234567890"
hermes send --to telegram:#ops --file /tmp/report.md
hermes send --to telegram:#eng --subject "[CI]" --file build.log
hermes send --to telegram:"-1001234567890" "MEDIA:/tmp/chart.png"
```

## Permanent Gateway Setup

1. Token in `~/.hermes/.env`: `TELEGRAM_BOT_TOKEN=<token>`
2. Allowlist + home channel in `.env`:
   ```
   TELEGRAM_ALLOWED_USERS=8165713004
   TELEGRAM_HOME_CHANNEL=8165713004
   TELEGRAM_HOME_CHANNEL_NAME=Jh
   ```
3. `hermes gateway restart`, then `hermes gateway status`
4. Without an allowlist, gateway defaults to denial — unknown users are rejected

Cloud deployments can use webhook mode:
```
TELEGRAM_WEBHOOK_URL=https://app.fly.dev/telegram
TELEGRAM_WEBHOOK_PORT=8443
TELEGRAM_WEBHOOK_SECRET=optional
```

## Polling Conflict (most common failure)

Symptom:
```
Telegram polling conflict (N/5) — previous session still held open
Error: Conflict: terminated by other getUpdates request
```

Cause: **Telegram allows exactly one active `getUpdates` consumer per bot token.** A
second consumer makes both flap — they alternate 200s and 409s indefinitely.

There are two distinct cases, and they have different fixes.

### Case 1 — a stray local process (kill it)

Typical sources: a `bot.py` in background, a second gateway instance, a stale process
after reboot.

```bash
ps aux | grep -i telegram | grep -v grep
ps aux | grep bot.py | grep -v grep
```

```bash
kill <PID>
hermes gateway restart
```

If the conflict persists after killing visible processes, wait 30-60s — Telegram may
hold stale sessions briefly.

### Case 2 — two legitimate apps sharing one token (split the token)

If the Hermes gateway AND a separate bot (a Docker service, a NAS stack, a colleague's
deploy) are both meant to run, killing one is not the fix — **each consumer needs its
own bot**. Symptoms that point here:

- The conflicting consumer is a *container*, so `ps aux` on the host shows nothing
- Logs alternate `200 OK` and `409 Conflict` on a fixed interval
- The token appears in both `~/.hermes/.env` and some other project's `.env`

Find every consumer of a token before assuming it is free:

```bash
grep -rn "<token-prefix>" ~/.hermes/.env ~/proyectos --include="*.env*" \
  --include="*.yml" --include="*.md" 2>/dev/null
docker ps --format '{{.Names}}' | xargs -I{} sh -c \
  'docker exec {} env 2>/dev/null | grep -l TELEGRAM_BOT_TOKEN >/dev/null && echo {}'
```

Fix: create a dedicated bot with @BotFather (`/newbot`) for the second app, put that
token in *its* config, and send the new bot `/start` once so it is allowed to message
you. Note that `chat_id` is per-user, not per-bot — the same `chat_id` works for both
bots, so only the token changes.

Prevention: treat a bot token as owned by exactly one deployment. In any `.env.example`
you ship, say so explicitly and leave the value empty rather than copying a working
token — a token pasted into a second project's example file is how this recurs.

### Note for multi-tenant bots

A bot serving several people still has one token and one polling loop; isolation happens
in *your* data layer, keyed on `telegram_id` from each update — not by running more
instances. Never scale a polling bot horizontally; it cannot work. Use webhook mode if
you need multiple workers.

## See Also

- `references/setup-workflow.md` — full step-by-step: chat_id, .env edits, verification, security notes
- `hermes send --help`
- `hermes gateway --help`
- Related skill: `xurl` (X/Twitter via CLI — similar messenger-tool pattern)
