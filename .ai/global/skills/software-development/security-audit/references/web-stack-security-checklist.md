# Web-Stack Security Checklist (Angular + Supabase + Docker + Nginx)

## Static Scan Patterns

```bash
# Docker Compose secrets (default values = CRITICAL)
grep -rn "POSTGRES_PASSWORD.*:-" docker-compose.yml
grep -rn "JWT_SECRET.*:-" docker-compose.yml
grep -rn "GOOGLE_CLIENT_ID.*:-" docker-compose.yml

# PostgreSQL exposure (should be localhost-only)
grep -rn "5432:5432" docker-compose.yml | grep -v "127.0.0.1"

# Console.log in production (use no-console ESLint rule)
grep -rn "console\.log" src/ --include="*.ts"

# Missing security headers in nginx
grep -rn "Content-Security-Policy\|Strict-Transport-Security\|Permissions-Policy" nginx.conf

# Supabase RLS verification
grep -rn "ENABLE ROW LEVEL SECURITY" supabase/migrations/
grep -rn "auth\.uid()" supabase/migrations/

# Healthcheck presence
grep -rn "healthcheck" docker-compose.yml
```

## Hardening Checklist

| Area | Check | Severity |
|------|-------|----------|
| Docker | No default secrets (JWT, password, OAuth) | Critical |
| Docker | PostgreSQL bound to localhost only | Low |
| Docker | Healthchecks on all services | Low |
| Nginx | Content-Security-Policy header | Medium |
| Nginx | Strict-Transport-Security (HSTS) | Medium |
| Nginx | Permissions-Policy header | Low |
| Nginx | X-Frame-Options, X-Content-Type-Options | Basic |
| Supabase | RLS enabled on all user-data tables | Critical |
| Supabase | Policies cover SELECT/INSERT/UPDATE/DELETE | Critical |
| Angular | `no-console: error` in ESLint | Medium |
| Angular | Password validation (minLength 8, pattern) | Medium |
| Angular | AuthGuard on protected routes | Medium |
| Backups | pg_dump automated with retention | Good |

## Supabase-Specific Patterns

### JWT Secret Management
```yaml
# BAD - default value is public
GOTRUE_JWT_SECRET: ${JWT_SECRET:-your-super-secret-jwt-token}

# GOOD - no default, fails if unset
GOTRUE_JWT_SECRET: ${JWT_SECRET}
```

### PostgreSQL Backup Pattern
```bash
pg_dump -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} \
  --format=custom --compress=9 --file="backup_${TIMESTAMP}.dump"
pg_dump -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} \
  --format=plain --file="backup_${TIMESTAMP}.sql"
find /backups -name "backup_*" -mtime +30 -delete
```

## Lessons from Finanzeasy Audit (2026-08-18)

### Critical Findings Fixed
1. JWT_SECRET had public default → removed default, requires env var
2. POSTGRES_PASSWORD was "postgres" → removed default, requires env var
3. Google OAuth credentials empty defaults → removed defaults
4. PostgreSQL exposed publicly → bound to 127.0.0.1
5. No healthcheck on frontend → added wget healthcheck

### Medium Findings Fixed
1. console.log in production → changed to console.error + no-console rule
2. Missing CSP header → added Content-Security-Policy
3. Missing HSTS header → added Strict-Transport-Security
4. Missing Permissions-Policy → added Permissions-Policy
5. Weak password validation → added minLength(8) + pattern

### Subagent Timeout Pattern
Parallel subagent delegation for security/design/features can timeout (HTTP 524) on large codebases. If a subagent times out, the work is NOT lost — the main agent already has enough context to synthesize the findings. Do NOT re-dispatch; consolidate what you have.
