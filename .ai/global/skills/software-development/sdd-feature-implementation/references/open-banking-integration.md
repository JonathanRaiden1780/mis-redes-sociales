# Open Banking Integration Pattern

> **Fecha:** 2026-08-19
> **Proyecto:** Finanzeasy
> **Proveedores soportados:** Belvo, Tink, Plaid

---

## Descripción

Integración de Open Banking para importar transacciones bancarias automáticamente desde instituciones financieras.

## Arquitectura

```
[Finanzeasy] → [OpenBankingService] → HTTP POST → [Proveedor: Belvo/Tink/Plaid]
                                      ↓
                                [bank_connections]
                                [bank_transactions]
                                      ↓
                                [SyncResult]
```

## Implementación

### OpenBankingService (Finanzeasy)

```typescript
@Injectable({ providedIn: 'root' })
export class OpenBankingService {
  private config: OpenBankingConfig | null = null;

  constructor(
    private readonly http: HttpClient,
    private readonly supabase: SupabaseService
  ) {}

  configure(config: OpenBankingConfig): void {
    this.config = config;
  }

  async initiateConnection(bankCode: string): Promise<{ linkId: string; url: string }> {
    // Inicia flujo OAuth con el proveedor
  }

  async completeConnection(linkId: string, accountId: string): Promise<BankConnection> {
    // Completa conexión después del OAuth
  }

  async syncTransactions(connectionId: string, fromDate?: string): Promise<SyncResult> {
    // Sincroniza transacciones del banco
    // Detecta duplicados
    // Importa a bank_transactions
  }

  async getBankTransactions(connectionId?: string): Promise<BankTransaction[]> {
    // Obtiene transacciones importadas
  }

  async markAsImported(transactionIds: string[], localTransactionId: string): Promise<void> {
    // Marca como importadas a transacciones locales
  }

  async revokeConnection(connectionId: string): Promise<void> {
    // Revoca acceso
  }
}
```

### Interfaces

```typescript
export interface BankConnection {
  id: string;
  userId: string;
  provider: 'belvo' | 'tink' | 'plaid' | 'manual';
  bankName: string;
  accessToken: string; // Encrypted
  refreshToken?: string; // Encrypted
  status: 'active' | 'expired' | 'revoked';
  lastSync?: string;
}

export interface BankTransaction {
  id: string;
  connectionId: string;
  userId: string;
  externalId: string;
  amount: number;
  currency: string;
  description: string;
  category?: string;
  transactionDate: string;
  imported: boolean;
  localTransactionId?: string;
}

export interface SyncResult {
  connectionId: string;
  totalImported: number;
  newTransactions: number;
  duplicates: number;
  errors: string[];
  syncedAt: string;
}
```

### Tablas Supabase

```sql
CREATE TABLE bank_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('belvo', 'tink', 'plaid', 'manual')),
  bank_name TEXT NOT NULL,
  access_token TEXT NOT NULL, -- Encrypted at application level
  refresh_token TEXT, -- Encrypted at application level
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  last_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES bank_connections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'MXN',
  description TEXT NOT NULL,
  category TEXT,
  transaction_date DATE NOT NULL,
  imported BOOLEAN NOT NULL DEFAULT false,
  local_transaction_id UUID,
  raw_data JSONB,
  UNIQUE(connection_id, external_id)
);
```

### RLS Policies

```sql
CREATE POLICY "Users can view own connections"
  ON bank_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own connections"
  ON bank_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own bank transactions"
  ON bank_transactions FOR SELECT
  USING (auth.uid() = user_id);
```

## Tests

```typescript
describe('OpenBankingService', () => {
  let service: OpenBankingService;
  let supabaseServiceMock: any;
  let httpClientMock: any;

  beforeEach(() => {
    const mockChain: any = {};
    mockChain.select = jasmine.createSpy('select').and.returnValue(mockChain);
    mockChain.insert = jasmine.createSpy('insert').and.returnValue(mockChain);
    mockChain.update = jasmine.createSpy('update').and.returnValue(mockChain);
    mockChain.eq = jasmine.createSpy('eq').and.returnValue(mockChain);
    mockChain.in = jasmine.createSpy('in').and.returnValue(mockChain);
    mockChain.single = jasmine.createSpy('single').and.returnValue(Promise.resolve({ data: null }));

    supabaseServiceMock = {
      client: { from: jasmine.createSpy('from').and.returnValue(mockChain) },
      user: { id: 'user-1' },
    };

    httpClientMock = {
      post: jasmine.createSpy('post').and.returnValue({ toPromise: () => Promise.resolve([]) }),
    };

    TestBed.configureTestingModule({
      providers: [
        OpenBankingService,
        { provide: SupabaseService, useValue: supabaseServiceMock },
        { provide: HttpClient, useValue: httpClientMock },
      ],
    });
    service = TestBed.inject(OpenBankingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have configure method', () => {
    expect(typeof service.configure).toBe('function');
  });

  it('should have initiateConnection method', () => {
    expect(typeof service.initiateConnection).toBe('function');
  });

  it('should have syncTransactions method', () => {
    expect(typeof service.syncTransactions).toBe('function');
  });
});
```

## Seguridad

- **Tokens cifrados**: access_token y refresh_token deben cifrarse a nivel de aplicación (Fernet + PBKDF2)
- **RLS**: Solo el usuario puede ver/modificar sus propias conexiones
- **Validación de proveedor**: Solo se permiten proveedores configurados
- **Detección de duplicados**: UNIQUE constraint en (connection_id, external_id)

## Próximos Pasos

- [ ] Implementar webhook para notificaciones de nuevas transacciones
- [ ] Agregar soporte para múltiples monedas
- [ ] Mejorar categorización automática de transacciones importadas
- [ ] Agregar UI para conectar bancos

---

**Última actualización:** 2026-08-19
