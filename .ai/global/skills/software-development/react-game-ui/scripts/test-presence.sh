#!/bin/bash
# End-to-end presence + guest-purge verification for a polling multiplayer server.
#
# Proves, with real HTTP calls, that:
#   1. joined players appear in the roster
#   2. a player who stops sending heartbeats disappears (hidden tier)
#   3. a stale guest is hard-deleted from the DB (purge tier)
#
# Adjust API / field names to the project. Assumes:
#   POST /api/auth/register {username,email,password,displayName} -> {token}
#   POST /api/houses {name}                                       -> {id,inviteCode}
#   POST /api/houses/join-guest {inviteCode,guestName}             -> {token}
#   POST /api/houses/:id/heartbeat
#   GET  /api/houses/:id/members                                  -> [ ...online only ]
#
# Usage: bash scripts/test-presence.sh
set -e
API=${API:-http://localhost:3001/api}

jqt() { python3 -c "import sys,json;print(json.load(sys.stdin)['$1'])"; }
roster() {
  curl -s "$API/houses/$1/members" -H "Authorization: Bearer $2" \
    | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d),[m['displayName'] for m in d])"
}

echo "=== 0. Server alive? ==="
curl -sf "$API/health" > /dev/null || { echo "FAIL: backend is not responding"; exit 1; }
echo "ok"

echo "=== 1. Register host ==="
TOKEN_HOST=$(curl -s -X POST "$API/auth/register" -H "Content-Type: application/json" \
  -d '{"username":"host1","email":"host1@t.com","password":"123456","displayName":"Host"}' | jqt token)

echo "=== 2. Create house ==="
HOUSE=$(curl -s -X POST "$API/houses" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_HOST" -d '{"name":"Casa Test"}')
HOUSE_ID=$(echo "$HOUSE" | jqt id)
CODE=$(echo "$HOUSE" | jqt inviteCode)
echo "house=$HOUSE_ID code=$CODE"

echo "=== 3. Two guests join (no registration) ==="
TOKEN_G1=$(curl -s -X POST "$API/houses/join-guest" -H "Content-Type: application/json" \
  -d "{\"inviteCode\":\"$CODE\",\"guestName\":\"Ana\"}" | jqt token)
curl -s -X POST "$API/houses/join-guest" -H "Content-Type: application/json" \
  -d "{\"inviteCode\":\"$CODE\",\"guestName\":\"Beto\"}" > /dev/null

echo "=== 4. Roster (expect 3: Host, Ana, Beto) ==="
roster "$HOUSE_ID" "$TOKEN_HOST"

echo "=== 5. Only Host+Ana heartbeat for 20s; Beto goes dark ==="
for _ in 1 2 3 4; do
  curl -s -X POST "$API/houses/$HOUSE_ID/heartbeat" -H "Authorization: Bearer $TOKEN_G1"   > /dev/null
  curl -s -X POST "$API/houses/$HOUSE_ID/heartbeat" -H "Authorization: Bearer $TOKEN_HOST" > /dev/null
  sleep 5
done

echo "=== 6. Roster (expect 2: Host, Ana — Beto hidden) ==="
roster "$HOUSE_ID" "$TOKEN_HOST"

echo "=== 7. Keep beating past the purge threshold (~35s total) ==="
for _ in 1 2 3; do
  curl -s -X POST "$API/houses/$HOUSE_ID/heartbeat" -H "Authorization: Bearer $TOKEN_G1"   > /dev/null
  curl -s -X POST "$API/houses/$HOUSE_ID/heartbeat" -H "Authorization: Bearer $TOKEN_HOST" > /dev/null
  sleep 6
done

echo "=== 8. Roster (expect 2 — Beto now DELETED, not just hidden) ==="
roster "$HOUSE_ID" "$TOKEN_HOST"

echo "=== 9. Prove deletion at the DB level ==="
python3 - <<'PY' || echo "(skip: adjust DB path)"
import sqlite3, os
for p in ('playscore.db', 'app.db'):
    if os.path.exists(p):
        c = sqlite3.connect(p)
        print('USERS:', list(c.execute('SELECT display_name, is_guest FROM users')))
        print('MEMBERSHIPS:', c.execute('SELECT COUNT(*) FROM memberships').fetchone()[0])
        break
PY

echo "=== DONE — a stale guest must be absent from BOTH roster and users table ==="
