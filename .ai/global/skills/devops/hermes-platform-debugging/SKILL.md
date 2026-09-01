---
name: hermes-platform-debugging
description: Debug Hermes platform config — lives in ~/.hermes/
owner: ai-engineering-platform
created: 2026-08-13
---

# Hermes Platform Debugging

Use when debugging Hermes Agent platform features: messaging platforms (Telegram, Discord, WhatsApp, Signal, Slack, etc.), the gateway service, cron delivery, platform toolsets, or any feature whose configuration lives in `~/.hermes/` rather than in an AI project repo.

**First-class signal:** if you find yourself looking for Telegram/Discord/Slack config inside an AI project repo, STOP and redirect to `~/.hermes/` — the user will tell you "that's Hermes global, not the project."

## Where Hermes Agent platform configuration lives

Hermes Agent is a GLOBAL platform, not a project dependency. Its configuration is separate from any AI project (like AI-Engineering-Platform). When debugging platform features, the relevant files are:

| Concern | Location |
|---------|----------|
| Platform tokens (Telegram bot token, Discord token, etc.) | `~/.hermes/.env` (credential store) |
| Platform enablement flags, toolsets per platform | `~/.hermes/config.yaml` (sections: `platform_toolsets`, `known_plugin_toolsets`, `known_builtin_toolsets`) |
| Gateway runtime state | `~/.hermes/gateway_state.json` (PID, platform states, error codes) |
| Platform plugin definitions | `~/.hermes/plugins/platforms/<platform>/` (e.g. `telegram/`, `discord/`) |
| Gateway systemd user service | `~/.config/systemd/user/hermes-gateway.service` (or macOS LaunchAgent) |
| Gateway logs | `~/.hermes/logs/errors.log` and `~/.hermes/logs/` |
| Gateway process | `ps aux | grep gateway` — typically `hermes_cli.main gateway run` |

## Common failure patterns

### Token rejected by server (Telegram example)
Symptom: logs show `The token `XXXXXX:***` was rejected by the server` repeatedly, gateway state shows platform in `retrying` state.

Diagnosis steps:
1. `cat ~/.hermes/gateway_state.json` — check platform state and error_message
2. `grep TELEGRAM ~/.hermes/.env` — confirm token is present and non-empty
3. Test the token directly: `curl -s "https://api.telegram.org/bot<TOKEN>/getMe"` — a 401 Unauthorized means the token is invalid/expired
4. If token is valid but still failing, check network: the gateway may be unable to reach `api.telegram.org` (DNS issues, fallback IPs in logs)
5. Check `~/.hermes/.env` for `TELEGRAM_HOME_CHANNEL` — if set to a chat_id, that chat must exist and the bot must be member

### Platform plugin not found
Symptom: gateway logs reference a platform but the plugin directory doesn't exist at the expected path.

Diagnosis: `ls ~/.hermes/plugins/platforms/` — if the platform directory is missing, the plugin may not be installed. Check the install script: `~/.hermes/hermes-agent/scripts/install.sh` references `TELEGRAM_BOT_TOKEN` and other platform env vars.

### Gateway not running
Symptom: no `gateway run` process, platform features unavailable.

Diagnosis:
1. `ps aux | grep gateway | grep -v grep` — if no process, gateway is down
2. `systemctl --user status hermes-gateway` — check service state
3. Restart: `systemctl --user restart hermes-gateway` (or use the install script's restart mechanism)

### Allowlist / pairing warnings
Symptom: logs show `No env user allowlists configured. Messaging platforms default to pairing/allowlist policies`.

This is a security warning, not a failure. To enable open access: set `GATEWAY_ALLOW_ALL_USERS=true` in config, or configure `TELEGRAM_ALLOWED_USERS` with specific user IDs. Without this, unknown senders are denied.

## Scope boundary: Hermes global vs project-local

**Critical distinction:**

- **Hermes Agent platform features** (Telegram, Discord, WhatsApp, Signal, Slack, cron delivery, gateway, platform toolsets) → configured globally in `~/.hermes/`, owned by the Hermes installation, NOT by any AI project.
- **AI project features** (project memory, context engine, embeddings, providers, CLI commands like `ai run`, `ai context`, `ai security`) → configured in the project repo, owned by the project.

When a user asks about "Telegram connection" or "why isn't my bot working" or "gateway not connecting to X":
1. First check `~/.hermes/gateway_state.json` and `~/.hermes/logs/errors.log`
2. Check `~/.hermes/.env` for the relevant token
3. Check `~/.hermes/config.yaml` for platform enablement
4. ONLY after ruling out global config issues, consider whether the project has any relevant integration (rare — most platform features are Hermes-global)

## Restarting the gateway after config changes

After modifying `~/.hermes/.env` or `~/.hermes/config.yaml`:

1. The gateway reads env vars at startup — changes to `.env` require a restart
2. `systemctl --user restart hermes-gateway` (if using systemd)
3. Or kill the gateway PID from `gateway_state.json` and restart manually: `hermes gateway run`
4. Verify: check `gateway_state.json` updated_at and platform states move from `retrying` to `running`

## References

- `~/.hermes/.env` — credential store (tokens, API keys). Not directly readable by provider tools; use terminal to inspect.
- `~/.hermes/config.yaml` — platform toolsets, model config, feature flags.
- `~/.hermes/gateway_state.json` — live gateway state: PID, platform statuses, last error per platform.
- `~/.hermes/logs/errors.log` — chronological error log; search for platform name to find failure pattern.
- `~/.hermes/hermes-agent/scripts/hermes-gateway` — install/configure script with env var documentation.
- `~/.config/systemd/user/hermes-gateway.service` — systemd unit for the gateway (Linux).
