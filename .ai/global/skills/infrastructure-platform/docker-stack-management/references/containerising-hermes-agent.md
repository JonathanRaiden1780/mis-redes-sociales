# Containerising Hermes Agent (or any OAuth-authenticated agent)

Running the agent itself as a stack service, alongside the plain API wrapper.
The wrapper serves dashboards and apps; the agent is what a human drives for
open-ended work with tools and memory.

## The authentication trap: OAuth ≠ API key

Symptom, on every message, with the container otherwise running fine:

```
⚠️ Provider authentication failed. Check the configured credentials;
   raw provider details are in the gateway logs.
```

Cause: some providers authenticate by **OAuth device code**, not by API key.
`nous` is one of them. Passing an API key env var for such a provider is silently
useless — the credential store expects tokens, not a key.

Confirm which mode a working install actually uses by inspecting its credential
store rather than guessing. Print the **shape**, masking values:

```python
import json
d = json.load(open('/home/USER/.hermes/auth.json'))
def walk(o, p=''):
    if isinstance(o, dict):
        for k, v in o.items():
            if isinstance(v, (dict, list)): walk(v, p + '/' + k)
            else:
                s = str(v)
                print(f'{p}/{k} =', s[:6] + '…' + s[-4:] if len(s) > 18 else ('<set>' if s else '<empty>'))
    elif isinstance(o, list):
        for i, v in enumerate(o): walk(v, f'{p}[{i}]')
walk(d)
```

`access_token` + `refresh_token` present ⇒ OAuth. There is no API key to pass.

### Fix: mount the already-authenticated credential store

```bash
scp ~/.hermes/auth.json user@NAS:/volume1/Docker/hermes/auth.json
ssh user@NAS 'sudo chmod 600 /volume1/Docker/hermes/auth.json && docker restart nas-hermes'
```

**Name the machine each command runs on.** Credential files live on whichever
box is already authenticated, which is often *not* the laptop the user is
typing on, and pairing state lives inside the container rather than on the
host. Both mistakes happened here in one session:

```
scp: stat local "/Users/x/.hermes/auth.json": No such file or directory
```
— run from a machine that never had the agent installed.

```
No pairing data found. No one has tried to pair yet~
```
— `pairing approve` run on the workstation instead of in the container.

So write instructions as "on *this* Linux box" / "inside the container" /
"over SSH on the NAS", and verify the file and the route exist before handing
over a command:

```bash
ls -la ~/.hermes/auth.json                      # is it actually here?
timeout 5 bash -c 'cat </dev/null >/dev/tcp/NAS_IP/22' && echo 'ssh reachable'
```

Never ask for the user's SSH password to run the copy yourself — confirm the
path and reachability, then give them the exact one-liner.

The `refresh_token` means the container renews its own access token; this does not
need redoing when it expires. Mount the whole agent home so config, sessions,
memory and skills persist across redeploys:

```yaml
volumes:
  - /volume1/Docker/hermes:/data/hermes   # HERMES_HOME
  - /volume1/services:/workspace          # what the agent may act on
```

### Alternative: authenticate from inside the container

```bash
docker exec -it nas-hermes hermes auth add nous
```

Device-code flow; needs a TTY (`-it`) so it can print the code.

## Make the entrypoint report its auth mode

The worst failure shape is a container that starts cleanly and fails on every
request. Detect the mode at boot, print it, and say how to fix it when absent —
but **do not exit**, or the logs become unreadable in a crash loop.

```sh
AUTH_MODE="none"

if [ -f "$AUTHFILE" ] && grep -q "refresh_token" "$AUTHFILE" 2>/dev/null; then
  chmod 600 "$AUTHFILE"
  AUTH_MODE="oauth (auth.json mounted)"
elif [ -n "$NOUS_API_KEY" ]; then
  write_env "NOUS_API_KEY" "$NOUS_API_KEY"
  if [ ! -f "$AUTHFILE" ]; then
    hermes auth add nous --type api-key --api-key "$NOUS_API_KEY" \
      --label "nas-container" >/dev/null 2>&1 \
      && AUTH_MODE="api-key (registered)" || AUTH_MODE="api-key (.env only)"
  fi
fi

echo "[hermes] Auth: $AUTH_MODE"
[ "$AUTH_MODE" = "none" ] && echo "[hermes] WARNING: no credentials; every reply will fail. Mount auth.json or set NOUS_API_KEY."
```

Then one grep diagnoses the container:

```bash
docker logs nas-hermes | grep Auth
```

Design points:

- **OAuth wins over the API key** when both are present — tokens refresh, keys go
  stale, and silently preferring the key produces the original bug again.
- **`chmod 600`** on both `auth.json` and `.env`.
- **Settings in `config.yaml`, secrets in `.env`.** Never write a credential into
  the config file.
- **Generate `config.yaml` only if absent.** Regenerating on every boot discards
  whatever the user tuned. Do update individual `.env` keys in place, via
  `grep -q … && sed -i … || echo …`, so a changed value replaces the line instead
  of appending a duplicate.

## Idle-vs-gateway branch

An agent whose normal surface is a TTY needs a reason to stay alive in Docker:

```sh
if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
  exec hermes gateway run          # NOT `hermes gateway` — that verb does not exist
else
  echo "[hermes] idle; use: docker exec -it nas-hermes hermes"
  exec tail -f /dev/null
fi
```

Check subcommand spelling against `--help` before baking it into an image; a
wrong verb only surfaces at container start.

## Pairing runs INSIDE the container

First message from an unknown account returns a pairing code instead of a reply:

```
Here's your pairing code: GYUF359A
Ask the bot owner to run: hermes pairing approve telegram GYUF359A
```

That instruction is ambiguous about *where*. Pairing state lives in
`$HERMES_HOME/pairing/`, so it must run in the container that received the
request — running it on your workstation reports `No pairing data found`, which
is the tell that you targeted the wrong home:

```bash
docker exec nas-hermes hermes pairing approve telegram GYUF359A
docker exec nas-hermes hermes pairing list
```

Avoid the round trip by allowlisting up front:

```yaml
environment:
  - TELEGRAM_ALLOWED_USERS=${TELEGRAM_ALLOWED_USERS}   # comma-separated IDs
```

If `hermes` is not on the PATH of the non-interactive shell, call the venv
binary directly: `docker exec nas-hermes /opt/venv/bin/hermes …`.

## One bot token per consumer

The agent gateway and any other bot in the stack need **different** tokens.
Telegram permits a single `getUpdates` consumer per token; sharing one makes both
fail with `Conflict: terminated by other getUpdates request`. Keep them as
separate variables (`HERMES_TELEGRAM_TOKEN` vs `TELEGRAM_BOT_TOKEN`) so they
cannot be conflated.

Likewise keep the agent's provider credential separate from the API wrapper's
(`NOUS_API_KEY` vs `LLM_API_KEY`). Reusing one variable for both is what caused
the authentication failure here — they are different consumers with different
auth models.

## Testing an entrypoint without Docker

Shell entrypoints carry real branching logic and are easy to get wrong, but
rebuilding an ARM64 image to test each branch is far too slow. Stub the binaries
it calls, point `PATH` at the stubs, and run the script directly.

Stub the agent so nothing real executes, and log the invocations so you can
assert on them:

```sh
cat > "$STUB/hermes" <<'EOF'
#!/bin/sh
echo "STUB-HERMES: $*" >> "$HERMES_STUB_LOG"
exit 0
EOF

# tail -f would hang the test run
cat > "$STUB/tail" <<'EOF'
#!/bin/sh
echo "STUB: idle mode"
exit 0
EOF

chmod +x "$STUB"/*
export PATH="$STUB:$PATH"
```

Then drive each branch with a fresh `HERMES_HOME` and assert on stdout, on files
written, and on permissions. Scenarios worth covering:

| Scenario | Assert |
|---|---|
| No credentials | reports `none`, prints the fix, stays idle, writes `config.yaml` |
| API key only | registers via `hermes auth add`, key lands in `.env`, mode `600` |
| `auth.json` mounted **and** key set | reports `oauth`; key is **not** written (OAuth wins) |
| Messaging token set | invokes `gateway run` rather than going idle |
| Second boot | `config.yaml` byte-identical; changed key replaces the line, exactly one occurrence |

That last row is the one that catches duplicate-append bugs:

```sh
COUNT="$(grep -c '^NOUS_API_KEY=' "$HOME_DIR/.env")"
[ "$COUNT" = "1" ] || echo "FAIL: $COUNT duplicate lines"
```

This runs in about a second, needs no daemon and no credentials, and belongs in
`tests/` next to the other verification scripts.
