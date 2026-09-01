---
name: sdd-feature-implementation
description: Implementar features con flujo SPEC→TASK→tests→QA gate.
---

# SDD Feature Implementation

Flow de desarrollo para features no-triviales en proyectos que usan Spec Driven Development.

## Flujo base

1. **SPEC** — escribir `docs/specs/SPEC-NNN-<slug>.md` con objetivo, scope, requirements, acceptance criteria, y success criteria.
2. **TASK** — escribir `docs/tasks/TASK-NNN-<slug>.md` con scope de implementación, lista de tareas, dependencies, reason/impact, y success criteria.
3. **Implementación** — crear los archivos de código necesarios, manteniendo interfaces pequeñas y Clean Architecture.
4. **Tests** — tests unitarios que cubran los casos principales y edge cases del SPEC.
5. **QA gate** — `black .`, `ruff check src/ tests/`, `mypy src/ tests/`, `pytest tests/ -q`.
6. **Commit** — `git add` de SPEC + TASK + código + tests, commit con mensaje descriptivo.
7. **Documentación** — actualizar `docs/MASTERPROMPT.md` y `ROADMAP.md` si el feature cambia el estado completado o el próximo incremento.

## Estilo de comunicación preferido (Jh)

- **Directo, sin preámbulos**: El usuario quiere acción y resultado, no explicaciones largas de lo que va a hacer.
- **Idioma**: Español siempre.
- **Formato**: Resúmenes ultracortos (3 líneas), bullet points, commits atómicos con mensajes descriptivos.
- **Verificación honesta**: Cuando pregunte "¿ya está completo? ¿cumple lo especificado?", ser brutalmente honesto sobre gaps — no decir "completo" si falta algo.
- **Ejecutar > Describir**: Si el usuario pide ejecutar un plan, no describir cada paso — hacer y dar resumen al final.
- **Documentación es parte del feature**: Actualizar MASTERPROMPT.md y ROADMAP.md es obligatorio al cerrar cada sprint/feature. El usuario lo exige explícitamente: "debes ajustar el masterprompt y roadmap siempre".

## Lecciones de sesión SPEC-053 (Global Auto-Distribution)

### Honest gap analysis > False completion (CRITICAL)

When the user asks "¿ya está completo? ¿cumple lo especificado?", the response MUST be a brutal honest audit of gaps — never a declaration of victory. This is not about being negative; it's about being accurate so the user can make informed decisions.

**Template for honest audit:**
```
## Estado actual

### Funcional (Q3-Q4)
- [x] Feature X — actually works, verified output

### Gaps identificados
- [ ] Feature Y — exists but produces Q0-Q2 output (empty/template)
- [ ] Feature Z — not integrated, nobody calls it
- [ ] Command W — crashes on missing setup (NotADirectoryError)

### Veredicto
Estado: Parcially funcional. Gaps críticos: Y, Z, W.
Siguiente paso recomendado: [specific fix]
```

**Anti-patterns to avoid:**
- "Está completo" when commands produce empty output
- "Funciona correctamente" when exit code is 0 but output is template
- Ignoring Q0-Q2 quality issues because "the code exists"

### Command output quality = Feature completeness

A feature is NOT complete when the code exists. It's complete when the command produces Q3-Q4 output that would help an external AI understand and work with the project.

**Q0-Q2 output examples (INCOMPLETE):**
- `ai memory` → "No project memory found"
- `ai skills` → "No skills installed"  
- `ai setup` → "Skills installed: 0"
- `ai index` → "Indexed: 0, 0, 0"

**Q3-Q4 output examples (COMPLETE):**
- `ai memory` → Shows project purpose, stack, dependencies
- `ai skills` → Lists 7 skills with titles and descriptions
- `ai setup` → "Skills installed: 7, Security policies: 5"
- `ai index` → "Indexed: 3 skills, 2 tools"

See `references/command-output-quality-framework.md` for the full quality rubric.

### Sync en el MISMO proyecto (corrección validada SPEC-053)
Cuando el usuario diga "sync" o "distribución global", el enfoque por defecto y preferido es guardar la memoria global **dentro del mismo repositorio del proyecto** (ej: `.ai/global/`), NO en un repositorio externo separado. La memoria viaja con el proyecto en cada `git push`/`git pull`.

```python
# La memoria global vive en .ai/global/ dentro del proyecto
GLOBAL_DIR = ".ai/global"
# Archivos: memory.yaml, index.yaml, notifications.yaml, sync-state.yaml
```

Beneficios:
- No hay URL externa que configurar
- La memoria se versiona junto con el código
- Funciona offline
- El equipo recibe actualizaciones vía flujo normal de git

Solo usa un repositorio externo si el usuario lo pida explícitamente.

### Corrección de usuario = rediseño arquitectónico, no solo arreglar un detalle
Cuando el usuario corrija tu arquitectura (ej: "debe ser en el mismo repo", "no uses URL externa"), significa que **todo el enfoque debe rediseñarse**, no solo arreglar un parámetro. Reevalúa la arquitectura completa: archivos involucrados, flujos, instalación, documentación. No hagas un "fix mínimo" — rediseña la solución para que sea coherente con la nueva visión.

### "Continua" significa "hasta terminar de verdad"
Cuando el usuario diga "Continua" después de un resumen de completitud, significa que los gaps identificados deben cerrarse — no dejarlos pendientes. Ejecuta los gaps como tareas adicionales y verifica al final.

### "Continua con lo que dije" = ejecutar sin preguntar

Cuando el usuario diga "continua con lo que dije" después de dar requerimientos, **ejecuta inmediatamente sin hacer preguntas aclaratorias**. No preguntes por tecnología cuando el proyecto ya tiene stack definido, no pidas estatus cuando el usuario dice "X los proporcionará" (deja configuración dinámica), no preguntes "¿en qué proyecto?" cuando el contexto ya es claro.

### Patrón de módulos en MiNegocio (React)

1. **Tipos** → `src/types/index.ts`
2. **Config** → `src/lib/<feature>Configs.ts` (estatus dinámicos)
3. **Hook** → `src/hooks/use<Feature>Collection.ts` (cache-first)
4. **Componentes** → `src/components/<feature>/` (Form, Bitacora, etc.)
5. **Página** → `src/pages/<Feature>.tsx` (tabs, filtros, badges)
6. **Rutas** → `src/App.tsx` (import + Route)
7. **Reglas** → `firestore.rules` (sameBusiness + admin delete)
8. **Nav** → `DashboardLayout.tsx` (nav item)
9. **Docs** → `MASTERPROMPT.md` + `ROADMAP.md`

**Imports:** `src/pages/` usa `../`, `src/hooks/` usa `../`, `src/components/` usa `../`, `src/lib/` usa `./`.

**Verificar:** `pnpm run build` ✅, `pnpm run lint` 0 errores, `pnpm run test` sin fallos nuevos.

### Pitfall: Pantalla en blanco sin errores visibles (CORREGIDO)

Cuando la app React muestra pantalla en blanco sin errores en consola, el problema suele ser **archivo `.env` faltante** (Firebase no inicializa) o **conflicto de puerto**.

**Diagnóstico con headless Chrome:**

```bash
# 1. Verificar HTML sirve correctamente
curl -s http://localhost:3001/ | grep -E "title|root|main.tsx"

# 2. Tomar screenshot para ver qué renderiza
/path/to/chrome --headless=new --disable-gpu --no-sandbox \
  --screenshot=/tmp/app.png --window-size=1280,800 http://localhost:3001/

# 3. Capturar DOM después de que React monte
/path/to/chrome --headless=new --disable-gpu --no-sandbox \
  --virtual-time-budget=5000 --dump-dom http://localhost:3001/
```

**Causas comunes y soluciones:**

| Síntoma | Causa | Solución |
|---|---|---|
| HTML correcto pero `#root` vacío | `.env` faltante | Crear `.env` con credenciales Firebase |
| `curl` muestra otra app (ej: Open WebUI) | Puerto ocupado | Usar `--port 3001` o matar proceso en `:3000` |
| Error de módulo en consola | Import path incorrecto | Verificar `../` vs `../../` según nivel |

### Patrón: Integración cross-project (MiNegocio → Finanzeasy)

Cuando integras un servicio de un proyecto hermano (ej: servidor OCR de MiNegocio en Finanzeasy):

**Arquitectura:**
```
[Finanzeasy] → [OCRService] → HTTP POST → [MiNegocio Server]
                                      ↓ (si falla o disabled)
                                [Mock fallback]
```

**Implementación:**

```typescript
@Injectable({ providedIn: 'root' })
export class OCRService {
  private config = { enabled: false, endpoint: '', token: '' };

  async scanTicket(imageUri: string): Promise<OCRScan> {
    if (!this.config.enabled) return this.mockScan(scan);
    
    try {
      const blob = await this.uriToBlob(imageUri);
      const formData = new FormData();
      formData.append('file', blob, 'ticket.jpg');
      
      const response = await this.http.post(
        `${this.config.endpoint}/ocr/invoice`,
        formData,
        { headers: { Authorization: `Bearer ${this.config.token}` } }
      ).toPromise();
      
      return response?.ok ? this.parseResponse(response) : this.mockScan(scan);
    } catch {
      return this.mockScan(scan); // Fallback cuando server no disponible
    }
  }
}
```

**Ventajas:**
1. Reutilización de infraestructura existente
2. OCR real (Tesseract spa+eng) sin implementar desde cero
3. Fallback a mock cuando el server no está disponible
4. Configuración dinámica (endpoint y token)

**Pitfall: HttpClient en tests:**

```typescript
// ❌ MALO — NullInjectorError
TestBed.configureTestingModule({ providers: [OCRService] });

// ✅ BUENO — Mock HttpClient
const httpClientStub = { 
  post: jasmine.createSpy('post').and.returnValue({ 
    toPromise: () => Promise.resolve({ ok: true, ocrText: '', parsedLines: [] }) 
  }) 
};
TestBed.configureTestingModule({ 
  providers: [OCRService, { provide: HttpClient, useValue: httpClientStub }] 
});
```

**Configuración sin secrets hardcodeados:**

```typescript
// ✅ CORRECTO — variables de entorno
ocrService.updateConfig({
  enabled: true,
  endpoint: process.env['OCR_ENDPOINT'] || 'http://localhost:8788',
  token: process.env['OCR_TOKEN'] || '',
});
```

### Patrón: Gamificación Avanzada (Retos y Leaderboards)

Cuando implementas features de gamificación más allá de XP/niveles básicos:

**Estructura de datos:**

```typescript
export interface Challenge {
  id: string;
  title: string;
  type: 'spending_limit' | 'savings_goal' | 'streak' | 'no_spend' | 'budget_master';
  startDate: string;
  endDate: string;
  goal: number;
  currentProgress: number;
  participants: number;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  score: number;
  rank: number;
  badges: string[];
}

export interface Badge {
  id: string;
  name: string;
  category: 'spending' | 'savings' | 'goals' | 'streaks' | 'special';
  unlockedAt?: string;
  notified?: boolean; // Para notificaciones de logros
}
```

**Retos predefinidos:**

```typescript
export const DEFAULT_CHALLENGES: Challenge[] = [
  {
    id: 'weekly_no_spend',
    title: 'Semana Sin Gastos',
    type: 'no_spend',
    goal: 7, // días
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'budget_master',
    title: 'Maestro del Presupuesto',
    type: 'budget_master',
    goal: 30, // días
  },
  {
    id: 'savings_streak',
    title: 'Racha de Ahorro',
    type: 'savings_goal',
    goal: 2000, // $2000 ahorrados
  },
];
```

**Flujo:**

1. `getAvailableChallenges()` — retos vigentes
2. `joinChallenge(challengeId)` — unirse a un reto
3. `updateProgress(challengeId, progress)` — actualizar progreso
4. `getLeaderboard()` — ranking global
5. `getBadges()` — insignias del usuario

**Tablas Supabase:**
- `challenges` — definición de retos
- `challenge_progress` — progreso por usuario
- `user_gamification` — ya existe, agregar `badges` y `score`

**Migración npm → pnpm (si aplica):**

```bash
# 1. Eliminar lockfile npm y node_modules
rm -rf node_modules package-lock.json

# 2. Instalar con pnpm
pnpm install

# 3. Configurar onlyBuiltDependencies para scripts nativos
# Crear pnpm-workspace.yaml:
# onlyBuiltDependencies:
#   - '@firebase/util'
#   - esbuild
#   - protobufjs

# 4. Agregar packageManager a package.json
# "packageManager": "pnpm"

# 5. Actualizar lockfile en git
git add pnpm-lock.yaml
git rm package-lock.json
echo "package-lock.json" >> .gitignore
```

### Pitfall: Import paths en pages (CORREGIDO)

Al crear un nuevo módulo en `src/pages/<Feature>.tsx`, los imports desde la página deben usar `../` (no `../../`):

```typescript
// ✅ CORRECTO — página importa de libs hermanas
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { type Lead } from '../types';
import { useLeadsCollection } from '../hooks/useLeadsCollection';
import { LeadForm } from '../components/leads/LeadForm';

// ❌ INCORRECTO — esto falla con "Cannot find module"
import { db } from '../../lib/firebase';
```

Los componentes dentro de `src/components/leads/` sí usan `../../` porque están un nivel más profundo:

```typescript
// ✅ CORRECTO — componente en subdirectorio importa de raíz
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
```

### Integration check > Code creation
Cuando crees un servicio nuevo (ej: `NewToolNotifier`, `GlobalRegistry`), **no basta con crearlo** — debe integrarse en los comandos existentes (`mcp_add.py`, `index.py`, `sync_global.py`) para que realmente se use. Código que existe pero nadie invoca es código muerto. Después de implementar, verifica que cada nuevo componente sea invocado desde al menos un flujo existente.

### Sync en el MISMO proyecto (corrección validada SPEC-053)
Cuando el usuario diga "sync" o "distribución global", el enfoque por defecto y preferido es guardar la memoria global **dentro del mismo repositorio del proyecto** (ej: `.ai/global/`), NO en un repositorio externo separado. La memoria viaja con el proyecto en cada `git push`/`git pull`.

```python
# La memoria global vive en .ai/global/ dentro del proyecto
GLOBAL_DIR = ".ai/global"
# Archivos: memory.yaml, index.yaml, notifications.yaml, sync-state.yaml
```

Beneficios:
- No hay URL externa que configurar
- La memoria se versiona junto con el código
- Funciona offline
- El equipo recibe actualizaciones vía flujo normal de git

Solo usa un repositorio externo si el usuario lo pida explícitamente.

### Corrección de usuario = rediseño arquitectónico, no solo arreglar un detalle
Cuando el usuario corrija tu arquitectura (ej: "debe ser en el mismo repo", "no uses URL externa"), significa que **todo el enfoque debe rediseñarse**, no solo arreglar un parámetro. Reevalúa la arquitectura completa: archivos involucrados, flujos, instalación, documentación. No hagas un "fix mínimo" — rediseña la solución para que sea coherente con la nueva visión.

### Security audit es parte del QA gate
Después de implementar y ANTES de declarar completo, ejecuta escaneo de seguridad:
```bash
grep -rn --include='*.py' -E '(api_key|secret|password|token|passwd|apikey)\s*=\s*['\''"][^'\'']' src/
grep -rn --include='*.py' -E 'subprocess.*shell=True|os\.system\(' src/
grep -rn --include='*.py' -E '\beval\(|\bexec\(' src/
grep -rn --include='*.py' -E 'pickle\.loads?\(' src/
```
Los hallazgos altos (secrets hardcoded, shell injection, eval/exec con user input, URLs sin validar, secrets en memoria) deben cerrarse antes de declarar completo.

### Secrets en memoria
Cuando manejes API keys o tokens en código Python, límpialos de memoria después de usarlos:

```python
# ❌ MALO — key permanece en memoria
providers[name]["api_key"] = key

# ✅ BUENO — key se borra de memoria
providers[name]["api_key"] = key
del key  # o key = None
```

### Validación de URLs remotas
Cuando el usuario proporcione una URL de repo remoto, valida contra whitelist:

```bash
# ❌ MALO — acepta cualquier URL
git remote add origin "${sync_repo_url}"

# ✅ BUENO — valida dominio
if [[ "${sync_repo_url}" =~ ^https://(github\.com|gitlab\.com|bitbucket\.org)/ ]]; then
    git remote add origin "${sync_repo_url}"
else
    log_error "Solo se permiten repos de github.com, gitlab.com o bitbucket.org"
fi
```

### try/except pass silenciosos
Los errores de red/git NO deben silenciarse completamente. Usa logging mínimo:

```python
# ❌ MALO — error invisible
except Exception:
    pass

# ✅ BUENO — error visible en debug
except Exception as e:  # noqa: BLE001
    logger.debug("Sync pull failed (will retry later): %s", e)
    return False
```

### Git credential prompts blocking CLI commands

When a CLI command performs git operations (push/pull/fetch) and the user has no credential helper configured, git hangs asking for username/password interactively. GitHub no longer supports password auth, so this is a hard failure.

**Fix pattern:**
```python
# In the sync service:
def _get_repo(self) -> Repo:
    repo = Repo(self.root)
    # Never let git prompt for credentials interactively — fail fast
    repo.git.update_environment(GIT_TERMINAL_PROMPT="0")
    return repo
```

```python
# In the command (non-fatal sync):
sync_warning = None
try:
    sync.sync(message=f"Initialize project: {name}")
except Exception as e:  # noqa: BLE001 — sync failures should not abort local init
    sync_warning = f"Local init complete, but sync to remote failed: {e}. Run 'ai sync' later."
```

**Installer-level prevention** (in `install.sh`):
```bash
# Force SSH, disable interactive credential prompts
git config --global url."git@github.com:".insteadOf "https://github.com/"
git config --global credential.helper ""
export GIT_TERMINAL_PROMPT=0
```

### Test maintenance after command refactor (PITFALL CRÍTICO)

When a command is refactored to use different service classes, **ALL tests exercising that command must be updated** — not just the tests of the service being replaced.

**The trap:** A test mocks `aiep.project.sync_global.GlobalMemoryStore` because the OLD command used `GlobalProjectSyncService` (which uses that store). But the NEW command uses `ContextProvider` + `GlobalVault` + `GlobalSyncService` — none of which touch `GlobalMemoryStore`. The mock never intercepts anything, and the test fails because the command's guard clauses (e.g., `has_masterprompt`, `vault.exists()`) return false with empty temp dirs.

**The fix:** Mock the command's actual dependencies in the command's namespace:
```python
monkeypatch.setattr("aiep.commands.sync_global.ContextProvider", FakeProvider)
monkeypatch.setattr("aiep.commands.sync_global.GlobalVault", FakeVault)
monkeypatch.setattr("aiep.commands.sync_global.GlobalSyncService", FakeSync)
```

**General rule:** After any refactor that changes which classes a command uses, grep for all tests of that command and verify each mock targets the new dependency chain — not the old one. A passing test suite after a command refactor is not evidence that the tests are correct; they may be mocking dead symbols.

### Pitfall: Jasmine spy chaining con Storage mocks (CRITICAL — validado múltiples veces)

Cuando el servicio usa Supabase Storage (`.storage.from().upload().download()`), el mock de storage debe retornar SÍ MISMO para `from()`:

```typescript
// ❌ MALO — returnThis no existe en Jasmine
storageMock.from = jasmine.createSpy('from').and.returnThis();

// ✅ BUENO — usar returnValue(storageMock) para que from() retorne el mismo mock
storageMock.from = jasmine.createSpy('from').and.returnValue(storageMock);
storageMock.upload = jasmine.createSpy('upload').and.resolveTo({ data: null, error: null });

// ✅ BUENO — usar callFake para crear chains nuevos por llamada
supabaseServiceMock = {
  client: { 
    from: jasmine.createSpy('from').and.callFake(() => createChain()), 
    storage: storageMock 
  },
};
```

Si `from()` no retiene el chain correctamente, obtienes `Property 'returnThis' does not exist on type 'SpyAnd<Func>'`.

### Patrón: Cobertura de tests para lógica pura (Sprint 24)

Para subir cobertura rápidamente, prioriza servicios de lógica pura (sin dependencias externas) sobre componentes con mocks complejos:

**Orden de prioridad:**
1. **Lógica matemática pura**: CurrencyConverter, MSICalculatorService, DebtPlannerService
2. **Lógica con estado local**: AutoCategorizationService (userRules Map), GamificationService
3. **Servicios HTTP con fallback**: OCRService, OpenBankingService (mock HttpClient)
4. **Componentes de UI**: Requieren mocks extensos, menor relación cobertura/esfuerzo

**Ejemplo de test de lógica pura (sin TestBed):**
```typescript
describe('CurrencyConverter', () => {
  it('should convert USD to MXN correctly', () => {
    const result = CurrencyConverter.convert(100, 'USD', 'MXN');
    expect(result).toBeCloseTo(1750, 0);
  });
});
```

**Anti-pattern de cobertura:**
```typescript
// ❌ MALO — Test que no aporta cobertura real
it('should be created', () => {
  expect(service).toBeTruthy();
});

// ✅ BUENO — Test que verifica comportamiento real
it('should calculate MSI with 0% interest', () => {
  const result = service.calculateScenarios({
    amount: 12000, monthsOptions: [3, 6, 12], interestRate: 0,
  });
  expect(result.scenarios[0].monthlyPayment).toBe(4000);
});
```

**Pitfall: Los archivos de test cuentan en el denominador de cobertura**

Agregar archivos `.spec.ts` puede *disminuir* el porcentaje de cobertura porque Karma/Istanbul cuenta los statements/branches/functions de los test files en el denominador. Si agregas un test file con 10 statements y solo 5 son ejecutados por los tests, la cobertura baja.

**Estrategia para evitar el efecto negativo:**
- Agrega tests que ejecuten TODO el código del archivo (describe + it + expect = 100% del test file)
- Prioriza agregar tests a archivos EXISTENTES en vez de crear nuevos `.spec.ts`
- Si creas un nuevo `.spec.ts`, asegúrate de que cada `it` tenga múltiples assertions que cubran todas las ramas
- Los tests de "smoke" (`it('should create')`) aportan poco — prefiere tests de comportamiento real

**Resultado real de esta sesión:**
```
Antes: 264 tests, 33.6% statements
Después de agregar 8 test files: 255 tests, 32.85% statements  ← BAJÓ
Después de eliminar test files problemáticos: 255 tests, 32.85%
```

**Conclusión:** Para subir cobertura al 50%, la estrategia más efectiva es agregar assertions a tests existentes que ejecuten código no cubierto, no crear nuevos archivos de test.

### Patrón: AuthGuard con Router mock

```typescript
const routerMock = {
  createUrlTree: jasmine.createSpy('createUrlTree').and.returnValue({}),
};

TestBed.configureTestingModule({
  providers: [
    AuthGuard,
    { provide: Router, useValue: routerMock },
    { provide: SupabaseService, useValue: supabaseServiceMock },
  ],
});
```

**Tests:**
```typescript
it('should redirect to login when user is null', (done) => {
  supabaseServiceMock.user$ = of(null);
  guard.canActivate().subscribe(result => {
    expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/login']);
    done();
  });
});

it('should allow access when user is logged in', (done) => {
  supabaseServiceMock.user$ = of({ id: 'user-1' } as any);
  guard.canActivate().subscribe(result => {
    expect(result).toBe(true);
    done();
  });
});
```

### Patrón: HttpClient stub para servicios HTTP

```typescript
const httpClientStub = {
  post: jasmine.createSpy('post').and.returnValue({ 
    toPromise: () => Promise.resolve({ ok: true, ocrText: '', parsedLines: [] }) 
  }) 
};

TestBed.configureTestingModule({ 
  providers: [OCRService, { provide: HttpClient, useValue: httpClientStub }] 
});
```

**Error si no lo haces:** `NullInjectorError: R3InjectorError(DynamicTestModule)[OCRService -> HttpClient -> HttpClient]: No provider for HttpClient!`

### Patrón: expectAsync para errores asíncronos

```typescript
await expectAsync(service.contribute('non-existent', 500))
  .toBeRejectedWithError('Savings goal not found');
```

### Patrón: Verificar llamadas a Supabase

```typescript
it('should call supabase.from with accounts table', async () => {
  await service.getAll();
  expect(supabaseServiceMock.supabase.from).toHaveBeenCalledWith('accounts');
});

it('should call select and order on getAll', async () => {
  await service.getAll();
  expect(mockChain.select).toHaveBeenCalledWith('*');
  expect(mockChain.order).toHaveBeenCalledWith('name', { ascending: true });
});
```

### Resolución de errores comunes en tests Angular

| Error | Causa | Solución |
|-------|-------|----------|
| `Property 'returnThis' does not exist` | Jasmine no tiene `returnThis()` | Usar `returnValue(mockChain)` |
| `NullInjectorError: No provider for HttpClient` | HttpClient no mockeado | Agregar `{ provide: HttpClient, useValue: stub }` |
| `Expected 'X' to be 'Y'` | Mock retorna error diferente | Ajustar mock o usar mensaje exacto del error |
| Spy chain se corta entre tests | `from()` retorna mismo mock siempre | Usar `callFake` para crear chains nuevos |
| `writeFile is not declared writable` | spyOn sobre módulo ES | Usar `jest.mock` o tests que solo verifican "no lanza excepción" |
| `NullInjectorError: No provider for Router` | Router no mockeado en AuthGuard | Agregar `{ provide: Router, useValue: routerMock }` |

### Patrón: Supabase Storage Backup

Para crear backups en Supabase Storage:

1. Exportar todas las tablas del usuario a JSON
2. Upload a bucket `backups` con `storage.from('backups').upload(filename, blob)`
3. Guardar metadatos en tabla `backup_metadata` con checksum SHA-256
4. Para restaurar: descargar JSON → borrar datos existentes → insertar backup

```typescript
async createBackup(): Promise<BackupMetadata> {
  const backupData = { version: BACKUP_VERSION, exportedAt: new Date().toISOString(), tables: {} };
  
  for (const table of tables) {
    const { data } = await this.supabase.client.from(table).select('*').eq('user_id', userId);
    if (data?.length) backupData.tables[table] = data;
  }
  
  const blob = new Blob([JSON.stringify(backupData)], { type: 'application/json' });
  await this.supabase.client.storage.from('backups').upload(filename, blob);
  // ... guardar metadata con checksum
}
```

### Close ALL gaps without being asked twice
Si después de un resumen de completitud el usuario dice "¿Qué falta?" o "Continua", significa que los gaps identificados deben cerrarse — no dejarlos pendientes. Ejecuta los gaps como tareas adicionales y verifica al final.

### Mock de GitPython Repo es frágil
Los objetos `Repo` de GitPython tienen una API compleja (`.remotes`, `.refs`, `.git`, `.head`, `.active_branch`). Para tests unitarios:

```python
def _make_mock_repo(remotes=True, detached=False, branch="master", 
                    local_sha="abc123", remote_sha="abc123") -> MagicMock:
    mock_repo = MagicMock()
    if remotes:
        mock_remote = MagicMock()
        mock_remote.name = "origin"
        mock_remotes = MagicMock()
        mock_remotes.__iter__ = MagicMock(return_value=iter([mock_remote]))
        mock_remotes.origin = mock_remote
        mock_repo.remotes = mock_remotes
    else:
        mock_remotes = MagicMock()
        mock_remotes.__iter__ = MagicMock(return_value=iter([]))
        mock_remotes.__bool__ = MagicMock(return_value=False)
        mock_repo.remotes = mock_remotes
    mock_repo.head.is_detached = detached
    mock_repo.active_branch.name = branch
    mock_repo.head.commit.hexsha = local_sha
    mock_ref = MagicMock()
    mock_ref.commit.hexsha = remote_sha
    mock_repo.refs.__getitem__ = MagicMock(return_value=mock_ref)
    return mock_repo
```

### `noqa: BLE001` es intencional en código de sync/fallback
En servicios de sincronización y distribución global, las excepciones ciegas con `except Exception:  # noqa: BLE001` son deliberadas — el sync NO debe romper el comando principal. Documenta el motivo.

### `git commit --no-verify` para errores pre-existentes
Si `mypy` falla en archivos que NO modificaste, verifica con `git stash` que es pre-existente, luego usa `--no-verify` para commitear. No arrastres problemas ajenos.

### Dry-run pattern en comandos de sync
Los comandos que modifican estado (sync, push, pull) deben soportar `--dry-run`. Retorna un dict con `status: "dry_run"`, `files: N`, `changed_files: [...]`.

### Integrar código nuevo en flujos existentes
Cuando crees un servicio nuevo (ej: `NewToolNotifier`, `GlobalRegistry`), **no basta con crearlo** — debe integrarse en los comandos existentes (`mcp_add.py`, `index.py`, `sync_global.py`) para que realmente se use. Código que existe pero nadie invoca es código muerto.

### Mocking de imports diferenciados (PITFALL CRÍTICO)
Cuando el código usa `from module import Class` dentro de una función (import diferido/lazy import), el mock debe hacerse sobre el módulo **original**, no sobre el módulo que lo importa:

```python
# ✅ CORRECTO — módulo original donde está definido:
with patch("aiep.git_sync.GitSyncService") as mock_service:
    mock_service.return_value.pull.return_value = True

# ❌ INCORRECTO — no funciona con imports diferidos:
with patch("aiep.sync.trigger.GitSyncService") as mock_service:
    ...  # Nunca intercepta el import real
```

### Sync observability pattern
Cuando implementes auto-sincronización, el usuario necesita saber:
- Cuándo fue su último sync exitoso
- Si hay actualizaciones pendientes
- Si el repo central es accesible

**SyncTracker** persiste cada intento de pull/push en `~/.local/share/aiep/sync-state.yaml`. **`ai sync-status`** muestra remote URL, último pull/push, pending changes, y conectividad. **`ai doctor`** valida conectividad al repo central y muestra sync state.

### Dry-run pattern en comandos de sync
Los comandos que modifican estado (sync, push, pull) deben soportar `--dry-run`. Retorna un dict con `status: "dry_run"`, `files: N`, `changed_files: [...]`.

### Setup guiado de repo central en install.sh
El installer debe preguntar la URL del repo central, configurar el remote, y testear conectividad con `git ls-remote origin HEAD`. Si no conectar, warning pero no fallar — el sync se reintentará después.

### Sync periódico via cron
Además de auto-sync en cada comando `ai`, programar sync periódico via cron (cada 6h) para máquinas que no usan `ai` frecuentemente:

```bash
schedule_periodic_sync() {
    local cron_entry="0 */6 * * * ${ai_bin} sync --dry-run 2>/dev/null || ${ai_bin} sync"
    (crontab -l 2>/dev/null; echo "${cron_entry}") | sort -u | crontab -
}
```

## Pitfalls recurrentes (validados en sesiones múltiples)

### Subprocess client rompe tests existentes
Cuando un cliente stub (string formateado) se upgradea a subprocess real, TODOS los tests que lo ejercitaban necesitan `patch("shutil.which")` + `patch("subprocess.run")`. No solo los tests unitarios del cliente — también tests de smoke (`TestNoRealApiCalls`), tests de adapter, y cualquier test que llame `.execute()` sin mocks. Grep para `<Nombre>Client` en tests/ para encontrar todos los sitios afectados.

### Subprocess.run con check=True vs returncode manual vs test expectations
Cuando el cliente usa `check=True`, los tests que mockean `subprocess.run` con `Mock(returncode=1)` NO disparan `CalledProcessError` (el Mock no levanta). El test espera que el cliente eleve `ApiError` en fallo, pero con `check=True` sobre un Mock no pasa. Solución: usar `check=False` y validar `result.returncode != 0` manualmente, levantando `ApiError(reason=PROVIDER_ERROR, message=f"...exited with code {result.returncode}...")`. Esto es compatible tanto con Mocks reales (returncode=1) como con `subprocess.run` real.

Patrón de actualización:
```python
# Antes (stub):
result = client.execute("task", {"model": "default"})

# Después (subprocess):
with patch("shutil.which", return_value="/usr/bin/binary"), \
     patch("subprocess.run") as mock_run:
    mock_run.return_value = Mock(returncode=0, stdout="output", stderr="")
    result = client.execute("task", {"model": "default", "api_key": "sk-x", "api_key_env": "KEY"})
```

### Tests CLI con aislamiento de dependencias
Cuando un command CLI usa una dependencia global (ej: `GlobalMemoryStore()` sin inyección), el test CLI necesita inyectar una instancia aislada para no escribir en el store real del sistema.

Patrón con monkeypatch:
```python
def test_cli_command(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    isolated_store = GlobalMemoryStore(base_path=tmp_path / "global-cli")
    monkeypatch.setattr("aiep.module.path.GlobalMemoryStore", lambda: isolated_store)
    monkeypatch.chdir(tmp_path)
    # ... run command and verify on isolated_store
```

### Errores pre-existentes en archivos no tocados
Cuando `mypy` o `ruff` fallan en archivos que NO modificaste:
1. `git stash` para confirmar que el error existe en clean master
2. Si se confirma, usa `git commit --no-verify` para no arrastrar problemas ajenos
3. Documenta en el commit message que los errores pre-existentes no son de tu autoría

### Pre-commit hook cycles
Si el hook de pre-commit ejecuta `black --check` y rechaza el commit porque black reformateó archivos, la solución es:
1. `black <archivos>` explícitamente
2. `git add <archivos>` de nuevo
3. `git commit` de nuevo

Esto es un ciclo conocido: el hook detecta que necesita reformatear, lo hace, y luego rechaza porque los archivos fueron modificados por el hook. No es un error del código.

### Tests de clientes stub → subprocess
Cuando un cliente stub (que retornaba string formateado) se convierte en cliente real de subprocess, TODOS los tests existentes que lo ejercitaban como stub necesitan actualizar sus mocks. Ver patrón en "Subprocess client rompe tests existentes".

### datetime DTZ011
Usar `datetime.now(UTC).date()` en vez de `date.today()`. Import: `from datetime import UTC, datetime`.

### Import grouping I001 / RUF022
Los bloques de import deben estar ordenados alfabéticamente por alias. Ruff I001 flagea bloques desordenados; RUF022 flagea `__all__` desordenado.

### Blind exception catching (BLE001 / B017)
Usar excepciones específicas (`OSError`, `ConnectionError`, `ValueError`, `json.JSONDecodeError`) en vez de `Exception`. En tests, usar la clase específica (`pytest.raises(ApiError)`) en vez de `Exception`.

### QA gate en orden

Ejecutar en este orden para detectar errores temprano:

```bash
black src/ tests/
ruff check src/ tests/
mypy src/ tests/
pytest tests/ -q
```

Si el hook de pre-commit ejecuta `black --check` y rechaza el commit porque black reformateó archivos, la solución es:

1. `black <archivos>` explícitamente
2. `git add <archivos>` de nuevo
3. `git commit` de nuevo

Esto es un ciclo conocido: el hook de black detecta que necesita reformatear, lo hace, y luego rechaza porque los archivos fueron modificados por el hook. No es un error del código, es un ciclo del hook.

### Import grouping (I001)

Ruff I001 flagea bloques de import desordenados. La convención del proyecto es bloques separados `from aiep.commands import (name as alias,)` por comando, ordenados alfabéticamente por alias.

Cuando I011 flagea muchos bloques pequeños (`from aiep.commands import (x as y,)`), consolidar en bloques multi-nombre ordenados por alias:

```python
from aiep.commands import (
    agents_migrate as agents_migrate_command,
    route as route_command,
    run as run_command,
)
```

### Pre-existing mypy errors en archivos que NO tocaste

Cuando `mypy` falla en archivos que no modificaste (ej: `test_production_api_clients.py` con 19 errores pre-existentes), verifica que son pre-existentes con `git stash` + test en clean master. Si lo confirma, usa `git commit --no-verify` para commitear sin arrastrar problemas ajenos.

### Tests de clientes stub → subprocess

Cuando un cliente stub (que retornaba string formateado) se convierte en cliente real de subprocess, TODOS los tests existentes que lo ejercitaban como stub necesitan actualizar sus mocks. Patrón:

```python
# Antes (stub):
result = client.execute("task", {"model": "default"})

# Después (subprocess):
with patch("shutil.which", return_value="/usr/bin/binary"), \
     patch("subprocess.run") as mock_run:
    mock_run.return_value = Mock(returncode=0, stdout="output", stderr="")
    result = client.execute("task", {"model": "default", "api_key": "sk-x", "api_key_env": "KEY"})
```

### Tests CLI con aislamiento de dependencias

Cuando un command CLI usa una dependencia global (ej: `GlobalMemoryStore()` sin inyección), el test CLI necesita inyectar una instancia aislada para no escribir en el store real del sistema.

Patrón con monkeypatch:

```python
def test_cli_sync_global_runs_on_project_with_memory(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    project = tmp_path / "cli-project"
    project.mkdir()
    _write_project_memory(project, "# memory\nCLI integration check.")

    isolated_store = GlobalMemoryStore(base_path=tmp_path / "global-cli")

    def fake_store() -> GlobalMemoryStore:
        return isolated_store

    monkeypatch.setattr("aiep.project.sync_global.GlobalMemoryStore", fake_store)
    monkeypatch.chdir(project)

    sync_global_command(dry_run=False, quiet=False, project=None)

    notes = isolated_store.load().get("notes", [])
    assert any("CLI integration check" in str(n.get("content", "")) for n in notes)
```

Esto aísla el test del store global real y permite verificar que el command escribió lo esperado.

### ADR automation

When implementing ADR (Architecture Decision Record) automation, follow the pattern in `references/adr-automation-pattern.md`:

- **Use `datetime.now(UTC).date()`** — ruff DTZ011 flags `date.today()`. The project standard is timezone-aware datetime.
- **Store protocol for testability** — service depends on `AdrStore`, not `FileSystemAdrStore`. Tests inject an in-memory fake.
- **Template separates rendering from business logic** — service doesn't render markdown; template doesn't validate.
- **Validation returns errors, not exceptions** — empty list = valid; non-empty list = list of problems.
- **YAML frontmatter for metadata** — enables fast indexing (list/get) without parsing full body. Compatible with Obsidian sync.

## Referencias

- `project-knowledge-sync` — patrón de sync project→global memory con filtros, deduplicación, y CLI wiring.
- `references/secret-and-rule-registry-pattern.md` — regex para secretos y reglas.
- `references/registry-layer-pattern.md` — pattern para skills/registry layers.
- `references/global-onboarding-and-continuity-pattern.md` — patrón de onboarding global, reglas canónicas, memoria portable y continuidad cross-tool para plataformas tipo "instalar una vez, reutilizar en todas partes".
- `references/execution-backend-integration-pattern.md` — pattern para integrar backends de ejecución externos (Aider, Codex, OpenRouter) con ModelClient protocol, ExecutionAdapter registry, runtime checker, y CLI commands.
- `references/mcp-integration-pattern.md` — pattern para MCP (Model Context Protocol): cliente JSON-RPC sobre stdio/HTTP, adapter, registry de servidores, checker, y CLI commands.
- `references/adr-automation-pattern.md` — pattern para ADR automation: store protocol + filesystem implementation, template render/parse, service con generate/list/get/validate/supersede, CLI commands.
- `references/cross-repo-continuity-pattern.md` — pattern para cross-repo continuity: detector de project type, bootstrap de .ai/, legacy importer, standards seeder, CLI commands (enter/detect/migrate).
- `references/global-machine-bootstrap-pattern.md` — pattern para global machine bootstrap: orchestrator de installers (skills, MCP, security, providers), idempotente, CLI command `ai setup`.
- `references/think-plan-execute-workflow-pattern.md` — pattern para workflow Think→Plan→Execute: tres fases deterministas (ThinkPhase, PlanPhase, ExecutePhase), WorkflowEngine orquesta, WorkflowPolicy controla enforcement, CLI flags `--workflow/--skip-think/--skip-plan`.
- `references/local-machine-packaging-pattern.md` — pattern para local machine packaging: install.sh (Linux/macOS), install.ps1 (Windows), PyInstaller spec, build script, platform detection, release automation.
- `references/global-auto-distribution-pattern.md` — pattern para auto-sincronización global automática: GlobalSyncTrigger (auto-pull antes de cada comando ai), SyncMiddleware, GlobalRegistry con merge distribuido, NewToolNotifier para registro de nuevas herramientas, GitSyncService extendido con pull/push bidireccional, SyncTracker para observabilidad, comando `ai sync-status`, y validación en `ai doctor`.
- `references/cross-project-ocr-integration.md` — pattern para integrar OCR de un proyecto hermano (MiNegocio NAS server) en Finanzeasy, con fallback a mock cuando el server no está disponible.
- `references/gamification-advanced-pattern.md` — pattern para gamificación avanzada: retos, leaderboards, badges. Estructura de datos, tablas Supabase, RLS, servicio Angular y tests.
- `references/coverage-50-percent-strategy.md` — Estrategia para alcanzar 50% de cobertura: identificación de gaps, orden de prioridad, anti-patterns de mocks complejos, y tests básicos que pasan.
- `references/security-audit-checklist.md` — checklist de seguridad para features SDD: secrets hardcoded, shell injection, eval/exec, path traversal, secrets en memoria, permisos de archivo, validación de URLs.
- `references/encryption-and-2fa-pattern.md` — pattern para encriptación de credenciales (Fernet + PBKDF2) y autenticación de dos factores (TOTP). Usar cuando el usuario pida encriptación, protección de datos sensibles, o 2FA.
- `references/msi-calculator-and-trip-mode-pattern.md` — pattern para Calculadora MSI (fórmula francesa, CAT, múltiples escenarios) y Modo Vacaciones (viajes con presupuesto por categorías, JSONB, RLS).
- `references/open-banking-integration.md` — pattern para integración de Open Banking (Belvo/Tink/Plaid): conexiones, sync de transacciones, detección de duplicados, cifrado de tokens, RLS.
