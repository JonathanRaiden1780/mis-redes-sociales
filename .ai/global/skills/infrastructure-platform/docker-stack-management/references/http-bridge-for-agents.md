# HTTP bridge for an agent service

The agent lives behind Telegram or `docker exec`. Apps need it over HTTP.
This is the pattern that connects both: a small HTTP server that invokes the
agent's binary per request, returning only the final text.

## When to use

A frontend (MiNegocio, FinanzApp, any web app) needs the agent's judgement, not
just a stored row. Two endpoints cover most cases:

| Endpoint | Input | Output |
|---|---|---|
| `POST /api/ask` | `{"prompt": "..."}` | `{"answer": "...", "elapsed_s": N}` |
| `POST /api/strategy` | structured business data | `{"answer": "...", "type": "strategy"}` |

## The core loop

```python
proc = subprocess.run(
    ["hermes", "-z", prompt],
    capture_output=True, text=True, timeout=300,
)
answer = proc.stdout.strip()
```

Key points:

- `hermes -z` (or `--oneshot`) prints **only** the final answer. No banner,
  no spinner, no tool previews. That is what you return to the caller.
- One request = one full agent turn. It is not cheap: 20-60 s is normal.
- Cap concurrency with a semaphore. The agent is single-threaded; three
  simultaneous requests is already a lot.

## Construction of domain prompts

Do **not** let the caller write the prompt. Each domain endpoint builds it from
structured data so the prompt is consistent:

```python
def build_customer_prompt(payload):
    return (
        f"Eres asesor de ventas. Dame una estrategia para {nombre} basada en "
        f"su historial de compras y su relación con el vendedor.\n\n"
        f"PERFIL DEL CLIENTE:\n"
        f"- frecuencia: cada {frequency_days} días\n"
        f"- días desde última compra: {days_since_last}\n"
        f"- vendedor: {seller_name}\n"
        ...
    )
```

The caller sends JSON; the bridge builds the prompt. That keeps the contract
stable and lets the caller be ignorant of prompting.

## Authentication

If `HERMES_API_TOKEN` is set, reject requests without
`Authorization: Bearer <token>`. If it is not set, the bridge is open — only
expose it on the internal Docker network in that case.

## CORS

Frontends call this from the browser. Send:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Content-Type, Authorization
```

## Failing gracefully

| Condition | HTTP | Body |
|---|---|
| Agent timeout | 504 | `{"error": "Hermes no respondió en Ns"}` |
| Agent busy | 503 | `{"error": "ocupado, reintenta"}` |
| Agent crashed | 500 | `{"error": "código N: ..."}` |
| Empty answer | 500 | `{"error": "respuesta vacía"}` |

## Invoking the agent from a scheduler

A scheduler that fires every hour should not send a fixed template. It should
ask the agent to decide:

```
POST /api/ask
{"prompt": "Tienes este recordatorio que vence el <fecha>: <título>. Avísame.
Si es un pago, un mensaje corto. Si requiere pensar (planear algo, revisar un
proyecto), resuélvelo y manda el resultado, no solo el aviso."}
```

Difference in practice:

| Reminder | Fixed template | Via agent |
|---|---|---|
| "Pagar la luz" | `⏰ Recordatorio: Pagar la luz` | Same short notice |
| "Idea plan for project X" | Same text you wrote | **A drafted plan** |

If the bridge is down, fall back to the fixed template — a simple notice is
better than none. Control with an env var so it can be disabled:

```
USE_HERMES_FOR_REMINDERS=true
```

## Why not reimplement the agent in the bridge?

The bridge is a **thin pipe**, not a reimplementation. It uses the installed
binary so the agent keeps its memory, skills, and tools. The bridge only:

1. Receives the HTTP request.
2. Builds the prompt from structured data.
3. Invokes the binary.
4. Returns the answer.

That means memory learned via Telegram is available to the HTTP callers too,
because it is the same agent process.
