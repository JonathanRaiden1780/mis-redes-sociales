# Angular + Supabase Implementation Patterns (Finanzeasy Hardening 2026-08-18)

## Angular Testing Patterns

### Standalone Component Test Setup
```typescript
// BAD: declarations array rejects standalone components
TestBed.configureTestingModule({
  declarations: [HeaderComponent],  // ERROR
  imports: [RouterTestingModule],
});

// GOOD: imports array for standalone components
TestBed.configureTestingModule({
  imports: [RouterTestingModule.withRoutes([]), IonicModule, HeaderComponent],
});
```

### Mocking Services with Observable Getters
When a service exposes `user$` as a getter (e.g., `get userState$() { return this.user$; }`), the spy must mirror that structure:

```typescript
const authServiceMock = {
  user$: of(mockUser),
  get userState$() { return this.user$; },  // Mirror the getter
  signOut: jasmine.createSpy('signOut'),
};
```

### RouterTestingModule for Navigation Tests
Always provide routes to avoid `NG04002: Cannot match any routes`:
```typescript
RouterTestingModule.withRoutes([
  { path: 'login', loadComponent: () => import('../pages/login/login.page').then((m) => m.LoginPage) },
])
```
Or empty routes if navigation target doesn't matter: `RouterTestingModule.withRoutes([])`.

## Supabase JS Response Typing

### List Responses
```typescript
// BAD: `as Type` cast hides shape mismatches and causes TS2322 errors
return data as Transaction[];  // Type 'Transaction[][]' not assignable to 'Transaction[]'

// GOOD: use response.data with null coalescing
const response = await supabaseService.supabase
  .from('transactions')
  .select('*')
  .order('date', { ascending: false });
if (response.error) throw response.error;
return response.data ?? [];
```

### Single-Row Responses
```typescript
const response = await supabaseService.supabase
  .from('transactions')
  .select('*')
  .eq('id', id)
  .single();
if (response.error) throw response.error;
if (!response.data) throw new Error('No data returned');
return response.data;
```

## Nginx Hardening

### Security Headers Block
```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
```

### Rate Limiting
```nginx
# Define zones at http level (outside server block)
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;

# Apply per route
location ~ ^/(login|register|verify-email) {
    limit_req zone=auth burst=3 nodelay;
}
location / {
    limit_req zone=api burst=10 nodelay;
}
```

## Docker Hardening

### Multi-Stage + Non-Root User
```dockerfile
FROM node:20-alpine AS builder
# ... build steps ...

FROM nginx:alpine
RUN adduser -D -H -u 1001 nginxuser && \
    chown -R nginxuser:nginxuser /usr/share/nginx/html && \
    chown -R nginxuser:nginxuser /var/cache/nginx && \
    chown -R nginxuser:nginxuser /var/log/nginx && \
    chown -R nginxuser:nginxuser /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginxuser:nginxuser /var/run/nginx.pid
COPY --from=builder /app/www /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
USER nginxuser
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## Repository Pattern (Angular + Supabase)

### Interface Definition
```typescript
// src/app/Interfaces/ITransactionRepository.ts
import { Transaction } from '../Interfaces/models';

export interface ITransactionRepository {
  getAll(): Promise<Transaction[]>;
  getById(id: string): Promise<Transaction | null>;
  create(transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>): Promise<Transaction>;
  update(id: string, data: Partial<Transaction>): Promise<Transaction>;
  delete(id: string): Promise<void>;
}
```

### Service Implementation
```typescript
@Injectable({ providedIn: 'root' })
export class TransactionService implements ITransactionRepository {
  private readonly supabaseService = inject(SupabaseService);
  // ... methods use response.data ?? [] pattern
}
```

## ESLint Security Rules

```json
{
  "rules": {
    "no-debugger": "error",
    "no-console": ["error", { "allow": ["warn", "error"] }]
  }
}
```

## pnpm Migration Notes

### Install Approvals (Puppeteer/Chromium)
```bash
# After adding puppeteer, approve build scripts
pnpm approve-builds --all
# Or individually: pnpm approve-builds puppeteer
```

### SkipLibCheck for Supabase Types
Supabase JS ships types that conflict with browser libs. Add to `tsconfig.json`:
```json
{
  "compilerOptions": {
    "skipLibCheck": true
  }
}
```

## Test Password Validation Pattern

When testing forms with password validation (minLength + pattern), use passwords that satisfy the rules:
```typescript
// Pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/
component.formLogin.controls.password.setValue('SecurePass1!');  // passes
component.formLogin.controls.password.setValue('securepass123'); // fails (no uppercase/special)
```

## Supabase Migration Template

```sql
-- Enable RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Policies (cover all operations)
CREATE POLICY "Users can view own <entities>"
  ON table_name FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own <entities>"
  ON table_name FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own <entities>"
  ON table_name FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own <entities>"
  ON table_name FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tablename_updated_at
  BEFORE UPDATE ON table_name
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```
