---
name: offline-first-mobile
description: "Build offline-first mobile apps with SQLite."
---

# Offline-First Mobile

## When to Use

- Building React Native / Expo apps that must work without internet
- Implementing local data persistence with SQLite
- Creating a sync queue that survives app restarts
- Detecting network state and auto-syncing when connection returns
- Multi-step create/update/delete operations that need to sync to Supabase/postgREST

## Architecture

```
+-------------------------------------------------------------+
|                     Offline-First Stack                      |
+-------------------------------------------------------------+
|  UI Components (React Native Paper)                         |
|  +-- SyncStatusBar (online/offline/pending indicator)       |
+-------------------------------------------------------------+
|  Zustand Store (offline state + sync queue)                 |
|  +-- useOfflineStore                                        |
+-------------------------------------------------------------+
|  Services (offline-first pattern)                           |
|  +-- Save locally, Queue for sync, Sync if online          |
+-------------------------------------------------------------+
|  Local Storage                                               |
|  +-- expo-sqlite (primary data: accounts, transactions)    |
|  +-- AsyncStorage (sync queue, app state)                   |
+-------------------------------------------------------------+
|  Network Detection                                          |
|  +-- @react-native-community/netinfo                        |
+-------------------------------------------------------------+
```

## Core Components

### 1. Offline Store (src/services/offline.ts)

Combines a Zustand store (for app state) with SQLite (for data) and AsyncStorage (for sync queue):

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { openDatabaseAsync } from 'expo-sqlite';
import NetInfo from '@react-native-community/netinfo';

interface OfflineState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt: string | null;
  pendingChanges: number;
}

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set, get) => ({ /* State + actions */ }),
    {
      name: 'offline-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isOnline: state.isOnline,
        lastSyncAt: state.lastSyncAt,
        pendingChanges: state.pendingChanges,
      }),
    }
  )
);
```

### 2. SQLite Database Schema

All tables include a `dirty` INTEGER column (0 = synced, 1 = local modification pending sync):

```sql
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  dirty INTEGER DEFAULT 0
);
```

**Pitfall:** Use `INSERT OR REPLACE INTO` for idempotent local saves. This handles both initial sync from server and re-sync after offline changes.

### 3. Sync Queue

Queue items are persisted in AsyncStorage and survive app restarts:

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

### 4. Service Pattern (Offline-First)

Every service method follows this flow:

```typescript
async create(userId, data) {
  const offlineStore = useOfflineStore.getState();
  const id = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  
  // 1. Save locally (dirty = 1)
  await offlineStore.saveLocal('accounts', { ...newItem, dirty: 1 });
  
  // 2. Add to sync queue
  await offlineStore.addToQueue({
    table: 'accounts',
    operation: 'create',
    data: newItem,
    timestamp: now,
  });
  
  // 3. If online, try to sync immediately
  if (offlineStore.isOnline) {
    try {
      const { data: serverData } = await supabase.from('accounts').insert(newItem).select().single();
      await offlineStore.saveLocal('accounts', { ...serverData, dirty: 0 });
      await offlineStore.markAsSynced(queueItemId);
      return serverData;
    } catch (error) {
      // Will be retried automatically when network recovers
    }
  }
  
  return newItem; // Return local item for immediate UI update
}
```

### 5. Network Detection + Auto-Sync

```typescript
export function setupNetworkListener() {
  return NetInfo.addEventListener(state => {
    const isConnected = state.isConnected ?? false;
    useOfflineStore.getState().setOnline(isConnected);
    if (isConnected) triggerSync();
  });
}
```

## Sync Strategies

### Optimistic Local-First

1. Write to SQLite immediately
2. Add to sync queue
3. Attempt server sync if online
4. On success: mark synced, replace local with server data
5. On failure: leave in queue, auto-retry when online

### Read Pattern

1. Always read from SQLite (fast, works offline)
2. If online, fetch from server in background
3. Update SQLite with fresh data
4. Return fresh data to UI

### Conflict Resolution

- **Last-write-wins:** Use `updated_at` timestamps (default for Finanzeasy)
- **Server-wins:** If server returns 409, accept server version
- **Manual merge:** Rare in personal finance apps (single user per data)

## SyncStatusBar Component

Visual indicator placed at top of main screens:

```typescript
export const SyncStatusBar: React.FC = () => {
  const isOnline = useOfflineStore(state => state.isOnline);
  const isSyncing = useOfflineStore(state => state.isSyncing);
  const pendingChanges = useOfflineStore(state => state.pendingChanges);

  if (isSyncing) return <ActivityIndicator + "Sincronizando..." />;
  if (!isOnline) return "Sin conexión - X cambios pendientes";
  if (pendingChanges > 0) return "X cambios pendientes de sincronizar";
  return null; // Everything synced
};
```

## Common Pitfalls

1. **Not using `dirty` column** - Cannot distinguish locally-modified from synced records
2. **Forgetting to mark queue items as synced** - Duplicate server entries on next sync
3. **Not handling ID replacement** - Local IDs (`local-*`) differ from server UUIDs
4. **Missing `partialialize` in persist** - Can persist functions to AsyncStorage
5. **Not awaiting SQLite operations** - `runAsync`/`getAllAsync` are promises
6. **NetInfo listener not cleaned up** - Returns unsubscribe function
7. **Sync loop without guard** - Always check `isSyncing` flag
8. **Not testing with mocked AsyncStorage** - Use `mockStorage` object in tests

## Testing

```typescript
// Mock AsyncStorage with in-memory object
let mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn((key, value) => { mockStorage[key] = value; return Promise.resolve(); }),
  getItem: jest.fn((key) => Promise.resolve(mockStorage[key] || null)),
  removeItem: jest.fn((key) => { delete mockStorage[key]; return Promise.resolve(); }),
}));

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
}));

// Mock expo-sqlite
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(() => Promise.resolve({
    execAsync: jest.fn(() => Promise.resolve()),
    runAsync: jest.fn(() => Promise.resolve()),
    getAllAsync: jest.fn(() => Promise.resolve([])),
  })),
}));
```

## Verification Checklist

- [ ] SQLite tables created with `dirty` column
- [ ] All CRUD methods in services follow offline-first pattern
- [ ] Sync queue persisted in AsyncStorage (survives restart)
- [ ] Network listener triggers auto-sync
- [ ] SyncStatusBar shows correct state
- [ ] Local IDs replaced with server UUIDs after sync
- [ ] `isSyncing` guard prevents concurrent syncs
- [ ] Tests mock AsyncStorage, NetInfo, and expo-sqlite

## References

- `references/finanzeasy-offline-implementation.md`
- `references/supabase-offline-sync-patterns.md`
- `templates/offline-service.template.ts`
