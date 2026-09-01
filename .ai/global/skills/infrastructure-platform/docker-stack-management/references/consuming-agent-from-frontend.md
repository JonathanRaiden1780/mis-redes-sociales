# Consuming the agent from a web frontend

Frontends (React, Vue, Svelte) need the agent's judgement. This reference covers
the patterns for calling the bridge from a browser.

## The base pattern

```typescript
const res = await fetch(`${VITE_HERMES_URL}/api/ask`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${VITE_HERMES_TOKEN}`,
  },
  body: JSON.stringify({ prompt: 'your question' }),
});

const { answer, elapsed_s } = await res.json();
```

## Handling the latency

A single call is a full agent turn. 20-60 s is normal. In the UI:

```tsx
const [loading, setLoading] = useState(false);
const [result, setResult] = useState('');

async function ask(prompt: string) {
  setLoading(true);
  try {
    const res = await fetch(`${HERMES_URL}/api/ask`, { ... });
    const { answer } = await res.json();
    setResult(answer);
  } finally {
    setLoading(false);
  }
}

// In the JSX:
{loading && <Spinner text="Analizando…" />}
```

## Handling 503 (agent busy)

`MAX_CONCURRENT` caps simultaneous requests. A 503 means "retry":

```ts
if (res.status === 503) {
  await new Promise(r => setTimeout(r, 5000));
  return retry();  // with a max retry count
}
```

## Domain endpoints: structured data in, strategy out

Do **not** let the caller write the prompt. Build domain endpoints that accept
structured JSON:

```typescript
// Business strategy
await fetch(`${HERMES_URL}/api/strategy`, {
  method: 'POST',
  body: JSON.stringify({
    business_name: 'MiNegocio MK',
    monthly_sales: '$45,000',
    top_products: 'Shampoo reparador, Kit completo',
    low_stock: 'Acondicionador (3 piezas)',
  }),
});

// Customer insight — the key case
await fetch(`${HERMES_URL}/api/customer-insight`, {
  method: 'POST',
  body: JSON.stringify({
    customer_name: 'María López',
    purchase_frequency_days: 21,
    days_since_last: 45,
    favorite_products: 'Shampoo reparador, Acondicionador',
    seller_name: 'Juan',
    purchase_history: [
      { date: '2026-07-10', items: 'Shampoo x2', total: '$400' },
      { date: '2026-06-18', items: 'Kit completo', total: '$890' },
    ],
  }),
});
```

## CORS

The bridge sends permissive CORS headers so browser apps can call it. This is
required because the frontend origin differs from the bridge origin.

## What fields to send

For customer insight, the more the better. Key fields:

| Field | Why it matters |
|---|---|
| `purchase_frequency_days` | Without this, cannot say *when* to contact |
| `days_since_last` | Detects cooling/churn |
| `purchase_history` | Reveals pattern and ticket trend |
| `favorite_products` | Makes the offer coherent |
| `seller_name` | Directs the action to a person |

## Error responses

| HTTP | Meaning | Action |
|---|---|---|
| 200 | Success | Display `answer` |
| 400 | Missing field | Check the payload |
| 401 | Bad/missing token | Check `Authorization` header |
| 500 | Agent crashed | Show generic error, log detail |
| 503 | Agent busy | Retry with backoff |
| 504 | Agent timeout | Retry or show timeout message |
