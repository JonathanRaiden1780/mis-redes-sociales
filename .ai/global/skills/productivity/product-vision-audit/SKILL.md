---
name: product-vision-audit
description: "Audit product against vision. Use for status questions."
version: 1.0.0
author: Jh / AIEP session
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [audit, roadmap, vision, project-management, gap-analysis]
    related_skills: [sdd-feature-implementation, systematic-debugging, spike]
---

# Product Vision Audit

Use when the user asks about project status, roadmap progress, what remains, or whether something is "closed." The written roadmap captures what was planned; it does NOT capture what the user actually wants the product to become. This skill audits all three layers: **vision**, **roadmap**, and **real code**.

## Trigger

- "What's pending?" / "Queda algo?" / "Are we done?"
- "Is X closed?" / "Ya está cerrado?"
- "Show me the roadmap status" / "Dime el estado del proyecto"
- Any question about progress, completion, or next steps

## Method

### 1. Read the written artifacts FIRST

Before speaking, pull:
- `ROADMAP.md` (or equivalent status file)
- Recent git log (`git log --oneline -10`)
- `git status` (uncommitted work)
- Latest specs / tasks / changelogs

Do NOT summarize these yet. Just absorb them.

### 2. Ask for the user's VISION (not the roadmap)

The roadmap is a plan. The vision is what the user actually wants. These frequently diverge.

Ask one direct question that forces the user to state the vision in their own words:
- "Antes de revisar, ¿cuál es la visión completa del producto para ti?"
- "Quiero asegurarme de que el roadmap captura lo que realmente quieres. ¿Me describes el objetivo final?"

This is the single most important step. The roadmap will lie to you; the user will not.

### 3. Audit code against vision, not just roadmap

For each claim in the roadmap or vision statement:
- Find the actual implementation (grep the source, read the code, run the command)
- Do not trust "completed" checkboxes without verifying
- Look for: features listed but not wired, commands that print success but don't persist, installers that skip critical steps, sync that is manual when vision requires automatic

Use terminal + search_files + read_file. Read the actual function bodies, not just the names.

### 4. Produce a three-layer report

```
## Visión vs Estado Real

### ✅ Vision items with real implementation
- [item]: [file/line evidence]

### ⚠️ Roadmap claims that don't match real behavior
- [roadmap claim] → [what code actually does]

### ❌ Vision items with NO implementation
- [vision requirement] → gap: [what's missing]
```

Be specific. Name files and line numbers. Say "prints '✓ configured' but never writes to providers.yaml" not "credentials might not work."

### 5. Do not stop at roadmap status

If the user asked "what's pending?" and the roadmap says "nothing," but the vision requires capabilities that exist nowhere — report those as pending. The roadmap is a lagging indicator; the vision is the source of truth.

## Pitfalls

- **Roadmap capture bias:** If you only read the roadmap, you will miss everything the user forgot to write down but actually wants. Always ask for vision first.
- **Name-based assumption:** A file called `global_sync.py` with a function called `sync_global` does not mean global synchronization works end-to-end. Read the body.
- **Echoing the user:** If the user says "everything is done," do not agree without auditing. They may be tired, or they may not have looked under the hood recently.
- **Scope collapse:** When the user describes a broad vision ("it should auto-sync across all machines"), do not narrow it to what's implemented ("it has a sync command"). Report the gap between automatic and manual.

## Verification

After reporting gaps, verify at least one claim by running the actual command or reading the actual function body. If you cannot verify a gap, say "needs verification" rather than asserting it.
