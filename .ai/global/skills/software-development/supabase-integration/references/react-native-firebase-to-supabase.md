# React Native Firebase to Supabase Migration

**Project:** FinanzeasyReact  
**Date:** 2026-08-18

## Overview

Migration of React Native mobile app from Firebase to Supabase, while web app (Angular) was already on Supabase. Both repos now share the same Supabase project, database, and auth.

## Architecture

```
Web (Angular + Ionic) ──┐
                        ├── Supabase (PostgreSQL + Auth + Storage)
Mobile (React Native) ──┘
```

## Migration Steps

### 1. Install Dependencies

```bash
pnpm add @supabase/supabase-js
pnpm add -D @types/jest babel-jest babel-preset-expo
```

### 2. Create Supabase Client

```typescript
// src/services/supabase.ts
import { createClient, SupabaseClient, User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

let client: SupabaseClient;

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,  // Must be false for React Native
      },
    });
  }
  return client;
}
```

### 3. Align Types to snake_case

```typescript
// Before (Firebase - camelCase)
export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  date: string;
}

// After (Supabase - snake_case)
export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  date: string;
  created_at: string;
  updated_at: string;
}
```

### 4. Rewrite Services

```typescript
// Before (Firebase)
import { collection, addDoc, doc, getDocs, query, orderBy, runTransaction } from "firebase/firestore";
import { db, auth } from "./firebase";

export const transactionService = {
  async createTransaction(transaction: Omit<Transaction, "id">): Promise<Transaction> {
    return await runTransaction(db, async (firebaseTransaction) => {
      // Complex atomic logic
    });
  }
};

// After (Supabase)
import { getSupabaseClient } from './supabase';

export const transactionService = {
  async getAll(): Promise<Transaction[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async create(dto: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>): Promise<Transaction> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('transactions').insert(dto).select().single();
    if (error) throw error;
    if (!data) throw new Error('No data returned');
    return data;
  },
  async update(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('transactions').update(updates).eq('id', id).select().single();
    if (error) throw error;
    if (!data) throw new Error('No data returned');
    return data;
  },
  async delete(id: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) throw error;
  },
};
```

### 5. Migrate Auth Store (Zustand)

```typescript
// Before (Firebase)
import { create } from "zustand";
import { User, onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "../services/firebase";

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  initializeAuth: () => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      set({ user, isLoading: false });
    });
    return unsubscribe;
  },
}));

// After (Supabase)
import { create } from "zustand";
import { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { getSupabaseClient, signOut as supabaseSignOut } from "../services/supabase";

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  initializeAuth: () => {
    const supabase = getSupabaseClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      set({ user: session?.user ?? null, session, isLoading: false });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        set({ user: session?.user ?? null, session, isLoading: false });
      }
    );
    return () => { subscription?.unsubscribe(); };
  },
}));
```

### 6. Migrate Finance Store

```typescript
// Before (Firebase with runTransaction)
async createTransaction(tx) {
  return await runTransaction(db, async (firebaseTx) => {
    // Complex read/write logic
  });
}

// After (Supabase with services)
async addTransaction(tx) {
  const newTx = await transactionService.create(tx);
  set((state) => ({ transactions: [...state.transactions, newTx] }));
  return true;
}
```

**Pitfall:** Firebase `runTransaction` is atomic; Supabase requires explicit transactions or RPC functions for atomic operations. Use `supabase.rpc()` for complex multi-table operations.

### 7. Add SQL Functions for Business Logic

```sql
-- Balance update
CREATE OR REPLACE FUNCTION update_account_balance(account_id UUID, amount_change NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE accounts SET balance = balance + amount_change, updated_at = now() WHERE id = account_id;
END;
$$ LANGUAGE plpgsql;

-- Goal contribution
CREATE OR REPLACE FUNCTION contribute_to_goal(goal_id UUID, amount NUMERIC)
RETURNS savings_goals AS $$
DECLARE result savings_goals;
BEGIN
  UPDATE savings_goals SET current_amount = current_amount + amount, updated_at = now()
  WHERE id = goal_id RETURNING * INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Add keyword to category
CREATE OR REPLACE FUNCTION add_keyword_to_category(category_id UUID, keyword TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE categories SET keywords = array_append(keywords, keyword), updated_at = now()
  WHERE id = category_id;
END;
$$ LANGUAGE plpgsql;
```

### 8. Environment Variables

```bash
# .env.example
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**Pitfall:** Expo requires `EXPO_PUBLIC_` prefix for client-side env vars.

## Common Pitfalls

1. **Forgetting RLS on new tables** — Always enable RLS immediately
2. **Using camelCase in PostgreSQL** — Use snake_case for column names
3. **Not handling auth state changes** — Subscribe to `onAuthStateChange` for session persistence
4. **Missing indexes on foreign keys** — Add indexes for `user_id`, `account_id`, `date`
5. **Not using `skipLibCheck`** — Supabase storage-js types conflict with browser types
6. **Missing `@types/node`** — Supabase storage-js references `Buffer`, `NodeJS.ReadableStream`
7. **JWT secret too short** — Always use 32+ character secrets in production
8. **Console.log in production** — Remove all `console.log` calls
9. **Missing `.env.example`** — Always document all environment variables
10. **Not using `condition: service_healthy`** — Docker Compose dependencies should wait for healthcheck
11. **Not prefixing Expo env vars** — Expo requires `EXPO_PUBLIC_` prefix
12. **Using `detectSessionInUrl: true` in React Native** — Must be `false`
13. **Firebase atomic transactions** — Use RPC functions for multi-table atomic operations
14. **Not mocking Supabase in tests** — Always mock `getSupabaseClient` in Jest tests

## Testing Pattern

```typescript
// Mock Supabase in Jest tests
const mockSupabase = {
  from: jest.fn(),
  auth: { getSession: jest.fn(), onAuthStateChange: jest.fn() },
  rpc: jest.fn(),
};

jest.mock('../services/supabase', () => ({
  getSupabaseClient: () => mockSupabase,
}));

describe('Service Tests', () => {
  it('should fetch data', async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });
    const result = await service.getAll();
    expect(result).toEqual([]);
  });
});
```

## Verification Checklist

- [ ] RLS enabled on all user-data tables
- [ ] Policies for SELECT, INSERT, UPDATE, DELETE
- [ ] Indexes on foreign keys and frequently queried columns
- [ ] Environment variables for secrets (not hardcoded)
- [ ] `skipLibCheck: true` in tsconfig.json
- [ ] `EXPO_PUBLIC_` prefix for Expo env vars
- [ ] `detectSessionInUrl: false` in React Native
- [ ] All services rewritten to use Supabase queries
- [ ] Auth store migrated to Supabase Auth
- [ ] SQL functions for business logic
- [ ] Tests mock Supabase client
