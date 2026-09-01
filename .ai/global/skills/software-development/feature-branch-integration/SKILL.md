---
name: feature-branch-integration
description: "Merge branches with overlapping feature implementations."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [Git, Merge, Integration, Feature-Branch, Conflict-Resolution]
    related_skills: [github-pr-workflow, github-code-review]
---

# Feature Branch Integration

Use when two branches have developed overlapping implementations of the same feature independently and you need to merge them into a coherent whole.

## Trigger Conditions

- Two branches both touch the same feature area (same types, same components, same routes)
- One branch has logic the other lacks, or vice versa
- Merge produces conflicts in shared files (`navItems.ts`, `types/index.ts`, `App.tsx`, etc.)
- User says "integrate", "merge these branches", "reconcile", "this branch has part of the logic"

## Phase 1: Analyze Both Branches

### 1.1 Get Commit History

```bash
# What commits does each branch have beyond main?
git log --oneline main..<branch-A>
git log --oneline main..<branch-B>
```

### 1.2 Get File-Level Diff

```bash
# What files does each branch touch?
git diff main <branch-A> --name-only | sort > /tmp/branch-A-files.txt
git diff main <branch-B> --name-only | sort > /tmp/branch-B-files.txt

# What files overlap?
comm -12 /tmp/branch-A-files.txt /tmp/branch-B-files.txt
```

### 1.3 Read Branch Content (for remote branches)

```bash
# Read a file from a specific branch without checking it out
git show <branch>:path/to/file.tsx
```

For parallel analysis of many files, use `delegate_task` to spawn a subagent that reads all files from one branch and summarizes structure, key functions, and purpose.

### 1.4 Compare Approaches

Create a comparison table:

| Aspect | Branch A | Branch B | Keep from |
|--------|----------|----------|-----------|
| Data model | `Lead` type | `Prospect` type | Evaluate which is more complete |
| Page component | `Leads.tsx` | `Starts.tsx` | Keep both or merge |
| Persistence | `useLeadsCollection` | `useProspectsList` | Evaluate cache-first vs real-time |
| UI components | `LeadForm`, `BitacoraForm` | `TrafficPill`, `SettingsStartsSection` | Keep both if complementary |
| Config | `leadConfigs.ts` | `startsDomain.ts` | Merge or keep both |

## Phase 2: Create Integration Branch

```bash
# Start from the more complete or more recent branch
git checkout <base-branch>
git checkout -b <branch>-integrated

# Merge the other branch (expect conflicts)
git merge <other-branch> --no-commit --no-ff
```

If conflicts arise, **do not abort immediately** — inspect them first:

```bash
grep -rn "<<<<<<<" src/ | head -20
```

## Phase 3: Resolve Conflicts

### 3.1 Shared Imports (lucide-react, etc.)

When both branches added different icons to the same import block:

```tsx
// Before (conflict):
import {
  ShoppingCart,
  Bell,
<<<<<<< HEAD
  Eye
=======
  Wallet,
  Settings,
  Eye,
  UserPlus,
>>>>>>> other-branch
} from 'lucide-react';

// After (resolution: union of all needed icons):
import {
  ShoppingCart,
  Bell,
  LogOut,
  Menu,
  X,
  Wallet,
  Settings,
  Eye,
  UserPlus,
} from 'lucide-react';
```

**Rule**: Take the union of all imports from both sides. Remove duplicates. If an icon ends up unused after merge, the TypeScript compiler will flag it — fix then.

### 3.2 Shared Type Definitions (`types/index.ts`)

When both branches added different types to the same file:

```tsx
// Before (conflict):
<<<<<<< HEAD
export interface Prospect { ... }
=======
export interface Lead { ... }
>>>>>>> other-branch

// After (resolution: keep both if they serve different purposes,
// or merge into one unified type):
export interface Prospect { ... }  // from branch A
export interface Lead { ... }      // from branch B (keep if used)
```

**Rule**: Keep both types if the code references both. If one is a superset of the other, keep the superset and remove the subset.

### 3.3 Navigation Items (`navItems.ts`)

When both branches added nav items:

```tsx
// Before (conflict):
<<<<<<< HEAD
  { icon: Users, label: 'Clientes', href: '/customers', roles: ['admin', 'seller'] },
=======
  { icon: Users, label: 'Clientes', href: '/customers', roles: ['admin', 'seller'] },
  { icon: UserPlus, label: 'Inicios', href: '/leads', roles: ['admin', 'seller'] },
>>>>>>> other-branch
  { icon: Calendar, label: 'Calendario', href: '/calendar', ... },
```

**Rule**: Keep all unique nav items. If both added the same item with different icons/labels, pick the one that matches the unified route name.

### 3.4 Route Definitions (`App.tsx`)

When both branches added routes:

```tsx
// Before (conflict):
<<<<<<< HEAD
            <Route path="/starts" element={...} />
=======
            <Route path="/leads" element={...} />
>>>>>>> other-branch
```

**Rule**: Pick ONE canonical route. If the page component was renamed, update the import and the route consistently. Delete the duplicate route.

### 3.5 When Rebase Fails

If `git pull --rebase` produces unresolvable conflicts:

```bash
# Abort the rebase
git rebase --abort

# Reset to remote state if needed
git reset --hard origin/<branch>

# Create a fresh integration branch
git checkout -b <branch>-integrated
git merge <other-branch> --no-commit --no-ff

# Resolve conflicts manually
```

## Phase 4: Post-Merge Verification

### 4.1 Build Check

```bash
pnpm run build 2>&1 | tail -20
```

Common errors after merge:
- `Cannot find module` → import path wrong
- `Duplicate identifier` → both branches exported same name
- `Property missing in type` → type not fully merged

### 4.2 Test Check

```bash
pnpm run test 2>&1 | grep -E "Test Files|Tests "
```

### 4.3 Lint Check

```bash
pnpm run lint 2>&1 | grep -E "^✖"
```

### 4.4 Run Graphify (if project uses it)

```bash
graphify update .
```

## Phase 5: Commit and Push

```bash
git add -A
git commit -m "merge: integrate <branch-A> and <branch-B>

- <what you kept from branch A>
- <what you kept from branch B>
- <conflicts resolved>"
git push -u origin <integrated-branch>
```

## Pitfalls

1. **Don't assume the branch with the feature name has the code.** In this session, `feat/inicios` had only docs/graphify files; the actual implementation was in `feat/leads-prospects-module`. Always verify with `git diff main <branch> --name-only`.

2. **Don't force-push over an existing branch.** Create a new `-integrated` branch unless the user explicitly asks to overwrite.

3. **Don't skip the comparison step.** Merging without understanding what each branch contains leads to lost functionality.

4. **Watch for duplicate imports.** When both branches add to the same import block, the conflict markers can be subtle.

5. **Route name collisions.** If both branches define routes for the same feature with different paths (`/starts` vs `/leads`), pick one and update all references.

6. **Type definition conflicts.** Both branches may define similar types (`Lead` vs `Prospect`). Keep both if the code uses both, or unify into one canonical type.

7. **Don't trust `git merge --no-edit`.** Always verify the result before committing.

## User Preferences Observed

- User expects documentation (MASTERPROMPT, ROADMAP) to be updated alongside code changes.
- User prefers to review branch content before merging ("valida lo que habia, lo que si sirva").
- User wants the final branch to have a clean build before push.
