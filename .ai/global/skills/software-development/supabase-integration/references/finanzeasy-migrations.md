# Supabase Migration Patterns

**Project:** Finanzeasy  
**Date:** 2026-08-18

## Standard Migration Template

```sql
-- Migración: [Descripción]
-- Fecha: [YYYY-MM-DD]

CREATE TABLE IF NOT EXISTS [table_name] (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- columns...
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_[table]_user_id ON [table_name](user_id);

-- Habilitar RLS
ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
CREATE POLICY "Users can view own [table]"
  ON [table_name] FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own [table]"
  ON [table_name] FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own [table]"
  ON [table_name] FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own [table]"
  ON [table_name] FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_[table]_updated_at
  BEFORE UPDATE ON [table_name]
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## Migrations Created

| # | File | Tables | Notes |
|---|------|--------|-------|
| 1 | 0001_initial.sql | accounts, transactions | Initial schema with RLS |
| 2 | 0002_budgets.sql | budgets | Budget tracking |
| 3 | 0003_savings_goals.sql | savings_goals | Goals with progress |
| 4 | 0004_transfers.sql | transfers | Inter-account transfers with trigger |
| 5 | 0005_loans_investments_debts.sql | loans, investments, debts | Financial instruments |
| 6 | 0006_recurring_transactions.sql | recurring_transactions | Subscriptions/recurring |
| 7 | 0007_credit_cards_reports.sql | credit_cards, reports | Credit management |

## RLS Policy Patterns

### Standard CRUD (all tables)
```sql
CREATE POLICY "Users can view own data" ON table FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own data" ON table FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own data" ON table FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own data" ON table FOR DELETE USING (auth.uid() = user_id);
```

### Foreign Key References
- `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- `account_id UUID REFERENCES accounts(id) ON DELETE SET NULL` (optional FK)
- `category_id UUID REFERENCES categories(id) ON DELETE SET NULL` (optional FK)

### Trigger Pattern
```sql
CREATE TRIGGER update_[table]_updated_at
  BEFORE UPDATE ON [table]
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Note:** The function `update_updated_at_column()` is created in migration 0001 and reused across all subsequent migrations.

## Indexing Strategy

| Column Type | Index |
|-------------|-------|
| Primary key | Automatic (id) |
| user_id | Always index (used in RLS + queries) |
| Foreign keys | Index (account_id, category_id) |
| Date columns | Index if frequently queried (date, next_due_date) |
| Boolean flags | Index if filtered often (active, is_paid) |

## TypeScript Interface Pattern

```typescript
export interface [Entity] {
  id: string;
  user_id: string;
  // snake_case fields matching PostgreSQL columns
  created_at: string;
  updated_at: string;
}
```

## Angular Service Pattern

```typescript
@Injectable({ providedIn: 'root' })
export class [Entity]Service implements I[Entity]Repository {
  private readonly supabaseService = inject(SupabaseService);

  async getAll(): Promise<[Entity][]> {
    const response = await this.supabaseService.supabase
      .from('[table_name]')
      .select('*')
      .order('created_at', { ascending: false });
    if (response.error) throw response.error;
    return response.data ?? [];
  }
  // ... CRUD methods
}
```

## Common Pitfalls

1. **Forgetting `IF NOT EXISTS`** — Migrations should be idempotent
2. **Missing `user_id` index** — Every query filters by user_id
3. **Forgetting RLS enable** — Table is public without it
4. **Missing CASCADE** — Orphaned rows when user deleted
5. **Not adding trigger** — updated_at won't auto-update
6. **Forgetting `@types/node`** — Supabase storage-js needs it
7. **Not using `skipLibCheck`** — Third-party type conflicts
