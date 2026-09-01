# MiNegocio Analyzer & Night Job Pattern

## Session Date
2026-08-21

## Context
User wanted the NAS LLM Server to not just respond to queries but proactively analyze MiNegocio business data (prospects, clients, inventory) during low-usage hours and surface actionable recommendations by morning.

## Architecture

```
nas-infrastructure/core/nas-llm-server/
├── night_job.py              # APScheduler job, runs at 3 AM
├── minegocio_analyzer.py     # Pure analysis logic (no LLM)
├── minegocio_firebase.py     # Firestore data access
├── analysis_routes.py        # Flask blueprint for /api/analysis/*
└── server.py                 # Registers analysis_bp
```

## Why separate analyzer from LLM

The analyzer (`minegocio_analyzer.py`) is pure Python logic — no LLM calls. It:
- Calculates days-in-status for each prospect
- Computes churn risk from last-purchase dates
- Identifies low-stock items and favorite categories
- Generates rule-based suggestions (e.g., "7 days no contact → contact now")

This keeps the night job fast and RAM-friendly. The LLM is only invoked for:
- Elaborating on patterns found by the analyzer
- Generating natural-language summaries

## MiNegocio Data Model (Firestore)

| Collection | Key Fields | Used For |
|------------|------------|----------|
| `prospects` | businessId, status, createdAt, log[] | Stagnation detection |
| `customers` | businessId, name | Churn analysis |
| `orders` | businessId, customerId, total, createdAt | Purchase patterns |
| `products` | businessId, name, stock, category | Upsell suggestions |
| `businesses` | settings.startsModule | Threshold configs |

## Night Job Flow

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

## Integration with MiNegocio Frontend

The `Recommendations.tsx` page in MiNegocio connects to NAS LLM Server's `/api/recommendations` endpoint. Each recommendation can be:
- **Acted** — marked as done
- **Dismissed** — hidden
- **Viewed** — opened for detail

## Telegram Reminders from Secretary Mode

When user says "recuerda pago de renta el 14 de cada mes" in secretary mode:
1. The chat handler detects "recuerda " prefix
2. Extracts title and date info
3. Creates reminder via minegocio_client.add_reminder()
4. Sends Telegram confirmation
5. Night job picks it up for recurrence tracking

## Pitfalls

1. **Firestore credentials on NAS** — the service account JSON must be mounted at `/app/config/service-account.json` and never committed to git. Add to `.gitignore`.

2. **SQLite write locking** — night job writes to SQLite while API may be reading. Use WAL mode: `PRAGMA journal_mode=WAL;`

3. **Telegram token in .env** — the `.env` file contains the real token. The `.env.example` should have empty values. Never commit `.env`.

4. **Large business datasets** — fetching all orders for a business with thousands of orders may be slow. Implement pagination or incremental sync.

5. **Timezone handling** — `createdAt` timestamps from Firebase are UTC. Convert to local time (America/Mexico_City) for display.

6. **Analyzer vs LLM** — analyzer is fast and deterministic. LLM is slow and costs RAM. Use analyzer for 95% of logic, LLM only for natural language elaboration.
