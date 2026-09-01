# File Downloader with Torrent Search

Extended file-downloader service that adds torrent search and download
with ClamAV scanning.

## Endpoints

| Method | Route | Function |
|--------|-------|----------|
| GET | `/api/torrents/search?q=X` | Search torrents on 1337x |
| POST | `/api/torrents/download` | Download a torrent (with ClamAV scan) |
| POST | `/api/download?url=X` | Direct file download |
| GET | `/api/history` | Download history |
| GET | `/api/categories` | Available categories |

## Torrent search flow

1. Search: `GET /api/torrents/search?q=matrix`
2. Results include title, URL, seeds, leech, size
3. Download: `POST /api/torrents/download` with `{"url": "https://1337x.to/torrent/..."}`
4. Service fetches the page, finds the .torrent download link
5. Downloads the .torrent file
6. Scans with ClamAV
7. Returns status (completed/quarantined)

## Implementation notes

- Uses regex to parse 1337x.to HTML (fragile, may break if site changes)
- ClamAV scanning on every download
- Torrents stored in `/app/data/torrents/`
- Files stored in `/app/data/downloads/`
- Auto-categorization by extension/MIME type (9 categories)

## Categories

music, video, image, document, software, archive, subtitle, ebook, other

## Compose entry

```yaml
nas-file-downloader:
  container_name: nas-file-downloader
  networks: [nas-net]
  build:
    context: ./core/nas-file-downloader
    dockerfile: Dockerfile
  platform: linux/arm64
  ports:
    - "8797:8796"
  environment:
    - DOWNLOAD_DIR=/app/data/downloads
    - TORRENT_DIR=/app/data/torrents
    - MAX_FILE_MB=500
  volumes:
    - /volume1/Docker/downloader/downloads:/app/data/downloads
    - /volume1/Docker/downloader/torrents:/app/data/torrents
    - /volume1/Docker/downloader/config:/app/config
  restart: unless-stopped
```

## Dockerfile

```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    clamav clamav-freshclam curl \
    && rm -rf /var/lib/apt/lists/* && mkdir -p /var/lib/clamav

COPY server.py /app/
WORKDIR /app
CMD ["python", "-u", "server.py"]
```

## Security

- All downloads scanned with ClamAV
- Infected files quarantined (not deleted, flagged)
- File size limit configurable
- No execution of downloaded files
