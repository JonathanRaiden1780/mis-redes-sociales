# Pattern: global onboarding + cross-tool continuity for an AI platform

Use when a project is a **global platform** (installed once, reused across machines/IDEs/agents) and you need the onboarding + continuity layer to guarantee that any new tool (Hermes, Claude Code, OpenHands, Cursor, etc.) or new machine inherits the team's knowledge, rules, and behavior without manual re-setup.

## Why this pattern exists

A global platform dies if re-setup is per-tool or per-machine. The durable shape is:

- **One bootstrap** that provisions everything a fresh environment needs.
- **One source of truth for rules/prompts** (not per-tool copies that drift).
- **One portable memory layer** that survives IDE/agent/machine swaps.
- **Containers for external interoperability** (MCP connectors, skills, etc.) as add-ons, not core.

## Core pieces

### 1. Bootstrap (install-time)

Bootstrap must create, in order:

1. Platform config (global rules, provider defaults, paths).
2. Global memory store + initial state.
3. Skills/registry layer (directories + default list).
4. MCP connector config (if any) — just configuration, not runtime.
5. Security baseline (policy files, rules, allowlists if applicable).
6. Seed content for skills or prompts so the platform is useful immediately.

Bootstrap should be **idempotent**: re-running it on an existing install must not blow away user content or duplicate seeds.

### 2. Global rules & prompts (single source)

Keep one canonical location for rules/prompts that apply across tools, then derive tool-specific artifacts from it if needed. Do not maintain parallel rule sets in `.claudecode/`, `.cursorrules`, etc. unless the platform explicitly generates them from the canonical source.

Preferred shape:

- Canonical rules/prompts in platform config or platform-owned storage.
- Tool-specific files are downstream artifacts, regenerated or synced, not edited independently.

### 3. Portable memory

Memory must be exportable/importable and must carry:

- Decisions and ADRs.
- Project-local context where relevant.
- Runtime state snapshots where relevant.
- Enough structure to be legible by both humans and agents.

Do not store memory in tool-private formats that another agent cannot read.

### 4. Cross-tool continuity

Continuity is not "every tool gets the same file tree". It is:

- Same **rules** available.
- Same **memory** reachable.
- Same **skills/behaviors** loadable.
- Same **security posture** enforced.

If a tool cannot consume the canonical form, the platform should convert at the boundary, not fracture the source.

## File layout

```
~/.config/<platform>/config.yaml        # canonical config
~/.local/share/<platform>/memory/       # global memory store
~/.local/share/<platform>/skills/       # skills registry
~/.local/share/<platform>/mcp/          # MCP configs (if any)
project/.ai/                             # project-local continuity layer
```

## Decisions encoded in this pattern

- **Bootstrap is the onboarding gate.** If bootstrap is incomplete or non-idempotent, portability claims are fake.
- **Rules are canonical, tool files are derived.** Avoid drift.
- **Memory is portable first.** If export/import is awkward, the memory layer is not global.
- **MCP and skills are extensions, not core.** They should be configurable, not baked into bootstrap as required runtime.
- **Security is provisioned at bootstrap, not bolted on later.** If policy/allowlists are missing, the platform should fail closed or at least warn loudly.

## Pitfalls

- **Per-tool rule duplication.** If Claude Code, Cursor, and Hermes each keep their own divergent rules, the platform has already lost.
- **Bootstrap that is not re-entrant.** Running install a second time should not break an existing install.
- **Memory locked into one IDE or agent.** If only Hermes can read it, it is not global memory.
- **MCP treated as required core.** Keep it optional/configurable unless the platform's value truly depends on it.
- **Silent partial installs.** If bootstrap can't provision something important (e.g. skills, memory, security policy), it should report it, not continue as if everything is fine.

## Verification

- Fresh-machine bootstrap produces a usable platform without manual edits.
- Re-running bootstrap on an existing install is safe.
- Global memory can be exported and imported across machines.
- Skills registry is empty-safe and seed-safe.
- Security allowlists/policies exist or the platform fails closed or warns explicitly.
- Any supported tool can reach rules + memory + skills through platform mechanisms, not ad-hoc copies.

## When to reach for this pattern

- The project is a global developer/AI platform, not a one-off repo tool.
- You promise "install once, reuse everywhere".
- New machines or tools should inherit team knowledge automatically.
- You need MCP/skills/rules/memory to stay coherent across tool boundaries.
