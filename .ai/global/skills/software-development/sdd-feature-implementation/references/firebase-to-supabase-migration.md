# Firebase to Supabase Migration Pattern

## When to Use

- Migrating an Angular/Ionic project from Firebase (Firestore + Firebase Auth) to Supabase (PostgreSQL + Auth)
- Need to replace NoSQL with SQL while maintaining similar development experience
- Dockerization requires local database (Firestore has no production-grade emulator)

## Migration Checklist

### 1. Remove Firebase Dependencies

```bash
# Remove Firebase packages
pnpm remove @angular/fire firebase @firebase/auth

# Install Supabase
pnpm add @supabase/supabase-js
```

### 2. Create Supabase Client Service

```typescript
// src/app/services/supabase.service.ts
import { Injectable } from '@angular/core';
import { SupabaseClient, createClient, User, Session } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly client: SupabaseClient;
  private readonly _user = new BehaviorSubject<User | null>(null);
  readonly user$ = this._user.asObservable();

  constructor() {
    this.client = createClient(environment.supabase.url, environment.supabase.anonKey, {
      auth: { autoRefreshToken: true, persistSession: true }
    });
    
    // Initialize user state
    this.client.auth.getSession().then(({ data: { session } }) => {
      this._user.next(session?.user ?? null);
    });
    
    // Listen for auth changes
    this.client.auth.onAuthStateChange((event, session) => {
      this._user.next(session?.user ?? null);
    });
  }

  get supabase(): SupabaseClient { return this.client; }
  get user(): User | null { return this._user.value; }
}
```

### 3. Update Environment Configuration

```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  supabase: {
    url: 'https://YOUR-PROJECT.supabase.co',
    anonKey: 'YOUR-ANON-KEY',
  },
};
```

### 4. Migrate Auth Service

```typescript
// Before (Firebase):
import { Auth, signInWithEmailAndPassword } from '@angular/fire/auth';

// After (Supabase):
import { SupabaseService } from './supabase.service';

async signIn(email: string, password: string) {
  const { data, error } = await this.supabaseService.supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}
```

### 5. Migrate Data Services

Key changes:
- camelCase → snake_case (e.g., `userId` → `user_id`)
- Observable → Promise (Supabase uses async/await, not realtime listeners by default)
- `collectionData`/`docData` → `from().select().eq()`

```typescript
// Before (Firestore):
getAll(userId: string): Observable<Transaction[]> {
  return collectionData(
    query(collection(this.firestore, 'transactions'), where('userId', '==', userId)),
    { idField: 'id' }
  );
}

// After (Supabase):
async getAll(): Promise<Transaction[]> {
  const { data, error } = await this.supabaseService.supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false });
  if (error) throw error;
  return data;
}
```

### 6. Create SQL Migrations

```sql
-- supabase/migrations/0001_initial.sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('checking', 'savings', 'credit')),
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'MXN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own accounts"
  ON accounts FOR SELECT USING (auth.uid() = user_id);
```

### 7. Update main.ts (Remove Firebase)

```typescript
// Before:
import { provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';

bootstrapApplication(AppComponent, {
  providers: [
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => getAuth()),
  ],
});

// After:
bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes),
  ],
});
```

## Security Improvements

| Firebase | Supabase |
|----------|----------|
| Firestore rules (declarative) | RLS policies (SQL-based) |
| Firebase Auth (managed) | GoTrue JWT (self-hostable) |
| No local emulator for production | PostgreSQL dockerizable |
| No SQL backups | pg_dump native backups |

## Common Pitfalls

1. **Naming convention**: Firestore uses camelCase, Supabase/PostgreSQL uses snake_case. Update all interfaces and API calls.
2. **Observable vs Promise**: Firestore returns Observables, Supabase returns Promises. Update all consumers.
3. **Auth state**: Firebase has `authState`, Supabase uses `onAuthStateChange` + `getSession`.
4. **No automatic ID field**: Supabase doesn't add `idField` automatically — select `*` or alias columns.
5. **Date handling**: Supabase returns ISO strings, not Timestamps. Convert as needed.

## References

- `supabase.service.ts` — Centralized client with reactive user state
- `auth.service.ts` — Thin wrapper over SupabaseService for auth operations
- `transaction.service.ts` / `account.service.ts` — Data services with async/await pattern
- `supabase/migrations/0001_initial.sql` — RLS-enabled schema
