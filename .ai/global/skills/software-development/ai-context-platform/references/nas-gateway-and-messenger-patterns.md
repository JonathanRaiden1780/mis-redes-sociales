# NAS Gateway & Messenger Architecture Patterns

## NAS Gateway Architecture (Express + Firebase Admin)

When building self-hosted NAS services for a React+Firebase app, use this pattern discovered in MiNegocio:

```javascript
// server.js — NAS Gateway skeleton
import express from 'express';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = express();
app.use(express.json());

// Auth: shared token header
const assertGatewayToken = (req, token) => {
  const received = String(req.header('x-gateway-token') || '').trim();
  if (received !== String(token).trim()) {
    const err = new Error('Unauthorized.');
    err.statusCode = 401;
    throw err;
  }
};

// Firebase Admin init per-app (multi-tenant)
const getFirebaseAdminApp = (config) => {
  // Lazy-init from serviceAccountPath in config
};

// Cron jobs via node-cron
import cron from 'node-cron';
cron.schedule('0 */12 * * *', evaluateRules);
```

### Key decisions:
- **Port allocation**: 8790 (gateway), 8791 (automation), 8788 (OCR), 8787 (backup)
- **Auth**: `x-gateway-token` header — single token, rotated manually
- **Config**: JSON files in `/app/config/apps/` directory, hot-reloadable
- **Multi-tenant**: load service account per `appId` from request body
- **Cron**: node-cron (no external scheduler needed)

### When to use:
- Self-hosted jobs on Synology NAS or similar
- Push notification dispatch
- Scheduled automation evaluation
- Backup receiving

---

## Messenger Abstraction Layer (Provider Pattern)

When integrating WhatsApp (or other messengers), use a provider pattern so you can swap implementations without touching callers:

```typescript
// types.ts
export interface MessengerProvider {
  send(args: SendMessageArgs): Promise<SendResult>;
  sendBatch(args: SendMessageArgs[]): Promise<SendResult[];
}

export interface SendMessageArgs {
  phone: string;
  message: string;
  source: 'manual' | 'automation' | 'campaign';
  leadId?: string;
}

export interface SendResult {
  ok: boolean;
  method: 'wa.me' | 'whatsapp-api' | 'none';
  url?: string;
  error?: string;
}
```

### Providers:

1. **WaMeProvider** (free, now): `https://wa.me/{phone}?text={encoded}` — opens WhatsApp Web/App
2. **WhatsAppApiProvider** (future): Meta Cloud API — real delivery, requires token + business verification
3. **MockProvider** (dev/test): logs, doesn't send

### Factory:
```typescript
const getProvider = (): MessengerProvider => {
  return import.meta.env.VITE_WHATSAPP_PROVIDER === 'whatsapp-api'
    ? whatsAppApiProvider
    : waMeProvider;
};
```

### Mexican phone normalization:
```typescript
const normalizePhone = (phone: string): string => {
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.length === 10) return `52${cleaned}`;      // 5512345678 → 525512345678
  if (cleaned.length === 11 && cleaned.startsWith('1')) return `52${cleaned.slice(1)}`;
  if (cleaned.length === 12 && cleaned.startsWith('52')) return cleaned;
  return cleaned;
};
```

### When to use:
- Any WhatsApp integration
- Future messenger expansion (Telegram, SMS)
- Testing without sending real messages

---

## Automation Engine (IF-THEN Rules)

For scheduled automation without Firebase Functions:

```javascript
// Rule evaluation
const evaluateRules = async () => {
  const leads = await db.collection('leads').get();
  const rules = await db.collection('automation_rules')
    .where('enabled', '==', true).get();
  
  for (const lead of leads.docs) {
    for (const rule of rules.docs) {
      if (matchesTrigger(rule.trigger, lead) && 
          matchesConditions(rule.conditions, lead)) {
        await executeActions(rule.actions, lead);
      }
    }
  }
};

// Trigger types: status_changed, days_inactive, birthday, threshold_reached, post_conversion, scheduled
// Actions: send_whatsapp, send_push, add_bitacora, change_status, create_task, notify_admin
```

### Firestore collections for automations:
- `automation_rules` — rule definitions (per businessId)
- `message_log` — sent message history (leadId, phone, message, source, sentAt)

### When to use:
- Self-hosted automation without Firebase Functions costs
- IF-THEN logic for lead nurturing
- Batch processing on schedule

---

## Repo Separation Principle

When NAS services grow complex enough to have their own dependencies, lifecycle, and deployment cycle, split them into independent repos.

**Decision criteria:**
- **Separate repo**: services with different deployment cycles, different owners, or that need independent versioning
- **Same repo**: services that share auth patterns, are always deployed together, and have tightly coupled lifecycles (gateway + automation)

**Pattern (MiNegocio case):**
```
MiNegocio/                    (main app repo — public)
  ├── src/                    (React frontend)
  ├── functions/              (Firebase Functions)
  └── docs/                   (references to NAS repos)

nas-gateway/                  (independent repo — public)
  ├── gateway/                (port 8790 — push + app release)
  └── automation/             (port 8791 — IF-THEN rules)

nas-services/                 (independent repo — PRIVATE)
  ├── backup-server/          (port 8787 — receives backups)
  └── ocr-server/             (port 8788 — PDF invoice OCR)
```

**Why gateway + automation together:**
- Same auth pattern (`x-gateway-token`)
- Always deployed together on same NAS
- Gateway forwards push requests to automation engine
- Shared Firebase Admin initialization pattern
- Single docker-compose for both services

**Why backup + OCR separate (private):**
- Different security posture (backup receives user data, OCR processes PDFs)
- May have different compliance requirements
- Stable, rarely changes — doesn't need same iteration speed as gateway

**Cross-repo references:**
- Main app's `MASTERPROMPT.md` lists independent repos with their ports and paths
- Each repo has its own `.ai/` structure (via `ai init-project`)
- Shared types duplicated (keep simple) or use a shared types package (if complex)

### Recovering deleted files from git

If you accidentally delete a directory that exists in git history:
```bash
# Find the last commit that had the directory
git log --all --oneline -- path/to/directory/

# Restore from that commit
git checkout <commit> -- path/to/directory/
```

This is faster than re-creating from scratch and preserves the exact state.

---

## Pitfalls

- **NAS Gateway auth**: Don't forget `x-gateway-token` on every endpoint except `/health`
- **Phone normalization**: Mexican numbers need `52` prefix for wa.me; 10-digit local numbers are common
- **Cron in NAS**: Synology Task Scheduler can trigger endpoints, but node-cron is simpler for containerized deploys
- **Provider swap**: Always code against `MessengerProvider` interface, not concrete implementation
- **Message logging**: Log every send attempt to Firestore for audit trail, even wa.me (no delivery confirmation)
- **wa.me limitation**: No delivery confirmation, no read receipts — upgrade to WhatsApp API when those matter
