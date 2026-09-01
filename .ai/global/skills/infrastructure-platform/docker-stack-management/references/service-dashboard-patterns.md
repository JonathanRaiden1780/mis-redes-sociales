# Building the stack's own monitoring dashboard

A small self-hosted panel that lists every service in the stack, shows health,
links out to each web UI, exposes each service's endpoints, and lets the user
edit base URLs. Patterns and traps specific to that surface.

## Removing a view orphans whatever it was the only consumer of

The dashboard originally had a Swagger-style "API Explorer" tab that rendered the
full endpoint catalog. Consolidating it into the service cards looked like a
straight simplification. It wasn't: the cards were reading a *different*,
much smaller source.

| Source | Coverage |
|---|---|
| `extra_endpoints`, hand-set per service in the monitor registry | 9 endpoints, 4 services |
| `/api/catalog`, generated from `api_catalog.py` | **42 endpoints, 13 services** |

Deleting the tab silently removed the only path to 33 endpoints. Nothing errored;
the cards just showed a handful of buttons and the rest ceased to exist in the UI.

**Before deleting or merging a view, ask what data it was the sole reader of.**
Compare the counts explicitly rather than eyeballing the rendered page:

```bash
curl -s localhost:PORT/api/services | \
  python3 -c "import json,sys; d=json.load(sys.stdin); \
print('with extra_endpoints:', sum(1 for s in d if s.get('extra_endpoints')))"

curl -s localhost:PORT/api/catalog | \
  python3 -c "import json,sys; d=json.load(sys.stdin); \
print('catalog total:', sum(len(v.get('endpoints',[])) for v in d.values()))"
```

Two numbers that should match and don't is the whole diagnosis.

## Have cards read the catalog, keep the small source as fallback

Prefer one authoritative source, but don't hard-fail a service that isn't in it:

```js
const cat = (API_CATALOG || {})[s.id];
if (cat && cat.endpoints && cat.endpoints.length) {
    const host = cat.host || s.id;
    const port = cat.port || s.port;
    // …render from the catalog
} else if (s.extra_endpoints) {
    // …fallback for services the catalog doesn't know
}
```

The catalog entry should carry its own `host` and `port`. Deriving the host from
the service id works right up until one service's id differs from its DNS name,
and then produces `undefined:8792` URLs.

Fetch the catalog in the same place you fetch the config — **before first paint**,
not from a tab handler:

```js
async function loadAll() {
    if (!SERVICE_CONFIG.services) await fetchConfig();
    if (!Object.keys(API_CATALOG).length) await fetchCatalog();
    await loadSystemInfo();
    await loadServices();
}
```

## An endpoint tester must respect the verb

A single `testEndpoint(url, name)` that always issues GET makes every POST route
look broken: the server correctly answers `400 No data provided`, and the user
reads that as "the service is failing".

Pass the verb through and branch on it:

- **GET** — fire immediately on open, hide the body editor.
- **POST/PUT** — show a JSON body textarea and an explicit *Send* button; do not
  auto-fire. Seed the placeholder with a real example for that route.

```js
async function testEndpoint(url, name, method) {
    method = (method || 'GET').toUpperCase();
    if (method === 'POST') {
        bodyBox.style.display = 'block';
        sendBtn.style.display = 'inline-flex';
        sendBtn.onclick = () => doRequest(url, method, bodyBox.value);
    } else {
        bodyBox.style.display = 'none';
        sendBtn.style.display = 'none';
        await doRequest(url, 'GET', null);
    }
}
```

Colour the verb badge (GET green, POST blue, DELETE red) so a card with a dozen
routes is scannable, and put the full `METHOD /path — summary` in the button's
`title` since the visible label has to be truncated.

Mark the response pane by outcome — a green left border for 2xx, red otherwise.
Without it, a `502` body reads like normal output.

## The proxy must forward the method and the body

A dashboard proxy that only ever issues GET upstream cannot test POST routes no
matter what the frontend sends. Forward both, and translate upstream errors
faithfully instead of collapsing everything to 502:

```python
method = "POST" if self.command in ("POST", "PUT") else "GET"
length = int(self.headers.get("Content-Length", 0))
body = self.rfile.read(length) if length else None
# …
except urllib.error.HTTPError as e:          # keep the real status
    self._send_json(json.loads(e.read()), status=e.code)
except TimeoutError:                          # a slow model is not a crash
    self._send_json({"error": f"Timeout ({PROXY_TIMEOUT}s)"}, status=504)
```

Also register the handler for every verb you accept — a `BaseHTTPRequestHandler`
with only `do_GET` returns 501 for POST, which surfaces as an unhelpful failure
in the UI.

## Cards need a per-service link, and a way to set it

Health status alone isn't useful; the user wants to *open* the service. Keep the
base URL in an editable config file rather than deriving it, because in practice
some services are published on a LAN IP, some behind a domain, and some are
internal-only.

```json
{"services": {"nas-jellyfin": {"host": "http://NAS_IP:8096", "exposed": true}}}
```

- Generate defaults from the service registry on first boot, seeded by a
  `NAS_IP` env var, then persist so user edits survive redeploys.
- Render `exposed: false` as a *internal only* badge and skip the link.
- Strip the scheme in the visible label (`192.168.0.129:8799 ↗`) — full URLs blow
  out the card width.
- `rel="noopener"` on every `target="_blank"`.
- Round-trip test the settings POST with a **non-default shape** (a bare domain,
  not another `IP:port`) to catch code that assumes the format.

Constrain the endpoint list's height (`max-height` + `overflow-y: auto`) or a
service with 12 routes stretches every other card in its grid row.

## When a browser click doesn't seem to land

Clicking a button inside a scrollable container can silently fail to reach the
handler, which looks identical to a broken handler. Isolate the two before
editing any code:

```js
// 1. Is the wiring right?
const b = [...document.querySelectorAll('.endpoint-btn')]
            .find(x => x.textContent.includes('/api/chat'));
({ onclick: b.getAttribute('onclick'), fn: typeof testEndpoint,
   modal: !!document.getElementById('responseModal') })

// 2. Does the handler work when called directly?
testEndpoint('http://svc:8792/api/chat', 'POST /api/chat', 'POST');
document.getElementById('responseModal').className   // -> "modal active"
```

If the direct call works, the handler is fine and the click delivery was the
problem — do not go rewrite working code. Check the console for exceptions in the
same pass; an empty error list plus correct wiring points at delivery, not logic.

## Verifying the whole surface locally

Services will read `down` outside the stack (Docker names don't resolve), which is
expected — you are checking rendering and wiring, not connectivity.

```bash
rm -f config/services.json        # exercise the default-generation path
DASHBOARD_PORT=18793 NAS_IP=192.168.0.129 python3 server.py &
```

Then assert on the accessibility snapshot rather than a screenshot alone: buttons
reported as `generic` where you expected `button`/`link` means the markup never
rendered. Count them — 42 endpoint buttons in the DOM is a falsifiable claim,
"the endpoints show up" is not.

Finish by exercising one GET (expect 200, green border) and one deliberately
unreachable target (expect 502, red border) so you've seen both paths.

If the panel also reports per-container CPU/RAM, the arithmetic behind those
figures has its own traps (derived CPU %, page-cache subtraction, parallel
sampling): `container-resource-stats.md`.

Delete generated config before committing; `git status --short` catches it.
