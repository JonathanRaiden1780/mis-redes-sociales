# Host vs Guest Role Separation

A guest must never see host controls. Getting this wrong is subtle: the app looks
correct from the host's browser and only breaks for the *other* person, so it survives
single-browser testing.

## The failure observed

After joining via `/join?code=XXXX`, the guest was rendered the complete host
dashboard — invite code, share buttons, "🎮 Jugar Basta", full game catalogue. The
guest could have started a game the host hadn't configured.

Two independent causes, both required fixing:

1. **Backend omitted the role.** `POST /api/houses/join-guest` returned
   `house: { id, name, inviteCode }` with no `hostId` and no `my_role`.
2. **Client fell back to `true`.** The guard was
   `house.hostId === user?.id || !house.hostId` — with `hostId` undefined, the
   `!house.hostId` clause made every guest a host.

Never write a permissive fallback into a role check. If the role is unknown, the safe
default is the *lesser* privilege.

## Fix 1 — backend returns role fields

```js
res.json({
  id: house[0], name: house[1], inviteCode: house[3], role: 'visitor', token,
  user: { id: userId, username, displayName: guestName.trim(), role: 'player', isGuest: true },
  house: { id: house[0], name: house[1], inviteCode: house[3],
           hostId: house[2], my_role: 'visitor' }        // <-- both required
})
```

`GET /api/houses` should likewise project `my_role` from the membership join so a
page refresh preserves the distinction.

## Fix 2 — derive `isHost` once, at the top

Compute it in `App.jsx` and pass it down. Deriving it separately inside each view is
how one screen gets it right and another gets it wrong.

```jsx
const isHost = !!house && (
  house.hostId === user?.id ||
  house.my_role === 'host' ||
  (!house.hostId && !user?.isGuest)     // narrow fallback: never true for a guest
)
```

The third clause still tolerates a missing `hostId` for legacy rows, but is gated on
`!user?.isGuest` so a guest can never satisfy it.

## Fix 3 — branch the whole screen, not a few widgets

Hiding individual buttons leaves the guest on a page built around host affordances.
Render a different component entirely.

```jsx
{house ? (
  isHost
    ? <DashboardPage house={house} games={games} onlinePlayers={onlinePlayers}
                     onSelectGame={g => g.id === 'basta' && setView('basta')} />
    : <GuestWaitingPage house={house} user={user} players={onlinePlayers} />
) : (
  <CreateHouseView token={token} onCreated={setHouse} />
)}
```

Also branch the game component's initial state so a guest entering the game screen
lands on the waiting step, not the setup wizard:

```jsx
const [step, setStep] = useState(isHost ? 'setup' : 'waiting')
```

## What the guest waiting screen contains

Everything reassuring, nothing actionable:

- House name
- "Esperando a que el anfitrión inicie la partida"
- Their own identity + a live pulsing "En línea" badge (proves the heartbeat works)
- Roster of connected players, with themselves marked "(tú)"
- "No cierres esta pestaña o perderás tu lugar en la partida"

No invite code, no share buttons, no game catalogue, no start button.

## The host-appears-as-their-own-guest bug

The roster filter compares against React state that is often still `null` on the
first fetch, so the host shows up in their own guest list. Read the id from the JWT:

```jsx
const fetchMembers = async (t, houseId) => {
  const currentUserId = JSON.parse(atob(t.split('.')[1])).id   // not user?.id
  const res = await fetch(`/api/houses/${houseId}/members`,
    { headers: { Authorization: `Bearer ${t}` } })
  const members = await res.json()
  setOnlinePlayers(members.filter(m => m.id !== currentUserId)
                          .map(m => m.displayName || m.username))
}
```

When assembling the player list for an online game, the host is re-added explicitly
at the front — that is deliberate, and distinct from the roster display:

```jsx
const allPlayers = isHost && user
  ? [user.displayName || user.username, ...onlinePlayers]
  : onlinePlayers
```

## Verification — must use two sessions

Single-browser testing cannot catch this. Minimum sequence:

```bash
# 1. Host creates the house, capture the code
TK=$(curl -s -X POST localhost:3001/api/auth/login -H 'Content-Type: application/json' \
      -d '{"username":"host","password":"123456"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
CODE=$(curl -s -X POST localhost:3001/api/houses -H 'Content-Type: application/json' \
      -H "Authorization: Bearer $TK" -d '{"name":"Casa"}' \
      | python3 -c "import sys,json;print(json.load(sys.stdin)['inviteCode'])")

# 2. Guest joins — assert the role fields came back
curl -s -X POST localhost:3001/api/houses/join-guest -H 'Content-Type: application/json' \
  -d "{\"inviteCode\":\"$CODE\",\"guestName\":\"Carlos\"}" \
  | python3 -c "import sys,json;d=json.load(sys.stdin)['house']; \
      print('hostId:', 'hostId' in d, '| my_role:', d.get('my_role'))"
# Expect: hostId: True | my_role: visitor
```

Then in the browser, visit `/join?code=XXXX` as the guest and confirm via snapshot
that no invite code and no "Jugar" button are present — assert on the element list,
not on a screenshot description.

## The consequence nobody anticipates: guests can't be reached

Separating the views correctly creates a new problem. The guest now lives on
`GuestWaitingPage`, so **any effect placed inside the game component never mounts
for them**. If the code that discovers "the host started a round" sits in
`<BastaGame>`, the guest waits forever while the host plays alone.

The discovery poll must live in whatever component is mounted *while the guest is
waiting* — normally the router in `App.jsx`:

```jsx
// App.jsx — the guest is on the dashboard, so the effect belongs here
useEffect(() => {
  if (!token || !house?.id || view !== 'dashboard') return
  if (house.hostId === user?.id || house.my_role === 'host') return   // host opts out
  const check = async () => {
    const res = await fetch(`/api/houses/${house.id}/active-session`,
      { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return
    const { sessionId, status } = await res.json()
    if (sessionId && ['playing', 'countdown', 'review'].includes(status)) {
      setView('basta')          // live round only — never on 'lobby'
    }
  }
  check()
  const i = setInterval(check, 2000)
  return () => clearInterval(i)
}, [token, house?.id, house?.hostId, house?.my_role, user?.id, view])
```

**Checklist whenever you split host/guest views:** for each effect the guest depends
on — heartbeat, discovery, roster refresh — name the component that is actually
mounted for a guest at that moment. If the answer is "the host's component", the
effect is in the wrong place. This is the same failure mode as scoping the presence
heartbeat to the dashboard: correct-looking code that simply never runs for the
person who needs it.

Two-browser E2E is the only reliable check here; `scripts/e2e-two-players.cjs`
drives a host and a guest concurrently and asserts the guest receives its form.
