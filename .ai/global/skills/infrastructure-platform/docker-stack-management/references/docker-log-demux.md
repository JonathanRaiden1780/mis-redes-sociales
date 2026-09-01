# Docker Log Demultiplexing

Docker logs come **multiplexed** when requested via the API. Each frame has an 8-byte header followed by the payload.

## Frame format

```
[stream: 1 byte] [0000: 3 bytes padding] [length: 4 bytes big-endian] [payload: length bytes]
```

- `stream=1` → stdout
- `stream=2` → stderr

## Containers with tty=true

Containers started with `tty=true` emit **plain text** without the 8-byte header. Detect this: if the first byte is not 0, 1, or 2, treat the entire response as text.

## Implementation

```python
import re

ANSI_RE = re.compile(r"\x1b\[[0-9;?]*[a-zA-Z]|\x1b\][^\x07]*\x07")

def demux(raw: bytes) -> list[dict[str, str]]:
    """Demultiplex Docker log stream."""
    lines = []
    i = 0
    n = len(raw)

    # TTY mode: plain text
    if n >= 1 and raw[0] not in (0, 1, 2):
        for ln in raw.decode(errors="replace").splitlines():
            if ln.strip():
                lines.append({"stream": "stdout", "text": ANSI_RE.sub("", ln)})
        return lines

    # Multiplexed mode
    while i + 8 <= n:
        stream_id = raw[i]
        size = int.from_bytes(raw[i + 4:i + 8], "big")
        i += 8
        if size <= 0 or i + size > n:
            break
        chunk = raw[i:i + size].decode(errors="replace")
        i += size
        name = "stderr" if stream_id == 2 else "stdout"
        for ln in chunk.splitlines():
            if ln.strip():
                lines.append({"stream": name, "text": ANSI_RE.sub("", ln)})

    return lines
```

## Common pitfalls

1. **Not stripping ANSI codes** — logs appear as `[32mINF[0m` in HTML
2. **Treating multiplexed as text** — first 8 bytes of every frame become garbage
3. **Pinning API version** — `/v1.43/` fails on Docker 29+. Use versionless URLs.
