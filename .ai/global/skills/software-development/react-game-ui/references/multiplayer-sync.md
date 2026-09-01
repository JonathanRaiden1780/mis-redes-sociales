# Server-Authoritative Multiplayer Sync (polling)

How to make several phones share one game round without WebSockets. Derived from
the PlayScore "Basta" build (2026-08), where the first attempt kept all state in
React and each device therefore played its own private game.

## The core mistake to avoid

Holding round state (`currentLetter`, `timeLeft`, `players`, `answers`) in React
means every client generates its own letter and runs its own clock. Nothing is
shared. The state that all devices must agree on belongs in the DB; React only
renders a projection of it.

Symptoms that you made this mistake:
- each device shows a different letter
- host presses start and guests see nothing
- a player who joins mid-round is invisible to everyone

## Schema

```sql
CREATE TABLE game_sessions (
  id TEXT PRIMARY KEY, house_id TEXT NOT NULL, host_id TEXT NOT NULL,
  status TEXT DEFAULT 'lobby',        -- lobby | playing | review | ended
  current_letter TEXT DEFAULT '',
  round_number INTEGER DEFAULT 1,
  time_limit INTEGER DEFAULT 60,
  time_left INTEGER DEFAULT 0,
  game_mode TEXT DEFAULT 'basta',     -- basta | time | offline
  categories TEXT DEFAULT '[]',       -- JSON
  config TEXT DEFAULT '{}',           -- JSON
  updated_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE game_players (
  id TEXT PRIMARY KEY, session_id TEXT NOT NULL, user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  answers TEXT DEFAULT '{}',          -- JSON
  is_active INTEGER DEFAULT 1,
  finished INTEGER DEFAULT 0,
  last_active INTEGER DEFAULT (strftime('%s','now'))
);
```

## Endpoints

| Verb | Route | Who | Purpose |
|---|---|---|---|
| POST | `/api/games/create` | host | create/reuse a `lobby` session |
| POST | `/api/games/:id/join` | all | insert player, or reactivate an existing row |
| GET | `/api/games/:id/state` | all | poll (1s) — also bumps `last_active` |
| GET | `/api/houses/:houseId/active-session` | all | **guests discover the round exists** |
| POST | `/api/games/:id/start` | host | set letter + `status='playing'` |
| POST | `/api/games/:id/answers` | all | autosave (`finished:false`) or submit (`true`) |
| POST | `/api/games/:id/basta` | all | shorten clock to 15s → `status='countdown'` |
| POST | `/api/games/:id/next-round` | host | bump round, clear answers/finished |
| POST | `/api/games/:id/end` | host | `status='ended'` |

Do **not** add a `POST /timer` endpoint where the host pushes `time_left` each tick.
That was the first design here and it desynchronises: the clock only advances while
the host's tab is focused, and a guest who joins mid-round gets whatever the host
last wrote. Derive time from `updated_at` instead — see the next section.

Two properties make this robust:

1. **`/state` doubles as the heartbeat.** Anyone polling is by definition present,
   so liveness needs no extra client code inside the game screen.
2. **`join` reactivates rather than duplicating.** A guest who reloads must not
   appear twice:

```js
const existing = db.exec('SELECT id FROM game_players WHERE session_id = ? AND user_id = ?',
  [sessionId, req.user.id])
if (!existing.length || !existing[0].values.length) {
  db.exec('INSERT INTO game_players (id, session_id, user_id, display_name) VALUES (?,?,?,?)',
    [generateId(), sessionId, req.user.id, req.user.displayName || req.user.username])
} else {
  db.exec('UPDATE game_players SET is_active = 1, finished = 0, last_active = ? WHERE session_id = ? AND user_id = ?',
    [Math.floor(Date.now()/1000), sessionId, req.user.id])
}
```

`/state` returns only `is_active = 1` rows, so a device that closed drops out of
the round automatically.

## Derive the clock; never let clients count it

`time_left` in the DB is a *starting budget*, not a live counter. Nothing decrements
it on a schedule. Every read computes the remainder from `updated_at`, which means
all devices agree even if some were closed, backgrounded, or joined late:

```js
function computeSession(row) {
  const [id, houseId, hostId, status, letter, roundNumber,
         timeLimit, timeLeft, gameMode, categories, config,
         createdAt, updatedAt] = row
  const now = Math.floor(Date.now() / 1000)
  let realTimeLeft = timeLeft, realStatus = status
  if (status === 'playing' || status === 'countdown') {
    realTimeLeft = Math.max(0, timeLeft - (now - updatedAt))
    if (realTimeLeft === 0) realStatus = 'review'   // expiry IS the transition
  }
  return { id, hostId, status: realStatus, letter, roundNumber,
           timeLimit, timeLeft: realTimeLeft, gameMode,
           categories: JSON.parse(categories || '[]'),
           config: JSON.parse(config || '{}') }
}
```

Only `start`, `basta`, and `next-round` ever write `updated_at` — each one restarts
the budget. Destructure the row in exact column order; getting it wrong yields
`JSON.parse` errors like `Unexpected token 'b', "basta" is not valid JSON` because
`game_mode` lands where `categories` was expected.

Persist the derived transition so it survives, then re-check "everyone finished" as
a second, independent path to `review`:

```js
function persistIfExpired(sessionId, computed) {
  if (computed.status !== 'review') return
  const row = getSessionRow(sessionId)
  if (row && row[3] !== 'review') {
    db.exec('UPDATE game_sessions SET status = ?, time_left = 0 WHERE id = ?',
      ['review', sessionId])
    saveDb()
  }
}
// inside /state, after loading players:
if (status === 'playing' && players.length && players.every(p => p.finished)) {
  db.exec('UPDATE game_sessions SET status = ?, time_left = 0 WHERE id = ?',
    ['review', sessionId]); status = 'review'
}
```

### There must exist code that writes `status = 'review'`

"The timer ran out and nothing happened" is almost never a UI bug. Grep the server
before touching React:

```bash
grep -n "'review'" server.cjs || echo "NO transition exists — that IS the bug"
```

If the only `review` reference is in the frontend, the round can never end.

## Guest discovery belongs ABOVE the game component

The subtlest failure in this build: the code that discovered the active session
lived inside `<BastaGame>`, but a guest waiting for the host is rendered by the
*dashboard* — so that effect never mounted and the guest could never be pulled in.
The host started the round and the guest sat forever on "waiting".

Poll for the session from the component that owns routing:

```jsx
// App.jsx — guest auto-enters when the host actually starts
useEffect(() => {
  if (!token || !house?.id || view !== 'dashboard') return
  if (house.hostId === user?.id || house.my_role === 'host') return   // host opts out
  const check = async () => {
    const res = await fetch(`/api/houses/${house.id}/active-session`,
      { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return
    const { sessionId, status } = await res.json()
    if (sessionId && ['playing', 'countdown', 'review'].includes(status)) {
      setView('basta')            // only on a LIVE round, not on 'lobby'
    }
  }
  check()
  const i = setInterval(check, 2000)
  return () => clearInterval(i)
}, [token, house?.id, house?.hostId, house?.my_role, user?.id, view])
```

Gate on a live status, not merely on existence — entering on `lobby` drops guests
into a half-configured screen.

**General rule:** any effect that must fire while the user is on screen *A* cannot
live in component *B*. Before writing a discovery/subscription effect, name the
component that is actually mounted at that moment and put it there.

## The role of `join` at mount

Once inside the game, a guest still has to register. Do it in the same discovery
step, then set `sessionId` — that starts the state poll:

```jsx
await fetch(`/api/games/${data.sessionId}/join`,
  { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
setSessionId(data.sessionId)
```

`join` must read the display name from the **users table**, not the JWT. Tokens
minted for guests carry only `{ id, username, role }`, so trusting
`req.user.displayName` writes rows named `guest_1787785618920`:

```js
const ur = db.exec('SELECT display_name, username FROM users WHERE id = ?', [req.user.id])
const displayName = ur.length && ur[0].values.length
  ? (ur[0].values[0][0] || ur[0].values[0][1])
  : (req.user.username || 'Jugador')
```

## Client polling loop

Poll on `sessionId` alone — **not** on `step`. Keying the effect to `step` tears
down and rebuilds the interval on every transition, and the `step` captured inside
the callback goes stale. Read the current step from a ref:

```jsx
const stepRef = useRef(step)
useEffect(() => { stepRef.current = step }, [step])

useEffect(() => {
  if (!sessionId || isOffline) return
  const tick = async () => {
    const res = await fetch(`/api/games/${sessionId}/state`,
      { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return
    const s = await res.json()
    setCurrentLetter(s.currentLetter); setTimeLeft(s.timeLeft)
    setMyUserId(s.myUserId); setPlayers(s.players)
    if (s.categories?.length) setCategories(s.categories)

    const cur = stepRef.current
    if ((s.status === 'playing' || s.status === 'countdown') &&
        !['playing','review','results','final'].includes(cur)) {
      setStep('playing')
    } else if (s.status === 'review' && ['playing','waiting'].includes(cur)) {
      await fetch(`/api/games/${sessionId}/answers`, {          // flush before leaving
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ answers: myAnswersRef.current, finished: true })
      }).catch(() => {})
      buildReview(s.players, s.categories)
    } else if (s.status === 'ended' && !['final','results'].includes(cur)) {
      setStep('final')
    }
  }
  tick()
  const i = setInterval(tick, 1000)
  return () => clearInterval(i)
}, [sessionId, token, isOffline])
```

Guard forward-only transitions with an allowlist of current steps, or a late poll
will yank a player out of `results` back into `playing`.

Have `/state` return `myUserId` so the client can identify itself without decoding
the token again — it needs this to know which board is its own (see below).

Rule of thumb: **1s for in-round state, 2s for guest discovery, 3s for a lobby
roster, 5s for heartbeat.**

## Online: every player edits THEIR OWN board

Tabs that switch `currentPlayerIdx` are right for offline hot-seat and wrong for
online. If the input binds to `players[currentPlayerIdx].answers`, each player is
typing into whoever's tab is selected — the user reports "my form never appeared".
Online, tabs are a read-only presence strip; the form always binds to *me*:

```jsx
const me = players.find(p => p.userId === myUserId)
const boardAnswers = isOffline ? (players[currentPlayerIdx]?.answers || {}) : myAnswers
const iFinished    = !isOffline && !!me?.finished

const setAnswer = (category, value) => {
  if (isOffline) {
    setPlayers(prev => prev.map((p, i) =>
      i === currentPlayerIdx ? { ...p, answers: { ...p.answers, [category]: value } } : p))
  } else {
    const next = { ...myAnswersRef.current, [category]: value }
    setMyAnswers(next)
    saveMyAnswers(next)        // autosave with finished:false
  }
}
```

Autosave with `finished:false` on every keystroke. Without it, a player whose clock
expires before pressing BASTA loses everything they typed.

## Two round-end modes

- **Timer mode** — every player gets the same configured countdown; the round ends
  when it hits 0 and unfilled answers submit as blank.
- **Basta mode** — the first player to finish presses BASTA, which sets
  `time_left = 15` and `status = 'countdown'` **server-side**. Every other device
  picks that up on its next poll and shows the shortened, red, animated countdown.
  Tension comes from the *shared* clock, so the 15s must be written to the DB,
  never held locally.

```js
app.post('/api/games/:sessionId/basta', auth, (req, res) => {
  const session = getSessionRow(req.params.sessionId)
  if (!session) return res.status(404).json({ error: 'Sesión no encontrada' })
  db.exec('UPDATE game_players SET answers = ?, finished = 1 WHERE session_id = ? AND user_id = ?',
    [JSON.stringify(req.body.answers || {}), req.params.sessionId, req.user.id])
  const computed = computeSession(session)
  if (computed.status === 'playing' && computed.timeLeft > BASTA_COUNTDOWN) {
    db.exec('UPDATE game_sessions SET status = ?, time_left = ?, updated_at = ? WHERE id = ?',
      ['countdown', BASTA_COUNTDOWN, Math.floor(Date.now()/1000), req.params.sessionId])
  }
  saveDb(); res.json({ success: true, countdown: BASTA_COUNTDOWN })
})
```

The `timeLeft > BASTA_COUNTDOWN` guard matters: without it, a second player pressing
BASTA resets the countdown back to 15s and the round never closes.

Show every device who triggered it, so the pressure is legible:

```jsx
{!isOffline && timeLeft <= BASTA_COUNTDOWN && timeLeft > 0 && (
  <div className="timer-urgent" style={{ background:'#fee2e2', border:'1px solid #fca5a5' }}>
    {iPressedBasta ? '¡Pulsaste BASTA! ' : '¡Alguien pulsó BASTA! '} Quedan {timeLeft}s
  </div>
)}
```

## Scoring with duplicate detection

Normalise before grouping so `Águila`/`aguila`/`AGUILA` collapse into one answer:

```js
const normalized = raw.trim().toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
```

Group by the normalised key, keep the list of authors, then award by group size:
1 author = 100, 2 = 50, 3+ = 25. Peer voting runs on top: only **non-authors** may
vote, and a word is valid when `likes > dislikes` (or when nobody voted). Rejected
words score 0 regardless of uniqueness. Duplicates are shown with a warning badge
and are exempt from voting — agreement between players already implies the word is
real.

## Offline mode is a different flow

Same device, sequential turns, and no session rows needed. The essential piece is
a **blocking hand-off screen** between turns so the next player cannot read the
previous answers — go `playing -> hide_screen -> playing` and only reveal the next
board after an explicit "I'm ready" tap. Each turn gets the same time limit.

## Debug order when "it doesn't sync"

1. `curl -s /api/health` — is the backend actually running?
2. Read the server log for a boot crash (async DB init is the usual culprit).
3. `grep -n "'review'" server.cjs` — does a transition to review even exist?
4. Inspect the DB, not the UI. This pinpoints the layer in one query:
   ```bash
   python3 -c "
   import sqlite3; c=sqlite3.connect('playscore.db')
   print('SESIONES:', list(c.execute('SELECT substr(id,1,8),status,current_letter,time_left FROM game_sessions')))
   print('JUGADORES:', list(c.execute('SELECT substr(session_id,1,8),display_name,is_active,finished FROM game_players')))
   "
   ```
   A session in `playing` that lists **only the host** proves the guest never
   reached `join` — a discovery bug, not a rendering bug.
5. Confirm `/state` returns the expected `status` and player list.
6. Only then look at React.

Empty `catch (e) {}` blocks around fetches make a dead server look like a frontend
bug; check the server before editing components.

### Symptom → cause table

| Symptom | Real cause |
|---|---|
| Guest stuck on "waiting" after host starts | discovery effect mounted in the wrong component |
| "My form never appeared" | inputs bound to the selected tab instead of `myUserId` |
| Timer expires, nothing happens | no server code writes `status='review'` |
| Players named `guest_1787…` | `join` trusted `req.user.displayName` from the JWT |
| Each device shows a different letter | round state kept in React, not the DB |
| Countdown restarts on every BASTA press | missing `timeLeft > BASTA_COUNTDOWN` guard |
| `Unexpected token 'b', "basta" is not valid JSON` | session row destructured in the wrong column order |

### Reusing a house across test runs

`create` closes prior sessions for that house
(`UPDATE game_sessions SET status='ended' WHERE house_id = ? AND status != 'ended'`).
Without it, a guest polling `active-session` rejoins a stale round from a previous
run and lands straight in `review`. When a test looks impossibly wrong, delete the
DB file and clear `node_modules/.vite` before concluding the code is broken.
