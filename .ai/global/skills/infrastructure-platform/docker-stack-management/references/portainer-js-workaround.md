# Portainer Script Injection Workaround

Portainer injects its own JavaScript files into served pages:
- `contentLogger.js`
- `polyfills.js`
- `contentScript.js`
- `detector.js`

These scripts **break inline JavaScript** in custom dashboards and web apps served through Portainer.

## Symptoms

```
Uncaught ReferenceError: showTab is not defined
Uncaught ReferenceError: loadAll is not defined
```

Even though the functions exist in the code, the page's JavaScript doesn't execute because Portainer's injected scripts corrupt the execution context.

## Root cause

Portainer's content scripts are designed for its own UI. When you serve a custom HTML page through Portainer (e.g., a Docker container's published port), Portainer injects these scripts into the response. They interfere with inline `<script>` tags.

## Solution

**Move all JavaScript to external files.**

```html
<!-- ❌ Inline JS — Portainer breaks this -->
<script>
  function showTab() { ... }
  function loadAll() { ... }
</script>

<!-- ✅ External file — Portainer doesn't touch this -->
<script src="app.js"></script>
```

## Serving external JS correctly

Your HTTP server must serve `.js` files with the correct Content-Type:

```python
if self.path == "/app.js":
    self._serve_file("app.js", "application/javascript")
```

Without `Content-Type: application/javascript`, browsers may refuse to execute the script.

## Verification

1. Check the browser's Network tab — `app.js` should return `200 OK` with `Content-Type: application/javascript`
2. Check the browser's Console — no more `ReferenceError` for your functions
3. Portainer's injected scripts (`contentLogger.js`, etc.) will still appear but won't interfere

## Alternative

If you must use inline JS, add a `Content-Security-Policy` header to block Portainer's scripts. However, this is fragile and may break Portainer's own UI. The external-file approach is recommended.
