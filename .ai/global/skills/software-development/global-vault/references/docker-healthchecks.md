# Docker Healthcheck Patterns

## Overview

Healthchecks for Docker Compose services — how to verify each service is actually running and ready to accept traffic.

## Pattern Categories

### HTTP Services (Flask, FastAPI, Express, etc.)

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:PORT/health"]
  interval: 30s
  timeout: 5s
  retries: 5
```

**Requirements:**
- Service must have a `/health` endpoint returning JSON
- Endpoint should return 200 when healthy, 503 when unhealthy
- Response time should be < 1s

**Example Flask endpoint:**
```python
@app.route("/health")
def health():
    return jsonify({
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "model": LLM_MODEL,
    })
```

### CLI-Based Services (Tailscale, etc.)

```yaml
healthcheck:
  test: ["CMD", "tailscale", "status", "--peers=false"]
  interval: 60s
  timeout: 10s
  retries: 3
```

**Use when:** Service has no HTTP interface but has a CLI that reports status.

### TCP Port Services (Databases, etc.)

```yaml
healthcheck:
  test: ["CMD", "nc", "-z", "localhost", "5432"]
  interval: 30s
  timeout: 5s
  retries: 5
```

**Use when:** Service listens on a TCP port but has no HTTP endpoint.

### Script-Based Checks

```yaml
healthcheck:
  test: ["CMD", "/app/healthcheck.py"]
  interval: 60s
  timeout: 5s
  retries: 3
```

**Use when:** Complex logic needed (e.g., check file age, parse logs).

## depends_on with condition: service_healthy

```yaml
services:
  nas-llm-server:
    # ... config ...
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8792/health"]
  
  nas-bot:
    # ... config ...
    depends_on:
      nas-llm-server:
        condition: service_healthy  # Waits for healthcheck to pass
```

**Important:** Without `condition: service_healthy`, Docker only waits for the container to start, not for the service to be ready.

## Healthcheck Best Practices

1. **Every service must have a healthcheck** — no exceptions
2. **Use `/health` endpoint for HTTP services** — standard convention
3. **Return JSON from `/health`** — includes status, timestamp, and relevant metrics
4. **Set appropriate intervals** — 30s for critical services, 60s for others
5. **Set low timeouts** — 5s is usually enough
6. **Use retries** — 3-5 retries before marking unhealthy
7. **Don't make healthchecks too heavy** — they run frequently
8. **Include dependency checks** — e.g., LLM server healthcheck can verify Ollama is reachable

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| No healthcheck | Add one to every service |
| `depends_on` without `condition: service_healthy` | Add `condition: service_healthy` |
| Healthcheck too slow | Keep response time < 1s |
| Healthcheck depends on external services | Only check the service itself |
| Wrong port | Double-check internal container port |
