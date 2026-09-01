# Peer Voting & Server-Side Scoring

How to make players grade each other's answers so invented words score nothing,
without letting anyone grade their own. Derived from the PlayScore "Basta" build
(2026-08).

Two rules the user asked for explicitly, and both are easy to get wrong:

1. A player may rate **only other players' answers** — never their own.
2. The round does **not close** until **every** player has submitted ratings.

## Schema — votes live on the player row

```sql
CREATE TABLE game_players (
  id TEXT PRIMARY KEY, session_id TEXT NOT NULL, user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  answers TEXT DEFAULT '{}',
  is_active INTEGER DEFAULT 1,
  finished INTEGER DEFAULT 0,
  last_active INTEGER DEFAULT (strftime('%s','now')),
  votes TEXT DEFAULT '{}',        -- JSON: { "Categoria::normalizada": "like"|"dislike" }
  voted INTEGER DEFAULT 0         -- has this player submitted their ballot?
);
```

Adding columns to a schema that already shipped needs idempotent migrations —
`CREATE TABLE IF NOT EXISTS` will not add them to an existing file:

```js
try { db.exec("ALTER TABLE game_players ADD COLUMN votes TEXT DEFAULT '{}'") } catch (e) {}
try { db.exec('ALTER TABLE game_players ADD COLUMN voted INTEGER DEFAULT 0') } catch (e) {}
```

Swallowing the error is correct here: the only expected failure is "duplicate
column", which means the migration already ran.

## Vote keys must be stable across clients

Every device has to name the same answer identically, so key on the **normalised**
text, not on an array index (indexes differ per client once you filter out your own
answers):

```js
const normalize = (s) =>
  String(s).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const key = `${category}::${normalize(value)}`   // "Nombre::maria"
```

This also means `María` and `maria` collapse into one votable entry, which is what
you want — they are the same word and the same duplicate group.

## Status machine gains a `scored` state

```
lobby -> playing -> countdown (BASTA) -> review -> scored -> (next-round | ended)
```

`review` is "everyone is rating"; `scored` is "all ballots in, points are final".
Keeping them separate is what lets the UI show a "3 of 5 have rated" progress line
instead of jumping straight to results.

## Endpoint

```js
app.post('/api/games/:sessionId/vote', auth, (req, res) => {
  const { sessionId } = req.params
  db.exec('UPDATE game_players SET votes = ?, voted = 1 WHERE session_id = ? AND user_id = ?',
    [JSON.stringify(req.body.votes || {}), sessionId, req.user.id])
  saveDb()

  const pr = db.exec('SELECT voted FROM game_players WHERE session_id = ? AND is_active = 1',
    [sessionId])
  const list = pr.length ? pr[0].values.map(r => r[0] === 1) : []
  const allVoted = list.length > 0 && list.every(Boolean)

  if (allVoted) {
    db.exec(`UPDATE game_sessions SET status = 'scored' WHERE id = ?`, [sessionId])
    saveDb()
  }
  res.json({ success: true, allVoted,
             votedCount: list.filter(Boolean).length, total: list.length })
})
```

Count only `is_active = 1` players, or a guest who closed their tab blocks the round
forever. Re-check the same condition inside `/state` too — a player might submit the
last ballot and then immediately drop, and the poll is what unsticks it:

```js
if (status === 'review' && players.length && players.every(p => p.voted)) {
  db.exec(`UPDATE game_sessions SET status = 'scored' WHERE id = ?`, [sessionId])
  status = 'scored'
}
```

## Scoring belongs on the server

Compute points in one place and ship the result. If each client tallies its own
votes they will disagree, and the client that renders first "wins".

```js
const POINTS_UNIQUE = 100, POINTS_DUP_2 = 50, POINTS_DUP_3PLUS = 25

function computeScores(players, categories) {
  const scores = {}
  players.forEach(p => { scores[p.userId] = 0 })

  const detail = categories.map(category => {
    // 1. group answers by normalised text
    const groups = {}
    players.forEach(p => {
      const val = String((p.answers || {})[category] || '').trim()
      if (!val) return
      const norm = normalize(val)
      if (!groups[norm]) groups[norm] = { value: val, norm, authors: [] }
      groups[norm].authors.push({ userId: p.userId, displayName: p.displayName })
    })

    const answers = Object.values(groups).map(g => {
      const key = `${category}::${g.norm}`
      const authorIds = g.authors.map(a => a.userId)

      // 2. tally votes from NON-AUTHORS only
      let likes = 0, dislikes = 0
      players.forEach(voter => {
        if (authorIds.includes(voter.userId)) return      // authors cannot vote
        const v = (voter.votes || {})[key]
        if (v === 'like') likes++
        else if (v === 'dislike') dislikes++
      })

      // 3. validity, then points by group size
      const valid = dislikes === 0 || likes >= dislikes
      let points = 0
      if (valid) {
        const n = g.authors.length
        points = n === 1 ? POINTS_UNIQUE : n === 2 ? POINTS_DUP_2 : POINTS_DUP_3PLUS
      }
      if (points > 0) authorIds.forEach(id => { scores[id] += points })

      return { value: g.value, norm: g.norm, key,
               authors: g.authors.map(a => a.displayName),
               authorIds, likes, dislikes, valid, points }
    })
    return { name: category, answers }
  })

  return { scores, detail }
}
```

Return `scoring` from `/state` only when `status === 'scored'`. Shipping `detail`
alongside `scores` lets the results screen explain *why* someone got 50 instead of
100 (authors, 👍/👎 counts, points) without recomputing anything.

### The validity threshold is a product decision — confirm it

`dislikes === 0 || likes >= dislikes` means a tie **keeps** the word. With 3 players,
one approve + one reject leaves it valid. The stricter alternatives are
`likes > dislikes` (tie kills it) or `dislikes === 0` (a single reject kills it).
Ask which the user wants rather than assuming; the shipped default here is the
permissive one.

## Client: accumulate round points exactly once

`/state` is polled every second and keeps returning `scored`, so a naive
`setTotalScores(prev => ...)` inside the poll adds the same round over and over.
Guard with a ref keyed on the round number:

```jsx
const scoredRoundsRef = useRef(new Set())

if (s.status === 'scored' && s.scoring) {
  if (!scoredRoundsRef.current.has(s.roundNumber)) {
    scoredRoundsRef.current.add(s.roundNumber)
    const byName = {}
    s.players.forEach(p => { byName[p.displayName] = s.scoring.scores[p.userId] || 0 })
    setTotalScores(prev => {
      const up = { ...prev }
      Object.entries(byName).forEach(([n, v]) => { up[n] = (up[n] || 0) + v })
      return up
    })
    setRoundHistory(prev => [...prev,
      { round: s.roundNumber, letter: s.currentLetter, scores: byName }])
  }
  setServerScoring(s.scoring)
  if (!['results', 'final'].includes(cur)) setStep('results')
}
```

Any derived total accumulated from inside a polling loop needs this treatment —
idempotency is not optional when the trigger repeats every second.

## Voting UI

Own answers render as a labelled, button-free row; everyone else's get 👍/👎. Submit
stays disabled until every foreign answer has a rating, so nobody can half-vote and
stall the round:

```jsx
// which keys THIS player must rate
const votable = []
grouped.forEach(cat => cat.answers.forEach(a => {
  if (!a.authorIds.includes(myUserId)) votable.push(`${cat.name}::${a.norm}`)
}))
const pending = votable.filter(k => !votes[k])
const canSubmit = pending.length === 0 && !sending && !iVoted

{mine ? (
  <span style={{ background:'#dbeafe', color:'#1d4ed8' }}>Tu respuesta</span>
) : (
  <>
    <button onClick={() => setVote(key,'like')}
      style={{ background: myVote==='like' ? '#22c55e' : '#e5e7eb' }}>👍</button>
    <button onClick={() => setVote(key,'dislike')}
      style={{ background: myVote==='dislike' ? '#ef4444' : '#e5e7eb' }}>👎</button>
  </>
)}

<button disabled={!canSubmit}>
  {pending.length > 0 ? `Califica ${pending.length} respuesta${pending.length>1?'s':''} más`
                      : 'Enviar mis calificaciones'}
</button>
```

Two things that make the wait legible instead of feeling broken:

- a persistent `{votedCount} de {players.length} jugadores han calificado` line
- an explicit "Ya calificaste — esperando a los demás" screen once `voted` is true

Duplicate groups deserve a badge (`duplicada · 50pts`) so players understand the
lower score before they see the total.

Only the host gets **Siguiente Ronda** / **Terminar Juego**; guests see
"Esperando a que el anfitrión inicie la siguiente ronda...".

## Clear ballots on every new round

`start` and `next-round` must reset votes as well as answers, or round 2 inherits
round 1's ballots and closes instantly:

```js
db.exec(`UPDATE game_players
         SET finished = 0, answers = '{}', votes = '{}', voted = 0
         WHERE session_id = ?`, [sessionId])
```

Client side, clear `serverScoring`, `votedCount`, and per-round refs in the same
place you bump the round.

## Pitfall: "everyone finished" must also fire during `countdown`

The check that flips `playing -> review` was originally gated on
`status === 'playing'` only. After someone pressed BASTA the session sat in
`countdown`, so when all players submitted, **nothing** moved it forward — the
round hung until the 15s expired, and if answers arrived after that it hung
permanently. Accept both states:

```js
if ((status === 'playing' || status === 'countdown') &&
    players.length && players.every(p => p.finished)) {
  db.exec('UPDATE game_sessions SET status = ?, time_left = 0 WHERE id = ?',
    ['review', sessionId])
  status = 'review'
}
```

The matching client guard has the same trap. `s.status === 'review' && (cur === 'playing' || cur === 'waiting')`
never fires for a device sitting in the countdown view; invert it to an exclusion
list instead:

```jsx
} else if (s.status === 'review' && !['review','results','final'].includes(cur)) {
```

**General lesson:** every time you add an intermediate status, re-audit each
transition guard that named the old status explicitly. Allowlists of "states I can
leave from" rot the moment the state machine grows.

## Symptom → cause

| Symptom | Real cause |
|---|---|
| Round hangs after everyone presses BASTA | "all finished" check gated on `playing`, ignores `countdown` |
| Totals grow every second | round points accumulated inside the 1s poll without a per-round guard |
| A player can rate their own word | vote tally didn't exclude `authorIds` |
| Round closes with one ballot | `allVoted` counted rows that were not `is_active = 1` |
| Round 2 ends immediately | `next-round` cleared `answers` but not `votes` / `voted` |
| Clients disagree on points | scoring computed per-client instead of server-side |
| Same word appears twice to vote on | grouped by raw text instead of the normalised key |
