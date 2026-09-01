# Dashboard: Endpoint Cards with Collapsible Sections

Pattern for service monitoring dashboards where each card shows endpoints
in a collapsible section to avoid overwhelming the user with 30+ buttons
per card.

## The Problem

When Frigate's endpoint catalog has 12+ routes per service, showing all
buttons by default makes the cards tall and the page unusable. The solution:
show only what's essential in the card footer, expand on click.

## The Fix

Each card has:
1. **Main row**: icon, name, status, port
2. **Footer**: link to open service (↗), expand button (▼ N endpoints)
3. **Hidden div**: endpoints appear when expanded

```javascript
function renderCard(s) {
  const endpoints = API_CATALOG[s.id]?.endpoints || [];
  
  let expandBtn = '';
  let endpointsHtml = '';
  
  if (endpoints.length) {
    expandBtn = `<button class="expand-btn" onclick="toggleExpand('${s.id}', this)">
      ▼ ${endpoints.length} endpoints</button>`;
    
    endpointsHtml = `<div class="card-expand-content" id="expand-${s.id}">
      <div class="endpoints">
        ${endpoints.map(ep => `
          <button class="endpoint-btn verb-${ep.method}" 
                  onclick="testEndpoint('${url}', '${ep.method}')">
            <span class="ep-verb">${ep.method}</span>${ep.path}
          </button>`).join('')}
      </div></div>`;
  }

  return `<div class="service-card">
    <div class="card-main">...</div>
    <div class="card-footer">
      ${linkBtn} ${errorMsg} ${expandBtn}
    </div>
    ${endpointsHtml}
  </div>`;
}

function toggleExpand(id, btn) {
  const content = document.getElementById(`expand-${id}`);
  if (content.classList.contains('open')) {
    content.classList.remove('open');
    btn.classList.remove('active');
    btn.textContent = `▼ ${content.querySelectorAll('.endpoint-btn').length} endpoints`;
  } else {
    content.classList.add('open');
    btn.classList.add('active');
    btn.textContent = '▲ ocultar';
  }
}
```

## Cache Busting for JS Updates

When updating `app.js`, browsers may serve the cached version. Force a
reload by adding a query string:

```html
<script src="/app.js?v=3"></script>
```

Increment the version on each major JS update.

## No-cache Headers for HTML/JS

If the dashboard HTTP server serves `app.js` and `html` files, add:

```python
def _serve_file(self, filename, content_type):
    fpath = Path(__file__).parent / filename
    if not fpath.exists():
        self._send_json({"error": f"{filename} not found"}, status=404)
        return
    body = fpath.read_bytes()
    self.send_response(200)
    self.send_header("Content-Type", content_type)
    # No cache for HTML and JS
    if filename.endswith(('.html', '.js')):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
    self.send_header("Content-Length", str(len(body)))
    self.end_headers()
    self.wfile.write(body)
```

## Portainer Script Injection

Portainer injects its own scripts (`contentLogger.js`, `polyfills.js`,
`contentScript.js`, `detector.js`) into served pages. This breaks inline
JavaScript. The fix: move all JS to an external file (`app.js`) and serve
it with correct Content-Type.

**Symptom:** `Uncaught ReferenceError: showTab is not defined` even though
the function exists in the code.

**Solution:** External JS file + no-cache headers.
