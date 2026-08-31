# TASK-003: Agnes Video Generator Integration

## Scope

Integrate Agnes Video Generator as the primary video/image engine for the Social Media Content Engine.

## Agnes API Endpoints (from docs/public/api.md)

### Image Generation
- `POST /api/image/generate` — Generate simple image (t2i / i2i)
- `GET /api/image/{task_id}` — Download generated image

### Video Generation
- `POST /api/tasks/simple` — Simple video (t2v / i2v / keyframes)
- `POST /api/tasks/creative` — Creative multi-scene video (AI screenplay → scenes → video)
- `POST /api/tasks/manuscript` — Manuscript video (long text → split → generate → composite)
- `POST /api/tasks/anchor` — Digital anchor (human talking head)

### Task Management
- `GET /api/tasks/{task_id}` — Check task status + get result
- `GET /api/models` — List available models

### Configuration
- `POST /api/config` — Set API key
- `GET /api/voices` — List TTS voices

## Integration Approach

Agnes runs as a sub-service on port 8765. Our backend (port 8000) calls Agnes API.

### Docker Compose Integration
```yaml
services:
  social-media-app:
    build: .
    ports:
      - "8000:8000"
    depends_on:
      - agnes
    environment:
      - AGNES_BASE_URL=http://agnes:8765
      - AGNES_API_KEY=${AGNES_API_KEY}
  
  agnes:
    image: ghcr.io/lcy362/agnes-video-generator/free-short-video:6.3.0
    ports:
      - "8765:8765"
    volumes:
      - ./agnes_data/working:/app/.working_dir
    environment:
      - AGNES_API_KEY=${AGNES_API_KEY}
```

### Python Client
```python
class AgnesClient:
    BASE_URL: str = "http://localhost:8765"
    
    async def generate_image(self, prompt: str, reference_image: str | None = None) -> TaskResult
    async def generate_video(self, prompt: str, mode: str = "simple") -> TaskResult
    async def get_task_status(self, task_id: str) -> TaskStatus
    async def download_result(self, task_id: str) -> bytes
```

## Modes for Social Media

1. **Simple (t2i)**: User idea → Agnes generates image directly
2. **Simple (t2v)**: User idea → Agnes generates video directly
3. **Creative**: Amplified prompt → Agnes screenplay → scenes → video with TTS + subtitles
4. **Image-to-Video**: User product photo + amplified prompt → i2v

## Steps

### 1. Create Agnes client module
- `src/server/core/agnes_client.py`
- Async HTTP client wrapping Agnes REST API
- Task polling, error handling, retry logic

### 2. Create image generation endpoint
- `POST /api/content/generate-image` — takes amplified prompt + optional reference image
- Returns task_id for polling

### 3. Create video generation endpoint
- `POST /api/content/generate-video` — takes amplified prompt + mode
- Returns task_id for polling

### 4. Add polling endpoint
- `GET /api/content/status/{task_id}` — returns task status + result URL

### 5. Integration tests
- Test client initialization
- Test task creation + polling
- Test error handling (bad key, network error)

## Acceptance Criteria
- Agnes client wraps all needed endpoints
- Image generation works (t2i and i2i)
- Video generation works (simple + creative modes)
- Task polling works
- Error handling for API failures
- Tests pass

## Dependencies
- Agnes API key (free from https://platform.agnes-ai.com)
- Agnes Video Generator running as sub-service