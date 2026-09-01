# NAS LLM Server — Local AI with Multi-Mode Support

## Session Dates
2026-08-20, 2026-08-21

## Context
User wanted a local AI server on their NAS that doesn't consume much RAM, with multiple modes for different use cases: business strategy, general chat, background processing, and personal secretary with reminders. Extended on 08-21 with proactive night analysis for MiNegocio.

## Architecture

```
nas-infrastructure/core/nas-llm-server/
├── docker-compose.yml    # ollama + nas-llm-server
├── Dockerfile            # python:3.11-slim
├── server.py             # Flask API with 4 modes + analysis endpoints
├── minegocio_client.py   # MiNegocio integration client
├── minegocio_analyzer.py # Pure analysis logic (no LLM)
├── minegocio_firebase.py # Firestore data access
├── night_job.py          # APScheduler job for 3 AM analysis
├── analysis_routes.py    # Flask blueprint for /api/analysis/*
├── requirements.txt      # flask, requests, gunicorn, firebase-admin
├── .env                  # Telegram token, model config
└── README.md
```

## Design Decisions

### Why separate docker-compose.yml
The nas-llm-server has its own docker-compose.yml instead of being added to the main one. This:
- Keeps the main docker-compose.yml clean
- Allows independent deployment/scaling
- Makes it optional (only deploy if you want local AI)

### Why Ollama as backend
- Standard API (OpenAI-compatible)
- Easy model switching
- Good ARM64 support (for NAS)
- Can use any model: qwen2.5, llama3.1, gemma2, etc.

### Model Selection (Updated 2026-08-21)

**GLM-5.2 (744B MoE) is NOT viable for local deployment:**
- Even Q4 quantization requires ~96GB RAM
- CPU-only streaming from disk yields ~1 tok/s
- Not suitable for interactive use or "architect" role
- User confirmed: "si me dices qué hardware tienes... te puedo orientar"

**Viable models for typical NAS (15GB RAM):**

| Model | RAM | Quality | Use Case |
|-------|-----|---------|----------|
| qwen2.5:7b-q4_K_M | ~5GB | ⭐⭐⭐⭐ | Best balance for NAS |
| llama3.1:8b-q4_K_M | ~6GB | ⭐⭐⭐⭐ | Alternative |
| gemma2:9b-q4_K_M | ~7GB | ⭐⭐⭐⭐ | Higher quality |
| qwen2.5:14b-q4_K_M | ~10GB | ⭐⭐⭐⭐⭐ | If RAM allows |

**Recommended approach for user's case:**
- Use 7B local model for fast tasks (OCR, resúmenes)
- Use API model (meituan/longcat-2.0:free) for complex architecture decisions
- Future: when NAS has 64GB+ RAM, reconsider larger models

### Why analyzer is separate from LLM

The analyzer (`minegocio_analyzer.py`) is pure Python logic — no LLM calls. It:
- Calculates days-in-status for each prospect
- Computes churn risk from last-purchase dates
- Identifies low-stock items and favorite categories
- Generates rule-based suggestions (e.g., "7 days no contact → contact now")

This keeps the night job fast and RAM-friendly. The LLM is only invoked for:
- Elaborating on patterns found by the analyzer
- Generating natural-language summaries

## API Modes

### mi_negocio
Pre-configured system prompt for business strategy. Extended with:
- `/api/mi_negocio/suggest` — strategy suggestion with business context
- `/api/mi_negocio/inventory_advice` — restock advice per product
- Business context includes: sales, top products, low stock, customers

### chat
General conversational AI with no special context.

### night
Background processing mode:
- Can be slow (no user waiting)
- Generates detailed reports
- RAM-friendly (processes in chunks)

### secretary
Personal assistant with:
- SQLite database for reminders
- Recurrence support (every month, every 2 months, etc.)
- Telegram/WhatsApp notifications
- Natural language input: "recuerda pago de renta el 14 de cada mes"

## Integration Points

### Telegram Notifications

**Bot token:** `8559099997:AAFxx_CI7x8Zxo8gGaHz2qZ9FltRJC4YBGQ`

```python
send_telegram_message(f"📅 *Recordatorio:*\n\n*{title}*\n{fecha}")
```

### NAS Gateway
Can register with nas-app-gateway for:
- Centralized authentication
- Shared context with other services
- Unified notification system

### MiNegocio Frontend
The `Recommendations.tsx` page connects to `/api/recommendations` endpoint to show night job results.

## Night Job Flow (Updated 2026-08-21)

```
3:00 AM triggers night_job.py
  1. Load businesses from /app/config/businesses.json
  2. For each business:
     a. Fetch data via minegocio_firebase.py (Firestore)
     b. Run MiNegocioAnalyzer.analyze_all()
     c. Store recommendations in SQLite
     d. Log run stats
  3. If high-priority issues found → send Telegram notification
  4. Done — user sees results in morning via /recommendations page
```

## Recommendation Schema (SQLite)

```sql
CREATE TABLE recommendations (
    id INTEGER PRIMARY KEY,
    business_id TEXT NOT NULL,
    type TEXT NOT NULL,          -- 'prospect' or 'client'
    entity_id TEXT NOT NULL,
    entity_name TEXT,
    risk_level TEXT,             -- low, medium, high
    suggestion TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, viewed, acted, dismissed
    created_at TEXT,
    acted_at TEXT
);
```

## Pitfalls

### 1. GLM-5.2 not viable locally
User asked about GLM-5.2. Even Q4 needs ~96GB RAM. Don't suggest it for local deployment.

### 2. ARM64 compatibility
NAS devices often use ARM CPUs. Ollama supports ARM64 but model availability varies.

### 3. Token speed at 1 tok/s
Large models on CPU-only NAS can be very slow (~1 tok/s). Not suitable for interactive use.

### 4. Firestore credentials on NAS
The service account JSON must be mounted at `/app/config/service-account.json` and never committed to git. Add to `.gitignore`.

### 5. SQLite write locking
Night job writes to SQLite while API may be reading. Use WAL mode: `PRAGMA journal_mode=WAL;`

### 6. Telegram token in .env
The `.env` file contains the real token. The `.env.example` should have empty values. Never commit `.env`.

### 7. Analyzer vs LLM separation
Analyzer is fast and deterministic. LLM is slow and costs RAM. Use analyzer for 95% of logic, LLM only for natural language elaboration.

### 8. Model too large for interactive use
For "architect" role or project analysis, you need responses in seconds, not minutes. Use API model for these cases.

### 9. MiNegocio timezone handling
`createdAt` timestamps from Firebase are UTC. Convert to local time (America/Mexico_City) for display.

### 10. Large business datasets
Fetching all orders for a business with thousands of orders may be slow. Implement pagination or incremental sync.

### 11. React Router route duplication
When adding new routes in `App.tsx`, ensure the path doesn't collide with existing routes. Common mistake: defining `/customers` twice instead of `/customers` + `/customers/:id`. Always verify routes after patching.

### 12. Lucide React icon imports
When adding icons to nav items, import them in the same file (`navItems.ts`). Don't use string literals like `"Lightbulb" as any` — import from `lucide-react`.

### 13. docker-compose.yml principal vs sub-proyecto
Cada servicio NAS tiene su propio `docker-compose.yml`, pero el principal (`docker-compose.yml` raíz) DEBE incluir también los nuevos servicios. Si no, `docker-compose up -d` desde la raíz no los levanta.

## User's Specific Use Cases

1. **MiNegocio strategy**: "sugerencias de estrategia y otras posibilidades relacionadas"
2. **Chat/consulta**: General questions
3. **Night processing**: Slow but doesn't kill RAM
4. **Secretary**: "recuerda pago de renta el 14 de cada mes, pago de agua cada dos meses"
5. **Notifications**: Via Telegram, WhatsApp, or other channels
6. **Proactive analysis**: "en las noches haga este barrido para tener en una base estas recomendaciones y pueda verlas por la mañana"
7. **Prospect tracking**: "si es inicio o prospecto, dependiendo el estatus y el histórico de bitácora, que valide sugerencias"
8. **Client retention**: "si es cliente, para vender mas, de acuerdo a su histórico de compras ofrecer algo"
9. **Learning loop**: track which suggestions were acted on vs dismissed to improve future recommendations

## Future Enhancements

- WhatsApp integration (via wa.me links or WhatsApp Business API)
- Voice input (Whisper local)
- Image analysis (LLaVA)
- Calendar sync (Google Calendar API)
- Incremental sync for large business datasets
- Learning loop implementation
