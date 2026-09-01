# Row Level Security (RLS) Patterns

## Basic Patterns

### User-owned data (most common)

```sql
-- Enable RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own data"
  ON table_name FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own data
CREATE POLICY "Users can insert own data"
  ON table_name FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own data
CREATE POLICY "Users can update own data"
  ON table_name FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own data
CREATE POLICY "Users can delete own data"
  ON table_name FOR DELETE
  USING (auth.uid() = user_id);
```

### Shared data (e.g., team-based access)

```sql
-- Users can see data from their organization
CREATE POLICY "Users can view org data"
  ON table_name FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM user_memberships
      WHERE user_id = auth.uid()
    )
  );
```

### Public read, authenticated write

```sql
-- Anyone can read
CREATE POLICY "Public can view"
  ON table_name FOR SELECT
  USING (true);

-- Only authenticated users can insert
CREATE POLICY "Authenticated can insert"
  ON table_name FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
```

### Admin-only access

```sql
-- Only admins can modify
CREATE POLICY "Admins can manage"
  ON table_name FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id FROM admins
    )
  );
```

## Automatic updated_at

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_table_name_updated_at
  BEFORE UPDATE ON table_name
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## Indexes for RLS Performance

Always index columns used in RLS policies:

```sql
-- For user-owned data policies
CREATE INDEX idx_table_name_user_id ON table_name(user_id);

-- For organization-based policies
CREATE INDEX idx_table_name_org_id ON table_name(org_id);

-- Composite indexes for common query patterns
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date DESC);
```

## Testing RLS

```sql
-- Set the current user for testing
SET LOCAL ROLE postgres;
SELECT set_config('request.jwt.claims', '{"sub": "user-uuid-here"}', true);

-- Now run queries as that user
SELECT * FROM table_name;

-- Reset
RESET ROLE;
```

## Common Mistakes

1. **Forgetting to enable RLS** — Without `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, policies don't apply
2. **Missing WITH CHECK on INSERT/UPDATE** — Users could insert data for other users
3. **Not indexing user_id** — Queries become slow as data grows
4. **Using auth.role() instead of auth.uid()** — `auth.role()` returns 'authenticated', not the user ID
5. **Policies on auth.users** — Don't add RLS to auth.users; it's managed by Supabase
