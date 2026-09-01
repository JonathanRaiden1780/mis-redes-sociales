# Finanzeasy Offline Implementation

**Project:** FinanzeasyReact
**Date:** 2026-08-18

## Overview

Full offline-first system for React Native / Expo with Supabase backend. The app works fully offline using local SQLite, queues all changes, and automatically syncs when network recovers.

## Key Dependencies

```json
{
  "@react-native-async-storage/async-storage": "^2.2.0",
  "@react-native-community/netinfo": "^12.0.1",
  "expo-sqlite": "^57.0.1"
}
```

## File Structure

```
src/
├── services/
│   ├── offline.ts          # Main offline store + SQLite + sync queue
│   ├── supabase.ts         # Supabase client
│   ├── accountService.ts   # Offline-first CRUD
│   └── transactionService.ts # Offline-first CRUD
├── components/
│   └── SyncStatusBar.tsx   # Network/sync indicator
└── store/
    └── financeStore.ts     # Uses offline-first services
```

## Database Schema

All tables follow this pattern:

```sql
CREATE TABLE IF NOT EXISTS table_name (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  -- ... columns ...
  dirty INTEGER DEFAULT 0  -- 0 = synced, 1 = local pending sync
);
```

Tables: `accounts`, `transactions`, `budgets`, `savings_goals`, `loans`, `investments`, `debts`, `recurring_transactions`, `categories`, `credit_cards`

## Sync Queue (AsyncStorage)

Persisted at `sync_queue` key in AsyncStorage:

```typescript
interface SyncQueueItem {
  id: string;
  table: string;
  operation: 'create' | 'update' | 'delete';
  data: Record<string, any>;
  timestamp: string;
  synced: boolean;
  retryCount: number;
}
```

## Service Pattern (accountService.ts)

```typescript
async create(userId: string, account: Omit<Account, 'id' | 'created_at' | 'updated_at'>): Promise<Account> {
  const offlineStore = useOfflineStore.getState();
  const id = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  
  const newAccount: Account = { ...account, id, user_id: userId, created_at: now, updated_at: now };
  
  // Save locally (dirty = 1)
  await offlineStore.saveLocal('accounts', { ...newAccount, dirty: 1 });
  
  // Add to sync queue
  await offlineStore.addToQueue({ table: 'accounts', operation: 'create', data: newAccount, timestamp: now });
  
  // If online, try to sync immediately
  if (offlineStore.isOnline) {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.from('accounts').insert({ ...account, user_id: userId }).select().single();
      if (!error && data) {
        await offlineStore.saveLocal('accounts', { ...data, dirty: 0 });
        await offlineStore.removeLocal('accounts', id);
        const queue = await offlineStore.getQueue();
        const item = queue.find(i => i.data.id === id);
        if (item) await offlineStore.markAsSynced(item.id);
        return data;
      }
    } catch (error) {
      console.warn('Failed to sync create, will retry later:', error);
    }
  }
  
  return newAccount;
}
```

## Network Detection

```typescript
// src/services/offline.ts
export function setupNetworkListener() {
  return NetInfo.addEventListener(state => {
    const isConnected = state.isConnected ?? false;
    useOfflineStore.getState().setOnline(isConnected);
    if (isConnected && !useOfflineStore.getState().isSyncing) {
      triggerSync();
    }
  });
}
```

## Sync Function

```typescript
export async function triggerSync() {
  const store = useOfflineStore.getState();
  if (store.isSyncing || !store.isOnline) return;
  
  store.setSyncing(true);
  try {
    const pendingItems = await store.getPendingItems();
    for (const item of pendingItems) {
      try {
        await syncItemToServer(item);
        await store.markAsSynced(item.id);
      } catch (error) {
        await store.incrementRetry(item.id);
      }
    }
    store.setLastSyncAt(new Date().toISOString());
  } finally {
    store.setSyncing(false);
  }
}
```

## Testing Patterns

### Mock AsyncStorage with in-memory object

```typescript
let mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn((key, value) => { mockStorage[key] = value; return Promise.resolve(); }),
  getItem: jest.fn((key) => Promise.resolve(mockStorage[key] || null)),
  removeItem: jest.fn((key) => { delete mockStorage[key]; return Promise.resolve(); }),
  clear: jest.fn(() => { mockStorage = {}; return Promise.resolve(); }),
}));
```

### Mock NetInfo

```typescript
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
}));
```

### Mock expo-sqlite

```typescript
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(() => Promise.resolve({
    execAsync: jest.fn(() => Promise.resolve()),
    runAsync: jest.fn(() => Promise.resolve()),
    getFirstAsync: jest.fn(() => Promise.resolve(null)),
    getAllAsync: jest.fn(() => Promise.resolve([])),
  })),
}));
```

### Verify queue persistence

```typescript
it('should persist queue to AsyncStorage', async () => {
  await useOfflineStore.getState().addToQueue({
    table: 'accounts',
    operation: 'create',
    data: { id: '1', name: 'Test' },
    timestamp: new Date().toISOString(),
  });

  const queueStr = mockStorage['sync_queue'];
  expect(queueStr).toBeDefined();
  const queue = JSON.parse(queueStr);
  expect(queue.length).toBe(1);
  expect(queue[0].synced).toBe(false);
});
```

## SyncStatusBar Component

```typescript
// src/components/SyncStatusBar.tsx
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useOfflineStore } from '../services/offline';
import { useTheme } from 'react-native-paper';

export const SyncStatusBar: React.FC = () => {
  const theme = useTheme();
  const isOnline = useOfflineStore(state => state.isOnline);
  const isSyncing = useOfflineStore(state => state.isSyncing);
  const pendingChanges = useOfflineStore(state => state.pendingChanges);

  useEffect(() => {
    const unsubscribe = setupNetworkListener();
    return unsubscribe;
  }, []);

  if (isSyncing) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.primaryContainer }]}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
        <Text style={[styles.text, { color: theme.colors.onPrimaryContainer }]}>
          Sincronizando...
        </Text>
      </View>
    );
  }

  if (!isOnline) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.errorContainer }]}>
        <Text style={[styles.text, { color: theme.colors.onErrorContainer }]}>
          ⚠ Sin conexión • {pendingChanges} cambios pendientes
        </Text>
      </View>
    );
  }

  if (pendingChanges > 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.tertiaryContainer }]}>
        <Text style={[styles.text, { color: theme.colors.onTertiaryContainer }]}>
          {pendingChanges} cambios pendientes de sincronizar
        </Text>
      </View>
    );
  }

  return null;
};
```

## Common Pitfalls

1. **Forgetting to mark queue items as synced** - Results in duplicate server entries
2. **Not handling ID replacement** - Local IDs (`local-*`) differ from server UUIDs
3. **Not awaiting SQLite operations** - `runAsync`/`getAllAsync` are promises
4. **NetInfo listener not cleaned up** - Returns unsubscribe function
5. **Sync loop without guard** - Always check `isSyncing` flag
6. **Not testing with mocked AsyncStorage** - Use `mockStorage` object
7. **Missing `partialialize` in persist** - Can persist functions to AsyncStorage
8. **Not using `INSERT OR REPLACE INTO`** - Needed for idempotent local saves
