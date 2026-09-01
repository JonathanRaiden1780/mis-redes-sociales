# Telegram Token Verification Recipe

Use this when a Telegram bot token needs verification before or after configuring it in `~/.hermes/.env`.

## Quick verification

```bash
curl -s "https://api.telegram.org/bot<TOKEN>/getMe"
```

Expected successful response:
```json
{"ok": true, "result": {"id": <bot_id>, "is_bot": true, "first_name": "<bot_name>", "username": "<bot_username>"}}
```

Failure responses:
- `{"ok": false, "error_code": 401, "description": "Unauthorized"}` — token is invalid/expired
- Network error — cannot reach api.telegram.org (DNS, firewall, fallback IPs)

## Optional: verify chat accessibility

```bash
curl -s "https://api.telegram.org/bot<TOKEN>/getChat?chat_id=<CHAT_ID>"
```

## Session example

In session 2026-08-13, the token `8559099997:AAFxx_CI7x8Zxo8gGaHz2qZ9F` returned `{"ok": false, "error_code": 401, "description": "Unauthorized"}` — confirming the token was rejected by Telegram's server. This matched the gateway error log pattern exactly: `The token '8559099997:***' was rejected by the server.`

## Notes

- Never paste full tokens into skill files or commit them. Use `[REDACTED]` in logs/summaries.
- The gateway reads `.env` at startup only — editing `~/.hermes/.env` requires a gateway restart to take effect.
- If the token is valid but the gateway still can't connect, the issue is network-level (DNS resolution, firewall, Telegram API IP reachability), not the token itself.
