# Frigate + Tuya Camera Integration

## The Problem

Most Tuya cameras **do NOT expose RTSP natively**. They're designed for the Smart Life cloud ecosystem, not local streaming.

## Options for Tuya Camera Integration

### Option 1: Check for Hidden RTSP (Easiest)

Some Tuya cameras (especially "Pro" models or certain hardware revisions) have RTSP hidden in the Smart Life app:

1. Smart Life app → Camera settings → Look for:
   - "RTSP"
   - "Local streaming"
   - "Stream URL"
   - "ONVIF"

If found, the URL typically looks like:
```
rtsp://192.168.0.X:554/stream1
```

Use directly in Frigate:
```yaml
cameras:
  tuya:
    ffmpeg:
      inputs:
        - path: rtsp://192.168.0.X:554/stream1
          roles:
            - detect
            - record
```

### Option 2: Firmware Alternatives (Advanced)

| Firmware | Compatible Cameras | Notes |
|----------|-------------------|-------|
| **OpenIPC** | Hi3516, Hi3518, GV7113 chipsets | Full Linux, RTSP native |
| **tuya-convert** | Cameras with ESP8266/ESP32 | Flash via OTA, then install custom firmware |

**Risk:** Can brick the camera. Verify hardware compatibility first.

### Option 3: Home Assistant Bridge (Indirect)

If Tuya camera integrates with Home Assistant, use HA as a bridge:

```yaml
cameras:
  tuya_via_ha:
    ffmpeg:
      inputs:
        - path: http://homeassistant:8123/api/camera_stream/camera.tuya_name
          roles:
            - detect
```

**Downsides:**
- Added latency
- Depends on HA being up
- May have resolution/framerate limitations

### Option 4: ONVIF (If Supported)

Some Tuya cameras support ONVIF. Frigate has built-in ONVIF support:

```yaml
cameras:
  tuya_onvif:
    onvif:
      host: 192.168.0.X
      port: 80
      user: admin
      password: your_password
```

## Frigate + Home Assistant Automation

Once Frigate is detecting objects, integrate with HA via MQTT:

### Frigate Config (mqtt section)

```yaml
mqtt:
  host: nas-mqtt   # Docker service name of the in-stack broker
  port: 1883
  # Only if the broker requires auth:
  # user: frigate
  # password: frigate
```

Point this at the broker **service name inside the stack**, not at
`homeassistant`. HA subscribes to the same broker; it does not need to be the
broker. If you use the stack's own Mosquitto with default settings it allows
anonymous connections, so sending `user`/`password` makes it fail — omit them.

### Frigate publishes events to MQTT:

- Topic: `frigate/events`
- Payload includes:
  - `before` / `after` state
  - `camera` name
  - `label` (person, car, dog, etc.)
  - `top_score` (confidence)

### Home Assistant Automation Example

```yaml
automation:
  - alias: "Turn on light when Frigate detects person"
    trigger:
      platform: mqtt
      topic: frigate/events
    condition:
      - condition: template
        value_template: "{{ trigger.payload_json.after.label == 'person' }}"
      - condition: state
        entity_id: sun.sun
        state: "below_horizon"
    action:
      service: light.turn_on
      target:
        entity_id: light.front_door

  - alias: "Send notification when car detected"
    trigger:
      platform: mqtt
      topic: frigate/events
    condition:
      - condition: template
        value_template: "{{ trigger.payload_json.after.label == 'car' }}"
    action:
      service: notify.mobile_app
      data:
        title: "Vehículo detectado"
        message: "Hay un coche en la entrada"
```

## Frigate Config (Synology ARM64)

Use Tensor Flow Lite (CPU detection) — no GPU/Coral needed:

```yaml
detectors:
  cpu:
    type: cpu
    num_threads: 2  # Adjust based on your NAS CPU cores

cameras:
  front_door:
    ffmpeg:
      inputs:
        - path: rtsp://USER:PASS@IP:554/stream1
          roles:
            - detect
            - record
    detect:
      width: 1280
      height: 720
      fps: 5  # Lower FPS = less CPU
    objects:
      track:
        - person
        - car
    snapshots:
      enabled: true
      retain:
        default: 10
    record:
      enabled: true
      retain:
        days: 7
        mode: motion
      alerts:
        retain:
          days: 30
      detections:
        retain:
          days: 30
```

**Performance tip for ARM64 NAS:** Use `width: 1280`, `height: 720`, `fps: 5` to avoid CPU overload.

## Frigate 0.14+ config schema break

`record.retain_days` was **removed**. Frigate refuses to start and prints the
offending line number:

```
Your configuration is invalid.
Line 24: cameras -> cateye -> record -> retain_days - Extra inputs are not permitted
```

| Removed (≤0.13) | Replacement (0.14+) |
|---|---|
| `record.retain_days: 7` | `record.retain.days: 7` + `record.retain.mode: motion` |
| `record.events.retain.default: 30` | `record.alerts.retain.days: 30` and `record.detections.retain.days: 30` |

`Extra inputs are not permitted` is Frigate's generic pydantic message for **any**
unknown key — read the line number it gives you rather than guessing, and check
the current schema at docs.frigate.video before hand-writing a config.

## Frigate config filename and ownership

Frigate writes its own `config.yaml` (**not** `config.yml`) into the config
volume on first boot, owned by `root`. Editing it from a VS Code Remote / SSH
session as a normal user fails:

```
EACCES: permission denied, open '/volume1/Docker/frigate/config/config.yaml'
```

Check the real filename before assuming, then take ownership:

```bash
ls -la /volume1/Docker/frigate/config/
sudo chown "$(whoami)" /volume1/Docker/frigate/config/config.yaml
```

Do **not** try to fix this by bind-mounting your own `config.yml` over it — that
hits the file-vs-directory mount conflict documented in the parent SKILL.md.

## Tuya "cloud-only" cameras: when no option works

Some Tuya models (e.g. doorbell/peephole cams reporting model `可视猫眼`) expose
**no** RTSP, **no** ONVIF, and **no** stream URL — not in the Smart Life app, not
in Home Assistant, and not via the Scrypted Tuya plugin. The Scrypted device page
shows only `Settings` / `Extensions` / `Status and Controls` with no `Streams` tab.

Diagnosis order — stop as soon as one yields a URL:

1. Smart Life app → camera settings → `RTSP` / `Local streaming` / `ONVIF`
2. Home Assistant → device page → look for a `Stream` / `Go2RTC` entity
3. Scrypted → add device via Tuya plugin → device page → `Streams` tab
4. Scrypted → install the **ONVIF** plugin and add the camera by IP (needs
   camera IP + credentials; only works if the firmware speaks ONVIF at all)

If all four come up empty the camera is genuinely cloud-only. Be direct with the
user at that point: the honest answer is "this model can't feed Frigate locally",
and the real options are HA's `camera_proxy_stream` (needs a long-lived token,
adds latency, depends on HA uptime), alternative firmware such as OpenIPC (risk
of bricking, verify the chipset first), or replacing the camera with one that has
native RTSP (Reolink, Amcrest, Hikvision). Do not keep proposing new bridges as
though one of them is bound to work.

## Scrypted as the RTSP bridge (the path that actually worked)

Scrypted's Tuya plugin **does** expose RTSP for some Tuya cameras (confirmed with
a JS-P162 300W). The HA `camera_proxy_stream` + go2rtc path is the documented
fallback, but Scrypted-direct is simpler and lower latency when it works.

### What Scrypted gives you

Each camera gets a unique RTSP URL with a hash that **changes on every Scrypted
restart**:

```
rtsp://localhost:43089/c46275ef4bc510cd     ← security_camera
rtsp://localhost:43089/f2e20c4819a24bfc     ← cateye (different hash)
```

### Step 1: Fix the port range so hashes stop changing

```yaml
# In nas-scrypted service
ports:
  - "11080:11080"
  - "43080-43099:43080-43099"        # ← pin the range
environment:
  - SCRYPTED_RTSP_PORT_RANGE=43080-43099
```

### Step 2: Consume directly in Frigate

```yaml
cameras:
  cateye:
    ffmpeg:
      inputs:
        - path: rtsp://nas-scrypted:43089/CATEYE_HASH
          input_args: preset-rtsp-generic,analyzeduration=10000000,probesize=10000000
          roles: [detect, record]
  security_camera:
    ffmpeg:
      inputs:
        - path: rtsp://nas-scrypted:43089/SECURITY_CAMERA_HASH
          input_args: preset-rtsp-generic,analyzeduration=10000000,probesize=10000000
          roles: [detect, record]
```

**Why `nas-scrypted` and not `localhost`?** From inside the Frigate container,
`localhost` is Frigate itself. Use the Docker service name.

### Step 3: Get the actual hashes

1. Open `http://NAS_IP:11080`
2. Click each camera → **Streams** tab → copy the **RTSP Rebroadcast Uri**
3. Replace the placeholders in the config
4. `docker restart nas-frigate`

### When go2rtc connects but no video flows

If go2rtc logs show `i/o timeout` and `EOF` repeatedly for one camera while another camera on the same Scrypted instance works fine, the problem is **upstream of Frigate**:

1. Open `http://NAS_IP:11080` → click the failing camera → check if live video shows
2. If Scrypted shows a black screen or "No frames": the Tuya plugin lost the connection to the camera
3. Restart Scrypted: `docker restart nas-scrypted`
4. Wait 30 seconds for Scrypted to reconnect all cameras
5. Then restart Frigate: `docker restart nas-frigate`

**Don't keep adjusting Frigate's ffmpeg args when Scrypted isn't serving the stream.** The chain is: Tuya cloud → Scrypted plugin → go2rtc → Frigate. Breakage at any earlier stage looks identical in Frigate's logs. Always verify Scrypted itself shows live video before touching Frigate configs.

### Scrypted's RTSP only supports UDP — do NOT force TCP

Scrypted's RTSP implementation rejects TCP transport with `461 Unsupported Transport`. If you add `rtsp_transport=tcp` to Frigate's `input_args`, ffmpeg fails immediately:

```
[rtsp @ 0x...] method SETUP failed: 461 Unsupported Transport
```

**The fix:** Let go2rtc handle the UDP connection to Scrypted. go2rtc negotiates the transport correctly, then Frigate consumes from go2rtc via local RTSP:

```yaml
go2rtc:
  streams:
    security_camera:
      - "rtsp://nas-scrypted:43089/c46275ef4bc510cd"

cameras:
  security_camera:
    ffmpeg:
      inputs:
        - path: rtsp://127.0.0.1:8554/security_camera
          input_args: preset-rtsp-restream   # ← correct preset for go2rtc source
          roles: [detect, record]
```

**Why this works:** go2rtc connects to Scrypted using whatever transport Scrypted accepts (UDP), then re-serves the stream locally over TCP to Frigate. Frigate never talks to Scrypted directly.

**Common mistake:** Adding `analyzeduration=...,probesize=...` to `input_args` along with `preset-rtsp-restream`. The preset is a single token — you can't append comma-separated options to it. If you need longer probing, use `preset-rtsp-generic` instead (but `preset-rtsp-restream` is preferred for go2rtc sources).

### When Scrypted does NOT expose RTSP

Some Tuya models (e.g. doorbell/peephole cams, model `可视猫眼`) show only
`Settings` / `Extensions` / `Status and Controls` in Scrypted — no `Streams`
tab at all. For those, fall back to the HA bridge below.

## Use go2rtc to restream anything that isn't native RTSP

Feeding Frigate an HA `camera_proxy_stream` URL **directly** works until the
stream hiccups — Frigate's ffmpeg input will not reliably reconnect to an HTTP
proxy. Frigate ships go2rtc for exactly this: let go2rtc own the flaky upstream
and hand Frigate a stable local RTSP endpoint.

**Caveat:** go2rtc inside Frigate tries to reach `homeassistant:8123`, but HA is
typically **not** on the user-defined Docker network (`nas-net`). This makes the
go2rtc path fail with `name resolution` errors unless HA is also on `nas-net`.
Scrypted-direct avoids this entirely.

```yaml
go2rtc:
  streams:
    cateye:
      - "ffmpeg:http://homeassistant:8123/api/camera_proxy_stream/camera.cateye?token=TOKEN#video=copy"
    security_camera:
      - "ffmpeg:http://homeassistant:8123/api/camera_proxy_stream/camera.security_camera?token=TOKEN#video=copy"

cameras:
  cateye:
    ffmpeg:
      inputs:
        - path: rtsp://127.0.0.1:8554/cateye     # go2rtc, inside the same container
          input_args: preset-rtsp-restream        # required for a go2rtc source
          roles: [detect, record]
```

Details that matter:

- `127.0.0.1:8554` — go2rtc runs **inside** the Frigate container, so it is
  localhost from Frigate's point of view, not a Docker service name.
- `input_args: preset-rtsp-restream` — omitting it produces stalls and audio
  errors; this preset is specifically for go2rtc-restreamed inputs.
- `#video=copy` — no re-encode. On a CPU-only NAS, transcoding two cameras will
  eat the box.
- The token is a **long-lived access token** (HA → profile → Security), not a
  session token. Frigate has no way to refresh a short-lived one.
- Verify the entity IDs first in HA → Developer tools → States, filtering on
  `camera.`. Guessing `camera.<friendly name>` is a common miss.

## Two cameras, and the dual-stream trick

Detection cost scales with resolution, recording quality does not have to. If a
camera exposes two substreams, split the roles so the AI reads a small frame
while you still record full res:

```yaml
cameras:
  security_camera:                  # 3MP sensor (2304x1296)
    ffmpeg:
      inputs:
        - path: rtsp://admin:PASS@IP:554/stream1
          roles: [record]           # full resolution, no inference on it
        - path: rtsp://admin:PASS@IP:554/stream2
          roles: [detect]           # substream, cheap to analyse
    detect:
      width: 1280
      height: 720
      fps: 5
```

When the camera only gives you one stream (the cloud-only case above), keep
`detect` pinned low anyway — `detect.width/height` is what the detector sees and
is independent of what gets written to disk.

Probing for a hidden second stream is worth a minute before settling for the HA
bridge:

```bash
nmap -p 554 CAMERA_IP
ffprobe rtsp://admin:PASS@CAMERA_IP:554/stream1
ffprobe rtsp://admin:PASS@CAMERA_IP:554/stream2
ffprobe rtsp://admin:PASS@CAMERA_IP:554/h264Preview_01_main
```

Per-camera object lists should differ by what the camera can actually see. A
doorbell peephole pointed at a porch has no business tracking `car`; a driveway
camera does. Extra labels are pure wasted inference.

## Facial recognition with Double-Take

Double-Take integrates with Frigate over MQTT: Frigate detects a person, Double-Take crops the face, compares it against `known_faces/`, and publishes the name to MQTT. HA can then trigger automations like "if it's Jh after 7pm, turn on the light."

### Architecture

```
Frigate detects person → publishes to MQTT
  → Double-Take receives event, crops face from snapshot
  → Compares against known_faces/
  → Publishes name: frigate/cateye/person/jh
  → HA automation: "if jh + after 7pm → light.turn_on"
```

### Double-Take service

The mount path is **critical**. Double-Take's image has its code at `/double-take/`. If you bind-mount over that exact path, the host directory (empty) overwrites the image's code — the container can't find its own `package.json` or entrypoint.

**Two safe patterns:**

```yaml
# Pattern A: Mount only the subdirectories the app reads/writes
volumes:
  - /volume1/Docker/double-take/known_faces:/.double-take/known_faces
  - /volume1/Docker/double-take/unknown_faces:/.double-take/unknown_faces
  - /volume1/Docker/double-take/.storage:/.double-take/.storage

# Pattern B: Use a named volume (preserves image content on first run)
volumes:
  - double-take-data:/.double-take
# and declare: volumes: { double-take-data: } at the bottom of the compose
```

**Debugging sequence when Double-Take fails to start:**

```bash
# 1. What's the CWD inside the container?
docker exec nas-double-take pwd

# 2. Does the entrypoint exist at that path?
docker exec nas-double-take ls -la /entrypoint.sh

# 3. Is the image code where it should be?
docker exec nas-double-take ls -la /double-take/

# 4. If empty → your bind mount overwrote it. Fix the volume path.
```

```yaml
nas-double-take:
  container_name: nas-double-take
  networks: [nas-net]
  image: skrashevich/double-take:latest
  platform: linux/arm64
  ports:
    - "3000:3000"
  environment:
    - TZ=America/Mexico_City
    - MQTT_HOST=nas-mqtt
    - MQTT_PORT=1883
    - FRIGATE_URL=http://nas-frigate:5000
    - FRIGATE_CAMERAS=cateye
    - SAVE_UNKNOWN=false
    - LOG_LEVEL=info
  volumes:
    - /volume1/Docker/double-take/known_faces:/.double-take/known_faces
    - /volume1/Docker/double-take/unknown_faces:/.double-take/unknown_faces
    - /volume1/Docker/double-take/.storage:/.double-take/.storage
  depends_on:
    nas-frigate:
      condition: service_healthy
    nas-mqtt:
      condition: service_started
  restart: unless-stopped
```

### Training faces

```bash
mkdir -p /volume1/Docker/double-take/known_faces/jh
# Copy 3-5 photos: front, profile, with glasses, low light, smiling
```

Or use the web UI at `http://NAS_IP:3000` to upload photos.

### HA automation example

```yaml
alias: "Luz entrada si es Jh después de las 7pm"
trigger:
  - platform: mqtt
    topic: "frigate/cateye/person/jh"
condition:
  - condition: time
    after: "19:00:00"
  - condition: sun
    after: sunset
    after_offset: "-00:30:00"
action:
  - service: light.turn_on
    target:
      entity_id: light.entrada
    data:
      brightness_pct: 80
      color_temp_kelvin: 2700
  - delay: "00:10:00"
  - service: light.turn_off
    target:
      entity_id: light.entrada
mode: single
```

### Tuning

| Problem | Fix |
|---|---|
| Not recognized | Add more photos (different angles, lighting) |
| Recognized as someone else | Raise `min_confidence` (default 0.55) |
| Slow recognition | Normal: 1-3s per face on CPU |
| Works for one person, not another | Each person needs their own folder with 3+ photos |

To stop a street-facing camera firing on every passer-by, add a zone covering
only the area you care about rather than pushing `min_score` up (which just makes
it miss real people):

```yaml
    zones:
      entrada:
        coordinates: 0,720,0,300,1280,300,1280,720
        objects: [person]
```

Coordinates are `x,y` pairs in **detect** resolution, not stream resolution.
Draw them in the Frigate UI (Settings → Mask & Zone creator) and paste the output
rather than computing by hand.
