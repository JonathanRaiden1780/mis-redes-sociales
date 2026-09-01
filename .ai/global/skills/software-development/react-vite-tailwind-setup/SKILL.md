---
name: react-vite-tailwind-setup
description: Set up React + Vite + Tailwind CSS.
version: 1.0.0
author: Hermes Agent
license: MIT
tags: [react, vite, tailwind, frontend, setup, pnpm, css]
platforms: [linux, macos, windows]
triggers:
  - create a react project
  - setup vite and tailwind
  - configure tailwind css
  - css not loading in react
  - styles not rendering
---

# React + Vite + Tailwind CSS Setup

Complete setup guide for a React + Vite + Tailwind CSS project. Covers the most common pitfall: CSS not rendering because the stylesheet wasn't imported or PostCSS wasn't configured.

## Critical Pitfall: CSS Won't Render Without These Steps

The #1 reason Tailwind/custom CSS doesn't render in a Vite + React project is missing one of these requirements:

1. **Import CSS in entry point** — `main.tsx` must `import './styles.css'`
2. **CSS must be imported with `@import "tailwindcss"`** — NOT `@tailwind base/components/utilities`
3. **Vite must have the React + Tailwind plugins** — via `@tailwindcss/vite` (Tailwind v4)

If your page renders unstyled (no colors, no layout, no gradients), check all three before debugging anything else.

## Setup Steps

### 1. Create Project

```bash
pnpm create vite@latest my-app -- --template react-ts
cd my-app
```

**Use `react-ts` template, NOT `react`.** The TS template includes proper type setup.

### 2. Install Dependencies

```bash
# Always use pnpm, not npm
pnpm install

# Tailwind CSS v4 (uses built-in PostCSS — NO separate postcss.config.js needed)
pnpm install -D tailwindcss @tailwindcss/vite

# Vite React plugin
pnpm install -D @vitejs/plugin-react
```

**Tailwind CSS v4 eliminates the need for postcss.config.js and tailwind.config.js.** It uses a Vite plugin instead.

### 3. Configure vite.config.ts with Tailwind v4 plugin

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
})
```

**Do NOT create postcss.config.js or tailwind.config.js separately** — Tailwind v4 uses inline configuration via the Vite plugin.

### 4. Create src/client/styles.css

```css
@import "tailwindcss";

/* Custom CSS variables and base styles */
:root {
  --bg: #0a0a0a;
  --surface: #111111;
}

body {
  background: var(--bg);
  color: #e4e4e4;
  font-family: 'Inter', sans-serif;
}
```

### 5. Import CSS in main.tsx (CRITICAL)

```tsx
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'  // ← THIS IS REQUIRED

createRoot(document.getElementById('root')!).render(<App />)
```

### 6. Create index.html

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>App Title</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/client/main.tsx"></script>
</body>
</html>
```

### 7. TypeScript Config

For Vite React TS projects, ensure `tsconfig.json` uses `moduleResolution: "bundler"` and includes `"types": ["vite/client"]`.

### 8. Vite Config with Proxy (if using backend)

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
```

## package.json Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

## CSS Not Rendering? Checklist

If styles don't appear:

| Check | Fix |
|-------|-----|
| `import './styles.css'` in main.tsx | Add the import |
| `@import "tailwindcss"` in styles.css | Must use `@import`, NOT `@tailwind` directives |
| `@tailwindcss/vite` plugin in vite.config.ts | Tailwind v4 uses Vite plugin, not postcss.config.js |
| Vite dev server running | Restart after config changes |
| Browser cache | Hard refresh: Ctrl+Shift+R |

## Common Mistakes

1. **Forgetting CSS import** — The most common error. Vite doesn't auto-import CSS. You must explicitly `import './styles.css'` in the entry point.

2. **Using `@tailwind` directives** — Tailwind v4 uses `@import "tailwindcss"`, NOT `@tailwind base/components/utilities`.

3. **Creating postcss.config.js** — Tailwind v4 has built-in PostCSS via `@tailwindcss/vite`. Creating a separate postcss.config.js can cause conflicts.

4. **Using npm instead of pnpm** — Some projects require pnpm. Check existing lockfiles. If `pnpm-lock.yaml` exists, use `pnpm install`.

5. **Not restarting dev server** — After changing vite.config.ts or styles.css, restart Vite.

## Verification

After setup, verify styles work:

```bash
pnpm dev
```

Check:
- Background color applies
- Tailwind classes work (e.g., `className="bg-red-500"`)
- Custom CSS variables apply
- No console errors about CSS files
