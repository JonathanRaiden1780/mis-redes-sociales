# Facial Recognition Service for Frigate

Lightweight CPU-only facial recognition that integrates with Frigate over MQTT.

## Architecture

```
Frigate detects person → MQTT: frigate/events
  → Face-recognizer downloads snapshot
  → face_recognition.compare_faces() against known_faces/
  → MQTT: frigate/cateye/person/jh (or "unknown")
  → HA automation fires
```

## Service Dockerfile

```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    cmake build-essential libopenblas-dev liblapack-dev \
    libx11-dev libgtk-3-dev libboost-python-dev \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir face_recognition paho-mqtt requests

RUN mkdir -p /app /known_faces /unknown_faces

COPY recognize.py /app/
WORKDIR /app
CMD ["python", "-u", "recognize.py"]
```

## recognize.py

```python
#!/usr/bin/env python3
"""
Reconocimiento facial para Frigate.
Se suscribe a frigate/events, descarga el snapshot,
compara con /known_faces/ y publica el nombre en MQTT.
"""
import json, os, time, urllib.parse, urllib.request, re, subprocess, logging
from pathlib import Path
import paho.mqtt.client as mqtt
import requests, face_recognition

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("face-recognizer")

MQTT_HOST = os.environ.get("MQTT_HOST", "nas-mqtt")
MQTT_PORT = int(os.environ.get("MQTT_PORT", "1883"))
FRIGATE_URL = os.environ.get("FRIGATE_URL", "http://nas-frigate:5000")
CAMERAS = os.environ.get("FRIGATE_CAMERAS", "cateye").split(",")
KNOWN_FACES = Path("/known_faces")
UNKNOWN_FACES = Path("/unknown_faces")
MIN_CONFIDENCE = float(os.environ.get("MIN_CONFIDENCE", "0.5"))

known_encodings, known_names = [], []

def load_known_faces():
    global known_encodings, known_names
    known_encodings, known_names = [], []
    if not KNOWN_FACES.exists(): return
    for person_dir in KNOWN_FACES.iterdir():
        if not person_dir.is_dir(): continue
        for img_path in person_dir.iterdir():
            if img_path.suffix.lower() not in (".jpg", ".jpeg", ".png"): continue
            try:
                img = face_recognition.load_image_file(str(img_path))
                encs = face_recognition.face_encodings(img)
                if encs:
                    known_encodings.append(encs[0])
                    known_names.append(person_dir.name)
                    logger.info(f"Cargado: {person_dir.name} desde {img_path.name}")
            except Exception as e:
                logger.error(f"Error cargando {img_path}: {e}")
    logger.info(f"Rostros: {len(known_encodings)} de {len(set(known_names))} personas")

def recognize_face(image_path):
    if not known_encodings: return "unknown"
    try:
        img = face_recognition.load_image_file(image_path)
        encs = face_recognition.face_encodings(img)
        if not encs: return "unknown"
        matches = face_recognition.compare_faces(known_encodings, encs[0], tolerance=0.6)
        distances = face_recognition.face_distance(known_encodings, encs[0])
        if not any(matches): return "unknown"
        best = distances.argmin()
        if matches[best] and distances[best] < (1 - MIN_CONFIDENCE):
            return known_names[best]
        return "unknown"
    except Exception as e:
        logger.error(f"Error reconociendo: {e}")
        return "unknown"

def on_connect(client, userdata, flags, rc):
    logger.info(f"MQTT conectado: {MQTT_HOST}:{MQTT_PORT}")
    client.subscribe("frigate/events")

def on_message(client, userdata, msg):
    try:
        event = json.loads(msg.payload)
    except json.JSONDecodeError:
        return
    after = event.get("after", {})
    if after.get("label") != "person": return
    camera = after.get("camera", "")
    if camera not in CAMERAS: return
    event_id = event.get("id", "")
    if not event_id: return

    logger.info(f"Persona en {camera} ({event_id[:8]})")
    snapshot_url = f"{FRIGATE_URL}/api/events/{event_id}/snapshot.jpg"
    try:
        resp = requests.get(snapshot_url, timeout=10)
        if resp.status_code != 200:
            logger.error(f"Snapshot error: {resp.status_code}")
            return
        temp_path = f"/tmp/snapshot_{event_id}.jpg"
        Path(temp_path).write_bytes(resp.content)
        name = recognize_face(temp_path)
        topic = f"frigate/{camera}/person/{name}"
        client.publish(topic, json.dumps({
            "name": name, "camera": camera,
            "event_id": event_id, "timestamp": time.time()
        }))
        logger.info(f"Reconocido: {name}")
        try: os.remove(temp_path)
        except: pass
    except Exception as e:
        logger.error(f"Error: {e}")

def main():
    load_known_faces()
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message
    client.connect(MQTT_HOST, MQTT_PORT, 60)
    client.loop_forever()

if __name__ == "__main__":
    main()
```

## Compose entry

```yaml
nas-face-recognizer:
  container_name: nas-face-recognizer
  networks: [nas-net]
  build:
    context: ./core/nas-face-recognizer
    dockerfile: Dockerfile
  platform: linux/arm64
  environment:
    - TZ=America/Mexico_City
    - MQTT_HOST=nas-mqtt
    - MQTT_PORT=1883
    - FRIGATE_URL=http://nas-frigate:5000
    - FRIGATE_CAMERAS=cateye
    - MIN_CONFIDENCE=0.5
  volumes:
    - /volume1/Docker/known_faces:/known_faces
    - /volume1/Docker/unknown_faces:/unknown_faces
  depends_on:
    nas-frigate:
      condition: service_healthy
    nas-mqtt:
      condition: service_started
  restart: unless-stopped
```

## Training faces

```bash
mkdir -p /volume1/Docker/known_faces/jh
# Copy 3-5 photos per person (front, profile, glasses, low light, smiling)
```

## HA automation

```yaml
alias: "Luz si es Jh después de las 7pm"
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

## Troubleshooting

| Problem | Fix |
|---|---|
| MQTT not connecting | Verify `nas-mqtt` is on `nas-net` |
| All faces "unknown" | Add more photos (3+ per angle) |
| Wrong person recognized | Raise `MIN_CONFIDENCE` (0.55, 0.6) |
| High CPU | Normal: dlib is CPU-intensive. Lower camera FPS. |
| Snapshot download fails | Verify `FRIGATE_URL` reachable from container |

## Why not Double-Take?

Double-Take requires CompreFace as a separate service (another container,
~2GB RAM minimum, heavy on CPU without GPU). The custom `face_recognition`
service is ~200MB RAM, one container, no external dependencies.
