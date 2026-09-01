# Dual Repo Sync Pattern (Angular + React Native)

Pattern para mantener dos repositorios (Angular web + React Native móvil) sincronizados compartiendo backend Supabase.

## Arquitectura

```
[Angular Web] ← → [Supabase] ← → [React Native Móvil]
     ↓                                      ↓
[testing/Ai]                           [test/ia]
```

## Estructura de Commits por Feature

Cada feature completo sigue este flujo:

```
feature/<nombre> → commit → merge --no-ff → testing/Ai
```

## Reglas de Sincronización

1. **Supabase compartido:** Ambos repos usan la misma instancia Supabase (mismo proyecto, mismas políticas RLS)
2. **Tipos alineados:** Los tipos TypeScript en React Native deben coincidir con la estructura snake_case de Supabase
3. **Migraciones SQL:** Se ejecutan una vez en Supabase, ambos repos las aplican
4. **Tests independientes:** Cada repo tiene su propio suite (Angular: Karma/Jasmine, React: Jest)

## Ejemplo: Agregar una nueva tabla

```sql
-- 1. Crear migración en /supabase/migrations/
CREATE TABLE IF NOT EXISTS new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  ...
);

-- 2. RLS
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own data" ON new_table FOR SELECT USING (auth.uid() = user_id);
```

```typescript
// 3. Interfaz TypeScript (Angular)
export interface NewItem {
  id: string;
  userId: string;
  ...
}

// 4. Interfaz TypeScript (React Native - snake_case mapping)
interface NewItem {
  id: string;
  user_id: string;
  ...
}
```

## Pitfall: Divergencia de tipos

Cuando agregues un campo nuevo a una tabla, actualiza AMBOS repositorios antes de hacer commit. Si solo actualizas uno, el otro repo tendrá tipos desalineados y errores en runtime.

### Verificación cruzada

```bash
# Angular
cd /home/jonathanh/proyectos/Finanzeasy
pnpm run test:ci
pnpm run build:prod

# React Native
cd /home/jonathanh/proyectos/FinanzeasyReact
pnpm test
```

## Patrón: Calculadora MSI

Cuando implementes una calculadora de Meses Sin Intereses:

```typescript
export interface MSIScenario {
  id: string;
  name: string;
  amount: number;
  months: number;
  interestRate: number; // TNA
  monthlyPayment: number;
  totalToPay: number;
  totalInterest: number;
}

export interface MSIComparison {
  scenarios: MSIScenario[];
  bestOption: MSIScenario;
  savingsVsCash: number;
}

export interface MSICalculatorInput {
  amount: number;
  monthsOptions: number[]; // ej: [3, 6, 12, 18, 24]
  interestRate: number; // TNA en porcentaje
  cashDiscount?: number; // Descuento por pago en efectivo (%)
}
```

**Fórmula de cuota fija francesa:**

```typescript
const monthlyRate = interestRate / 100 / 12;
monthlyPayment = (amount * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
```

**CAT (Costo Anual Total):**

```typescript
const totalCost = ((totalToPay / amount) - 1) * 100;
const cat = totalCost * (12 / months);
```

## Patrón: Modo Vacaciones (Trips)

Cuando implementes un modo de viajes con presupuesto:

```typescript
export interface Trip {
  id: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  budget: number;
  spent: number;
  categories: TripCategory[];
  created_at: string;
}

export interface TripCategory {
  name: string;
  budget: number;
  spent: number;
}

export interface TripExpense {
  id: string;
  tripId: string;
  amount: number;
  description: string;
  category: string;
  date: string;
}
```

**Tablas:**
- `trips` — información del viaje
- `trip_expenses` — gastos del viaje

**Lógica:**
1. Crear viaje con presupuesto y categorías
2. Agregar gastos con categoría
3. Actualizar `spent` automáticamente
4. Calcular presupuesto restante y porcentaje gastado
