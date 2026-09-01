# Angular + Supabase Security Hardening Pattern

## When to Use

- Angular/Ionic project with Supabase backend that needs production-grade security
- Dockerizing a Supabase stack for local development or self-hosted production
- After initial feature development, before declaring "production ready"

## Security Audit Checklist (SAST)

### Critical Findings (Fix Immediately)

1. **JWT_SECRET weak default** — `docker-compose.yml` must NOT have default JWT values
2. **PostgreSQL password default** — Remove `postgres` as default password
3. **Google OAuth empty credentials** — Validate if OAuth is enabled
4. **Dependency vulnerabilities** — Run `pnpm audit` + `pnpm update` regularly

### Medium Findings (Fix Soon)

5. **Console.log in production** — Add `no-console: error` to ESLint
6. **Missing CSP header** — Add Content-Security-Policy in nginx
7. **Missing HSTS header** — Add Strict-Transport-Security
8. **Weak password validation** — Add minLength(8) + pattern
9. **Routes without AuthGuard** — Protect all authenticated routes
10. **No rate limiting** — Configure nginx limit_req_zone

### Low Findings (Recommended)

11. **Missing Permissions-Policy** — Add to nginx
12. **Dockerfile without non-root user** — Create nginxuser
13. **PostgreSQL exposed publicly** — Bind to 127.0.0.1
14. **No frontend healthcheck** — Add wget healthcheck

## Implementation Patterns

### 1. Nginx Security Headers

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
```

### 2. Nginx Rate Limiting

```nginx
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;

location ~ ^/(login|register|verify-email) {
    limit_req zone=auth burst=3 nodelay;
    try_files $uri $uri/ /index.html;
}

location / {
    limit_req zone=api burst=10 nodelay;
    try_files $uri $uri/ /index.html;
}
```

### 3. AuthGuard with Supabase

```typescript
@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  private readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);

  canActivate(): Observable<boolean | UrlTree> {
    return this.supabaseService.user$.pipe(
      take(1),
      map((user) => user ?? this.router.createUrlTree(['/login']))
    );
  }
}
```

### 4. Dockerfile Non-Root User

```dockerfile
FROM nginx:alpine
RUN adduser -D -H -u 1001 nginxuser && \
    chown -R nginxuser:nginxuser /usr/share/nginx/html && \
    chown -R nginxuser:nginxuser /var/cache/nginx && \
    chown -R nginxuser:nginxuser /var/log/nginx && \
    chown -R nginxuser:nginxuser /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginxuser:nginxuser /var/run/nginx.pid
USER nginxuser
```

### 5. Supabase Docker Compose (Secrets)

```yaml
# NO default values for secrets
supabase-db:
  environment:
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}  # No default
    ports:
      - "127.0.0.1:5432:5432"  # localhost only

supabase-api:
  environment:
    GOTRUE_JWT_SECRET: ${JWT_SECRET}  # No default
```

### 6. Angular Password Validation

```typescript
password: new FormControl<string>('', {
  nonNullable: true,
  validators: [
    Validators.required,
    Validators.minLength(8),
    Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
  ]
}),
```

### 7. ESLint No-Console Rule

```json
{
  "rules": {
    "no-console": ["error", { "allow": ["warn", "error"] }]
  }
}
```

## Common Pitfalls

### PostgrestResponse Typing

```typescript
// ❌ WRONG — causes type errors
const { data, error } = await supabase.from('x').select('*') as PostgrestResponse<X[]>;

// ✅ CORRECT — let Supabase infer types, use response.data
const response = await supabase.from('x').select('*');
if (response.error) throw response.error;
return response.data ?? [];
```

### Testing Standalone Components

```typescript
// ❌ WRONG — standalone components can't be in declarations
TestBed.configureTestingModule({
  declarations: [MyComponent],
});

// ✅ CORRECT — import standalone components
TestBed.configureTestingModule({
  imports: [MyComponent],
});
```

### Mocking Supabase Chained Methods

```typescript
const mockChain: any = {};
mockChain.select = jasmine.createSpy('select').and.returnValue(mockChain);
mockChain.insert = jasmine.createSpy('insert').and.returnValue(mockChain);
mockChain.update = jasmine.createSpy('update').and.returnValue(mockChain);
mockChain.delete = jasmine.createSpy('delete').and.returnValue(mockChain);
mockChain.eq = jasmine.createSpy('eq').and.returnValue(mockChain);
mockChain.order = jasmine.createSpy('order').and.returnValue(mockChain);
mockChain.single = jasmine.createSpy('single').and.resolveTo({ data: null, error: null });

supabaseServiceMock = {
  supabase: {
    from: jasmine.createSpy('from').and.returnValue(mockChain),
  },
};
```

### Testing AuthGuard

```typescript
it('should allow access when authenticated', (done) => {
  supabaseServiceMock.user$ = of(mockUser);
  guard.canActivate().subscribe(result => {
    expect(result).toBeTrue();
    done();
  });
});

it('should redirect when not authenticated', (done) => {
  supabaseServiceMock.user$ = of(null);
  guard.canActivate().subscribe(result => {
    expect(result).toEqual(router.createUrlTree(['/login']));
    done();
  });
});
```

## Verification Gate

After applying security hardening:

```bash
pnpm run lint          # All files pass linting
pnpm run build:prod    # Bundle generates successfully
pnpm run test:ci       # All tests pass
pnpm audit             # Review vulnerabilities
```

## References

- `references/firebase-to-supabase-migration.md` — Migration from Firebase to Supabase
- `references/security-audit-checklist.md` — Security audit checklist for SDD features
