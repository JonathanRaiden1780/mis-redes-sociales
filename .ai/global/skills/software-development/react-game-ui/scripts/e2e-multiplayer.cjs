// Multi-client E2E harness for a polling multiplayer game.
//
// WHY THIS EXISTS: single-browser checks pass while multiplayer is broken. This
// harness drives one host + N guests in isolated browser contexts against the real
// stack, and it caught two bugs that curl and one-page inspection both missed:
//   1. a guest who never received their form (discovery effect in wrong component)
//   2. a round that hung in `countdown` when everyone finished
//
// SETUP — do NOT `pnpm add playwright` into the app; a mismatched pnpm store can
// break the project's node_modules. Install it out-of-tree and reuse whatever
// Chromium is already cached:
//
//   mkdir -p /tmp/pwtest && cd /tmp/pwtest && npm init -y && npm install playwright-core
//   ls ~/.cache/ms-playwright/            # find a chromium-<build> dir
//   # binary lives at chrome-linux64/chrome (newer) or chrome-linux/chrome (older)
//
// RUN: node scripts/e2e-multiplayer.cjs
// Exits 0 on success, 1 on failure, and writes screenshots to /tmp for inspection.

const { chromium } = require('/tmp/pwtest/node_modules/playwright-core')

const CHROME = process.env.CHROME_PATH ||
  '/home/jonathanh/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'
const BASE = process.env.BASE_URL || 'http://localhost:5173'
const API  = process.env.API_URL  || 'http://localhost:3001/api'
const log = console.log

const post = (p, body, token) => fetch(API + p, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json',
             ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body)
}).then(r => r.json())

// Seed the host + house over the API. Only exercise through the UI what you
// actually need to assert on — UI steps are slow and flaky by comparison.
async function seedHost() {
  const u = 'e2e' + Date.now().toString().slice(-6)   // unique: avoids "user exists"
  await post('/auth/register',
    { username: u, email: u + '@t.com', password: '123456', displayName: 'Jonathan' })
  const { token } = await post('/auth/login', { username: u, password: '123456' })
  const house = await post('/houses', { name: 'Casa E2E' }, token)
  return { token, house }
}

async function main() {
  const { token, house } = await seedHost()
  log(`casa=${house.inviteCode}`)

  const browser = await chromium.launch({ executablePath: CHROME })

  // HOST: inject the token, then reload so the app boots authenticated.
  const hostCtx = await browser.newContext()
  const host = await hostCtx.newPage()
  await host.goto(BASE)
  await host.evaluate(t => localStorage.setItem('token', t), token)
  await host.goto(BASE)
  await host.waitForTimeout(2000)

  // GUESTS: separate contexts = separate localStorage. Same-context tabs would
  // share the token and every "guest" would actually be the host.
  const guests = []
  for (const name of ['Ana', 'Beto']) {
    const g = await (await browser.newContext()).newPage()
    await g.goto(`${BASE}/join?code=${house.inviteCode}`)
    await g.fill('input[placeholder="¿Cómo te llamas?"]', name)
    await g.click('button[type="submit"]')
    await g.waitForTimeout(1800)
    guests.push({ name, page: g })
  }
  log('guests joined via UI')

  // Host opens the game and starts an online round.
  await host.click('text=🎮 Jugar Basta')
  await host.waitForTimeout(1000)
  await host.click('text=Modo Online')
  await host.waitForTimeout(1200)

  const lobby = await host.evaluate(() => {
    const h = [...document.querySelectorAll('h3')].find(x => /Jugadores/.test(x.textContent))
    return h ? h.textContent.trim() : '?'
  })
  log(`[1] lobby: ${lobby}`)

  await host.click('text=Modo Basta')
  await host.waitForTimeout(3500)

  const letter = await host.evaluate(() => {
    const el = [...document.querySelectorAll('span')].find(s => /^[A-Z]$/.test(s.textContent.trim()))
    return el ? el.textContent.trim() : null
  })
  log(`[2] letter: ${letter}`)

  // ASSERTION 1 — the guest must actually receive a playable form.
  // Count inputs rather than trusting a screenshot.
  const guestState = await guests[0].page.evaluate(() => ({
    inputs: document.querySelectorAll('input[type=text]').length,
    hasBasta: [...document.querySelectorAll('button')].some(b => /BASTA/.test(b.textContent))
  }))
  log(`[3] guest board -> ${JSON.stringify(guestState)}`)
  if (guestState.inputs === 0) {
    log('    FAIL: guest never received a form')
    await browser.close(); process.exit(1)
  }

  // Everyone types. Host + Ana submit the SAME first answer on purpose so the
  // duplicate-detection path (50pts) is exercised, and Beto submits a junk word
  // so the rejection path (0pts) is exercised.
  const fill = async (page, vals) => {
    const ins = await page.$$('input[type=text]')
    for (let i = 0; i < vals.length && i < ins.length; i++) {
      if (vals[i]) await ins[i].fill(vals[i])
    }
  }
  const L = letter
  await fill(host, [L + 'aria', L + 'ono'])
  await fill(guests[0].page, [L + 'aria', L + 'urcielago'])
  await fill(guests[1].page, [L + 'ario', L + 'mmm'])
  await host.waitForTimeout(1800)

  // All press BASTA -> should reach review WITHOUT waiting out the countdown.
  // This is the assertion that caught the `countdown` hang.
  await host.click('button:has-text("BASTA")')
  await guests[0].page.click('button:has-text("BASTA")')
  await guests[1].page.click('button:has-text("BASTA")')
  await host.waitForTimeout(3500)

  const titles = async () => ({
    host: await host.evaluate(() => [...document.querySelectorAll('h2')].map(x => x.textContent.trim()).join('|')),
    ana:  await guests[0].page.evaluate(() => [...document.querySelectorAll('h2')].map(x => x.textContent.trim()).join('|')),
    beto: await guests[1].page.evaluate(() => [...document.querySelectorAll('h2')].map(x => x.textContent.trim()).join('|'))
  })
  log(`[4] screens: ${JSON.stringify(await titles())}`)

  // ASSERTION 2 — own answers blocked, foreign answers votable, submit gated.
  const voteUi = await host.evaluate(() => ({
    ownBlocked: [...document.querySelectorAll('span')]
      .filter(s => s.textContent.trim() === 'Tu respuesta').length,
    votable: [...document.querySelectorAll('button')]
      .filter(b => b.textContent.trim() === '👍').length,
    submit: (() => {
      const b = [...document.querySelectorAll('button')].find(x => /Califica|Enviar mis/.test(x.textContent))
      return b ? { text: b.textContent.trim(), disabled: b.disabled } : null
    })()
  }))
  log(`[5] vote UI -> ${JSON.stringify(voteUi)}`)
  if (voteUi.ownBlocked < 1) {
    log('    FAIL: own answers are not marked "Tu respuesta"')
    await browser.close(); process.exit(1)
  }
  if (voteUi.submit && voteUi.submit.disabled !== true) {
    log('    FAIL: submit should be disabled before rating everything')
    await browser.close(); process.exit(1)
  }

  // Vote and submit, one client at a time, asserting the round does NOT close early.
  const voteAll = async (page, who) => {
    for (const b of await page.$$('button:has-text("👍")')) {
      await b.click(); await page.waitForTimeout(120)
    }
    const send = await page.$('button:has-text("Enviar mis calificaciones")')
    if (send) { await send.click(); log(`    ${who} submitted ballot`) }
    await page.waitForTimeout(800)
  }

  await voteAll(host, 'Host')
  const partial = await host.evaluate(() =>
    document.body.innerText.match(/\d+ de \d+ han calificado/)?.[0] || '(no counter)')
  log(`[6] after 1 ballot: "${partial}" — must NOT be final yet`)

  await voteAll(guests[0].page, 'Ana')
  await voteAll(guests[1].page, 'Beto')
  await host.waitForTimeout(3500)

  log(`[7] final screens: ${JSON.stringify(await titles())}`)

  // ASSERTION 3 — results reached, and scores match the server's own maths.
  const results = await host.evaluate(() => {
    const scores = {}
    document.querySelectorAll('div').forEach(d => {
      const sp = d.querySelectorAll('span')
      if (sp.length === 2 && /^\+\d+$/.test(sp[1].textContent.trim())) {
        scores[sp[0].textContent.trim()] = sp[1].textContent.trim()
      }
    })
    return { title: [...document.querySelectorAll('h1')].map(x => x.textContent.trim()).join('|'), scores }
  })
  log(`[8] results -> ${JSON.stringify(results)}`)

  await host.screenshot({ path: '/tmp/e2e-host.png', fullPage: true })
  await guests[0].page.screenshot({ path: '/tmp/e2e-guest.png', fullPage: true })

  const ok = /Resultados/.test(results.title)
  log(ok ? '\n    PASS: round completed only after ALL players rated'
         : '\n    FAIL: never reached results')
  await browser.close()
  process.exit(ok ? 0 : 1)
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
