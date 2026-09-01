# AIEP Credentials Bundle & Installer Patterns

## Session Reference — Credential Distribution & Auto-Configuration

### Credentials Bundle Workflow

The installer supports an encrypted credentials bundle (`bundle.aiep`) that auto-configures API keys, git credentials, and Hermes auth during installation.

**Generation** (`scripts/generate_credentials_bundle.py`):
```bash
# Interactive mode (terminal required — getpass needs a TTY)
python scripts/generate_credentials_bundle.py --output bundle.aiep

# CLI mode (for CI/automation — avoids getpass prompts)
python scripts/generate_credentials_bundle.py \
  --output bundle.aiep \
  --passphrase "$BUNDLE_PASS" \
  --openai-key "$OPENAI_KEY" \
  --anthropic-key "$ANTHROPIC_KEY" \
  --git-token "$GH_PAT" \
  --git-username "Blackfriday1780" \
  --git-email "mejahv_hs@hotmail.com" \
  --hermes-config ~/.hermes/config.yaml \
  --include-auth
```

**Bundle contents**:
- `credentials.yaml` — Provider API keys + git credentials
- `config.yaml` — Hermes configuration (model, providers, agents, toolsets)
- `auth.json` — Hermes OAuth tokens (via `--include-auth`)

**Encryption**: Fernet + PBKDF2-HMAC-SHA256 (600k iterations, OWASP 2023)

### getpass EOFError Pattern

When stdin is piped (not a TTY), `getpass.getpass()` raises `EOFError`. The generator script must handle this:

```python
try:
    passphrase = getpass.getpass("  Choose bundle passphrase: ")
except EOFError:
    print()
    print("Passphrase required. Exiting.")
    sys.exit(1)
```

This is why CLI mode (`--passphrase` flag) exists — for non-interactive use.

### Installer Credential Extraction

`install.sh` `copy_hermes_config()` extracts the bundle and:

1. **API Keys**: Parses `credentials.yaml` providers → calls `ai provider use <name> --key <key> --passphrase <pass>`
2. **Git token**: Sets `git config --global credential.helper store`
3. **Git username/email**: Sets `git config --global user.name` / `user.email`
4. **Hermes auth.json**: Copies to `~/.hermes/auth.json` with `chmod 600`

### Git Credential Fail-Fast Pattern

Prevent git from hanging on interactive credential prompts in any CLI automation:

```python
# In global_sync.py _get_repo()
repo = Repo(self.root)
repo.git.update_environment(GIT_TERMINAL_PROMPT="0")
return repo
```

Or in bash:
```bash
export GIT_TERMINAL_PROMPT=0
```

### Git Remote `insteadOf` Trap

A global git config like:
```ini
[url "git@github.com:"]
    insteadOf = https://github.com/
```

**forces SSH even on HTTPS remotes**, causing `git push https://...` to fail with `Permission denied (publickey)`. To push via HTTPS with a PAT:

```bash
# Remove the insteadOf that forces SSH
git config --global --unset url.git@github.com:.insteadOf

# Then push (will prompt for credentials)
git push origin master
# Username: JonathanRaiden1780
# Password: <PAT>
```

Or use one-shot:
```bash
git push https://<PAT>@github.com/JonathanRaiden1780/AI-Engineering-Platform.git master
```

### Non-Fatal Sync Pattern

CLI commands that do remote sync should wrap it in try/except so local operations succeed even when remote is unreachable:

```python
# In commands/init.py
sync_warning = None
try:
    sync.sync(message=f"Initialize project: {name}")
except Exception as e:  # noqa: BLE001
    sync_warning = (
        f"Local init complete, but sync to remote failed: {e}. "
        f"Run 'ai sync' later to push."
    )
```

Then surface the warning in the CLI command without failing the whole operation.

### Vault-Aware Documentation Generation

The document generator (`docgen.py`) must read from `GlobalVault` to produce contextualized docs, not empty templates:

```python
from aiep.vault import GlobalVault

class DocumentationGenerator:
    def __init__(self, analysis, project_root=None):
        self.vault = GlobalVault(project_root)
    
    def _generate_architecture(self, docs_dir):
        rules = self.vault.get_rules()
        patterns = self.vault.get_patterns()
        skills = self.vault.get_skills()
        # Inject into generated markdown
```

**Without vault context**, generated docs are empty templates. **With vault context**, they reflect the team's actual rules, patterns, and skills.

### Test Maintenance After Command Refactoring

When a CLI command is redesigned (e.g., `commands/sync_global.py` rewritten in SPEC-053), integration tests must be updated to mock the **new** symbols. The old test mocked `aiep.project.sync_global.GlobalMemoryStore` but the new command uses `ContextProvider`, `GlobalVault`, and `GlobalSyncService`. Tests must mock what the command actually imports:

```python
monkeypatch.setattr("aiep.commands.sync_global.ContextProvider", FakeProvider)
monkeypatch.setattr("aiep.commands.sync_global.GlobalVault", FakeVault)
monkeypatch.setattr("aiep.commands.sync_global.GlobalSyncService", FakeSync)
```

### Memory Loader Dual-Format Pattern

`ai project init` writes `.ai/memory.yaml`, but `ai memory` / `ProjectMemoryLoader` historically only read `.ai/memory.md`. The loader must handle both:

```python
# In context/memory.py ProjectMemoryLoader.load()
# Prefer .md, fall back to .yaml (render YAML as readable markdown)
memory_path = root / ".ai" / "memory.md"
if memory_path.exists():
    content = memory_path.read_text().strip()
    if content:
        return ProjectMemory(path=memory_path, content=content)

# Fall back to .ai/memory.yaml (generated by ai project init)
yaml_path = root / ".ai" / "memory.yaml"
if yaml_path.exists():
    data = yaml.safe_load(yaml_path.read_text()) or {}
    # Render as markdown with project info, analysis, etc.
    ...
```

### Skill Registry Path Mismatch

Skills must be written to the **global registry path** (`~/.local/share/aiep/skills/` from `config.yaml → skills.registry_path`), NOT to `.ai/global/skills/` (project-local). The `SkillInstaller` must read `registry_path` from config and write there:

```python
registry_dir = self.root / ".local" / "share" / "aiep" / "skills"
try:
    from aiep.core.paths import PlatformPaths
    paths = PlatformPaths()
    config_path = paths.config / "config.yaml"
    if config_path.exists():
        import yaml
        config = yaml.safe_load(config_path.read_text()) or {}
        skills_config = config.get("skills", {})
        registry_path_str = skills_config.get("registry_path")
        if registry_path_str:
            registry_dir = Path(registry_path_str)
except Exception:
    pass
```

The `SkillRegistry.list_skills()` must also handle **flat `.yaml` files** in the directory, not just subdirectories containing `skill.yaml`. This supports the new installer pattern where skills are written as `~/.local/share/aiep/skills/architecture.yaml` etc.

### User Preference Signals

- **No Co-authored-by** in commit messages — user wants clean attribution
- **Distribution model**: Credentials travel in encrypted bundle, not entered manually
- **Git auth**: SSH-first, token fallback, never interactive password prompts
- **Hermes config**: Auth tokens (OAuth) must be preserved across installs
- **Install experience**: Zero manual configuration when bundle is present
- **Push method**: HTTPS with PAT (not SSH keys unless explicitly configured)
