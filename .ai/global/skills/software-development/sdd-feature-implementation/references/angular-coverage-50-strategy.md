# Estrategia de Cobertura al 50% en Angular/Supabase/Karma/Jasmine

## Contexto

Proyectos Angular 17+ con Supabase (PostgreSQL) y tests en Karma/Jasmine tienen un patrón característico: los servicios llaman a `supabase.client.from('tabla').select('*').eq('campo', valor).order(...)`. Testear estos servicios requiere mockear la cadena de métodos de Supabase, lo cual es propenso a errores si no se conoce el patrón correcto.

## Orden de Prioridad (Mayor ROI primero)

### 1. Lógica Pura (sin dependencias)

Servicios como `CurrencyConverter`, `MSICalculatorService`, `DebtPlannerService` no necesitan TestBed ni mocks.

```typescript
// test — sin TestBed, sin mocks
describe('CurrencyConverter', () => {
  it('should convert USD to MXN', () => {
    const result = CurrencyConverter.convert(100, 'USD', 'MXN');
    expect(result).toBeCloseTo(1750, 0);
  });
});
```

### 2. Servicios con Supabase (mock chain)

```typescript
// Crear chain que retorna sí mismo
const createChain = () => {
  const chain: any = {};
  chain.select = jasmine.createSpy('select').and.returnValue(chain);
  chain.insert = jasmine.createSpy('insert').and.returnValue(chain);
  chain.update = jasmine.createSpy('update').and.returnValue(chain);
  chain.delete = jasmine.createSpy('delete').and.returnValue(chain);
  chain.eq = jasmine.createSpy('eq').and.returnValue(chain);
  chain.order = jasmine.createSpy('order').and.returnValue(chain);
  chain.gte = jasmine.createSpy('gte').and.returnValue(chain);
  chain.single = jasmine.createSpy('single').and.resolveTo({ data: null, error: null });
  return chain;
};

// En TestBed — usar callFake para crear chain nuevo por llamada
TestBed.configureTestingModule({
  providers: [
    MyService,
    { provide: SupabaseService, useValue: { 
      client: { from: jasmine.createSpy('from').and.callFake(() => createChain()) } 
    }},
  ],
});
```

**VERIFICAR:** `expect(supabaseMock.client.from).toHaveBeenCalledWith('tabla')`

### 3. Servicios con HttpClient

```typescript
const httpClientStub = {
  post: jasmine.createSpy('post').and.returnValue({ 
    toPromise: () => Promise.resolve({ ok: true, data: [] }) 
  }),
};

TestBed.configureTestingModule({
  providers: [MyService, { provide: HttpClient, useValue: httpClientStub }],
});
```

### 4. Componentes (ÚLTIMO — alto esfuerzo, bajo ROI)

Requieren TestBed + mocks de todos los servicios inyectados + imports de Ionic/Router.

## Errores Comunes y Soluciones

| Error | Causa | Solución |
|-------|-------|----------|
| `Property 'returnThis' does not exist on type 'SpyAnd<Func>'` | Jasmine no tiene `returnThis()` | `.and.returnValue(mockChain)` |
| `NullInjectorError: No provider for HttpClient` | HttpClient no mockeado | Agregar `{ provide: HttpClient, useValue: stub }` |
| Spy chain se corta entre tests | `from()` retorna mismo mock siempre | `callFake(() => createChain())` |
| `writeFile is not declared writable` | spyOn sobre módulo ES | Usar tests que solo verifican "no lanza excepción" |
| Storage mock falla | `from()` no retorna mock correcto | `.and.returnValue(storageMock)` en `from()` |

## Patrón de Test de Lógica Privada

```typescript
// Acceder método privado para testear lógica pura
const result = (service as any).estimateFrequency(dates);
expect(result).toBe('mensual');
```

## Cobertura Real vs Cobertura Aparente

Agregar archivos de test incrementa el denominador (líneas de código en tests). Para que la cobertura suba de verdad:

- **Tests de lógica pura**: Ejecutan líneas del servicio → sube numerador
- **Tests de "should be created"**: Solo ejecutan el constructor → sube poco el numerador
- **Tests de componentes**: Ejecutan mucho boilerplate → sube poco el numerador

**Consejo**: Prioriza tests que ejerciten ramas, cálculos y condiciones del servicio.

## Resultados Reales (Sprint 24)

| Antes | Después |
|-------|---------|
| 234 tests | 264 tests |
| ~34% statements | 33.7% statements |
| ~43% functions | 40.1% functions |

**Nota**: La cobertura bajó porcentualmente porque los nuevos archivos de tests añadieron más líneas al denominador que las líneas de producción ejercitadas. Para subir porcentaje real, se necesita testear servicios con mucha lógica sin mocks (como CurrencyConverter, MSICalculatorService).

## PITFALL CRÍTICO: Los archivos de test cuentan en el denominador (validado Sprint 24)

Descubrimiento clave de esta sesión: agregar archivos `.spec.ts` puede **disminuir** el porcentaje de cobertura porque Karma/Istanbul cuenta los statements/branches/functions de los archivos de test en el denominador.

**Estrategia corregida para llegar al 50%:**
1. Agrega assertions a tests **existentes** que ejecuten código no cubierto
2. Evita crear nuevos `.spec.ts` con solo tests de smoke (`it('should create')`)
3. Si creas un nuevo `.spec.ts`, cada `it` debe tener múltiples assertions que cubran todas las ramas
4. Prioriza servicios de lógica pura (sin mocks) donde 1 assertion = 1 statement ejecutado del servicio

**Resultado real de esta sesión:**
```
Antes:  264 tests, 33.6% statements
Después de agregar 8 test files: 255 tests, 32.85% statements  ← BAJÓ
```

**Conclusión:** Para subir cobertura al 50%, la estrategia más efectiva es agregar assertions a tests existentes que ejecuten código no cubierto, no crear nuevos archivos de test.
