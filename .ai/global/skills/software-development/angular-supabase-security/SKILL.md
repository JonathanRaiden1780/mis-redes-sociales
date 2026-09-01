---
name: angular-supabase-security
description: "Security hardening for Angular + Supabase applications."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [security, angular, supabase, postgresql, docker, hardening]
    related_skills: [supabase-integration, security-audit, requesting-code-review]
---

# Angular + Supabase Security

Security hardening specific to Angular applications using Supabase as backend.

## When to Use

- Securing an Angular/Ionic app with Supabase Auth and PostgreSQL
- Hardening Docker Compose for Supabase stack
- Reviewing Angular app for XSS, CSRF, injection vulnerabilities
- Configuring Nginx security headers for SPA
- Setting up automated PostgreSQL backups securely
- Auditing Row Level Security (RLS) policies

## Angular-Specific Security

### XSS Prevention

Angular auto-sanitizes interpolation `{{ }}`, but bypasses exist:

```typescript
// DANGEROUS: bypasses sanitization
this.sanitizer.bypassSecurityTrustHtml(userInput);

// SAFE: let Angular sanitize
<div [innerHTML]="userInput"></div>

// DANGEROUS: direct DOM access
document.getElementById('output').innerHTML = userInput;

// SAFE: use Angular template binding
<div>{{ userInput }}</div>
```

### CSRF Protection

```typescript
// Add CSRF token to all mutating requests
headers: {
  'X-CSRF-Token': this.csrfToken,
  'X-Requested-With': 'XMLHttpRequest'
}
```

### Route Guards

```typescript
// Always protect authenticated routes
@Injectable({ providedIn: 'root' })
export class AuthGuard {
  canActivate(): boolean {
    if (!this.authService.getCurrentUser()) {
      this.router.navigate(['/login']);
      return false;
    }
    return true;
  }
}
```

## Supabase Auth Security

### JWT Configuration

```typescript
// Supabase client with secure defaults
createClient(url, key, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',  // Most secure OAuth flow
  },
});
```

### Email Verification

```typescript
// Always require email verification
const { data } = await supabase.auth.signUp({
  email, password,
  options: { emailRedirectTo: `${origin}/auth/callback` }
});

if (data.user && !data.user.email_confirmed_at) {
  // Show "verify your email" page
}
```

### Password Policies

- Minimum 8 characters (enforce client-side, Supabase enforces server-side)
- Require uppercase, lowercase, number, special char
- Implement password strength indicator
- Use `supabase.auth.signInWithPassword()` — never implement custom crypto

### OAuth Providers

```typescript
// Google OAuth with PKCE
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${window.location.origin}/auth/callback`,
    queryParams: { access_type: 'offline', prompt: 'consent' }
  }
});
```

## PostgreSQL Row Level Security (RLS)

### Mandatory RLS Pattern

Every user-data table MUST have:

```sql
-- 1. Enable RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- 2. SELECT policy
CREATE POLICY "Users can view own data"
  ON table_name FOR SELECT
  USING (auth.uid() = user_id);

-- 3. INSERT policy
CREATE POLICY "Users can insert own data"
  ON table_name FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 4. UPDATE policy
CREATE POLICY "Users can update own data"
  ON table_name FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. DELETE policy
CREATE POLICY "Users can delete own data"
  ON table_name FOR DELETE
  USING (auth.uid() = user_id);
```

### RLS Verification Query

```sql
-- Check RLS status for all tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

### Common RLS Mistakes

1. **Forgetting RLS on new tables** — Data exposed to all users
2. **Only SELECT policy** — Users can insert/update/delete others' data
3. **Using `auth.email()` instead of `auth.uid()`** — Email can change, UUID is stable
4. **Not testing with anon key** — RLS only applies to anon role, not service_role

## Docker Security

### Environment Variables

```bash
# .env (NEVER commit this)
POSTGRES_PASSWORD=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 32)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

### Docker Compose Security

```yaml
services:
  supabase-db:
    image: supabase/postgres:15.1.0.117
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - supabase-db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - internal

  supabase-api:
    image: supabase/gotrue:v2.151.0
    environment:
      GOTRUE_JWT_SECRET: ${JWT_SECRET}
      GOTRUE_DISABLE_SIGNUP: "false"
    depends_on:
      supabase-db:
        condition: service_healthy
    networks:
      - internal
```

### Port Exposure

| Port | Service | Public? |
|------|---------|---------|
| 80 | Nginx | Yes |
| 5432 | PostgreSQL | No (internal only) |
| 8000 | Auth API | No |
| 3000 | REST API | No |
| 4000 | Realtime | No |

**Pitfall:** Exposing PostgreSQL port publicly allows brute-force attacks. Use Docker networks for isolation.

## Nginx Security Headers

```nginx
# Security headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co;" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
```

### CSP for Supabase

The CSP MUST include:
- `https://*.supabase.co` for REST API
- `wss://*.supabase.co` for Realtime
- `'unsafe-inline'` for Angular styles (or use nonces)

## Automated Backups

### pg_dump with Compression

```bash
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"

# Compressed binary backup (for pg_restore)
pg_dump -h ${DB_HOST} -U ${USER} -d ${DB_NAME} \
  --format=custom \
  --compress=9 \
  --file="${BACKUP_DIR}/backup_${TIMESTAMP}.dump"

# Plain SQL backup (for human inspection)
pg_dump -h ${DB_HOST} -U ${USER} -d ${DB_NAME} \
  --format=plain \
  --file="${BACKUP_DIR}/backup_${TIMESTAMP}.sql"
```

### Backup Security

1. **Encrypt backups** at rest: `gpg --symmetric --cipher-algo AES256 backup.dump`
2. **Store backups separately** from production DB
3. **Test restoration** quarterly
4. **Retention policy:** Keep 30 days locally, archive to cold storage

### Backup Retention

```bash
# Remove backups older than 30 days
find ${BACKUP_DIR} -name "backup_*" -mtime +30 -delete
```

## Security Audit Checklist

### Pre-Deployment

- [ ] RLS enabled on all user-data tables
- [ ] Policies for SELECT, INSERT, UPDATE, DELETE
- [ ] JWT secret 32+ characters (not default)
- [ ] PostgreSQL password strong (not default)
- [ ] Email verification required
- [ ] CSP headers configured
- [ ] HTTPS enforced (Supabase handles this)
- [ ] No console.log in production
- [ ] No hardcoded secrets in code
- [ ] .env.example documented
- [ ] Docker networks isolated
- [ ] Backups tested and scheduled

### Runtime Monitoring

- [ ] Monitor failed auth attempts
- [ ] Alert on unusual query patterns
- [ ] Log retention for audit trail
- [ ] Regular dependency updates

## Common Vulnerabilities

### Angular

| Vulnerability | Prevention |
|---------------|------------|
| XSS via bypassSecurityTrust | Never use bypass functions with user input |
| DOM XSS | Use Angular templates, not innerHTML |
| CSRF | Add custom headers |
| Route traversal | Auth guards on all protected routes |

### Supabase

| Vulnerability | Prevention |
|---------------|------------|
| Data exposure | RLS on all tables |
| JWT theft | Short expiration + refresh tokens |
| Password brute-force | Rate limiting + strong passwords |
| SQL injection | Use Supabase JS (parameterized queries) |

### Docker

| Vulnerability | Prevention |
|---------------|------------|
| Port scanning | Don't expose DB port |
| Secret leakage | Environment variables, not code |
| Container escape | Non-root user, read-only filesystem |

## Verification Commands

```bash
# Check RLS status
psql -c "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public';"

# Check JWT secret strength
echo $JWT_SECRET | wc -c  # Should be >= 32

# Check exposed ports
docker compose ps --format "table {{.Names}}\t{{.Ports}}"

# Check for secrets in code
grep -rn "AIza\|eyJ\|password\|secret" src/ --include="*.ts"

# Run security headers check
curl -I http://localhost | grep -i "x-frame\|x-content\|x-xss\|content-security"
```

## References

- `references/supabase-security-patterns.md` — Real-world security patterns from Finanzeasy audit (JWT, RLS, Docker, backups)
- `references/angular-supabase-implementation-patterns.md` — Angular testing gotchas (standalone components, observable getters, router testing), Supabase JS response typing, nginx hardening, Docker multi-stage + non-root, Repository Pattern, ESLint security rules, pnpm migration notes, test password patterns, Supabase migration template
