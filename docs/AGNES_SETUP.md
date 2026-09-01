# Agnes Video Generator — Requisitos y Configuración

## ¿Qué es Agnes?

Agnes Video Generator es una plataforma de generación de video e imágenes con IA. Permite crear contenido visual promocional a partir de prompts de texto.

## Requisitos

### 1. API Key (Gratuita)

1. Visita https://platform.agnes-ai.com
2. Crea una cuenta gratuita
3. Genera una API key en el dashboard
4. La key gratuita tiene límites diarios pero funciona para pruebas

### 2. Docker (Para self-hosting en NAS)

```bash
# Imagen oficial
docker pull ghcr.io/lcy362/agnes-video-generator/free-short-video:6.3.0

# Ejecutar en puerto 8765
docker run -d \
  --name agnes \
  -p 8765:8765 \
  -e AGNES_API_KEY=tu_api_key \
  -v agnes_data:/app/.working_dir \
  ghcr.io/lcy362/agnes-video-generator/free-short-video:6.3.0
```

### 3. Docker Compose (Ya incluido en el proyecto)

El `docker-compose.yml` del proyecto ya incluye Agnes como servicio:

```yaml
services:
  agnes:
    image: ghcr.io/lcy362/agnes-video-generator/free-short-video:6.3.0
    ports:
      - "8765:8765"
    volumes:
      - ./agnes_data/working:/app/.working_dir
    environment:
      - AGNES_API_KEY=${AGNES_API_KEY:-free}
    restart: unless-stopped
```

## Modos de Generación

| Modo | Descripción | Uso recomendado |
|------|-------------|-----------------|
| `simple` | Texto a video/imagen simple | Promociones rápidas |
| `creative` | Multi-escena con guion IA | Campañas completas |
| `manuscript` | Texto largo → video | Tutoriales, explicaciones |
| `anchor` | Presentador virtual | Videos de venta |

## Endpoints de la API Agnes

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/image/generate` | POST | Generar imagen (t2i, i2i) |
| `/api/image/{task_id}` | GET | Descargar imagen generada |
| `/api/tasks/simple` | POST | Video simple (t2v, i2v) |
| `/api/tasks/creative` | POST | Video creativo multi-escena |
| `/api/tasks/manuscript` | POST | Video desde manuscrito largo |
| `/api/tasks/anchor` | POST | Video con presentador virtual |
| `/api/tasks/{task_id}` | GET | Estado de tarea |
| `/api/models` | GET | Modelos disponibles |
| `/api/config` | POST | Configurar API key |
| `/api/voices` | GET | Voces TTS disponibles |

## Estado Actual del Sistema

El sistema tiene **fallback inteligente**:

1. **Agnes disponible**: Genera imágenes/video reales
2. **Agnes no disponible**: Genera placeholders con mensaje informativo
3. **LLM disponible**: Mejora los prompts antes de generar
4. **LLM no disponible**: Usa amplificación basada en reglas

## Solución de Problemas

| Problema | Solución |
|----------|----------|
| "Agnes connection failed" | Verifica que Agnes corra en puerto 8765 |
| "API key invalid" | Registra key gratuita en platform.agnes-ai.com |
| "Task timeout" | Agnes puede tardar 2-5 minutos en generar |
| "Rate limit exceeded" | La key gratuita tiene límites diarios |

## Recursos

- Documentación: https://github.com/lcy362/agnes-video-generator
- Plataforma: https://platform.agnes-ai.com
- API gratuita: Sí (con límites)