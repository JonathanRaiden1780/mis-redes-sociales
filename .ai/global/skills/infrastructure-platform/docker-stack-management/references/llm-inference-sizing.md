# Choosing local vs remote LLM inference on a NAS

## The decision

A CPU-only NAS **cannot** run a useful chat model at interactive speed. Measured
on an i7-8700 / 15 GB / no GPU:

| | Ollama local (7B q4_K_M) | Remote OpenAI-compatible API |
|---|---|---|
| RAM held | 5–10 GB | ~200 MB |
| Throughput | 1–3 tok/s | network-bound, effectively instant |
| Model class | 7B quantised | frontier-class |
| First response | tens of seconds to minutes | ~1 s |

On a box whose actual job is storage, media and containers, spending 2/3 of RAM
to get 2 tok/s is the wrong trade. Default to a remote API and keep the local
option behind one config switch.

**Rule of thumb:** no GPU → no local chat model. Embeddings and tiny classifiers
(all-minilm, a 1.5B coder) are still fine on CPU; conversational models are not.

## Symptom that this is the actual problem

Ollama looks perfectly healthy while being useless. `/api/tags` returns 200 on a
30 s loop and the logs are a wall of successful polls:

```
[GIN] | 200 | 141.749µs | 172.25.0.8 | GET "/api/tags"
[GIN] | 200 |     140µs | 172.25.0.8 | GET "/api/tags"
```

Those are just healthchecks. A *served* request would appear as
`POST "/api/generate"` and take seconds. If you only ever see `GET /api/tags`,
nothing has been generated — usually because **no model was ever pulled**.
`/api/tags` returns `200 {"models": []}` for an empty install, so a healthcheck
of `ollama list` or `GET /api/tags` passes on a server that cannot answer a
single prompt.

Verify with the model list, not the health endpoint:

```bash
curl -s http://HOST:11434/api/tags | jq '.models[].name'
docker exec -it nas-ollama ollama pull qwen2.5:7b-instruct-q4_K_M
```

## Write the client against the OpenAI schema, not Ollama's

Ollama's native `/api/generate` and `/api/chat` are non-standard, and `/api/chat`
is **missing on some builds** — it returns:

```
404 Client Error: Not Found for url: http://nas-ollama:11434/api/chat
```

Target `POST {base_url}/chat/completions` instead. Every provider speaks it, and
Ollama also exposes it at `/v1`, so the same client covers both and swapping
providers becomes a URL change:

```python
class LLMClient:
    """Cliente para API OpenAI-compatible (Nous, OpenRouter, Ollama, etc.)."""

    def __init__(self, base_url: str, model: str, api_key: str = "") -> None:
        self.base_url = base_url.rstrip("/")   # rstrip: '.../v1/' would give '//chat'
        self.model = model
        self.api_key = api_key

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:                       # omit when empty: local Ollama has no auth
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def generate(self, system_prompt: str, user_message: str,
                 max_tokens: int = 2048) -> str | None:
        try:
            r = requests.post(
                f"{self.base_url}/chat/completions",
                headers=self._headers(),
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message},
                    ],
                    "max_tokens": max_tokens,
                    "temperature": 0.7,
                    "stream": False,
                },
                timeout=180,
            )
            r.raise_for_status()
            choices = r.json().get("choices") or []
            if not choices:
                logger.error("Respuesta sin choices: %s", r.json())
                return None
            return (choices[0].get("message", {}).get("content") or "").strip()
        except requests.HTTPError as e:
            body = e.response.text[:300] if e.response is not None else ""
            logger.error("LLM HTTP error: %s — %s", e, body)   # log the body, not just the code
            return None
        except Exception as e:
            logger.error("LLM error: %s", e)
            return None

    def ping(self) -> tuple[bool, str]:
        """GET /models — cheap reachability probe for the healthcheck."""
        try:
            r = requests.get(f"{self.base_url}/models",
                             headers=self._headers(), timeout=10)
            return (True, "ok") if r.status_code == 200 else (False, f"HTTP {r.status_code}")
        except Exception as e:
            return False, str(e)
```

Points that matter:

- **`rstrip("/")`** on the base URL, or a trailing slash yields `//chat/completions`.
- **Conditional `Authorization`** so the same class works against an unauthenticated
  local Ollama.
- **Log `e.response.text`** on `HTTPError`. A bare status code tells you nothing;
  providers put the real reason (bad model name, no credit, bad key) in the body.
- **Return `None`, never raise.** The route turns `None` into a readable message
  instead of a 500.
- **`ping()` separate from `generate()`** so `/health` is cheap and does not burn tokens.

## Env vars

Name them after the *protocol*, not the vendor, so switching costs nothing:

```bash
LLM_BASE_URL=https://inference-api.nousresearch.com/v1
LLM_MODEL=meituan/longcat-2.0:free
LLM_API_KEY=
```

Compose, with defaults so the stack boots before the key is set:

```yaml
environment:
  - LLM_BASE_URL=${LLM_BASE_URL:-https://inference-api.nousresearch.com/v1}
  - LLM_MODEL=${LLM_MODEL:-meituan/longcat-2.0:free}
  - LLM_API_KEY=${LLM_API_KEY}
```

Going back to local later is one variable: `LLM_BASE_URL=http://nas-ollama:11434/v1`.

## Report degraded, not ok

Have `/health` surface reachability so a missing key is visible in the dashboard
rather than showing up later as a mystery chat failure:

```python
@app.route("/health")
def health():
    llm_ok, detail = llm.ping()
    return jsonify({
        "status": "ok" if llm_ok else "degraded",
        "model": LLM_MODEL,
        "llm_base_url": LLM_BASE_URL,
        "llm_connected": llm_ok,
        "llm_detail": detail,
    })
```

Probe connectivity once at import too, and **log a warning without exiting** —
the container should still start so you can read its logs and fix the key.

## When you also want an agent, not just an API

An API wrapper with mode prompts and a full agent are complementary, not
alternatives — run both:

- **API wrapper** (e.g. port 8792): fixed prompt modes, no tools. What dashboards
  and apps call.
- **Agent** (e.g. Hermes, port 8799): terminal, files, web, persistent memory,
  skills. What a human drives for open-ended work.

Give the agent the same `LLM_*` values so both use one provider and one model.
Point the agent at the wrapper (`NAS_LLM_URL=http://nas-llm-server:8792`) when it
should reuse the specialised prompts.

Containerising an agent whose normal surface is a TTY: generate config from env
on first boot, then branch — start the messaging gateway if a token exists,
otherwise `exec tail -f /dev/null` so the container stays up for
`docker exec -it <name> <agent>`. Keep settings in `config.yaml` and secrets in a
`chmod 600` `.env`; never write credentials into the config file.
