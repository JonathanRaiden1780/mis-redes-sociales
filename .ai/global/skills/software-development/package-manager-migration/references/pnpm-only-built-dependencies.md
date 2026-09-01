# pnpm onlyBuiltDependencies Pattern

When migrating to pnpm, some packages require postinstall/build scripts. pnpm blocks these by default for security.

## Common Packages Needing Approval

For React/Vite/Firebase projects:

```yaml
# pnpm-workspace.yaml
onlyBuiltDependencies:
  - '@firebase/util'
  - esbuild
  - protobufjs
```

## How to Identify Which Packages Need It

Run `pnpm install` and look for:

```
[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: @firebase/util@1.15.2, esbuild@0.28.2, protobufjs@7.6.5
```

## Two Approaches

### Approach 1: Whitelist in pnpm-workspace.yaml (Recommended)

Create `pnpm-workspace.yaml` at project root:

```yaml
onlyBuiltDependencies:
  - '@firebase/util'
  - esbuild
  - protobufjs
```

This is committed to git and reproducible across team/CI.

### Approach 2: Interactive Approval

```bash
pnpm approve-builds
```

Interactive — not suitable for CI. Use only for one-off dev setup.

## Fix: "No binary for ChromeHeadless browser" / Build fails silently

If `pnpm install` succeeds but build fails, check if build scripts ran:

```bash
# Force rebuild
pnpm rebuild
```
