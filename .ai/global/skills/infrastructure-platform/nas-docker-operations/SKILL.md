---
name: nas-docker-operations
description: "Operate Synology NAS Docker stacks — Frigate NVR and MQTT."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [nas, synology, docker, frigate, mqtt, cameras, infrastructure, arm64]
    related_skills: [docker-stack-management, infrastructure-platform]
---

# NAS Docker Operations

Operate multi-service Docker stacks on Synology NAS devices, with emphasis on Frigate NVR, camera integration, and event-driven service architecture.

## Scope

This skill covers:
- Synology DSM-specific Docker quirks and workarounds
- Frigate NVR configuration, version migration, and camera integration
- MQTT event-driven architecture for cameras and automation
- Service architecture patterns (central brain, persistence layer, schedulers)
- Docker volume mount pitfalls on NAS filesystems
- ARM64 container constraints

## Trigger

Use when:
- Building or debugging Docker stacks on Synology NAS
- Configuring Frigate NVR with RTSP streams via go2rtc
- Setting up MQTT-based event pipelines (cameras → recognition → automation)
- Troubleshooting service redundancy in a Docker stack
- Migrating Frigate configs across versions
- Working with camera RTSP streams on ARM64 NAS

## Hard Invariants

- **No `nano` on Synology DSM** — use `cat > file << 'EOF'` or `echo '...' | sudo tee file`
- **No `synoacltool` on all DSM versions** — use POSIX `setfacl` or group+setgid (`chmod 2775`)
- **`chmod 600` on a directory breaks it** — the `x` bit means "enter"; directories need `755`, only secret files get `600`
- **No SSH from external Linux to NAS** — run commands via Portainer console or `docker exec`, not remote SSH
- **Docker socket API** — files come multiplexed (8-byte header per frame) with ANSI codes; demultiplex and clean before display

## Key Patterns

### Frigate + go2rtc as RTSP Intermediary

Scrypted and cloud-only cameras (Tuya) serve RTSP over UDP only. FFmpeg defaults to TCP and fails with `461 Unsupported Transport`. The fix is go2rtc as intermediary:

```yaml
go2rtc:
  streams:
    camera_name:
      - "rtsp://service:PORT/HASH"

cameras:
  camera_name:
    ffmpeg:
      inputs:
        - path: rtsp://127.0.0.1:8554/camera_name
          input_args: preset-rtsp-restream,analyzeduration=10000000,probesize=10000000
          roles: [detect, record]
```

**Why**: go2rtc connects to Scrypted over UDP, re-publishes as RTSP locally. Frigate consumes from `rtsp://127.0.0.1:8554/`. The `analyzeduration`/`probesize` args give FFmpeg enough time to detect codec parameters.

### MQTT Event Pipeline

```
Camera → Frigate detects person → MQTT: frigate/events
  → Recognition service recieves event → downloads snapshot → compares face
  → MQTT: frigate/camera/person/name
  → Home Assistant → automation (light on, etc.)
```

**Why MQTT not HTTP**: MQTT is push-based (events), HTTP is pull (polling). For real-time camera events, MQTT is instant and zero-waste.

### Service Architecture: Central Brain + Persistence + Scheduler

```
External apps (MiNegocio, FinanzApp)
    ↓ HTTP
nas-hermes (brain: reasoning, memory, tools, skills)
    ↓ calls
nas-llm-server (persistence: SQLite, reminders, prompts, scheduler)
    ↓ scheduler triggers
nas-hermes (cron invokes agent to handle reminder/task)
```

- **Hermes** decides (memory + tools), **llm-server** stores (SQLite with dates)
- Scheduler in llm-server runs cron jobs that invoke Hermes via HTTP
- Recurring reminders auto-reschedule (bimonthly → +60 days)

### Version Migration: Frigate 0.14+

`record.retain_days` was removed. New syntax:
```yaml
record:
  enabled: true
  retain:
    days: 7
    mode: motion
  alerts:
    retain:
      days: 30
```

## Pitfalls

1. **Volume mount overwrites CWD** — If a container's working directory is `/double-take/` and you mount a volume there, the code disappears. Mount to a subdir or use named volumes.

2. **Symlinks inside containers** — Scrypted images have `.storage -> /.storage`. The app creates `./.storage/config` which resolves to `/.storage/config`. Mount at the symlink target, not the symlink location.

3. **Docker socket permissions** — Containers reading logs via `/var/run/docker.sock:ro` need the user in the `docker` group or appropriate ACLs.

4. **SHM size** — Frigate warns when `/dev/shm` is < 178MB. On NAS, add `shm_size: '256m'` to the service or mount host `/dev/shm`.

5. **Frigate needs MQTT host as service name** — Use `nas-mqtt` (Docker service name), not `localhost` or `homeassistant`.

## Verification

After config changes:
```bash
# Validate YAML
python3 -c "import yaml; yaml.safe_load(open('config.yml'))"

# Check container logs
docker logs <container> 2>&1 | grep -E "ERROR|started|ready" | tail -5

# Test MQTT message flow
docker exec nas-mqtt mosquitto_sub -t "frigate/events" -v
```

## References

- `references/frigate-gop2rtc-pattern.md` — Full Frigate + go2rtc config with camera examples
- `references/synology-dsm-quirks.md` — DSM-specific commands and workarounds
