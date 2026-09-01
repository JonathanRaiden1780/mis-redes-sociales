# Supabase Security Patterns — Real-World Audit (Finanzeasy)

**Fecha:** 2026-08-17  
**Proyecto:** Finanzeasy — App de finanzas personales  
**Hallazgos:** 3 críticos, 4 medios, 3 bajos

---

## Hallazgos Críticos Resueltos

### 1. JWT Secret Débil por Defecto

**Problema:** `docker-compose.yml` tenía `JWT_SECRET: ${JWT_SECRET:-your-super-secret-jwt-token}` — 28 caracteres,ceptible a fuerza bruta.

**Solución:**
```bash
# Generar secret fuerte
openssl rand -base64 32
# Resultado: 44 caracteres base64 (256 bits de entropía)
```

**Regla:** JWT secrets deben tener mínimo 32 caracteres aleatorios (256 bits).

### 2. `skipLibCheck: true` Oculta Errores

**Problema:** Se necesitaba `skipLibCheck: true` por conflictos entre `@types/node` y Supabase storage-js, pero esto oculta errores reales de tipos.

**Solución:**
- `skipLibCheck: true` solo en `tsconfig.json` principal
- `tsconfig.app.json` (para build) sin `skipLibCheck`
- `tsconfig.spec.json` (tests) con `skipLibCheck: true`

### 3. 66 Vulnerabilidades en Dependencias

**Problema:** `pnpm audit` reportó 66 vulnerabilidades (4 bajas, 26 medias, 35 altas, 1 crítica).

**Solución:**
- Crítico: `@babel/core <=7.29.0` — actualizar Angular CLI
- Alto: Dependencias de `@angular-devkit/build-angular` — esperar actualización oficial
- Medias/Bajas: `pnpm audit --fix` donde sea posible

---

## Hallazgos Medios Resueltos

### 4. console.log en Producción

**Ubicación:** `auth.service.ts`, `header.component.ts`

**Patrón problemático:**
```typescript
console.log(data); // Puede exponer tokens, emails, etc.
```

**Solución:**
```typescript
// Logger environment-aware
if (!environment.production) {
  console.log(data);
}

// O usar un servicio de logging centralizado
this.logger.debug('Auth state changed', { userId: data?.id });
```

### 5. Falta de .env.example

**Problema:** No había referencia de variables de entorno necesarias.

**Solución:** Crear `.env.example` con todas las variables:
```env
POSTGRES_PASSWORD=your-secure-password-here
JWT_SECRET=your-super-secret-jwt-token-min-32-chars
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 6. Puertos Expuestos en Docker

**Problema:** PostgreSQL (5432), Auth (8000), REST (3000), Realtime (4000) expuestos públicamente.

**Solución:** Solo Nginx (80) expuesto; resto en red interna de Docker.

### 7. Falta de Content-Security-Policy

**Problema:** `nginx.conf` no tenía header CSP.

**Solución:**
```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co;" always;
```

---

## Hallazgos Bajos

### 8. Sin Rate Limiting en Auth

**Recomendación:** Agregar limitación de intentos de login en Nginx:
```nginx
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;

location /auth/ {
  limit_req zone=auth burst=3 nodelay;
}
```

### 9. Sin CSRF Tokens

**Recomendación:** Agregar header CSRF en formularios:
```typescript
headers: { 'X-CSRF-Token': this.csrfToken }
```

### 10. Sin Helmet.js Equivalente

**Recomendación:** Agregar headers adicionales:
```nginx
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

---

## Patrones de Seguridad Aplicados

### Row Level Security (RLS)

```sql
-- Patrón correcto: políticas CRUD completas
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions"
  ON transactions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions"
  ON transactions FOR DELETE
  USING (auth.uid() = user_id);
```

### Verificación de RLS

```sql
-- Verificar que todas las tablas tienen RLS
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
  AND rowsecurity = false;
-- Debe retornar 0 filas
```

### Backups Seguros

```bash
# Backup comprimido con pg_dump
pg_dump -h localhost -U postgres -d postgres \
  --format=custom \
  --compress=9 \
  --file="backup_$(date +%Y%m%d_%H%M%S).dump"

# Cifrar backup
gpg --symmetric --cipher-algo AES256 backup.dump

# Retención 30 días
find ./backups -name "backup_*" -mtime +30 -delete
```

---

## Lecciones Aprendidas

1. **Los defaults son inseguros** — JWT secret, contraseña de BD, y puertos por defecto deben cambiarse siempre
2. **RLS es obligatorio** — Sin RLS, todos los datos son públicos aunque el frontend filtre
3. **Los secrets nunca en código** — Siempre variables de entorno con `.env.example` documentado
4. **Los backups son seguridad** — pg_dump + cifrado + retención = recuperación ante desastres
5. **Los headers importan** — CSP, X-Frame-Options, HSTS previenen ataques comunes
6. **Auditar dependencias** — `pnpm audit` regularmente, actualizar críticos inmediatamente
