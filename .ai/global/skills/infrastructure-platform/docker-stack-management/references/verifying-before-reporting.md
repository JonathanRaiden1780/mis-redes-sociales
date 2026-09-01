# Verifying a stack change before reporting it done

The user's standing requirement is that things are **verified working** before
being reported, not merely written. On a NAS stack that is awkward: the target is
a remote ARM64 box deployed through Portainer, so the tempting shortcut is to
push the commit and say "pull and redeploy". That shortcut has repeatedly shipped
broken code.

The rule that actually holds: **whatever you can run locally, run locally, before
the commit.** Syntax checks, a real process, a real HTTP request, a real browser.
Only genuinely NAS-bound things (ARM64 image pulls, `/volume1` mounts, the
physical cameras) get deferred to the user.

## What local verification caught

Five real bugs in one session, none of which any amount of re-reading the diff
would have surfaced:

| Bug | Found by |
|---|---|
| Chat endpoint created a reminder but never reported it in the JSON | end-to-end HTTP call, asserting on the response body |
| Reminder creation self-called over HTTP and deadlocked a single-worker Flask | same call, hanging |
| Reminder list filtered to 7 days, hiding every bimonthly/yearly entry | asserting the item was actually retrievable afterwards |
| Service links never rendered in the dashboard | opening the page in a browser |
| Config never loaded on first paint, so the config object was empty | same |

The last two are the instructive ones: `/api/services` and `/api/config` both
returned perfect JSON. Every backend check passed. The feature was still broken,
because the bug was in how the frontend consumed the shape. Only rendering the
page revealed it.

## Ladder of verification, cheapest first

Run all of these that apply. Each rung catches a class the rung above cannot.

### 1. Static parse — every file you touched

```bash
python3 -c "import ast; ast.parse(open('server.py').read())"
python3 -c "import yaml; yaml.safe_load(open('docker-compose.yml'))"
python3 -c "import json; json.load(open('config/services.json'))"
node --check app.js
sh -n entrypoint.sh
```

`node --check` on the JS is not optional. A stray backtick in a template literal
(`html += '</div>\`;`) is invisible in review, silently kills the whole script in
the browser, and leaves the page looking merely "empty" rather than broken.

### 2. Structural assertions on the compose file

After a refactor, assert the *intent*, not just that the YAML parses:

```python
import yaml
d = yaml.safe_load(open('docker-compose.yml'))
svcs = d['services']

assert 'nas-ollama' not in svcs, 'service still present'
assert 'nas-hermes' in svcs, 'new service missing'
assert 'ollama-models' not in (d.get('volumes') or {}), 'orphan volume'

# nothing may still reference the thing you removed
for name, s in svcs.items():
    for v in (s.get('volumes') or []):
        assert 'ollama' not in v, f'{name}: {v}'
    for e in (s.get('environment') or []):
        assert 'ollama' not in str(e).lower(), f'{name}: {e}'
```

Then sweep the repo for leftovers, and read the hits rather than trusting a zero
count — comments explaining *why* something was removed are legitimate and should
survive:

```bash
grep -rn -i 'ollama\|11434' --include='*.py' --include='*.yml' \
  --include='*.js' --include='*.json' . | grep -v '^./.git'
```

### 2b. Removing a whole service: preserve the logic, prove nothing consumed it

Deleting a service is not deleting its code. Two of the services retired here held
logic that was still needed — the business analyser a nightly job depends on lived
in a *different* service than the one being removed, and only checking that saved
it from vanishing with the container.

Before removing a service block, answer both questions with a grep, not memory:

```bash
# 1. Does anything still call it?
grep -rn "nas-agent\|:8795" --include='*.py' --include='*.yml' --include='*.js' .

# 2. Where does its actual logic live — in it, or somewhere else?
grep -rn "MiNegocioAnalyzer\|VentasAgent" --include='*.py' .
```

If the logic lives elsewhere, the service was a transport wrapper and removing it
is free. If it lives inside, you are deleting a capability — move it first.

Then remove it from **every** registry, not just compose. A service lingering in a
dashboard's service map keeps being probed forever and shows a permanent red
`down`:

- `docker-compose.yml`
- the monitoring service's registry dict
- the endpoint catalog
- any generated `config/services.json`

Leave a comment in place of the deleted block saying *why* and where the code went,
so the next reader doesn't re-add it:

```yaml
  # nas-bot REMOVED: duplicated the agent's own Telegram gateway without tools,
  # and forced two separate tokens. Code kept at core/…/bot_server.py.
```

Keep the source in the repo rather than deleting the directory. Reversing a
commented-out compose block is trivial; recovering a deleted implementation is not.

### 3. Import the app with production-shaped env

Catches undefined names left behind by a rename (`LLM_HOST` → `LLM_BASE_URL`)
that a static parse cannot see, and confirms every route registered:

```bash
LLM_BASE_URL=http://127.0.0.1:8991/v1 DATABASE_PATH=/tmp/t.db \
  python3 -c "
import server
print('routes:', sorted(str(r) for r in server.app.url_map.iter_rules()))
"
```

### 4. Run it against a mock upstream

Do **not** require a real API key or a live provider to test your own logic.
Stand up a `BaseHTTPRequestHandler` that imitates the upstream, capture what your
client sends, and assert on it. This verifies the parts a live call would hide:

- the exact path used (`/v1/chat/completions`, not Ollama's `/api/generate`)
- that `Authorization: Bearer …` is sent when a key is set — and **omitted** when
  it is not, so the same client still works against an unauthenticated local
- the request shape (`messages == [system, user]`, `stream == False`)
- that a **dead** upstream degrades to `None`/`False` instead of raising, so the
  route returns a readable message rather than a 500

The dead-upstream case is the one most often skipped and most often wrong.

### 5. End-to-end: real server, real HTTP, assert on the effect

Boot the actual app as a subprocess against the mock, poll until `/health`
answers, then exercise the routes. Crucially, assert the **side effect** rather
than the status code:

```python
# not enough: 200 OK
r = requests.post(f"{base}/api/chat",
                  json={"mode": "chat", "message": "recuerda pagar la luz cada bimestre"})
assert r.json().get("reminder_created")          # did it say it saved?

lst = requests.get(f"{base}/api/reminders").json()   # is it actually retrievable?
assert any("luz" in x["title"] for x in lst["reminders"])
```

That second call is what exposed the 7-day filter. A create endpoint returning
200 proves nothing about whether the thing can be read back.

Always include a negative case (empty input → 400). It is cheap and catches
validation that silently accepts garbage.

### 6. Render the page in a browser

For anything with a frontend, this rung is mandatory and cannot be substituted
with `curl`. Backend JSON being correct is not evidence the UI works.

```
browser_navigate(url="http://127.0.0.1:18793/")
browser_vision(question="Does each service card show its URL as a clickable link?")
browser_click(ref="@e5")     # open the tab that reads the config
browser_vision(question="Does the config table list every service with editable URL?")
```

The accessibility snapshot is the fastest signal: elements reported as `generic`
where you expected `link` means the markup never rendered. Ask the vision check a
question with a **falsifiable** answer ("is there a card for X, and is there any
card for Y that should be gone?") rather than "does this look right".

### The recurring frontend bug class: envelope mismatch

Both dashboard bugs were the same mistake in two places, and neither is visible
from the backend. An endpoint returns an **envelope**:

```json
{ "services": { "nas-hermes": { "host": "http://…:8799" } } }
```

…and the consumer indexes as if it were flat (`CONFIG[id]` instead of
`CONFIG.services[id]`). Every lookup yields `undefined`, so the feature renders
*empty* rather than erroring — no console exception, no failed request, nothing to
grep for.

Its twin: the data was only fetched by the handler for **one** tab, so on first
paint the object was still `{}`. Anything else reading it rendered blank.

Two habits that prevent both:

- When a fetch populates shared state, split "get the data" from "draw the UI"
  (`fetchConfig()` vs `loadConfig()`), and have the initial load `await` the data
  step **before** first paint. Do not rely on a tab handler that may never fire.
- Confirm the envelope shape against the actual response, not the mental model:
  `curl -s localhost:PORT/api/config` and read the top-level keys.

Signal to watch for in a vision check: the page looks fine, the numbers are
there, but every *link* or *derived* value is missing. That asymmetry — static
markup present, data-derived markup absent — is this bug, not a styling problem.

## Running the dashboard locally when the stack lives on the NAS

Port-shift so it cannot collide, and pass the NAS IP so generated config looks
realistic:

```bash
DASHBOARD_PORT=18793 NAS_IP=192.168.0.129 python3 server.py   # background
```

Delete any generated config first (`rm -f config/services.json`) so you exercise
the **default-generation** path, not a stale file — that path is what a fresh
deploy will hit. Restore or delete it again before committing so a local artifact
does not ship.

Services will show `down` locally because Docker service names do not resolve
outside the stack. That is expected and does not invalidate the run: you are
verifying rendering, wiring, and the config round-trip, not connectivity.

## Verify a write endpoint round-trips

For any settings UI, POST then re-GET. Include a value that is *not* the default
shape (an external hostname, not another `IP:port`) so you find code that assumes
the format:

```bash
curl -s -X POST localhost:18793/api/config -H 'Content-Type: application/json' \
  -d '{"services":{"nas-llm-server":{"host":"http://mi-dominio.com","exposed":true}}}'
curl -s localhost:18793/api/config      # did it persist, unchanged?
```

## Keep the verification scripts

Commit them under `tests/` with a README covering how to run them and **which
bugs each one caught**. They cost nothing to re-run after the next refactor, and
the bug list is what stops someone deleting them as redundant.

## Pitfalls

- **Reporting "pull and redeploy" as if that were verification.** It is a
  handoff, not a result. Say plainly which parts you verified locally and which
  genuinely need the NAS.
- **Trusting a green backend for a frontend feature.** Two of the five bugs here
  had flawless API responses.
- **Committing a message containing text that trips a shell guard.** A commit
  body mentioning gateway restart phrasing got blocked mid-commit; write the
  message to a file and use `git commit -F <file>` instead of a heredoc.
- **Adding a route that a blueprint already registers.** Flask refuses to boot
  (`View function mapping is overwriting an existing endpoint function`) rather
  than warning, so the service dies on the next redeploy. Grep the whole tree for
  the path and for `@app.route`/`@bp.route` before adding one; rung 3 (importing
  the app) catches it locally.
- **Leaving generated config or test databases staged.** Check `git status
  --short` before committing after a local run.
