# TDD + Angular + Karma: Pitfalls de Mocking

## Pitfall: spyOn en módulos ES no es writable

Cuando usas `spyOn(require('xlsx'), 'writeFile').and.stub()` en Karma + Angular, obtienes:
```
Error: writeFile is not declared writable or has no setter
```

**Causa:** Los módulos ES importados via `import * as XLSX` tienen propiedades no configurables/writable.

**Solución 1 — Mock del módulo completo (recomendado para nuevos tests):**
```typescript
jest.mock('xlsx', () => ({
  utils: {
    book_new: jest.fn(() => ({})),
    aoa_to_sheet: jest.fn(() => ({ '!ref': 'A1:B1' })),
    book_append_sheet: jest.fn(),
  },
  writeFile: jest.fn(),
}));
```

**Solución 2 — Tests sin spies destructivos (para Karma):**
```typescript
it('should not throw when calling export', () => {
  expect(() => service.exportTransactionsReport([], [], [])).not.toThrow();
});

it('should not throw with empty data', () => {
  expect(() => service.exportTransactionsReport([], [], [])).not.toThrow();
});
```

**Solución 3 — Usar callThrough con spies parciales:**
```typescript
const writeFileSpy = spyOn(XLSX, 'writeFile').and.callThrough();
// Luego verificar que fue llamado sin stub behavior
expect(writeFileSpy).toHaveBeenCalled();
```

## Regla de oro

En Angular + Karma, evita `spyOn(module, 'method').and.stub()` sobre módulos ES. Usa:
1. `jest.mock` a nivel de módulo (si usas Jest)
2. Tests que verifican "no lanza excepción" en vez de "llama a método X"
3. Inyección de dependencias para servicios propios

## Mock chain pattern para Supabase (callFake para chains frescos)

Cuando el servicio llama multiples veces a `supabase.client.from('tabla')`, cada llamada necesita un chain NUEVO. Si usas `returnValue(mockChain)`, todas las llamadas comparten el mismo chain y los spies acumulan calls de forma incorrecta.

**Patrón correcto con callFake:**

```typescript
const createChain = () => {
  const chain: any = {};
  chain.select = jasmine.createSpy('select').and.returnValue(chain);
  chain.insert = jasmine.createSpy('insert').and.returnValue(chain);
  chain.update = jasmine.createSpy('update').and.returnValue(chain);
  chain.delete = jasmine.createSpy('delete').and.returnValue(chain);
  chain.eq = jasmine.createSpy('eq').and.returnValue(chain);
  chain.order = jasmine.createSpy('order').and.returnValue(chain);
  chain.gte = jasmine.createSpy('gte').and.returnValue(chain);
  chain.single = jasmine.createSpy('single').and.resolveTo({ data: null });
  return chain;
};

supabaseServiceMock = {
  client: { 
    from: jasmine.createSpy('from').and.callFake(() => createChain()), 
  },
};
```

**Cuando NO usar callFake:** Si el servicio solo llama `from()` una vez, `returnValue(mockChain)` es suficiente y más simple.

## Mock de Supabase Storage (returnThis no existe en Jasmine)

El API de Supabase Storage usa `.storage.from('bucket').upload()` donde `from()` debe retornar el MISMO objeto storage. En Jasmine, `and.returnThis()` NO existe.

**Patrón correcto:**

```typescript
const storageMock: any = {};
storageMock.from = jasmine.createSpy('from').and.returnValue(storageMock);
storageMock.upload = jasmine.createSpy('upload').and.resolveTo({ data: null, error: null });
storageMock.download = jasmine.createSpy('download').and.resolveTo({ data: new Blob(['{}']), error: null });
storageMock.remove = jasmine.createSpy('remove').and.resolveTo({ data: null, error: null });

supabaseServiceMock = {
  client: { from: jasmine.createSpy('from').and.callFake(() => createChain()), storage: storageMock },
  storage: storageMock,
};
```

**Error que obtienes si no lo haces bien:**
```
Property 'returnThis' does not exist on type 'SpyAnd<Func>'
```

**Fix:** Usa `and.returnValue(storageMock)` explícitamente — `from()` retorna el mock completo que tiene `upload()`, `download()`, `remove()`.

## Tests para servicios con Storage

Cuando el servicio usa `client.storage`, el test falla con `NullInjectorError` si no provees el mock completo. Siempre incluye `storage: storageMock` en el `client` mock.

```typescript
// ✅ CORRECTO — storage mock incluido
TestBed.configureTestingModule({
  providers: [BackupService, { provide: SupabaseService, useValue: supabaseServiceMock }],
});
```

## Patrón: Backup con SHA-256

Para crear backups con integridad de datos:

```typescript
async createBackup(): Promise<BackupMetadata> {
  const backupData = { version: BACKUP_VERSION, exportedAt: new Date().toISOString(), tables: {} };
  
  for (const table of tables) {
    const { data } = await this.supabase.client.from(table).select('*').eq('user_id', userId);
    if (data?.length) backupData.tables[table] = data;
  }
  
  const blob = new Blob([JSON.stringify(backupData)], { type: 'application/json' });
  await this.supabase.client.storage.from('backups').upload(filename, blob);
  
  const checksum = await this.calculateChecksum(JSON.stringify(backupData));
  // ... guardar metadata con checksum
}

private async calculateChecksum(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

**Mock en tests:** Usa `storageMock.upload = jasmine.createSpy('upload').and.resolveTo({ data: null, error: null })` para evitar llamadas reales a Supabase Storage.

## Verificación post-merge

Después de cada merge --no-ff a testing/Ai, ejecutar verificación:

```bash
# Verificar que no hubo pérdida de tests
export CHROME_BIN=/path/to/chrome && pnpm run test:ci | grep "TOTAL:"

# Si hay fallos, investigar inmediatamente
```

En esta sesión se perdió temporalmente 1 test después de merge (de 185 a 184) porque el mock chain tenía `returnThis()` en vez de `returnValue(mockChain)`.
