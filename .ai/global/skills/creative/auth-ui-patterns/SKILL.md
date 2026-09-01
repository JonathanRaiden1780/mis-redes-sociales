---
name: auth-ui-patterns
description: "Auth UI patterns: split-screen, social login, form design."
version: 1.0.0
author: Hermes Agent
license: MIT
tags: [auth, login, register, ui, design, split-screen]
platforms: [linux, macos, windows]
triggers:
  - build a login page
  - create auth screen
  - design registration flow
  - login UI
  - auth layout
  - split-screen auth
---

# Auth UI Patterns

Proven patterns for authentication screens, extracted from production apps (MiNegocio, PlayScore).

## Pattern 1: Split-Screen Auth (Recommended for SaaS)

Two-panel layout: form on left, visual showcase on right.

### Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Form Panel (40-45%)        │  Visual Panel (55-60%)       │
│                             │                               │
│  ┌─────────────────────┐   │  ┌─────────────────────────┐ │
│  │ Logo                │   │  │ Gradient background     │ │
│  │ Title               │   │  │ Animated blob shapes    │ │
│  │ Subtitle            │   │  │ Mockup/preview card     │ │
│  │                     │   │  │                         │ │
│  │ [Input fields]      │   │  │ "Headline text"         │ │
│  │ [Primary button]    │   │  │ Description text        │ │
│  │ [Divider]           │   │  │                         │ │
│  │ [Social buttons]    │   │  │                         │ │
│  └─────────────────────┘   │  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Left Panel (Form)
- White/light background
- Centered form with max-width ~360px
- Logo/brand mark at top
- Large title (3xl-4xl, extrabold, tight tracking)
- Subtitle in muted gray
- Input fields with icons, rounded-xl, focus ring
- Primary button with shadow
- Divider with "O continúa con"
- Social login buttons (Google, Apple)

### Right Panel (Visual)
- Hidden on mobile (`hidden lg:block`)
- Dark gradient background (indigo → purple → slate)
- Noise texture overlay (`grainy-gradients.vercel.app/noise.svg`)
- Animated blob shapes with `mix-blend-screen` and `blur-[100px]`
- Glass card mockup with `backdrop-blur-2xl bg-white/5 border-white/10`
- Headline with gradient text
- Description text

### CSS Key Points

```css
/* Blob animation */
@keyframes blob {
  0% { transform: translate(0px, 0px) scale(1); }
  33% { transform: translate(30px, -50px) scale(1.1); }
  66% { transform: translate(-20px, 20px) scale(0.9); }
  100% { transform: translate(0px, 0px) scale(1); }
}
.animate-blob { animation: blob 7s infinite; }

/* Glass card */
background: rgba(255, 255, 255, 0.05);
backdrop-filter: blur(16px);
border: 1px solid rgba(255, 255, 255, 0.1);
border-radius: 2rem;
```

### When to Use
- SaaS applications
- Platform/product auth screens
- When you want to convey professionalism and polish
- When the product has a dashboard or UI worth showcasing

### Anti-Patterns
- Don't put real user data in the mockup
- Don't make the visual panel compete with the form for attention
- Don't use stock photos — use abstract shapes or product mockups
- Don't forget to hide the visual panel on mobile

## Pattern 2: Centered Card (Simple)

A single centered card on a gradient or solid background.

### When to Use
- Internal tools
- Admin panels
- Simple apps where the product doesn't need showcasing

## Pattern 3: Full-Bleed Background

Form card over a full-bleed image or gradient.

### When to Use
- Consumer apps
- Marketing-heavy landing pages

## Component Recommendations

### Input with Icon
```jsx
<div className="relative">
  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
    <Icon className="h-5 w-5 text-gray-400" />
  </div>
  <input className="block w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
</div>
```

### Primary Button
```jsx
<button className="w-full flex items-center justify-center py-3 px-4 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-[0.99]">
  {children}
</button>
```

### Social Button (Google)
```jsx
<button className="w-full flex items-center justify-center gap-2.5 border border-gray-200 text-gray-700 rounded-xl py-3 text-sm font-medium hover:border-gray-400 hover:text-black transition-colors">
  <GoogleIcon />
  Google
</button>
```

### Divider
```jsx
<div className="relative my-6">
  <div className="absolute inset-0 flex items-center">
    <div className="w-full border-t border-gray-200"></div>
  </div>
  <div className="relative flex justify-center text-sm">
    <span className="px-4 bg-white text-gray-500">O continúa con</span>
  </div>
</div>
```

## Design Tokens (Linear-inspired)

```css
:root {
  --accent: #4f46e5;
  --accent-hover: #4338ca;
  --accent-light: rgba(79, 70, 229, 0.1);
  --text: #111827;
  --text-secondary: #4b5563;
  --text-muted: #6b7280;
  --text-subtle: #9ca3af;
  --border: #e5e7eb;
  --radius: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
}
```

## Verification Checklist

- [ ] Visual panel hidden on mobile
- [ ] Form is accessible (labels, focus states, error messages)
- [ ] Social buttons have proper icons
- [ ] Loading states on buttons
- [ ] Error messages styled clearly
- [ ] Responsive at all breakpoints
