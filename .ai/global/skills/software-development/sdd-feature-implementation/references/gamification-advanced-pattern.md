# Gamificación Avanzada: Retos, Leaderboards y Badges

Pattern para implementar features de gamificación más allá de XP/niveles básicos en aplicaciones Angular + Supabase.

## Estructura de datos

```typescript
export interface Challenge {
  id: string;
  title: string;
  description: string;
  type: 'spending_limit' | 'savings_goal' | 'streak' | 'no_spend' | 'budget_master';
  startDate: string;
  endDate: string;
  goal: number;
  currentProgress: number;
  participants: number;
  createdBy: string;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  avatar?: string;
  score: number;
  rank: number;
  badges: string[];
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'spending' | 'savings' | 'goals' | 'streaks' | 'special';
  unlockedAt?: string;
  notified?: boolean;
}

export interface ChallengeProgress {
  challengeId: string;
  userId: string;
  progress: number;
  completed: boolean;
  joinedAt: string;
}
```

## Retos predefinidos

```typescript
export const DEFAULT_CHALLENGES: Challenge[] = [
  {
    id: 'weekly_no_spend',
    title: 'Semana Sin Gastos',
    description: 'No gastes en categorías no esenciales por una semana',
    type: 'no_spend',
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    goal: 7,
    currentProgress: 0,
    participants: 0,
    createdBy: 'system',
  },
  {
    id: 'budget_master',
    title: 'Maestro del Presupuesto',
    description: 'Mantén tus gastos dentro del presupuesto por 30 días',
    type: 'budget_master',
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    goal: 30,
    currentProgress: 0,
    participants: 0,
    createdBy: 'system',
  },
  {
    id: 'savings_streak',
    title: 'Racha de Ahorro',
    description: 'Ahorra al menos $500 cada semana por 4 semanas',
    type: 'savings_goal',
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(),
    goal: 2000,
    currentProgress: 0,
    participants: 0,
    createdBy: 'system',
  },
];
```

## Flujo de retos

1. `getAvailableChallenges()` — retos vigentes (end_date >= hoy)
2. `joinChallenge(challengeId)` — unirse a un reto
3. `updateProgress(challengeId, progress)` — actualizar progreso
4. `getLeaderboard()` — ranking global (top 100 por score)
5. `getBadges()` — insignias del usuario

## Tablas Supabase

```sql
CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  goal NUMERIC NOT NULL DEFAULT 0,
  current_progress NUMERIC NOT NULL DEFAULT 0,
  participants INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS challenge_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  progress NUMERIC NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(challenge_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_gamification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  score INTEGER NOT NULL DEFAULT 0,
  badges JSONB NOT NULL DEFAULT '[]'::jsonb,
  achievements JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## RLS

```sql
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_gamification ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view challenges" ON challenges FOR SELECT USING (true);
CREATE POLICY "Users can create challenges" ON challenges FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "Users can view own progress" ON challenge_progress FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own progress" ON challenge_progress FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can view own gamification" ON user_gamification FOR SELECT USING (user_id = auth.uid());
```

## Servicio Angular

```typescript
@Injectable({ providedIn: 'root' })
export class GamificationAdvancedService {
  constructor(private readonly supabase: SupabaseService) {}

  async getAvailableChallenges(): Promise<Challenge[]> {
    const { data, error } = await this.supabase.client
      .from('challenges')
      .select('*')
      .gte('end_date', new Date().toISOString())
      .order('start_date', { ascending: true });

    if (error) throw error;
    return data || DEFAULT_CHALLENGES;
  }

  async joinChallenge(challengeId: string): Promise<void> {
    const userId = this.supabase.user?.id;
    if (!userId) throw new Error('User not authenticated');

    await this.supabase.client.from('challenge_progress').insert({
      challenge_id: challengeId,
      user_id: userId,
      progress: 0,
      completed: false,
    });
  }

  async updateProgress(challengeId: string, progress: number): Promise<void> {
    const userId = this.supabase.user?.id;
    if (!userId) return;

    await this.supabase.client
      .from('challenge_progress')
      .update({ progress })
      .eq('challenge_id', challengeId)
      .eq('user_id', userId);
  }

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const { data, error } = await this.supabase.client
      .from('user_gamification')
      .select('user_id, display_name, score, badges')
      .order('score', { ascending: false })
      .limit(100);

    if (error) throw error;

    return (data || []).map((entry: any, index: number) => ({
      userId: entry.user_id,
      displayName: entry.display_name || `Usuario ${index + 1}`,
      score: entry.score || 0,
      rank: index + 1,
      badges: entry.badges || [],
    }));
  }

  async getBadges(): Promise<Badge[]> {
    const userId = this.supabase.user?.id;
    if (!userId) return [];

    const { data, error } = await this.supabase.client
      .from('user_gamification')
      .select('badges')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data?.badges || [];
  }
}
```

## Tests

```typescript
describe('GamificationAdvancedService', () => {
  let service: GamificationAdvancedService;
  let supabaseServiceMock: any;

  beforeEach(() => {
    const createChain = () => {
      const chain: any = {};
      chain.select = jasmine.createSpy('select').and.returnValue(chain);
      chain.insert = jasmine.createSpy('insert').and.returnValue(chain);
      chain.update = jasmine.createSpy('update').and.returnValue(chain);
      chain.delete = jasmine.createSpy('delete').and.returnValue(chain);
      chain.eq = jasmine.createSpy('eq').and.returnValue(chain);
      chain.order = jasmine.createSpy('order').and.returnValue(chain);
      chain.gte = jasmine.createSpy('gte').and.returnValue(chain);
      chain.limit = jasmine.createSpy('limit').and.returnValue(chain);
      chain.single = jasmine.createSpy('single').and.resolveTo({ data: null });
      return chain;
    };

    supabaseServiceMock = {
      client: { from: jasmine.createSpy('from').and.callFake(() => createChain()) },
      user: { id: 'user-1' },
    };

    TestBed.configureTestingModule({
      providers: [GamificationAdvancedService, { provide: SupabaseService, useValue: supabaseServiceMock }],
    });
    service = TestBed.inject(GamificationAdvancedService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have getAvailableChallenges method', () => {
    expect(typeof service.getAvailableChallenges).toBe('function');
  });

  it('should have joinChallenge method', () => {
    expect(typeof service.joinChallenge).toBe('function');
  });

  it('should have updateProgress method', () => {
    expect(typeof service.updateProgress).toBe('function');
  });

  it('should have getLeaderboard method', () => {
    expect(typeof service.getLeaderboard).toBe('function');
  });

  it('should have getBadges method', () => {
    expect(typeof service.getBadges).toBe('function');
  });
});
```

## Pitfall: callFake para chains frescos

Cuando el servicio llama multiples veces a `supabase.client.from('tabla')`, cada llamada necesita un chain NUEVO. Usa `callFake`:

```typescript
supabaseServiceMock = {
  client: { 
    from: jasmine.createSpy('from').and.callFake(() => createChain()) 
  },
};
```

Si usas `returnValue(mockChain)`, todas las llamadas comparten el mismo chain y los spies acumulan calls incorrectamente.
