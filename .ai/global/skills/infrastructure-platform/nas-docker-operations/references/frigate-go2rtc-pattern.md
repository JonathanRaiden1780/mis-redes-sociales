# Frigate + go2rtc Pattern

## Context

Scrypted and cloud-only cameras (Tuya) serve RTSP over UDP only. FFmpeg defaults to TCP and fails with `461 Unsupported Transport`. The fix is go2rtc as intermediary.

## Full docker-compose.yml snippet

```yaml
  # Frigate NVR
  nas-frigate:
    container_name: nas-frigate
    networks:
      - nas-net
    image: ghcr.io/blakeblackshear/frigate:stable
    platform: linux/arm64
    privileged: true
    ports:
      - "5000:5000"
      - "8554:8554"
      - "8555:8555/tcp"
    environment:
      - TZ=America/Mexico_City
      - FRIGATE_RTSP_PASSWORD=frigate
    volumes:
      - /volume1/Docker/frigate/config:/config
      - /volume1/Docker/frigate/media:/media/frigate
      - /dev/bus/usb:/dev/bus/usb
      - /tmp/cache:/tmp/cache
    restart: unless-stopped

  # Scrypted (Tuya cloud cameras → RTSP)
  nas-scrypted:
    container_name: nas-scrypted
    networks:
      - nas-net
    image: koush/scrypted:latest
    platform: linux/arm64
    ports:
      - "11080:11080"
      - "10443:10443"
      - "43080-43099:43080-43099"  # fixed port range
    volumes:
      - /volume1/Docker/scrypted:/server/volume
    environment:
      - TZ=America/Mexico_City
      - SCRYPTED_RTSP_PORT_RANGE=43080-43099
    restart: unless-stopped
```

## Frigate config.yml

```yaml
mqtt:
  host: nas-mqtt
  port: 1883

detectors:
  cpu1:
    type: cpu
    num_threads: 3

go2rtc:
  streams:
    cateye:
      - "rtsp://nas-scrypted:43089/CATEYE_HASH"
    security_camera:
      - "rtsp://nas-scrypted:43089/SECURITY_HASH"

cameras:
  cateye:
    ffmpeg:
      inputs:
        - path: rtsp://127.0.0.1:8554/cateye
          input_args: preset-rtsp-restream,analyzeduration=10000000,probesize=10000000
          roles: [detect, record]
    detect:
      width: 1280
      height: 720
      fps: 5
    objects:
      track: [person, dog, cat]
    snapshots:
      enabled: true
      retain:
        default: 10
    record:
      enabled: true
      retain:
        days: 7
        mode: motion

  security_camera:
    ffmpeg:
      inputs:
        - path: rtsp://127.0.0.1:8554/security_camera
          input_args: preset-rtsp-restream,analyzeduration=10000000,probesize=10000000
          roles: [detect, record]
    detect:
      width: 1280
      height: 720
      fps: 5
    objects:
      track: [person, car, dog, cat]
    snapshots:
      enabled: true
      retain:
        default: 10
    record:
      enabled: true
      retain:
        days: 7
        mode: motion

birdseye:
  enabled: true
  mode: objects
```

## Key insights

- **analyzeduration=10000000,probesize=10000000**: 10 seconds of probing for codec detection
- **preset-rtsp-restream**: Tells FFmpeg it's consuming from a restream source, not direct RTSP
- **roles: [detect, record]**: Same input used for both detection and recording
- **go2rtc port range fixed**: So Frigate always finds the same URL after restart
- **Frigate version 0.17+**: `mqtt` section is separate from cameras
