# NAS Gateway Compatibility for Automation

Session: Architecture analysis for MiNegocio WhatsApp automations (August 2026)

## Context

Before building Firebase Functions for automation, we analyzed whether the existing NAS Gateway could host the automation engine instead. This avoids adding a new cloud service when existing infra suffices.

## NAS Gateway Architecture

```
nas-app-gateway/
├── server.js                 — Express app, port 8790
├── lib/
│   ├── httpAuth.js           — x-gateway-token verification
│   ├── firebaseAppRegistry.js — Multi-app Firebase Admin
│   └── loadGatewayConfig.js  — JSON config loader
├── modules/notifications/
│   ├── runNotificationsJob.js — Cron-style push notification job
│   ├── queryPendingNotifications.js
│   ├── sendFirebasePush.js   — FCM sender
│   └── markNotificationDelivery.js
└── package.json              — Node + Express + Firebase Admin
```

## Automation Readiness Assessment

| Requirement | Status | Notes |
|-------------|--------|-------|
| Scheduled execution | ✅ Ready | Add `node-cron` or system cron hitting endpoint |
| Firebase access | ✅ Integrated | Already uses Firebase Admin with multi-app support |
| Message history | ✅ Ready | Can query any Firestore collection |
| Push notifications | ✅ Working | Already sends FCM via existing job |
| WhatsApp integration | ✅ Ready | Can add wa.me link generation or API calls |
| Auth & security | ✅ Solid | Token-based, per-app isolation |

## Decision: NAS Gateway over Firebase Functions

**Choose NAS Gateway when:**
- You control the server (uptime is your responsibility)
- You want simpler deployment (one less cloud service)
- You already have Firebase Admin + Express patterns established
- Cost is a concern (Firebase Functions invocations vs fixed server cost)

**Choose Firebase Functions when:**
- You need zero-downtime guarantees
- You want automatic scaling
- You need multi-region deployment
- You don't want to manage server uptime

## Implementation Pattern

To add automation to NAS Gateway:

```javascript
// server.js — new endpoint
app.post('/jobs/automations/run', async (req, res) => {
  try {
    assertGatewayToken(req, TOKEN);
    const summary = await runAutomationJob({ adminApp, config });
    res.json({ ok: true, summary });
  } catch (error) {
    logger.error('automation job error', error);
    res.status(error.statusCode || 500).json({ ok: false, error: error.message });
  }
});
```

Cron scheduling options:
1. **node-cron** inside the server process (simple, same codebase)
2. **System cron** hitting the endpoint externally (decoupled, survives restarts)
3. **Firebase Scheduled Functions** (only if you already use Functions)

## Compatibility Notes

- NAS Gateway uses `x-gateway-token` header (not Bearer)
- Configs are JSON files in `/app/config/apps/`
- Firebase Admin apps are registered per `firebaseProjectId`
- Logs go to console (no structured logging yet — consider Pino or similar)

## Future Phases

Phase 2 (Automation Engine) should:
1. Build rules engine (IF-THEN evaluation)
2. Add `message_log` collection for tracking
3. Create `/jobs/automations/run` endpoint
4. Wire cron to hit it every 12h
5. Build UI for rule creation/editing

Phase 3 (WhatsApp Business API) would add:
1. Meta Cloud API client
2. Webhook handler for incoming messages
3. Queue system for rate limiting
4. Analytics tracking
