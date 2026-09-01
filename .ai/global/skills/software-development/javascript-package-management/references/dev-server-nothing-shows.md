# Dev Server Debugging: "Nothing Shows" Pattern

**Signal:** User runs a local dev server but sees a blank page, the wrong app, or "nothing happens."

## The Port Conflict Trap

A dev server (Vite, Next, etc.) may start successfully on a port while a DIFFERENT service is already occupying that port. The dev server either fails silently, proxies to the wrong service, or the user sees the other service's UI.

### How to Diagnose

```bash
# Check what's actually listening on the port
lsof -i :3000 2>/dev/null | head -10
# or
ss -tlnp | grep 3000

# Curl the root and check the <title> — does it match your app?
curl -s http://localhost:3000/ 2>&1 | grep -E "title|root" | head -5
```

If the title/content doesn't match your app → **port conflict**.

### Common Culprits

- Open WebUI (commonly occupies :3000)
- Previous dev server instances that didn't shut down
- Docker containers mapped to the same port
- Other local development tools

### Fixes

```bash
# 1. Kill the conflicting process
lsof -i :3000 -t | xargs -r kill -9

# 2. Or use a different port in package.json
"dev": "vite --host 0.0.0.0 --port 5173"
```

## The "Long-Lived Server" Tool Trap

When you try `pnpm dev` in a foreground terminal, the tool will kill the server because it appears hung. This is correct behavior — dev servers are long-lived.

**Don't:** Repeatedly try running `pnpm dev` in foreground expecting output.
**Do:** 
- Use `background=true` for the dev server command
- Or verify the server is already running with `curl` / `lsof`
- Check if another service is occupying the port

## Blank Page (No Content at All)

If curl returns HTML but the page is blank in browser:

1. Check browser console for JavaScript errors (module resolution, CORS)
2. Verify the entry point is being served:
   ```bash
   curl -s http://localhost:3000/src/main.tsx | head -5
   ```
3. If main.tsx returns HTML (not JS) → the dev server is proxying to a fallback
4. Check vite.config.ts for proxy or historyApiFallback settings

## When Server Logs Look Fine But UI Is Blank

The server logs may show "ready in Xms" but the browser shows nothing. This usually means:
- The server IS running but on a different origin than expected
- The browser cached a previous blank state
- A service worker is interfering (check DevTools → Application → Service Workers)
- The HTML loads but React fails to mount (check for `#root` element and JS errors)

## Key Insight

**"Server started" ≠ "Your app is running."** Always verify by curling the root URL and confirming the content matches your application. A 200 OK response with the wrong `<title>` is a port conflict, not a successful startup.

## Real Example (MiNegocio, 2026-08-19)

Symptom: `pnpm dev` ran without error but the browser showed nothing.
Root cause: Open WebUI was occupying port 3000. `curl http://localhost:3000/` returned `<title>Open WebUI</title>` instead of the MiNegocio app.
Fix: `lsof -i :3000 -t | xargs kill -9` to free the port, then restart `pnpm dev`.
