#!/usr/bin/env node
/*
 * Two real browsers playing one round at the same time.
 *
 * Why this exists: a curl-only test passes while the UI is still broken. Backend
 * state can be perfect and the guest still never receives a form, because the bug
 * lives in which React component mounts the discovery effect. Only two concurrent
 * browser contexts catch that class of failure.
 *
 * Playwright without polluting the project's node_modules (pnpm store major-version
 * mismatches are common):
 *   mkdir -p /tmp/pwtest && cd /tmp/pwtest && npm init -y && npm install playwright-core
 * Then point CHROME at an already-downloaded browser:
 *   ls ~/.cache/ms-playwright/            # chromium-XXXX/chrome-linux64/chrome
 *
 * Adapt BASE/API and the selectors, then:  node scripts/e2e-two-players.cjs
 */
const { chromium } = require('/tmp/pwtest/node_modules/playwright-core')

const CHROME = process.env.CHROME_PATH ||
  '/home/jonathanh/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'
const BASE = process.env.BASE || 'http://localhost:5173'
const API  = process.env.API  || 'http://localhost:3001/api'

const log = (m) => console.log(m)
let failed = false
const assert = (cond, ok, bad) => {
  log(cond ? `    OK: ${ok}` : `    *** FALLO: ${bad} ***`)
  if (!cond) failed = true
}

async function main() {
  // --- Seed host + house over the API (faster and less brittle than the UI) ---
  await fetch(`${API}/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'p1', email: 'p1@t.com', password: '123456',
                           displayName: 'Anfitrion' })
  }).catch(() => {})

  const login = await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'p1', password: '123456' })
  })).json()

  let house = await (await fetch(`${API}/houses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${login.token}` },
    body: JSON.stringify({ name: 'Casa E2E' })
  })).json()
  if (house.error) {                       // one-house-per-host rule: reuse it
    const list = await (await fetch(`${API}/houses`,
      { headers: { Authorization: `Bearer ${login.token}` } })).json()
    house = list[0]
  }
  log(`casa=${house.inviteCode}`)

  const browser = await chromium.launch({ executablePath: CHROME })

  // --- HOST: inject the token so we skip the login form ---
  const host = await (await browser.newContext()).newPage()
  await host.goto(BASE)
  await host.evaluate(t => localStorage.setItem('token', t), login.token)
  await host.goto(BASE)
  await host.waitForTimeout(2500)

  // --- GUEST: joins through the real invite link ---
  const guest = await (await browser.newContext()).newPage()
  await guest.goto(`${BASE}/join?code=${house.inviteCode}`)
  await guest.fill('input[placeholder="¿Cómo te llamas?"]', 'Ana')
  await guest.click('button[type="submit"]')
  await guest.waitForTimeout(2500)
  log(`\n[1] Invitado: ${await guest.evaluate(
    () => document.body.innerText.slice(0, 80).replace(/\n/g, ' | '))}`)

  // --- Host opens the game and reads the lobby roster ---
  await host.click('text=🎮 Jugar Basta');  await host.waitForTimeout(1200)
  await host.click('text=Modo Online');     await host.waitForTimeout(1200)
  const roster = await host.evaluate(() => {
    const h = [...document.querySelectorAll('h3')].find(x => x.textContent.includes('Jugadores'))
    return h ? h.textContent : 'no encontrado'
  })
  log(`[2] Host en setup: ${roster}`)
  assert(/\(([2-9])\)/.test(roster), 'el lobby ve al invitado',
         'lobby en 0 — usa los miembros de la casa, no players[] de la sesion')

  await host.click('text=Modo Basta')
  log('[3] Host inició la partida')

  // --- The decisive check: does the guest get its OWN form, unprompted? ---
  await guest.waitForTimeout(4000)
  const g = await guest.evaluate(() => ({
    inputs: document.querySelectorAll('input[type=text]').length,
    categorias: [...document.querySelectorAll('label')].map(l => l.textContent).slice(0, 4),
    tieneBotonBasta: [...document.querySelectorAll('button')].some(b => b.textContent.includes('BASTA')),
    letra: ([...document.querySelectorAll('span')]
      .find(s => /^[A-Z]$/.test(s.textContent.trim())) || {}).textContent?.trim() || null
  }))
  log(`[4] INVITADO -> ${JSON.stringify(g)}`)
  assert(g.inputs > 0, 'el invitado recibio su formulario',
         'sin formulario — el efecto de descubrimiento esta en el componente equivocado')
  if (g.inputs === 0) { await browser.close(); process.exit(1) }

  // --- Both type, then the GUEST presses BASTA ---
  const gi = await guest.$$('input[type=text]')
  await gi[0].fill(g.letra + 'na'); await gi[1].fill(g.letra + 'ato')
  const hi = await host.$$('input[type=text]')
  await hi[0].fill(g.letra + 'ndres')
  await host.waitForTimeout(1500)

  await guest.click('button:has-text("BASTA")')
  log('[5] Invitado pulsó BASTA')
  await host.waitForTimeout(2500)
  const aviso = await host.evaluate(() => {
    const p = [...document.querySelectorAll('p')].find(x => x.textContent.includes('BASTA'))
    return p ? p.textContent.trim() : 'sin aviso'
  })
  log(`[6] HOST ve: "${aviso}"`)
  assert(aviso.includes('BASTA'), 'el countdown se propago al host',
         'el host no vio el aviso — BASTA no se escribio en la DB')

  // --- Let the shared countdown expire; both must reach review on their own ---
  log('[7] Esperando el countdown (18s)...')
  await host.waitForTimeout(18000)
  const readH2 = (p) => p.evaluate(
    () => [...document.querySelectorAll('h2')].map(x => x.textContent.trim()).join(' / '))
  const sh = await readH2(host), sg = await readH2(guest)
  log(`[8] HOST: "${sh}"\n[9] INVITADO: "${sg}"`)
  assert(sh.includes('Validar') && sg.includes('Validar'),
         'ambos pasaron a Validar automaticamente',
         'no pasaron a review — falta la transicion server-side')

  await host.screenshot({ path: '/tmp/e2e-host.png' })
  await guest.screenshot({ path: '/tmp/e2e-guest.png' })
  await browser.close()
  process.exit(failed ? 1 : 0)
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
