# Backup en Nube con Supabase Storage

Patrón para implementar backup y restauración de datos del usuario usando Supabase Storage.

## Arquitectura

```
[Usuario] → [BackupService] → [Supabase Storage bucket: backups]
                    ↓
            [backup_metadata tabla]
```

## Estructura de datos

```typescript
export interface BackupData {
  version: string;        // ej: "2.1.0"
  exportedAt: string;
  tables: {
    accounts?: any[];
    transactions?: any[];
    budgets?: any[];
    savings_goals?: any[];
    loans?: any[];
    investments?: any[];
    debts?: any[];
    recurring_transactions?: any[];
    credit_cards?: any[];
    transfers?: any[];
    trips?: any[];
    trip_expenses?: any[];
  };
}

export interface BackupMetadata {
  id: string;
  userId: string;
  filename: string;
  size: number;
  tables: string[];
  createdAt: string;
  checksum: string;  // SHA-256 para integridad
}

export const BACKUP_VERSION = '2.1.0';
```

## Tabla metadata

```sql
CREATE TABLE IF NOT EXISTS backup_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL UNIQUE,
  size BIGINT NOT NULL DEFAULT 0,
  tables TEXT[] NOT NULL DEFAULT '{}',
  checksum TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE backup_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own backups" ON backup_metadata FOR ALL 
  USING (auth.uid() = user_id);
```

## Storage bucket

```sql
-- Crear bucket (ejecutar en Supabase SQL editor)
INSERT INTO storage.buckets (id, name, public) VALUES ('backups', 'backups', false);
```

## Servicio Angular

```typescript
@Injectable({ providedIn: 'root' })
export class BackupService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Crea backup completo de datos del usuario
   */
  async createBackup(): Promise<BackupMetadata> {
    const userId = this.supabase.user?.id;
    if (!userId) throw new Error('User not authenticated');

    const tables = [
      'accounts', 'transactions', 'budgets', 'savings_goals',
      'loans', 'investments', 'debts', 'recurring_transactions',
      'credit_cards', 'transfers', 'trips', 'trip_expenses',
    ];

    const backupData: BackupData = {
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      tables: {},
    };

    // Exportar cada tabla
    for (const table of tables) {
      const { data, error } = await this.supabase.client
        .from(table)
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;
      if (data && data.length > 0) {
        backupData.tables[table as keyof BackupData['tables']] = data;
      }
    }

    // Upload a Storage
    const filename = `backup_${userId}_${Date.now()}.json`;
    const blob = new Blob([JSON.stringify(backupData)], { type: 'application/json' });
    const { error: uploadError } = await this.supabase.client.storage
      .from('backups')
      .upload(filename, blob);

    if (uploadError) throw uploadError;

    // Calcular checksum
    const checksum = await this.calculateChecksum(JSON.stringify(backupData));

    // Guardar metadata
    const metadata: BackupMetadata = {
      id: `bkp_${Date.now()}`,
      userId,
      filename,
      size: blob.size,
      tables,
      createdAt: new Date().toISOString(),
      checksum,
    };

    await this.supabase.client.from('backup_metadata').insert(metadata);
    return metadata;
  }

  /**
   * Restaura datos desde un backup
   */
  async restoreBackup(backupData: BackupData): Promise<void> {
    const userId = this.supabase.user?.id;
    if (!userId) throw new Error('User not authenticated');

    if (!backupData.version || !backupData.tables) {
      throw new Error('Invalid backup file format');
    }

    for (const [table, records] of Object.entries(backupData.tables)) {
      if (!records || records.length === 0) continue;

      // Borrar datos existentes
      await this.supabase.client.from(table).delete().eq('user_id', userId);

      // Insertar backup
      const { error } = await this.supabase.client.from(table).insert(records);
      if (error) throw error;
    }
  }

  /**
   * Lista backups del usuario
   */
  async listBackups(): Promise<BackupMetadata[]> {
    const userId = this.supabase.user?.id;
    if (!userId) return [];

    const { data, error } = await this.supabase.client
      .from('backup_metadata')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Descarga archivo de backup
   */
  async downloadBackup(filename: string): Promise<Blob> {
    const userId = this.supabase.user?.id;
    if (!userId) throw new Error('User not authenticated');

    const { data, error } = await this.supabase.client.storage
      .from('backups')
      .download(filename);

    if (error) throw error;
    return data;
  }

  /**
   * Elimina backup
   */
  async deleteBackup(filename: string): Promise<void> {
    const userId = this.supabase.user?.id;
    if (!userId) throw new Error('User not authenticated');

    await this.supabase.client.storage.from('backups').remove([filename]);

    await this.supabase.client
      .from('backup_metadata')
      .delete()
      .eq('filename', filename)
      .eq('user_id', userId);
  }

  /**
   * Calcula checksum SHA-256
   */
  private async calculateChecksum(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}
```

## Tests

```typescript
describe('BackupService', () => {
  let service: BackupService;
  let supabaseServiceMock: any;

  beforeEach(() => {
    const createChain = () => {
      const chain: any = {};
      chain.select = jasmine.createSpy('select').and.returnValue(chain);
      chain.insert = jasmine.createSpy('insert').and.returnValue(chain);
      chain.update = jasmine.createSpy('update').and.returnValue(chain);
      chain.delete = jasmine.createSpy('delete').and.returnValue(chain);
      chain.eq = jasmine.createSpy('eq').and.returnValue(chain);
      chain.order = jasmine.createSpy('order').and.returnValue(chain);
      chain.single = jasmine.createSpy('single').and.resolveTo({ data: null });
      return chain;
    };

    const storageMock: any = {};
    storageMock.from = jasmine.createSpy('from').and.returnValue(storageMock);
    storageMock.upload = jasmine.createSpy('upload').and.resolveTo({ data: null, error: null });
    storageMock.download = jasmine.createSpy('download').and.resolveTo({ data: new Blob(['{}']), error: null });
    storageMock.remove = jasmine.createSpy('remove').and.resolveTo({ data: null, error: null });

    supabaseServiceMock = {
      client: { 
        from: jasmine.createSpy('from').and.callFake(() => createChain()), 
        storage: storageMock 
      },
      user: { id: 'user-1' },
      storage: storageMock,
    };

    TestBed.configureTestingModule({
      providers: [BackupService, { provide: SupabaseService, useValue: supabaseServiceMock }],
    });
    service = TestBed.inject(BackupService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should expose createBackup method', () => {
    expect(typeof service.createBackup).toBe('function');
  });

  it('should expose restoreBackup method', () => {
    expect(typeof service.restoreBackup).toBe('function');
  });

  it('should expose listBackups method', () => {
    expect(typeof service.listBackups).toBe('function');
  });
});
```

## Pitfall: Storage mock en Jasmine

```typescript
// ✅ CORRECTO — from() retorna el mismo mock
storageMock.from = jasmine.createSpy('from').and.returnValue(storageMock);

// ❌ INCORRECTO — returnThis() no existe en Jasmine
storageMock.from = jasmine.createSpy('from').and.returnThis();
```

## Pitfall: callFake para chains múltiples

Cuando el servicio llama a múltiples tablas (`from('accounts')`, `from('transactions')`, etc.), cada llamada necesita un chain NUEVO:

```typescript
supabaseServiceMock = {
  client: { 
    from: jasmine.createSpy('from').and.callFake(() => createChain()) 
  },
};
```

Si usas `returnValue(mockChain)`, todas las llamadas comparten el mismo chain y los spies acumulan calls incorrectamente.
