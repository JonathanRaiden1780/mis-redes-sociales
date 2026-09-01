# Healthcheck Patterns for All Services

Every service in docker-compose.yml MUST have a healthcheck. This reference documents the patterns used.

## Pattern 1: HTTP Healthcheck

For services that expose an HTTP server:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:<PORT><PATH>"]
  interval: 30s
  timeout: 5s
  retries: 5
```

### Examples

| Service | Port | Path |
|---------|------|------|
| nas-app-gateway | 8790 | /health |
| nas-automation-engine | 8791 | /health |
| nas-backup-server | 8787 | /health |
| nas-ocr-server | 8788 | /health |
| nas-llm-server | 8792 | /health |
| nas-dashboard | 8793 | /api/services |

### Pattern 2: HTTP with Fallback

For services where failure is non-critical (e.g., tunnel monitoring):

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8080/health", "||", "exit", "0"]
  interval: 30s
  timeout: 5s
  retries: 3
```

### Pattern 3: CLI-Based Check

For services that don't expose HTTP (e.g., VPN):

```yaml
healthcheck:
  test: ["CMD", "tailscale", "status", "--peers=false"]
  interval: 60s
  timeout: 10s
  retries: 3
```

### Pattern 4: File-Age Check

For batch jobs that generate reports (e.g., music-syncer):

The service runs an HTTP sidecar that checks report age:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8088/health"]
  interval: 60s
  timeout: 5s
  retries: 3
```

The sidecar server (`syncer_server.py`) implements:
- Check if `summary_report.txt` exists
- Check if report is < 48h old
- Parse report for playlist metrics
- Return combined health status

### Pattern 5: Python One-Liner

For services that need custom logic:

```yaml
healthcheck:
  test: ["CMD", "python3", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')"]
  interval: 60s
  timeout: 5s
  retries: 3
```

### Pattern 6: API-Based Check

For services with REST APIs that need specific endpoints:

```yaml
# Ollama — check if models are loaded
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:11434/api/tags"]
  interval: 60s
  timeout: 10s
  retries: 5
```

## Docker Compose `depends_on` with Healthchecks

When Service B depends on Service A being healthy:

```yaml
depends_on:
  nas-llm-server:
    condition: service_healthy
```

This ensures Service B starts only AFTER Service A's healthcheck passes.

## Music-Syncer Status Server Pattern

The music-syncer is a batch job (while loop with sleep 86400). To expose its status:

1. Create `syncer_server.py` that:
   - Parses `summary_report.txt` (doesn't modify it)
   - Exposes `/health`, `/report`, `/playlists`, `/faltantes`
   - Checks file age (stale if > 48h)
   - Returns container health info (disk space, process running)

2. Create `entrypoint.sh` that:
   - Starts `syncer_server.py` in background
   - Runs `sync.sh` in foreground (exec)

3. Update docker-compose:
   - entrypoint: `/bin/bash /app/entrypoint.sh`
   - healthcheck: `curl -f http://localhost:8088/health`

Key principle: **Never modify the original batch job**. Add a sidecar HTTP server instead.

## Telegram Bot (nas-bot) Healthcheck

The bot uses long-polling which doesn't expose HTTP. Healthcheck approach:

```yaml
healthcheck:
  test: ["CMD", "python3", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')"]
  interval: 60s
  timeout: 5s
  retries: 3
```

Alternative: Check if process is running:
```yaml
healthcheck:
  test: ["CMD", "pgrep", "-f", "bot_server.py"]
  interval: 60s
  timeout: 5s
  retries: 3
```

## Dashboard (nas-dashboard) Healthcheck

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8793/api/services"]
  interval: 30s
  timeout: 10s
  retries: 5
```

The dashboard's healthcheck also validates it can reach all services' health endpoints.

## Best Practices

1. **Always use `curl -f`** — fails on HTTP errors (4xx, 5xx)
2. **Set reasonable intervals** — 30s for interactive services, 60s for batch
3. **Set timeouts < interval** — prevents overlapping checks
4. **Use `retries >= 3`** — avoids false negatives on transient failures
5. **Test locally first** — `docker compose up -d && docker ps --format "table {{.Names}}\t{{.Status}}"`
