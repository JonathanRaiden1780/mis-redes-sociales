---
name: react-firebase-features
description: "Use when building a React+Firebase feature module. Handles cache-first Firestore hooks, branch integration, multi-mode UI flows (basic/MK profile selection), lifecycle stage promotion, cross-tab action consistency, settings configuration (statuses, thresholds, strategies), WhatsApp messenger abstraction, and NAS Gateway automation compatibility."
---

# React+Firebase Feature Modules

Pattern for adding a complete feature to a React 19 + Firestore + Vite + Capacitor app. Based on MiNegocio conventions.

## Anatomy of a feature module

```
src/types/index.ts          — domain interfaces
src/lib/<feature>Configs.ts  — static config (statuses, strategies, defaults)
src/hooks/use<Feature>s.ts   — cache-first Firestore collection hook
src/components/<feature>/    — presentational components (Form, Detail, etc.)
src/pages/<Feature>.tsx      — main page component
src/App.tsx                  — route registration
firestore.rules              — collection permissions
src/components/layout/DashboardLayout.tsx — sidebar nav item
```

## Import path depth (CRITICAL)

Files at different directory depths use different relative import roots:

| Location | Import prefix |
|---|---|
| `src/pages/X.tsx` | `../lib/`, `../components/`, `../hooks/`, `../context/` |
| `src/components/X.tsx` | `../../lib/`, `../../types/`, `../../hooks/` |
| `src/hooks/X.tsx` | `../lib/`, `../types/` |
| `src/lib/X.tsx` | `./` (siblings) |

**Anti-pattern:** Creating a page with `../../` imports (works for components, breaks in pages). Always count from the file's actual location.

## Cache-first hook pattern

Follows the `useCacheFirstCollection` template. Query must be memoized with `useMemo`:

```typescript
const buildQuery = useMemo((): Query | null => {
  if (!businessId) return null;
  const constraints = [where('businessId', '==', businessId)];
  if (filter !== 'all') constraints.push(where('lifecycle', '==', filter));
  return query(collection(db, 'leads'), ...constraints, limit(500));
}, [businessId, filter]);

useEffect(() => {
  if (!enabled || !businessId) { setDocs([]); setLoading(false); return; }
  const q = buildQuery;
  if (!q) { setDocs([]); setLoading(false); return; }
  cancelledRef.current = false;
  setLoading(true);
  cacheFirstGetDocs('leads/list', q)
    .then(snap => {
      if (cancelledRef.current) return;
      const items = mapDocs(snap) as unknown as Array<WithId<Lead>>;
      items.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
      setDocs(items);
    })
    .finally(() => { if (!cancelledRef.current) setLoading(false); });
  return () => { cancelledRef.current = true; };
}, [enabled, businessId, filter, buildQuery]);
```

Key rules:
- **`buildQuery` must be `useMemo`, not a plain function** — ESLint `react-hooks/exhaustive-deps` will flag it otherwise
- **Sort after mapping** — `mapDocs` returns `WithId<DocumentData>`, cast and sort by timestamp
- **`cancelledRef` pattern** — prevents state updates after unmount
- **Reload from server** — expose `reloadFromServer` for post-write refreshes

## Stale alert pattern

Track inactivity per configurable threshold:

```typescript
const staleMap = useMemo(() => {
  const now = Date.now();
  const map: Record<string, boolean> = {};
  for (const lead of leads) {
    const status = STATUSES.find(s => s.id === lead.statusId);
    if (!status) continue;
    const threshold = status.daysUntilStale * 24 * 60 * 60 * 1000;
    map[lead.id] = (now - lead.lastActivityAt) > threshold;
  }
  return map;
}, [leads]);
```

Render with orange border + "Sin actividad reciente" banner when `staleMap[id]` is true.

## Sidebar nav registration

Add to `allNavItems` array in `DashboardLayout.tsx`:

```typescript
{ icon: UserPlus, label: 'Inicios', href: '/leads', roles: ['admin', 'seller'] },
```

Import the icon from `lucide-react` at the top of the file.

## Route registration

In `App.tsx`, wrap with `DashboardLayout`:

```typescript
<Route path="/leads" element={
  <DashboardLayout>
    <Leads />
  </DashboardLayout>
} />
```

## Firestore rules

Add collection before the catch-all deny:

```firestore
match /leads/{id} {
  allow read: if sameBusiness(resource.data);
  allow create: if sameBusiness(request.resource.data);
  allow update: if sameBusiness(resource.data) && sameBusiness(request.resource.data);
  allow delete: if isAdmin() && sameBusiness(resource.data);
}
```

## Lifecycle stage model

For funnel features (prospect → active → converted/lost):

```typescript
export type LeadLifecycleStage = 'prospect' | 'inicio' | 'converted' | 'lost';

export interface BitacoraEntry {
  id: string;
  type: 'note' | 'status_change' | 'strategy' | 'conversion' | 'loss';
  content: string;
  fromStatus?: string;
  toStatus?: string;
  authorUid?: string;
  authorName?: string;
  createdAt: number;
}
```

**Conversion pattern:** Create the target entity first (e.g. customer), then update the lead with `convertedToCustomerId` and append a `conversion` bitacora entry. This preserves the audit trail.

## Lifecycle stage promotion (Prospect → Inicio)

For funnel features with lifecycle stages (prospect → inicio → converted → lost), use a dedicated "promote" action rather than just status changes when moving between stages:

- **Confirmation dialog** prevents accidental transitions
- **Bitácora entry** preserves audit trail of the promotion
- **Tab-scoped button** — "Promover a Inicio" only appears on `prospect` tab
- **Why not just status change?** Promotions are significant funnel events that need explicit tracking and user intent

**Pitfall:** Don't conflate lifecycle stages with status. A lead can be `prospect` lifecycle with status `listo_para_iniciar`. Promotion changes the lifecycle (which tab it appears in), not the status (sales process position). See `references/lifecycle-promotion.md`.

## Lifecycle-specific statuses

Different lifecycle stages often need different status vocabularies:

- **Prospect:** nuevo, contactado, interesado, en_seguimiento, listo_para_iniciar, no_responde, no_interesado
- **Inicio:** activo, pausa, primera_compra, recurrente, en_riesgo, inactivo

Use `getStatusesForLifecycle(activeTab)` everywhere status options appear (filter dropdown, status change select, badge rendering, stale detection). See `references/lifecycle-statuses.md`.

## Cross-tab functionality consistency

When a lifecycle-based page has multiple tabs (prospect, inicio, converted, lost), the **same action handlers** must work across ALL tabs — not just the active one:

| Tab | Status Change | Bitácora | Estrategias | Convert to Client | Mark as Lost |
|-----|---------------|----------|-------------|-------------------|--------------|
| prospect | ✅ | ✅ | ✅ | ✅ | ✅ |
| inicio | ✅ | ✅ | ✅ | ✅ | ✅ |
| converted | ✅ | ✅ | ✅ | ❌ | ❌ |
| lost | ✅ | ✅ | ✅ | ❌ | ❌ |

**Key insight:** Status change, bitacora, and strategies remain accessible even on terminal tabs (converted/lost) so users can still annotate and reclassify. Only the destructive/state-changing actions (convert, mark as lost) are hidden on terminal tabs.

```typescript
const canModify = activeTab !== 'converted' && activeTab !== 'lost';
```

**Pitfall:** Don't wrap the entire action bar in `canModify` — that would hide bitácora and strategies from converted/lost leads. See `references/cross-tab-actions.md`.

## AIEP Bridge integration (multi-agent context sharing)

When building features that need to share context across multiple IAs (Hermes, Claude Code, Codex, Aider), use AIEP as the central hub:

- **HermesBridge**: imports Hermes skills + memory into AIEP vault
- **IA Bridge**: propagates rules from any IA to all others
- **Auto-sync**: after every `ai` command, skills/memory/rules sync automatically

**Key insight:** When a user tells ANY IA "always do X", that rule propagates to ALL other IAs via AIEP.

See `references/aiep-bridge.md`.

## Separating NAS services into independent repos

When a monorepo has NAS services (gateway, automation, backup, OCR), split them:

| Service | Visibility | Repo |
|---------|------------|------|
| Gateway + Automation | Public | `nas-gateway` |
| Backup + OCR | **Private** | `nas-services` |

**Why:** Backup/OCR handle sensitive data. Gateway/automation are generic/reusable.

See `references/nas-repo-separation.md`.

When providing predefined marketing strategies to apply against leads, offer multiple delivery modes — not just "apply":

| Mode | Behavior |
|------|----------|
| **Copy** | Copy template to clipboard with visual feedback |
| **Send** | Open WhatsApp with pre-filled message (`wa.me/<phone>?text=<encoded>`) |
| **Personalize** | Edit template inline before sending |
| **Custom** | Write from scratch with client name pre-filled |

**Props:** Include `leadPhone` alongside `leadName` so WhatsApp can deep-link directly to the client's chat.

**Pitfall:** Don't auto-send on strategy selection. Users expect to control when a message goes out. Auto-send is aggressive and reduces trust.

See `references/strategy-library.md`.

## Settings configuration for lifecycle-based features

When a feature has multiple lifecycle stages, settings should provide:

1. **Separate status configurations per lifecycle** — each gets its own tab with independent CRUD
2. **Threshold configuration** — multiple inactivity thresholds with notifications
3. **Tab structure:** Prospectos, Inicios, Sugerencias, Umbrales, Estrategia

See `references/settings-thresholds.md`.

## WhatsApp Messenger abstraction

For features that need to send messages to clients, build a provider-pattern messenger layer rather than hardcoding a single delivery method:

```typescript
// src/lib/messenger/types.ts
export interface SendMessageArgs {
  phone: string;           // E.164 format
  message: string;
  source: 'manual' | 'automation' | 'campaign';
  leadId?: string;
}

export interface SendResult {
  ok: boolean;
  method: 'wa.me' | 'whatsapp-api' | 'none';
  url?: string;            // wa.me URL for manual mode
  error?: string;
}

export interface MessengerProvider {
  send(args: SendMessageArgs): Promise<SendResult>;
  sendBatch(args: SendMessageArgs[]): Promise<SendResult[]>;
}
```

### Provider implementations:

| Provider | Use case | Auth required |
|----------|----------|---------------|
| `waMeProvider` | Free, opens WhatsApp Web/App with pre-filled message | None |
| `whatsAppApiProvider` | Real send via Meta Cloud API | Token + Business verification |

### Mexican phone normalization:

```typescript
const normalizePhone = (phone: string): string => {
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.length === 10) return `52${cleaned}`;        // 5512345678 → 525512345678
  if (cleaned.length === 11 && cleaned.startsWith('1')) return `52${cleaned.slice(1)}`;
  if (cleaned.length === 12 && cleaned.startsWith('52')) return cleaned;
  return cleaned;
};
```

### Integration points:

- **Strategy Library**: Pass `leadPhone` alongside `leadName` for direct WhatsApp deep-link
- **Message logging**: Record every send attempt in `message_log` collection
- **Environment switching**: `VITE_WHATSAPP_PROVIDER=wa-me` or `whatsapp-api`

See `references/whatsapp-messenger.md`.

## NAS Gateway compatibility for backend automation

When planning server-side automation (cron jobs, rule engines), verify whether the existing NAS Gateway can host it:

| Criteria | NAS Gateway |
|----------|-------------|
| Runtime | Node.js + Express |
| Port | 8790 |
| Auth | `x-gateway-token` header |
| Firebase | Firebase Admin already integrated |
| Cron | Add scheduled endpoint (node-cron) |
| Push | FCM already working |

**Decision rule:** If NAS Gateway has Firebase Admin + Express, prefer adding endpoints there over Firebase Functions for simpler deployment. Use Firebase Functions only when you need zero-downtime guarantees or multi-region.

See `references/nas-gateway-automation.md`.

### Cross-tab functionality consistency

| Tab | Editar | Status Change | Bitácora | Estrategias | Convert to Client | Mark as Lost |
|-----|--------|---------------|----------|-------------|-------------------|--------------|
| prospect | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| inicio | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| converted | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| lost | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

```typescript
const canModify = activeTab !== 'converted' && activeTab !== 'lost';
```

## NAS Synchronization Pattern (NEW 2026-08-20)

When NAS services exist both in production (NAS share) and in repos, maintain bidirectional sync:

### Direction 1: NAS → Repo (production is source of truth)
```bash
# Sync production configs/scripts back to repo
cp "/nas/share/run-notifications-repo.sh" repo/gateway/
cp -r "/nas/share/data/." repo/backup-server/

# Update repo docker-compose with production values
```

### Direction 2: Repo → NAS (new features go to production)
```bash
# Copy new service to NAS
mkdir -p "/nas/share/nas-automation-engine"
cp -r repo/automation/* "/nas/share/nas-automation-engine/"

# Create unified docker-compose on NAS
```

### Key files to sync:
| File | Direction | Reason |
|------|-----------|--------|
| `run-notifications-job.sh` | NAS → Repo | Production script may differ from repo |
| `data/` directories | NAS → Repo | Production data for testing |
| `automation/` | Repo → NAS | New service from repo to production |
| `docker-compose.yml` | Both | Unified on NAS, split in repos |

### Verification:
```bash
# Compare structures
diff <(ls /nas/share/service/) <(ls repo/service/)

# Validate docker-compose
python3 -c "import yaml; yaml.safe_load(open('docker-compose.yml'))"
```

**Pitfall**: Don't delete NAS node_modules for practical reasons — they're needed for production. Just don't commit them to git.

See `references/nas-sync-pattern.md`.

## NAS Infrastructure Architecture (NEW 2026-08-20)

The NAS runs a unified infrastructure managed via `nas-infrastructure` repo at `~/proyectos/nas-infrastructure/`.

### Service Inventory (12 services):
| Service | Port | Repo Location |
|---------|------|---------------|
| Cloudflare tunnel | — | `nas-infrastructure` |
| Tailscale | — | `nas-infrastructure` |
| **Portainer CE** | 9000 | `nas-infrastructure/portainer/` |
| nas-app-gateway | 8790 | `nas-infrastructure/core/nas-app-gateway/` |
| nas-automation-engine | 8791 | `nas-infrastructure/core/nas-automation-engine/` |
| nas-backup-server | 8787 | `nas-infrastructure/core/nas-backup-server/` |
| nas-ocr-server | 8788 | `nas-infrastructure/core/nas-ocr-server/` |
| Home Assistant | 8123 | `nas-infrastructure/homeassistant/` |
| Navidrome | 4533 | `nas-infrastructure/media/` |
| Music syncer | 8088 | `nas-infrastructure/media/` |
| Picard | 5800 | `nas-infrastructure/media/` |
| Telegram downloader | 5027 | `nas-infrastructure/utilities/` |

### Portainer CE Setup:
```yaml
# portainer/docker-compose.yml
services:
  portainer:
    image: portainer/portainer-ce:latest
    container_name: portainer
    restart: unless-stopped
    ports:
      - "9000:9000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - portainer_data:/app/data
```

Access: `http://<nas-ip>:9000` — manages all Docker containers on the NAS.

### Automation Engine (nas-automation-engine):
IF-THEN rule engine with:
- **Triggers**: `days_inactive`, `threshold_reached`
- **Conditions**: `lifecycle`, `status`
- **Actions**: `send_whatsapp`, `add_bitacora`, `change_status`, `send_push`
- **Cron**: Every 12h (configurable via `CRON_SCHEDULE`)
- **Endpoints**: `/health`, `/jobs/automations/run`, `/rules`

### Unified docker-compose on NAS:
Single file at `~/proyectos/nas-infrastructure/docker-compose.yml` controls all 12 services. Deploy with:
```bash
cd ~/proyectos/nas-infrastructure
docker compose up -d --build
```

Or via Portainer → Stacks → Add Stack.

See `references/nas-infrastructure-setup.md`.
2. **Import depth** — Count from the file's actual location, not from where similar files live. Files moved between `pages/` and `components/` need import path updates.
3. **ESLint exhaustive-deps** — Query builders used in useEffect must be `useMemo`, not plain functions.
4. **mapDocs casting** — `mapDocs` returns `WithId<DocumentData>`; cast `as unknown as Array<WithId<T>>` when the linter complains.
5. **Missing `cancelledRef`** — Always guard async callbacks with `if (cancelledRef.current) return` before setState.
6. **Firestore rules catch-all** — The `match /{document=**}` deny-all must come AFTER all specific collections.
7. **Error messages** — Always surface the specific Firebase error (`error instanceof Error ? error.message : 'unknown'`) rather than generic "Error" alerts. Helps user diagnose (e.g., missing `businessId` in user doc, permission denied).
8. **Branch integration** — When two branches modify the same files (`DashboardLayout.tsx`, `navItems.tsx`, `App.tsx`), expect conflicts. Use `git merge --no-commit --no-ff` to preview, then resolve manually.
9. **useEffect callback dependency loop** — When a `useEffect` depends on functions passed as props/callbacks that are recreated each render (e.g., `setSalesNote`, `setSchedule`), the effect re-runs infinitely. **Fix:** Store callbacks in `useRef` to hold stable references. See `references/infinite-loop-debugging.md`.
10. **Cross-tab functionality consistency** — When a lifecycle-based page has multiple tabs (prospect, inicio, converted, lost), the same action handlers (status change, bitacora, strategies, convert to client, mark as lost) must work across ALL tabs — not just the active one. Use `canModify = activeTab !== 'converted' && activeTab !== 'lost'` to conditionally hide convert/mark-lost buttons on terminal tabs, but keep status change and bitacora accessible everywhere. See `references/cross-tab-actions.md`.
11. **ESLint react-refresh for non-component exports** — Files that export constants, configs, or hooks alongside components trigger `react-refresh/only-export-components`. Add `// eslint-disable-next-line react-refresh/only-export-components` directly above the offending export.
12. **Lifecycle vs Status confusion** — Lifecycle stages (prospect/inicio/converted/lost) determine which tab a lead appears in. Status (nuevo/contactado/interesado/etc.) reflects where they are in the sales process. A lead can be `prospect` lifecycle with status `listo_para_iniciar`. Use dedicated "promote" actions to move between lifecycle stages, not just status changes. See `references/lifecycle-promotion.md`.

13. **Firestore Timestamp date math** — Never treat Firestore Timestamps as raw numbers for date arithmetic. They are objects with `toDate()` and `seconds` properties. Use a helper that handles multiple Timestamp formats (live objects, serialized objects, plain numbers). See `references/days-since-created-firestore.md`.

14. **Settings: separate lifecycle configs** — When a feature has multiple lifecycle stages (prospect, inicio), settings must provide separate status configurations for each. Don't share status arrays between lifecycles — they have different vocabularies. Use `prospectStatuses` and `inicioStatuses` as separate fields in the settings interface. See `references/settings-thresholds.md`.

15. **Settings: threshold configuration** — For inactivity alerts, provide multiple configurable thresholds (not just one `stagnationDays`). Each threshold has: label, days, notify toggle, color. Users want granular control over when alerts fire (e.g., yellow at 5 days, orange at 10, red at 14). See `references/settings-thresholds.md`.
16. **WhatsApp: don't auto-send** — Always let the user see the message before sending. Auto-send via API is aggressive and reduces trust. Use `wa.me` links (user taps send) unless the user explicitly opts into automated sending. See `references/whatsapp-messenger.md`.
17. **Phone number normalization** — Mexican numbers come in many formats (10-digit local, 11-digit with cell prefix, 12-digit E.164). Always normalize before building `wa.me` links. See `references/whatsapp-messenger.md`.
18. **NAS Gateway vs Firebase Functions** — Before adding Firebase Functions for automation, check if the existing NAS Gateway (Express + Firebase Admin) can host the logic. It's simpler to deploy and already has auth + Firebase integrated. See `references/nas-gateway-automation.md`.

19. **No npm (user rule)** — `npm` is NOT a supported package manager anywhere in this project. Only `pnpm`, `bun`, and `yarn` are allowed. The Android publish script's `--package-manager` flag and auto-detection both exclude `npm`. See `references/android-publish-script.md`.

20. **Run Python scripts with python3, not bash source** — `scripts/publish_android_zip.py` is a Python script. Running `. publish_android_zip.py` (bash source) fails with "No se ha encontrado la orden `from`". Always use `python3 scripts/publish_android_zip.py`. The script auto-loads `.env` from project root or `~/.env`. See `references/android-publish-nas-push.md`.

21. **NAS Gateway 404 on push = missing endpoint** — If `/jobs/app-release/notify` returns 404, the deployed gateway code doesn't have that route. Fix: add the endpoint to `server.js`, update `buildServerRoutes()`, rebuild container. See `references/android-publish-nas-push.md`.

22. **NAS Gateway .env corruption** — The `.env` file on the NAS gateway can get corrupted with duplicate lines when using `echo >>` repeatedly. Validate with `cat /volume1/services/core/nas-app-gateway/.env`. If corrupted (no `=` on lines, duplicate tokens), rewrite cleanly with `cat > .env << 'EOF'` format. See `references/android-publish-nas-push.md`.

23. **Android publish `--push-only` flag** — To deploy without recompiling (uses existing APK), use `python3 scripts/publish_android_zip.py --push-only`. Useful when only metadata or NAS push needs to happen. See `references/android-publish-nas-push.md`.

24. **Dockerfile: `npm ci` vs `npm install`** — Use `npm install --omit=dev` not `npm ci --production`. `npm ci` requires `package-lock.json` which may not exist, causing build failure. See `references/nas-infrastructure-setup.md`.

20. **CI/CD for multi-repo projects** — When the user asks for security scanning + PR review as GitHub Actions across multiple repos, use a single reusable workflow file (`.github/workflows/security-quality-gate.yml`) that combines: secret detection (grep-based, NOT gitleaks/CodeQL which require GitHub Advanced Security for private repos), dependency audit, lint/typecheck/test/build quality gates, Docker scan (Trivy), and a PR auto-review bot. Copy the same file to every repo. **CRITICAL:** The workflow file MUST exist on the base branch (`develop`/`main`) BEFORE creating PRs — GitHub only runs workflows that exist on the base branch. Push CI/CD infrastructure directly to the default branch, not through feature branches. **`hashFiles()` cannot be used in job-level `if:` conditions** — it's only valid in step-level `if:`. Use file existence checks in `run:` steps instead. See `references/multi-repo-cicd.md`.

21. **Firestore backward compatibility** — When changing data structures in Firestore, old documents retain the field names. Add normalization at the hook level to handle both old and new field names:
```typescript
const normalized = initial
  ? {
      ...initial,
      prospectStatuses: initial.prospectStatuses ?? (initial as unknown as { statuses: ProspectStatusDefinition[] }).statuses ?? [],
      inicioStatuses: initial.inicioStatuses ?? [],
      thresholds: initial.thresholds ?? [],
    }
  : DEFAULT_STARTS_SETTINGS;
```
**Pitfall:** Don't just update the type — old Firestore documents will crash the app at runtime. See `references/firestore-backward-compat.md`.

**CRITICAL:** Normalize in BOTH the initial state AND the useEffect that updates from Firestore. Missing either causes runtime crashes with "statuses is not iterable" or "Cannot read properties of undefined (reading 'length')". See `references/settings-lifecycle-tabs.md`.

## References

- `references/leads-module-session.md` — full session transcript of building the Inicios/Prospects module (Session 1: basic module, Session 2: detail view, status change, general strategies)
- `references/starts-integration-session.md` — integrating divergent branches, profile type selection, error handling
- `references/infinite-loop-debugging.md` — debugging useEffect infinite loops in React+Firebase hooks
- `references/expandable-detail-cards.md` — pattern for full-width expandable cards with detail view, status change, and timeline
- `references/cross-tab-actions.md` — ensuring actions work across all lifecycle tabs (prospect, inicio, converted, lost)
- `references/lifecycle-promotion.md` — dedicated "promote" action for moving leads between lifecycle stages with confirmation + bitácora entry
- `references/days-since-created-firestore.md` — handling Firestore Timestamp objects for date difference calculations
- `references/strategy-library.md` — multi-action strategy picker with clipboard, WhatsApp, personalize, and custom modes
- `references/lifecycle-statuses.md` — lifecycle-specific status models (prospect vs inicio vocabularies)
- `references/settings-thresholds.md` — configurable inactivity thresholds with notifications for lifecycle-based features
- `references/settings-lifecycle-tabs.md` — settings page with tabs for each lifecycle stage (prospectos, inicios, sugerencias, umbrales, estrategia)
- `references/aiep-bridge.md` — multi-agent context sharing via AIEP (Hermes Bridge, IA Bridge, auto-sync)
- `references/nas-repo-separation.md` — when and how to separate NAS services into independent repos
See `references/whatsapp-messenger.md` — provider-pattern messenger layer for wa.me and future Meta Cloud API
- `references/nas-gateway-automation.md` — NAS Gateway compatibility assessment for hosting automation logic
- `references/nas-infrastructure-setup.md` — complete NAS infrastructure: 12 services, Portainer CE, automation engine, unified docker-compose, Dockerfile best practices, troubleshooting
- `references/nas-sync-pattern.md` — bidirectional sync between NAS production share and code repos
- `references/typescript-type-migration.md` — resolving cascading TS2339/TS2322/TS2741 errors when refactoring shared interfaces
- `references/android-publish-nas-push.md` — Android APK publishing via Python script + NAS Gateway push notifications, .env loading, Portainer issues, build troubleshooting
- `references/multi-repo-cicd.md` — reusable GitHub Actions workflow for security scanning + quality gates across multiple repos
