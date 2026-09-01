# Telegram gateway token failures — Quick diagnosis

## Symptom

Gateway log shows repeated:
```
[Telegram] Failed to connect to Telegram: The token `<token>` was rejected by the server.
```

Gateway status: `telegram` stuck in `retrying`, no connected platforms.

## Most likely cause

The configured bot token is invalid or rejected by Telegram. Not a network issue, not a plugin-missing issue first — the token itself is the failure point once you see "was rejected by the server" consistently across many retries.

## Diagnostic order

1. Check gateway state:
   - `cat ~/.hermes/gateway_state.json` — look for `platforms.telegram.state` and `error_message`.

2. Verify token against Telegram API directly:
   - `curl -s "https://api.telegram.org/bot<TOKEN>/getMe"`
   - Expected: `{"ok": true, "result": {"id": ..., "is_bot": true, "username": "..."}}`
   - Failing: `{"ok": false, "error_code": 401, "description": "Unauthorized"}`

3. If 401, the token is invalid/expired/revoked. Do not keep retrying the gateway.

4. If network errors precede the token error, fix connectivity first, then re-verify token.

## Recovery

1. Get a valid token from @BotFather (or regenerate if the old one was revoked).
2. Set it in `~/.hermes/.env`: `TELEGRAM_BOT_TOKEN=...`
3. If the token was stored with extra garbage (e.g. token and chat_id concatenated on the same line), separate them:
   - `TELEGRAM_BOT_TOKEN=...`
   - `TELEGRAM_HOME_CHANNEL=...` (if needed)
4. Restart gateway: `hermes gateway restart`
5. Confirm with `hermes gateway status`

## Notes

- If `.env` has the token and chat_id concatenated as one line, the gateway may still read the token but the value can be malformed or misinterpreted; split into separate keys.
- Allowlist warnings are secondary: token failure will block the platform before allowlist policy even matters.
- Never paste raw tokens into repo files, docs, or commit them.

## References

- `telegram-gateway` skill (usage, setup, polling conflicts)
- `~/.hermes/.env` and `HERMES_HOME` layout
- `hermes gateway status` / `hermes gateway restart`
