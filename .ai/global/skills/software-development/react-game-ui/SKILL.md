---
name: react-game-ui
description: "Game UI patterns: auth, boards, timers, presence, peer voting."
version: 1.2.0
author: Hermes Agent
license: MIT
tags: [react, ui, game, frontend, multiplayer, presence]
platforms: [linux, macos, windows]
triggers:
  - build a game UI
  - multiplayer game board
  - game auth flow
  - game timer
  - split-screen login
  - player board
  - game validation
  - game dashboard
  - invite code
  - guest join
  - online players not syncing
  - stale players still showing
  - purge offline players
  - presence heartbeat
  - host vs guest view
  - waiting for host screen
  - turn-based same device
  - peer voting answers
  - players rate each other
  - vote on answers like dislike
  - duplicate answer scoring
  - invisible button
  - button not visible
  - cannot see the button
  - multi browser e2e test
  - test with two players
---

# React Game UI Patterns

## Design Rule: Reference First

Ask the user if there are existing projects they like BEFORE writing code. Read their CSS/components and lift exact values.

## Design Rule: Critical Controls Get Inline Colors

This user reported invisible buttons **five separate times in one session** — login
submit, "Crear cuenta", the guest-join button, "Compartir invitación". Every instance
had the same cause: the JSX used a semantic alias (`bg-accent`, `text-heading`,
`text-subtle`, `accent-hover`) that no longer existed after `styles.css` was rewritten.
A missing utility class fails **silently** — the element renders with no background and
white text, so it is literally invisible while the DOM still looks correct.

Any control the user must click to progress (submit, primary CTA, share) carries its
color inline, where no stylesheet edit can erase it:

```jsx
<button
  disabled={!canSubmit}
  style={{ background: canSubmit ? '#2563eb' : '#93c5fd', color: '#ffffff' }}
  className="w-full rounded-lg py-3 px-4 text-base font-semibold">
  Iniciar sesión
</button>
```

Two habits that prevent the repeat:

1. **Grep the whole tree after any `styles.css` rewrite**, not just the file you edited.
   Orphaned components keep referencing the old vocabulary:
   ```bash
   grep -rn "bg-accent\|text-heading\|text-body\|text-subtle\|accent-hover" src/
   ```
2. **Delete unimported components.** The stale aliases here lived in six files nobody
   imported (`GamesPage`, `HousesPage`, `AuthVisualLayout`, `Navbar`, `ui`, …). Confirm
   with a search for the export name before removing.

Verify against the built bundle, not the source — that proves what actually ships:

```bash
node -e "const j=require('fs').readFileSync('dist/assets/index-XXX.js','utf8');
  ['bg-accent','text-heading','text-subtle'].forEach(c=>
    console.log((j.includes('\"'+c)?'PRESENT':'clean  ')+' | '+c))"
```

Then confirm rendered contrast in the browser instead of asking whether it looks right:

```js
getComputedStyle(btn).backgroundColor   // "rgb(37, 99, 235)" — not "rgba(0, 0, 0, 0)"
```

## Pattern 1: Split-Screen Auth

Form on left, visual panel on right. Collapses to single column on mobile.

```jsx
<div className="min-h-screen flex w-full">
  <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24 w-full lg:w-[45%] bg-white">
    <div className="mx-auto w-full max-w-sm lg:w-96">{/* form */}</div>
  </div>
  <div className="hidden lg:block relative w-0 flex-1 bg-gray-900">
    <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900"></div>
  </div>
</div>
```

## Pattern 2: Google Button

Use explicit `width`/`height` on SVG (not CSS). Keep 14-18px.

```jsx
<button className="w-full flex items-center justify-center gap-3 border rounded-lg py-3 px-4">
  <svg width="14" height="14" viewBox="0 0 24 24">{/* paths */}</svg>
  <span>Continuar con Google</span>
</button>
```

## Pattern 3: Individual Player Boards

Each player gets their own board; tabs switch between them. Use literal palette
classes (`bg-blue-600`, not `bg-accent`) so a missing class is visible in the JSX —
semantic aliases silently vanish when `styles.css` is rewritten.

```jsx
<div className="flex gap-2 mb-4 overflow-x-auto pb-2">
  {players.map((p, i) => (
    <button key={p} onClick={() => setIdx(i)}
      className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
        i === idx        ? 'bg-blue-600 text-white'
        : p.finished     ? 'bg-green-100 text-green-700'
                         : 'bg-gray-100 text-gray-900'}`}>
      {p.displayName} {p.finished && '✓'}
    </button>
  ))}
</div>
<div className="border rounded-xl p-6">
  {categories.map(cat => (
    <input value={(answers[current] || {})[cat] || ''} />
  ))}
</div>
```

## Pattern 4: Timer with Auto-Submit

```jsx
useEffect(() => {
  if (timerActive && timeLeft > 0) {
    t = setTimeout(() => setTimeLeft(p => p - 1), 1000)
  } else if (timeLeft === 0 && timerActive) {
    calculateRound()
  }
  return () => clearTimeout(t)
}, [timerActive, timeLeft])
```

## Pattern 5: Validation

```jsx
const validate = () => {
  const e = {}
  players.forEach(p => categories.forEach(c => {
    const v = (answers[p] || {})[c] || ''
    if (v.trim() && v[0].toUpperCase() !== letter) e[`${p}-${c}`] = `Must start with ${letter}`
  }))
  setErrors(e)
  return Object.keys(e).length === 0
}
```

## Pattern 6: Guest Join

```jsx
await fetch('/api/houses/join-guest', {
  method: 'POST',
  body: JSON.stringify({ inviteCode, guestName })
})
// Returns: { token, user: { isGuest: true }, house }
```

## Pattern 7: Presence / Online Roster (polling, no WebSocket)

"Stale players never disappear" and "online status doesn't sync" are the same bug:
membership rows are permanent, so anyone who ever joined shows forever. Presence
needs a timestamp, a heartbeat, a read-time filter, and a purge.

**Schema** — add a heartbeat column to the join table:

```sql
CREATE TABLE memberships (
  id TEXT PRIMARY KEY, house_id TEXT, user_id TEXT, role TEXT,
  guest_name TEXT, last_seen INTEGER DEFAULT (strftime('%s','now'))
);
```

**Heartbeat endpoint + read-time filter.** The roster read also refreshes the
caller, so simply having the app open keeps you online:

```js
app.post('/api/houses/:houseId/heartbeat', auth, (req, res) => {
  db.exec('UPDATE memberships SET last_seen = ? WHERE house_id = ? AND user_id = ?',
    [Math.floor(Date.now()/1000), req.params.houseId, req.user.id])
  saveDb(); res.json({ ok: true })
})

app.get('/api/houses/:houseId/members', auth, (req, res) => {
  const now = Math.floor(Date.now()/1000)
  db.exec('UPDATE memberships SET last_seen = ? WHERE house_id = ? AND user_id = ?',
    [now, req.params.houseId, req.user.id])
  // ...select rows...
  res.json(all.filter(m => (now - (m.lastSeen || 0)) <= 15))   // ONLINE only
})
```

**Purge stale guests** so throwaway accounts don't accumulate. Guard `if (!db)`
because the interval starts before async DB init finishes:

```js
setInterval(() => {
  if (!db) return
  const now = Math.floor(Date.now()/1000)
  db.exec('UPDATE game_players SET is_active = 0 WHERE last_active < ?', [now - 15])
  const stale = db.exec(`SELECT m.id, m.user_id FROM memberships m
    JOIN users u ON u.id = m.user_id
    WHERE u.is_guest = 1 AND m.last_seen < ?`, [now - 30])
  if (stale.length && stale[0].values.length) {
    stale[0].values.forEach(([mid, uid]) => {
      db.exec('DELETE FROM memberships WHERE id = ?', [mid])
      db.exec('DELETE FROM game_players WHERE user_id = ?', [uid])
      db.exec('DELETE FROM users WHERE id = ? AND is_guest = 1', [uid])
    })
  }
  saveDb()
}, 10000)
```

Tiers that work in practice: heartbeat **5s**, hide from roster at **15s**,
hard-delete guests at **30s**.

**The heartbeat must be global, not per-view.** Scoping the interval to the
dashboard makes every player fall offline the moment they enter the game screen:

```jsx
// App.jsx — runs in EVERY view, keyed only on token + house
useEffect(() => {
  if (!token || !house?.id) return
  const beat = () => fetch(`/api/houses/${house.id}/heartbeat`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
  beat()
  const i = setInterval(beat, 5000)
  return () => clearInterval(i)
}, [token, house?.id])
```

See `references/multiplayer-sync.md` for the full server-authoritative game-session
design, and `scripts/test-presence.sh` for an executable end-to-end presence check.

## Pattern 8: Host vs Guest View Split

A guest must never see host controls. Derive the role and branch the initial state
instead of rendering one shared screen:

```jsx
const isHost = house.hostId === user?.id
<BastaGame isHost={isHost} ... />
// inside: const [step, setStep] = useState(isHost ? 'setup' : 'waiting')
```

Guests sit on a "waiting for host" screen with a live connected badge; the host
polls the roster and starts the round. Identify the current user from the **decoded
JWT**, not from React state — `user` is often still `null` on the first roster
fetch, which makes the host appear as one of their own guests:

```jsx
const currentUserId = JSON.parse(atob(token.split('.')[1])).id
```

## Pattern 9: Peer Voting on Answers

When answers are free text, players must grade each other or invented words score
full marks. Two rules, both easy to break:

- a player rates **only** other players' answers — own ones show a label, no buttons
- the round does **not** close until **every** active player submitted a ballot

Key votes on the normalised text (`` `${category}::${normalize(value)}` ``), never on
an array index — indexes differ per client once each filters out their own answers.
Tally on the server and exclude authors from their own group's count:

```js
players.forEach(voter => {
  if (authorIds.includes(voter.userId)) return       // authors cannot vote
  const v = (voter.votes || {})[key]
  if (v === 'like') likes++; else if (v === 'dislike') dislikes++
})
const valid = dislikes === 0 || likes >= dislikes    // confirm threshold with user
```

Gate the submit button until nothing is pending, so nobody can half-vote and stall
the round, and show `{votedCount} de {players.length} han calificado` while waiting:

```jsx
const pending = votable.filter(k => !votes[k])
<button disabled={pending.length > 0}>
  {pending.length ? `Califica ${pending.length} más` : 'Enviar mis calificaciones'}
</button>
```

Adding a `scored` status between `review` and results is what makes the progress line
possible. Full design, the idempotency guard for accumulating round points inside a
1s poll, and the migration for adding `votes`/`voted` to a shipped schema are in
`references/peer-voting-scoring.md`.

## Backend Pitfalls (game session servers)

**`sql.js` needs async init.** `require('sql.js')` exports a Promise-returning
factory, not a class. `new SQL.Database()` on the raw module throws
`TypeError: SQL.Database is not a constructor`, the process dies on boot, and every
`fetch` in the UI fails — which reads to the user as "it doesn't sync", not "the
server is down". Also load the existing file or the DB resets on every restart:

```js
const initSqlJs = require('sql.js')
const DB_PATH = path.join(__dirname, 'playscore.db')
let db = null
async function initDb() {
  const SQL = await initSqlJs()                       // await the factory
  db = fs.existsSync(DB_PATH)
    ? new SQL.Database(new Uint8Array(fs.readFileSync(DB_PATH)))  // persist
    : new SQL.Database()
  db.exec(`CREATE TABLE IF NOT EXISTS ...`)
}
function saveDb() { if (!db) return; fs.writeFileSync(DB_PATH, Buffer.from(db.export())) }
initDb().then(() => app.listen(PORT))
```

**`catch (e) {}` around every fetch hides a dead backend.** Empty catches turn a
crashed server into a UI that renders but never updates. When the user reports
"doesn't sync", "stale data", or "nothing happens", check the server FIRST:

```bash
curl -s http://localhost:3001/api/health          # is it even alive?
process(action='log', session_id=...)             # read the crash trace
```

Never trust "started successfully" from a background launch — a Node process can
print nothing and exit immediately. Confirm with a real health request before
touching frontend code.

**Re-audit every transition guard when you add a status.** Guards written as an
allowlist of the *current* status rot the moment the state machine grows. Adding
`countdown` between `playing` and `review` broke both sides at once: the server's
"everyone finished" check was gated on `status === 'playing'`, so a round where all
players submitted during the countdown hung; and the client's
`s.status === 'review' && (cur === 'playing' || cur === 'waiting')` never fired for a
device sitting in the countdown view. Accept every state you can legally leave from,
and prefer exclusion lists for the destination:

```js
if ((status === 'playing' || status === 'countdown') && players.every(p => p.finished))
```
```jsx
} else if (s.status === 'review' && !['review','results','final'].includes(cur)) {
```

**Register `app.get('*')` SPA catch-all LAST**, after every `/api` route, and guard
it with `if (!req.path.startsWith('/api'))`. Registered early it swallows API
routes and they return HTML.

## Verify Before Reporting Done

This user requires proof from real execution, not a description of the change.
For presence/sync work a curl script beats clicking:

```bash
bash scripts/test-presence.sh     # join host + 2 guests, heartbeat one, assert roster shrinks
python3 -c "import sqlite3;print(list(sqlite3.connect('app.db').execute('SELECT display_name,is_guest FROM users')))"
```

Assert on the actual row count/names, and inspect the DB directly to prove a purge
really deleted rows rather than just filtering the response.

**For multiplayer, one browser is not enough.** Single-page checks pass while the
shared round is broken. Drive a host plus N guests in **separate browser contexts**
(same-context tabs share `localStorage`, so every "guest" is really the host):

```bash
node scripts/e2e-multiplayer.cjs     # host + 2 guests, real stack, asserts on DOM counts
```

That harness caught two bugs neither curl nor eyeballing one page found: a guest who
never received a form, and a round that hung after everyone pressed BASTA. Assert on
counted DOM facts (`inputs`, `ownBlocked`, `submit.disabled`) rather than screenshots
— a screenshot taken a second late shows the next screen and reads as a pass.

Install Playwright **out-of-tree** (`/tmp/pwtest` + `playwright-core`) and point it at
an already-cached Chromium; `pnpm add playwright` into the app can break its
`node_modules` on a pnpm store mismatch.

When a test result looks impossible, suspect stale state before suspecting the code:
delete the DB file, clear `node_modules/.vite`, and restart both processes. A guest
polling `active-session` can rejoin a previous run's round and land straight in
`review`.

## Slop Checklist

- [ ] Referenced existing project?
- [ ] Google SVG uses explicit size?
- [ ] No centered hero on dashboards?
- [ ] One accent color?
- [ ] Components split pages/components?
- [ ] Every `className` token actually defined in styles.css? (invisible-control bug)
- [ ] Primary/submit buttons carry inline `style` colors, not semantic aliases?
- [ ] Grepped `src/` for orphaned aliases after rewriting styles.css?
- [ ] Backend answered `/api/health` before blaming the frontend?
- [ ] Presence proven by real run — stale player leaves the roster?
- [ ] Guests see only "waiting for host", never host controls?
- [ ] Multiplayer proven with 2+ browser contexts, not one page?
- [ ] Players can only rate OTHERS' answers, and the round waits for all ballots?
- [ ] Every transition guard re-checked after adding an intermediate status?

## Structure

```
src/client/
├── components/
├── pages/
├── App.jsx
└── styles.css
```
