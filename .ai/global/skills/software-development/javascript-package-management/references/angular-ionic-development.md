# Angular/Ionic Development Patterns (Finanzeasy)

## Project Structure

```
src/app/
├── components/        # Shared standalone components
├── pages/            # Route-based standalone pages
├── services/         # Injectable services (Firestore CRUD)
├── Interfaces/       # TypeScript interfaces/models
├── app.routes.ts     # Route definitions
└── app.component.ts  # Root standalone component
```

## Standalone Component Pattern

All components and pages are standalone (Angular 14+):

```typescript
@Component({
  selector: 'app-transactions',
  templateUrl: './transactions.page.html',
  styleUrls: ['./transactions.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, IonicModule],
})
export class TransactionsPage implements OnInit { }
```

## Route Loading

Lazy loading with dynamic imports:

```typescript
{
  path: 'transactions',
  loadComponent: () => import('./pages/transactions/transactions.page').then((m) => m.TransactionsPage),
}
```

## Firebase Firestore CRUD Service Pattern

```typescript
@Injectable({ providedIn: 'root' })
export class TransactionService {
  private readonly firestore = inject(Firestore);
  private readonly collectionName = 'transactions';

  getAll(userId: string): Observable<Transaction[]> {
    const q = query(
      collection(this.firestore, this.collectionName),
      where('userId', '==', userId),
      orderBy('date', 'desc'),
    );
    return collectionData(q, { idField: 'id' }) as Observable<Transaction[]>;
  }

  create(data: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = doc(collection(this.firestore, this.collectionName)).id;
    const now = new Date();
    return setDoc(doc(this.firestore, this.collectionName, id), { ...data, id, createdAt: now, updatedAt: now }).then(() => id);
  }

  update(id: string, data: Partial<Transaction>): Promise<void> {
    return updateDoc(doc(this.firestore, this.collectionName, id), { ...data, updatedAt: new Date() });
  }

  delete(id: string): Promise<void> {
    return deleteDoc(doc(this.firestore, this.collectionName, id));
  }
}
```

## Environment-Based Firebase Config

```typescript
// environment.ts
export const environment = {
  production: false,
  firebase: {
    projectId: 'finanzeasy-71d73',
    apiKey: 'AIzaSyB_...',
    // ... other config
  }
};

// main.ts
import { environment } from './environments/environment';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';

bootstrapApplication(AppComponent, {
  providers: [
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => getAuth()),
    provideFirestore(() => getFirestore()),
  ],
});
```

## Testing Patterns

### Standalone Component Test

```typescript
TestBed.configureTestingModule({
  imports: [IonicModule, MyPage],  // Import standalone component
  providers: [
    { provide: MyService, useValue: jasmine.createSpyObj('MyService', ['getAll']) },
  ],
});
```

### Service with Firestore Mock

```typescript
import { Firestore } from '@angular/fire/firestore';

TestBed.configureTestingModule({
  providers: [
    MyService,
    { provide: Firestore, useValue: {} },
  ],
});
```

### Router Testing

```typescript
import { RouterTestingModule } from '@angular/router/testing';

TestBed.configureTestingModule({
  imports: [RouterTestingModule, MyPage],
});
```

### Auth Service Mock

```typescript
const mockAuthService = jasmine.createSpyObj('AuthService', ['getCurrentUser', 'signOut']);
mockAuthService.getCurrentUser.and.returnValue({ uid: 'test-123', email: 'test@example.com' });
mockAuthService.userState$ = of(null);  // For components that use the observable
```

## Common Pitfalls

1. **`Cannot match any routes` in tests** → Add `RouterTestingModule`
2. **`No provider for Firestore!`** → Add `{ provide: Firestore, useValue: {} }`
3. **`Cannot find module 'src/app/...'`** → Use relative imports from test file location
4. **Standalone component in declarations** → Use `imports: [Component]` instead
5. **`getCurrentUser()` missing** → Add method to AuthService returning `auth.currentUser`

## Karma CI Configuration

```javascript
// karma.conf.js
browsers: ['ChromeHeadlessCI'],
customLaunchers: {
  ChromeHeadlessCI: {
    base: 'ChromeHeadless',
    flags: ['--no-sandbox', '--disable-gpu']
  }
}
```

Run tests with:
```bash
export CHROME_BIN=$(find ~/.cache/puppeteer -name 'chrome' -type f | head -1)
pnpm run test:ci
```
