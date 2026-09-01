# Firebase to Supabase Migration Guide

## Overview

This reference covers the complete migration path from Firebase (Firestore + Firebase Auth) to Supabase (Postabase + Supabase Auth) in an Angular application.

## Auth Migration

### Before (Firebase)

```typescript
import { Injectable, inject } from '@angular/core';
import { Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, authState, signInWithPopup, sendPasswordResetEmail, sendEmailVerification, signOut } from '@angular/fire/auth';
import { User } from 'firebase/auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);
  
  get userState$() {
    return authState(this.auth);
  }
  
  getCurrentUser(): User | null {
    return this.auth.currentUser;
  }
  
  async signIn(email: string, password: string) {
    const { user } = await signInWithEmailAndPassword(this.auth, email, password);
    if (!user.emailVerified) {
      await sendEmailVerification(user);
    }
  }
}
```

### After (Supabase)

```typescript
import { Injectable, inject } from '@angular/core';
import { SupabaseClient, createClient, User } from '@supabase/supabase-js';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly client: SupabaseClient;
  private readonly _user = new BehaviorSubject<User | null>(null);
  readonly user$ = this._user.asObservable();

  constructor() {
    this.client = createClient(environment.supabase.url, environment.supabase.anonKey);
    this.client.auth.getSession().then(({ data: { session } }) => {
      this._user.next(session?.user ?? null);
    });
    this.client.auth.onAuthStateChange((event, session) => {
      this._user.next(session?.user ?? null);
    });
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabaseService = inject(SupabaseService);
  
  get userState$() {
    return this.supabaseService.user$;
  }
  
  getCurrentUser(): User | null {
    return this.supabaseService.user;
  }
  
  async signIn(email: string, password: string) {
    const { data, error } = await this.supabaseService.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  }
}
```

## Database Migration

### Before (Firestore)

```typescript
import { collection, collectionData, doc, docData, query, where, orderBy, setDoc, updateDoc, deleteDoc } from '@angular/fire/firestore';

getAll(userId: string): Observable<Transaction[]> {
  const q = query(
    collection(this.firestore, 'transactions'),
    where('userId', '==', userId),
    orderBy('date', 'desc')
  );
  return collectionData(q, { idField: 'id' });
}
```

### After (Supabase)

```typescript
import { PostgrestResponse } from '@supabase/supabase-js';

async getAll(): Promise<Transaction[]> {
  const { data, error } = await this.supabaseService.supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false });
  if (error) throw error;
  return data;
}
```

## Interface Migration

### Before (camelCase - Firestore convention)

```typescript
export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  type: 'income' | 'expense';
  amount: number;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### After (snake_case - PostgreSQL convention)

```typescript
export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  type: 'income' | 'expense';
  amount: number;
  date: string;
  created_at: string;
  updated_at: string;
}
```

## Package Changes

### Remove Firebase packages

```bash
pnpm remove @angular/fire firebase @firebase/auth
```

### Add Supabase packages

```bash
pnpm add @supabase/supabase-js
pnpm add -D @types/node
```

## Main.ts Changes

### Before

```typescript
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';

bootstrapApplication(AppComponent, {
  providers: [
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
  ],
});
```

### After

```typescript
// No Firebase providers needed - Supabase client is created in SupabaseService
bootstrapApplication(AppComponent, {
  providers: [
    // Standard Angular providers only
  ],
});
```

## Common Issues

1. **Type conflicts**: Add `"skipLibCheck": true` to tsconfig.json
2. **Date handling**: PostgreSQL returns dates as strings, not Date objects
3. **Observable vs Promise**: Supabase uses Promises; wrap with `from()` if Observable needed
4. **Auth state**: Must manually subscribe to `onAuthStateChange` for session persistence
