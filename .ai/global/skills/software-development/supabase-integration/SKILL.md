---
name: supabase-integration
description: "Integrate Supabase: Firebase migration, RLS, Docker Compose."
---

# Supabase Integration

## When to Use

- Migrating a web app from Firebase to Supabase
- Adding Supabase Auth (email/password, OAuth) to a project
- Designing PostgreSQL schemas with Row Level Security (RLS)
- Setting up Supabase locally with Docker Compose
- Implementing automated PostgreSQL backups
- Building multi-tenant applications with per-user data isolation

## Core Concepts

### Why Supabase over Firebase

| Feature | Firebase | Supabase |
|---------|----------|----------|
| Database | Firestore (NoSQL) | PostgreSQL (SQL) |
| Auth | Firebase Auth | Supabase Auth (GoTrue) |
| Realtime | Firestore listeners | WebSockets over PostgreSQL |
| Docker | No official emulator | Full Docker stack |
| RLS | Security rules | Native PostgreSQL RLS |
| Backups | Manual export | pg_dump automation |

### Row Level Security (RLS)

RLS is the cornerstone of Supabase security. Every table that user data touches must have:

```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data"
  ON table_name FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own data"
  ON table_name FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

**Pitfall:** Forgetting RLS on a new table means all users can see all data. Always enable RLS immediately after table creation.

## Migration from Firebase

### Auth Migration

Replace Firebase Auth imports with Supabase Auth:

```typescript
// Before (Firebase)
import { Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from '@angular/fire/auth';

// After (Supabase)
import { SupabaseClient, createClient } from '@supabase/supabase-js';
```

Key differences:
- Firebase uses `authState` observable; Supabase uses `user$` BehaviorSubject
- Firebase `currentUser` is synchronous; Supabase `user` is from the BehaviorSubject
- Email verification: Firebase sends automatically; Supabase requires `emailRedirectTo` option

### Database Migration

Firestore (document-based) → PostgreSQL (relational):

```typescript
// Before (Firestore)
collectionData(query(collection(firestore, 'transactions'), where('userId', '==', uid)));

// After (Supabase)
supabase.from('transactions').select('*').eq('user_id', uid);
```

**Pitfall:** Firestore uses camelCase (`userId`, `accountId`); PostgreSQL convention is snake_case (`user_id`, `account_id`). Update interfaces accordingly.

## Docker Compose Setup

### Stack Architecture

```
┌─────────────────────────────────────────┐
│              Docker Compose              │
├─────────────────────────────────────────┤
│  frontend (nginx) → supabase-api        │
│  supabase-db (PostgreSQL)               │
│  supabase-rest (PostgREST)              │
│  supabase-realtime (WebSockets)         │
│  backup (pg_dump cron)                  │
└─────────────────────────────────────────┘
```

### Service Dependencies

```yaml
supabase-api:
  depends_on:
    supabase-db:
      condition: service_healthy

backup:
  profiles:
    - backup  # Only runs when explicitly invoked
```

**Pitfall:** Always use `condition: service_healthy` for database dependencies, not just `depends_on`. Without it, auth API starts before PostgreSQL is ready.

## Backup Strategy

### Automated pg_dump

```bash
# Compressed backup (for restoration)
pg_dump -h ${DB_HOST} -U ${USER} -d ${DB_NAME} \
  --format=custom --compress=9 \
  --file="backup_${TIMESTAMP}.dump"

# Plain SQL backup (for migrations/inspection)
pg_dump -h ${DB_HOST} -U ${USER} -d ${DB_NAME} \
  --format=plain --file="backup_${TIMESTAMP}.sql"
```

### Retention Policy

```bash
# Remove backups older than 30 days
find ${BACKUP_DIR} -name "backup_*" -mtime +30 -delete
```

## Cross-Repo Migration: Mobile Firebase → Supabase (Web already on Supabase)

When migrating a React Native mobile app from Firebase to Supabase while the web app (Angular) is already on Supabase:

### Shared Backend Architecture

```
Web (Angular + Ionic) ──┐
                        ├── Supabase (PostgreSQL + Auth + Storage)
Mobile (React Native) ──┘
```

Both repos share the same Supabase project, database, and auth. Types and services must align.

### Key Migration Steps

1. **Install Supabase JS**: `pnpm add @supabase/supabase-js`
2. **Create `supabase.ts` client** with AsyncStorage persistence:
   ```typescript
   import AsyncStorage from '@react-native-async-storage/async-storage';
   const client = createClient(URL, ANON_KEY, {
     auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
   });
   ```
3. **Align types to snake_case** — Match PostgreSQL column names exactly
4. **Rewrite services** — Replace Firestore SDK calls with Supabase queries
5. **Migrate Auth store** — Replace `onAuthStateChanged` with Supabase `onAuthStateChange`
6. **Add SQL functions** for business logic (balance updates, goal contributions)
7. **Use `EXPO_PUBLIC_` prefix** for environment variables in Expo

### Service Pattern (React Native)

```typescript
export const entityService = {
  async getAll() {
    const { data, error } = await supabase.from('table').select('*').order('created_at');
    if (error) throw error;
    return data ?? [];
  },
  async create(dto) { /* insert + select().single() */ },
  async update(id, updates) { /* update + eq + select().single() */ },
  async delete(id) { /* delete + eq */ },
};
```

### Common Pitfalls

1. **Forgetting RLS on new tables** — Always enable RLS immediately
2. **Using camelCase in PostgreSQL** — Use snake_case for column names
3. **Not handling auth state changes** — Subscribe to `onAuthStateChange` for session persistence
4. **Missing indexes on foreign keys** — Add indexes for `user_id`, `account_id`, `date`
5. **Not using `skipLibCheck`** — Supabase storage-js types conflict with browser types; add `"skipLibCheck": true` to tsconfig
6. **Missing `@types/node`** — Supabase storage-js references `Buffer`, `NodeJS.ReadableStream`; install `@types/node` and add to `types` in tsconfig
7. **JWT secret too short** — Always use 32+ character secrets in production; never commit defaults
8. **Console.log in production** — Remove all `console.log` calls; use environment-aware logger
9. **Missing `.env.example`** — Always document all environment variables with placeholder values
10. **Not using `condition: service_healthy`** — Docker Compose dependencies should wait for healthcheck, not just container start
11. **Not prefixing Expo env vars** — Expo requires `EXPO_PUBLIC_` prefix for client-side env vars
12. **Using `detectSessionInUrl: true` in React Native** — Must be `false`; no URL-based auth in mobile

## Verification Checklist

- [ ] RLS enabled on all user-data tables
- [ ] Policies for SELECT, INSERT, UPDATE, DELETE
- [ ] Indexes on foreign keys and frequently queried columns
- [ ] Docker healthchecks configured
- [ ] Backup script tested and scheduled
- [ ] Environment variables for secrets (not hardcoded)
- [ ] `skipLibCheck: true` in tsconfig.json

## References

- `references/firebase-to-supabase-migration.md` — Detailed migration steps and code comparisons
- `references/docker-compose-reference.md` — Full docker-compose.yml with all services
- `references/rls-patterns.md` — Common RLS policy patterns for multi-tenant apps
- `references/react-native-firebase-to-supabase.md` — React Native mobile migration guide
- `references/react-native-jest-supabase-testing.md` — Jest config, mocks, and testing patterns for React Native + Supabase
- `references/finanzeasy-migrations.md` — Actual SQL migrations from the Finanzeasy project
