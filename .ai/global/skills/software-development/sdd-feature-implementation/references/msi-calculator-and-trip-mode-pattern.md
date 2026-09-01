# Calculadora MSI y Modo Vacaciones en Angular + Supabase

Patrón para implementar calculadoras financieras avanzadas y modos de presupuesto por evento en aplicaciones Angular + Supabase.

## Calculadora MSI (Meses Sin Intereses)

### Fórmulas

```
Cuota fórmula francesa:
M = P * [r(1+r)^n] / [(1+r)^n - 1]

Donde:
M = pago mensual
P = monto principal
r = tasa mensual (TNA / 12 / 100)
n = número de meses

CAT (Costo Anual Total):
CAT = ((Total/P) - 1) * (12/n) * 100
```

### Input/Output

```typescript
export interface MSICalculatorInput {
  amount: number;
  monthsOptions: number[];  // ej: [3, 6, 12, 18, 24]
  interestRate: number;     // TNA en porcentaje
  cashDiscount?: number;    // Descuento por pago en efectivo (%)
}

export interface MSIComparison {
  scenarios: MSIScenario[];
  bestOption: MSIScenario;  // Menor total a pagar
  savingsVsCash: number;    // Diferencia vs pago contado
}
```

### Servicio

```typescript
@Injectable({ providedIn: 'root' })
export class MSICalculatorService {
  calculateScenarios(input: MSICalculatorInput): MSIComparison {
    // Para cada plazo, calcular:
    // 1. Pago mensual (fórmula francesa o división simple si tasa=0)
    // 2. Total a pagar = pago mensual * meses
    // 3. Total intereses = total - monto
    // 4. Mejor opción = menor total
    // 5. Comparación vs contado con descuento
  }

  calculateCAT(scenario: MSIScenario): number {
    // CAT = ((Total/P) - 1) * (12/n) * 100
  }

  calculateMonthlyPayment(amount: number, months: number, annualRate: number): number {
    // Pago mensual con tasa
  }
}
```

### Casos de prueba críticos

1. **Tasa 0%**: `monthlyPayment = amount / months`, `totalInterest = 0`
2. **Tasa > 0**: Usar fórmula francesa
3. **Cash discount**: `cashPrice = amount * (1 - discount/100)`
4. **Mejor opción**: Siempre el plazo más corto con menor total
5. **CAT > 0** cuando hay intereses

## Modo Vacaciones (Trip Budget)

### Estructura

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
}

export interface TripCategory {
  name: string;      // ej: "Vuelos", "Hotel", "Comida"
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

### Tablas Supabase

```sql
CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  destination TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  budget NUMERIC(12,2) NOT NULL DEFAULT 0,
  spent NUMERIC(12,2) NOT NULL DEFAULT 0,
  categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trip_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### RLS

```sql
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own trips" ON trips FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can CRUD own trip expenses" ON trip_expenses FOR ALL 
  USING (trip_id IN (SELECT id FROM trips WHERE user_id = auth.uid()));
```

### Servicio

```typescript
@Injectable({ providedIn: 'root' })
export class TripService {
  async createTrip(trip: Omit<Trip, 'id' | 'spent' | 'created_at'>): Promise<Trip> {}
  async getTrips(): Promise<Trip[]> {}
  async getTrip(id: string): Promise<Trip | null> {}
  async addExpense(tripId: string, expense: Omit<TripExpense, 'id' | 'tripId'>): Promise<TripExpense> {}
  async getExpenses(tripId: string): Promise<TripExpense[]> {}
  
  getRemainingBudget(trip: Trip): number {
    return trip.budget - trip.spent;
  }
  
  getSpentPercentage(trip: Trip): number {
    return Math.round((trip.spent / trip.budget) * 100);
  }
}
```

## Pitfall: JSONB para categorías

Usar `JSONB` para `categories` en `trips` permite arrays de objetos sin tabla separada. RLS aplica al trip completo, no a cada categoría.

```typescript
// ✅ CORRECTO — JSONB array
categories: [
  { name: "Vuelos", budget: 5000, spent: 4500 },
  { name: "Hotel", budget: 8000, spent: 6000 }
]
```

## Pitfall: Actualizar spent automáticamente

Cuando se agrega un gasto, recalcular el total:

```typescript
async addExpense(tripId: string, expense: Omit<TripExpense, 'id' | 'tripId'>): Promise<TripExpense> {
  // 1. Insertar gasto
  const { data } = await this.supabase.client.from('trip_expenses').insert({...}).select().single();
  
  // 2. Recalcular total
  await this.updateTripSpent(tripId);
  
  return data;
}

private async updateTripSpent(tripId: string): Promise<void> {
  const expenses = await this.getExpenses(tripId);
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  
  await this.supabase.client.from('trips').update({ spent: totalSpent }).eq('id', tripId);
}
```
