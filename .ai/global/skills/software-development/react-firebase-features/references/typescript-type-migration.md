# TypeScript Type Migration Pattern — Session 2026-08-20

## Context

When refactoring a shared interface (e.g., `StartsModuleSettings`), TypeScript reports cascading errors across many files. This pattern shows how to systematically resolve them.

## The Migration Pattern

### 1. Identify the root type change

```typescript
// BEFORE
interface StartsModuleSettings {
  statuses: ProspectStatusDefinition[];
  defaultSuggestions: ProspectSuggestionDefinition[];
  stagnationDays: number;
  strategyLog: StartsStrategyLogEntry[];
}

// AFTER
interface StartsModuleSettings {
  prospectStatuses: ProspectStatusDefinition[];
  inicioStatuses: ProspectStatusDefinition[];
  defaultSuggestions: ProspectSuggestionDefinition[];
  stagnationDays: number;
  thresholds: ThresholdConfig[];
  strategyLog: StartsStrategyLogEntry[];
}
```

### 2. Find ALL references (grep is your friend)

```bash
# Find all .statuses references
grep -rn "\.statuses" src/ --include="*.ts" --include="*.tsx"

# Find all DEFAULT_STARTS_SETTINGS.statuses references
grep -rn "DEFAULT_STARTS_SETTINGS\.statuses" src/
```

### 3. Update references by category

| Category | Action |
|----------|--------|
| **Type definitions** | Update the interface itself |
| **Default values** | Update `DEFAULT_STARTS_SETTINGS` to use new field names |
| **Component props** | Update prop types and destructuring |
| **Helper functions** | Update function signatures and internal references |
| **Test files** | Update test assertions to match new structure |
| **Import statements** | Update if the type name changed |

### 4. Update helper functions that use the old fields

```typescript
// BEFORE
export const findNewStatusId = (statuses: ProspectStatusDefinition[]): string | undefined => {
  return statuses.find(s => s.id === 'new')?.id;
};

// AFTER (support both old and new IDs for backward compatibility)
export const findNewStatusId = (statuses: ProspectStatusDefinition[]): string | undefined => {
  return statuses.find(s => s.id === 'nuevo' || s.id === 'new')?.id;
};
```

### 5. Update tests to match new IDs

```typescript
// BEFORE
expect(DEFAULT_STARTS_SETTINGS.statuses).toHaveLength(5);
expect(def[0].id).toBe('new');

// AFTER
expect(DEFAULT_STARTS_SETTINGS.prospectStatuses).toHaveLength(7);
expect(def[0].id).toBe('nuevo');
```

## Common Error Codes

| Error | Meaning | Fix |
|-------|---------|-----|
| `TS2339: Property 'X' does not exist on type 'Y'` | Field removed/renamed | Update to new field name |
| `TS2322: Type 'X' is not assignable to type 'Y'` | Type shape mismatch | Update the value to match new type |
| `TS2741: Property 'X' is missing in type 'Y'` | Required field missing | Add the missing field |
| `TS7006: Parameter 'X' implicitly has an 'any' type` | Lost type inference | Add explicit type annotation |

## Verification

```bash
# Type check
npx tsc --noEmit --pretty

# Run affected tests
pnpm exec vitest run src/lib/startsDomain.test.ts src/lib/prospectStatus.test.ts

# Build
pnpm run build
```

## Pitfall: Don't forget test files

Test files often reference the old structure and fail silently (tests pass but for wrong reasons). Always update tests to match the new structure explicitly.
