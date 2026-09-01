# npm → pnpm Migration: Real Project Lessons

**Project:** MiNegocio (React + Vite + Firebase + Capacitor)
**Date:** 2026-08-19
**pnpm version:** 11.22.0

## The Migration

```bash
# 1. Clean slate
rm -rf node_modules package-lock.json

# 2. Install with pnpm
pnpm install

# 3. Approve build scripts for packages that need them
# (see below — this was the main friction point)

# 4. Remove old lockfile from tracking
git rm package-lock.json

# 5. Add package-lock.json to .gitignore
echo "package-lock.json" >> .gitignore

# 6. Commit pnpm-lock.yaml + pnpm-workspace.yaml
git add pnpm-lock.yaml pnpm-workspace.yaml package.json .gitignore
```

## Key Friction: `onlyBuiltDependencies` Configuration

### What happened

`pnpm install` failed with:
```
[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: @firebase/util@1.15.2, esbuild@0.28.2, protobufjs@7.6.5
Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.
```

### Failed attempts

1. **`.npmrc` with `only-built-packages[]=` syntax** — doesn't work in pnpm v11
2. **`package.json#pnpm.onlyBuiltDependencies`** — pnpm v11 logs: `"pnpm" field in package.json is no longer read`
3. **`pnpm config set onlyBuiltDependencies '...'`** — fails: `"onlyBuiltDependencies" isn't supported by the global config.yaml file`
4. **`pnpm approve-builds` with piped `echo "y\ny\ny"`** — interactive, doesn't accept piped input properly; ends with `All packages were added to allowBuilds with value false` (opposite of what we want)

### What worked

Create **`pnpm-workspace.yaml`** at project root:

```yaml
onlyBuiltDependencies:
  - '@firebase/util'
  - esbuild
  - protobufjs
```

Then `pnpm install` succeeds without the build warning.

### Why this matters

pnpm v11 made `onlyBuiltDependencies` a workspace-only setting. This is a **breaking change** from earlier pnpm versions that accepted it in `.npmrc` or `package.json`. The migration path is now `pnpm-workspace.yaml` only.

## package.json Updates

```json
{
  "packageManager": "pnpm",
  "engines": {
    "node": ">=20.19.0 <23"
  }
}
```

Note: `packageManager` field is informational — it doesn't enforce which manager is used. But it signals intent and some tools (like CI) read it.

## Verification

```bash
pnpm run build    # should pass
pnpm run test     # should pass same tests as npm
pnpm run lint     # should pass
```

## Pitfalls

- **Don't try `pnpm approve-builds --all`** — this flag doesn't exist in v11. The correct approach is `pnpm-workspace.yaml` with `onlyBuiltDependencies`.
- **Don't add `pnpm approve-builds` to CI** — it's interactive. Pre-configure `onlyBuiltDependencies` instead.
- **Don't keep `package-lock.json`** in the repo after migration — it conflicts with `pnpm-lock.yaml`.
- **Don't use the old `.npmrc` syntax** (`only-built-packages[]=`) — it's silently ignored in pnpm v11.
- **Don't panic about the firebase/protobufjs/esbuild warning** — these are common in Firebase projects and are safe to approve.

## Checklist

- [ ] `rm -rf node_modules package-lock.json`
- [ ] `pnpm install`
- [ ] Create `pnpm-workspace.yaml` with `onlyBuiltDependencies` for build-script packages
- [ ] `git rm package-lock.json`
- [ ] Add `package-lock.json` to `.gitignore`
- [ ] `git add pnpm-lock.yaml pnpm-workspace.yaml package.json .gitignore`
- [ ] Verify `pnpm run build`, `pnpm run test`, `pnpm run lint` all pass
