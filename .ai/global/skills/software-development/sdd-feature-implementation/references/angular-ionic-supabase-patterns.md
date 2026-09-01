# Angular + Ionic + Supabase Patterns

Patrones validados en sesión de migración Firebase → Supabase con Angular 17 + Ionic 7.

## Estructura de servicios con Repository Pattern

```typescript
// Interfaz de repositorio
export interface ITransactionRepository {
  getAll(): Promise<Transaction[]>;
  getById(id: string): Promise<Transaction | null>;
  create(data: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>): Promise<Transaction>;
  update(id: string, data: Partial<Transaction>): Promise<Transaction>;
  delete(id: string): Promise<void>;
}

// Servicio implementa interfaz
@Injectable({ providedIn: 'root' })
export class TransactionService implements ITransactionRepository {
  private readonly supabaseService = inject(SupabaseService);

  async getAll(): Promise<Transaction[]> {
    const response = await this.supabaseService.supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false });

    if (response.error) throw response.error;
    return response.data ?? [];
  }
  // ...
}
```

## Cliente Supabase centralizado

```typescript
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly client: SupabaseClient;
  private readonly _user = new BehaviorSubject<User | null>(null);
  readonly user$ = this._user.asObservable();

  constructor() {
    this.client = createClient(environment.supabase.url, environment.supabase.anonKey, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
    });
    // Initialize + listen auth changes
  }

  get supabase(): SupabaseClient { return this.client; }
  get user(): User | null { return this._user.value; }
}
```

## AuthGuard con Signals

```typescript
@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  private readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);

  canActivate(): Observable<boolean | UrlTree> {
    return this.supabaseService.user$.pipe(
      take(1),
      map((user) => user ? true : this.router.createUrlTree(['/login'])),
    );
  }
}
```

## Theme Service con Signals

```typescript
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'finanzeasy-theme';
  readonly theme = signal<Theme>(this.getInitialTheme());

  constructor() {
    effect(() => {
      document.documentElement.setAttribute('data-theme', this.theme());
      localStorage.setItem(this.STORAGE_KEY, this.theme());
    });
  }

  toggleTheme(): void {
    this.theme.update((t) => t === 'light' ? 'dark' : 'light');
  }
}
```

## i18n con Signals

```typescript
@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly STORAGE_KEY = 'finanzeasy-locale';
  readonly locale = signal<Locale>(this.getInitialLocale());
  private translations: Translations = {};

  async setLocale(locale: Locale): Promise<void> {
    if (locale === this.locale() && Object.keys(this.translations).length > 0) return;
    let module: { default: Translations };
    if (locale === 'es') {
      module = await import('../services/i18n/es.json') as unknown as { default: Translations };
    } else {
      module = await import('../services/i18n/en.json') as unknown as { default: Translations };
    }
    this.translations = module.default;
    this.locale.set(locale);
    localStorage.setItem(this.STORAGE_KEY, locale);
  }

  translate(key: string): string { return this.translations[key] || key; }
}
```

**Archivos**: `src/app/services/i18n/es.json` y `en.json` con pares clave-valor.

**tsconfig.json**: Requiere `"resolveJsonModule": true`.

**Uso en template**: `{{ 'nav.dashboard' | translate }}` con pipe `TranslatePipe`.

**Toggle en header**:
```html
<ion-button (click)="toggleLanguage()">
  <ion-icon [name]="currentLocale === 'es' ? 'flag-outline' : 'flag'"></ion-icon>
</ion-button>
```

## CSV Export Service

```typescript
@Injectable({ providedIn: 'root' })
export class CsvExportService {
  private readonly BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility

  exportToCsv<T>(filename: string, data: T[], columns: CsvColumn<T>[]): void {
    if (data.length === 0) return;

    const headers = columns.map((col) => this.escapeCsvField(col.header));
    const rows = data.map((item) =>
      columns.map((col) => this.escapeCsvField(this.formatValue(col.getValue(item)))),
    );

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    this.downloadCsv(this.BOM + csvContent, filename);
  }

  private escapeCsvField(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private downloadCsv(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
```

## Chart.js con Angular

```typescript
@Component({
  selector: 'app-expense-by-category-chart',
  standalone: true,
  template: `<div class="chart-container"><canvas #chartCanvas></canvas></div>`,
})
export class ExpenseByCategoryChartComponent implements OnInit, OnDestroy {
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;
  @Input() categories: CategoryTotal[] = [];
  private chart: Chart<'doughnut'> | null = null;

  ngOnInit(): void { this.createChart(); }
  ngOnDestroy(): void { this.chart?.destroy(); }

  private createChart(): void {
    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    this.chart = new Chart(ctx, {
      type: 'doughnut',
      data: this.chartService.getExpenseByCategoryChartData(this.categories),
      options: this.chartService.getDoughnutOptions('Gastos por Categoría'),
    });
  }
}
```

## Row Level Security (RLS) en Supabase

```sql
-- Habilitar RLS
ALTER TABLE transactions ENABLE ROW LEVEL_SECURITY;

-- Políticas por usuario
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

## GitFlow para features

1. `git checkout -b feature/<nombre>`
2. Implementar + tests + lint + build
3. `git add -A && git commit -m "feat: ..."`
4. `git checkout testing/Ai && git merge feature/<nombre> --no-ff`
5. Actualizar MASTERPROMPT.md y ROADMAP.md

## QA Gate (proyectos Angular)

```bash
pnpm run lint        # ESLint
pnpm run build:prod  # Build producción
pnpm run test:ci     # Tests + coverage
```

## Pitfalls validados

- **JSON imports en TS**: Necesitan `"resolveJsonModule": true` en tsconfig.json
- **Chart.js con Angular standalone**: Registrar con `Chart.register(...registerables)` en el componente
- **Signals en servicios**: Usar `inject()` en vez de constructor para servicios con Signals
- **Imports dinámicos JSON**: Usar `as unknown as ModuleType` para evitar errores de tipo
- **Angular template binding**: Usar `[property]="value"` para pasar arrays/objetos, no `property="value"`
- **PWA service worker**: Registrar en `ngOnInit` con `window.addEventListener('load', ...)`, no directamente
- **PWA en nginx**: Los archivos `.json`, `.webmanifest` y `sw.js` deben tener `Cache-Control: no-cache`
- **SW testing**: Los tests de componentes con SW fallan si no se mockea `navigator.serviceWorker`; usar `Object.defineProperty` con `writable: true`

## Patrón de entidad completa (validado en sesión)

Para cada nueva entidad (Loans, Investments, Debts, Credit Cards, Recurring Transactions):

### 1. Interfaz de dominio (`src/app/Interfaces/<Name>.ts`)
```typescript
export interface <Name> {
  id: string;
  user_id: string;
  // campos específicos
  created_at: string;
  updated_at: string;
}
```

### 2. Interfaz de repositorio (`src/app/Interfaces/I<Name>Repository.ts`)
```typescript
export interface I<Name>Repository {
  getAll(): Promise<Name[]>;
  getById(id: string): Promise<Name | null>;
  create(item: Omit<Name, 'id' | 'created_at' | 'updated_at'>): Promise<Name>;
  update(id: string, data: Partial<Name>): Promise<Name>;
  delete(id: string): Promise<void>;
}
```

### 3. Servicio (`src/app/services/<name>.service.ts`)
```typescript
@Injectable({ providedIn: 'root' })
export class <Name>Service implements I<Name>Repository {
  private readonly supabaseService = inject(SupabaseService);
  // implementar métodos
}
```

### 4. Tests (`src/app/services/<name>.service.spec.ts`)
```typescript
describe('<Name>Service', () => {
  let service: <Name>Service;
  let supabaseServiceMock: { supabase: any };

  beforeEach(() => {
    const mockChain: any = {};
    mockChain.select = jasmine.createSpy('select').and.returnValue(mockChain);
    mockChain.insert = jasmine.createSpy('insert').and.returnValue(mockChain);
    mockChain.update = jasmine.createSpy('update').and.returnValue(mockChain);
    mockChain.delete = jasmine.createSpy('delete').and.returnValue(mockChain);
    mockChain.eq = jasmine.createSpy('eq').and.returnValue(mockChain);
    mockChain.order = jasmine.createSpy('order').and.returnValue(mockChain);
    mockChain.single = jasmine.createSpy('single').and.resolveTo({ data: null, error: null });
    supabaseServiceMock = { supabase: { from: jasmine.createSpy('from').and.returnValue(mockChain) } };
    TestBed.configureTestingModule({
      providers: [<Name>Service, { provide: SupabaseService, useValue: supabaseServiceMock }],
    });
    service = TestBed.inject(<Name>Service);
  });

  it('should be created', () => { expect(service).toBeTruthy(); });
  it('should have getAll method', () => { expect(typeof service.getAll).toBe('function'); });
});
```

### 5. Página (`src/app/pages/<name>/<name>.page.ts`)
```typescript
@Component({
  selector: 'app-<name>',
  templateUrl: './<name>.page.html',
  styleUrls: ['./<name>.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, IonicModule],
})
export class <Name>Page implements OnInit {
  private readonly <name>Service = inject(<Name>Service);
  private readonly authService = inject(AuthService);
  items: Name[] = [];
  showForm = false;
  form = new FormGroup({ /* campos */ });
  ngOnInit(): void { this.loadData(); }
  async loadData(): Promise<void> { /* llamar servicio */ }
  openCreate(): void { this.form.reset(); this.showForm = true; }
  cancel(): void { this.showForm = false; }
  async save(): Promise<void> { /* validar, crear, recargar */ }
  async delete(id: string): Promise<void> { /* eliminar, recargar */ }
}
```

### 6. Ruta (`src/app/app.routes.ts`)
```typescript
{
  path: '<route>',
  canActivate: [AuthGuard],
  loadComponent: () => import('./pages/<name>/<name>.page').then((m) => m.<Name>Page),
}
```

### 7. Navegación header (`src/app/components/header/header.component.html`)
```html
<ion-button routerLink="/<route>" routerDirection="root">
  <ion-icon slot="icon-only" name="<icon>"></ion-icon>
</ion-button>
```

### 8. SQL Migration (`supabase/migrations/NNNN_<name>.sql`)
```sql
CREATE TABLE IF NOT EXISTS <table_name> (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- campos específicos
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_<table>_user_id ON <table_name>(user_id);
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own <items>" ON <table_name> FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own <items>" ON <table_name> FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own <items>" ON <table_name> FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own <items>" ON <table_name> FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_<table>_updated_at BEFORE UPDATE ON <table_name> FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 9. Actualizar MASTERPROMPT.md y ROADMAP.md

Siempre cerrar el sprint actualizando:
- `MASTERPROMPT.md`: métricas (tests, cobertura, features)
- `docs/ROADMAP.md`: sprint completado con checklist
