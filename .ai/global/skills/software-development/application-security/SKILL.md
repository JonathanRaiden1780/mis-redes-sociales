---
name: application-security
description: "CLI application security: encryption, 2FA, secure storage."
version: 1.1.0
author: Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [security, encryption, 2fa, python, cli, secure-storage, cryptography]
    related_skills: [requesting-code-review]
---

# Application Security for Python CLI Tools

Security patterns for CLI applications that handle credentials, tokens, and sensitive data. Covers encryption at rest, two-factor authentication, secure storage, memory safety, and supply chain verification.

## When to Use

- Storing API keys, tokens, or credentials on disk
- Building sync features that transmit data between machines
- Accepting user input that configures external connections (git remotes, URLs)
- Installing dependencies via scripts
- Any CLI tool that handles secrets or sensitive configuration

## Core Patterns

### 1. Encryption at Rest (Fernet + PBKDF2)

Use for: providers.yaml, config files, any file containing secrets.

```python
from cryptography.fernet import Fernet
import hashlib, base64, secrets

PBKDF2_ITERATIONS = 600_000  # OWASP 2023 recommendation

def derive_key(passphrase: str, salt: bytes) -> bytes:
    key = hashlib.pbkdf2_hmac("sha256", passphrase.encode(), salt, PBKDF2_ITERATIONS, dklen=32)
    return base64.urlsafe_b64encode(key)

def encrypt(plaintext: str, passphrase: str) -> bytes:
    salt = secrets.token_bytes(32)
    key = derive_key(passphrase, salt)
    return Fernet(key).encrypt(plaintext.encode())

def decrypt(ciphertext: bytes, passphrase: str, salt: bytes) -> str:
    key = derive_key(passphrase, salt)
    return Fernet(key).decrypt(ciphertext).decode()
```

**Pitfall:** Always use a random salt per encryption. Never hardcode the salt.

### 2. TOTP-Based 2FA

Use for: sensitive operations (disabling security, changing credentials, destructive actions).

```python
import hmac, struct, time, base64, secrets

def generate_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode()

def verify_totp(secret: str, code: str, tolerance: int = 1) -> bool:
    secret_bytes = base64.b32decode(secret.upper())
    t = int(time.time())
    for delta in range(-tolerance, tolerance + 1):
        counter = (t + delta * 30) // 30
        msg = struct.pack(">Q", counter)
        digest = hmac.new(secret_bytes, msg, hashlib.sha1).digest()
        offset = digest[-1] & 0x0F
        expected = struct.unpack(">I", digest[offset:offset+4])[0] & 0x7FFFFFFF
        if f"{expected % 10**6:06d}" == code:
            return True
    return False
```

**Pitfall:** Use `hmac.compare_digest` for constant-time comparison to prevent timing attacks.

### 3. Secure File Storage with Locking

Use for: any file that may be accessed concurrently (cron + CLI).

```python
import fcntl
from pathlib import Path

class SecureStorage:
    def save(self, data: dict, path: Path) -> None:
        with open(path, "w") as f:
            fcntl.flock(f, fcntl.LOCK_EX)
            yaml.safe_dump(data, f)
        path.chmod(0o600)
    
    def load(self, path: Path) -> dict:
        with open(path, "r") as f:
            fcntl.flock(f, fcntl.LOCK_SH)
            return yaml.safe_load(f)
```

**Pitfall:** Always set chmod 0o600 on files containing secrets. The default umask may leave them world-readable.

### 4. Memory Cleanup for Secrets

Use for: API keys, passwords, tokens that should not linger in memory.

```python
# Bad: key remains in memory after use
store.set_api_key(name, key)

# Good: overwrite key after use
store.set_api_key(name, key)
key = "x" * len(key)  # Overwrite before GC
```

**Pitfall:** `del key` or `key = None` just drops the reference; the string object may still exist in memory until GC. Overwriting is more reliable.

### 5. Git Remote Helper Injection Prevention

Use for: any script that configures git remotes from user input.

```bash
# Validate URL before passing to git
if echo "${url}" | grep -qE '^(ext::|--upload-pack=|ssh://.*\\\\|)'; then
    echo "ERROR: git remote helpers are not allowed" >&2
    exit 1
fi

if ! echo "${url}" | grep -qE '^(https://|git@|git://)'; then
    echo "ERROR: Invalid URL format" >&2
    exit 1
fi
```

**Pitfall:** Git remote helpers (`ext::sh -c "..."`) allow arbitrary code execution. Always validate URLs against a whitelist of schemes.

### 6. Supply Chain Verification (curl | bash)

Use for: any script that downloads and executes code.

```bash
# Bad: curl | bash
curl -LsSf https://example.com/installer.sh | sh

# Good: download, verify checksum, then execute
curl -LsSf "https://example.com/installer.sh" -o /tmp/installer.sh
expected="abc123..."
actual=$(sha256sum /tmp/installer.sh | awk '{print $1}')
if [ "${expected}" != "${actual}" ]; then
    echo "Checksum mismatch — installer may be compromised" >&2
    exit 1
fi
sh /tmp/installer.sh
rm -f /tmp/installer.sh
```

**Pitfall:** Even with HTTPS, a compromised server can serve malicious code. Always verify checksums.

### 7. Secure Configuration Store (Hermes Config)

Use for: copying and encrypting Hermes agent config during install.

```python
class SecureConfigStore:
    """Stores configuration files encrypted with passphrase."""
    
    def lock(self, passphrase: str) -> None:
        """Encrypt all configuration files."""
        for file_path in self._dir.iterdir():
            if file_path.is_file() and not file_path.name.startswith("."):
                self._encrypt_file(file_path)

    def unlock(self, passphrase: str) -> None:
        """Decrypt all configuration files."""
        for file_path in self._dir.iterdir():
            if file_path.is_file() and file_path.suffix == ".encrypted":
                self._decrypt_file(file_path)
```

### 8. Installer Preflight Checks

Use for: installers that must not break on missing tools.

```bash
# Verify prerequisites before installing
preflight_checks() {
    # System tools (git, curl, sha256sum)
    # Python 3.12+ (try python3.12 if python3 is too old)
    # venv module
    # uv (optional)
    # Docker, Ollama, VSCode, Trae (optional)
    # Hermes (required)
}

# Auto-install missing tools
install_system_tools() {
    # Try apt-get, brew, dnf, pacman, apk in order
}

# Handle Python version mismatch
check_python() {
    if python3 is too old:
        if python3.12 exists:
            symlink python3 → python3.12 in BIN_DIR
        else:
            install_python
}
```

**Pitfall:** If `shellcheck` is unavailable in the environment, fall back to `bash -n` for syntax validation only — do not skip linting entirely. Shellcheck may not be in PATH on minimal/container environments even when bash is. The lesson is to check availability and degrade gracefully (`command -v shellcheck && shellcheck ... || bash -n ...`).

### 9. Installer Idempotency and Reconfiguration

Use for: installers that will be re-run; the second run should detect existing state and offer reconfiguration, not silently reinstall everything.

**Core pattern:** detect installation by checking for the venv binary symlink AND config files; if present, print a status summary and exit early with instructions.

```bash
is_aiep_installed() {
    [ -x "${VENV_DIR}/bin/ai" ] && [ -x "${BIN_DIR}/ai" ]
}

# In main(), run BEFORE the full install flow:
if is_aiep_installed && [ -f "${CONFIG_DIR}/providers.yaml" ]; then
    show_install_summary   # print status of venv, providers, hermes, ollama, keys
    echo "AI Engineering Platform is already installed!"
    echo "  Re-run with --reconfigure       to change API keys/providers"
    echo "  Re-run with --install-optional  to install Trae and other tools"
    exit 0
fi

# --reconfigure mode: only re-run credential/provider setup
if [ "${RECONFIGURE}" = true ] && is_aiep_installed; then
    show_install_summary
    prompt_credentials
    exit 0
fi

# --install-optional: install optional tools like Trae
if [ "${INSTALL_OPTIONAL}" = true ] && command -v trae &>/dev/null; then
    # skip; already installed
elif [ "${INSTALL_OPTIONAL}" = true ]; then
    install_trae   # uses checksum verification for supply-chain safety
fi
```

**Pitfall:** When piping input to a subcommand that lacks a `--yes`/`--non-interactive` flag (e.g., `ai setup` uses `typer.confirm(...)` which has no auto-yes), use `echo "y" | subcommand` to bypass the confirm prompt. Verify the subcommand doesn't have a hidden flag first by checking `--help`.

**Pitfall:** If `providers.yaml` exists but no API keys are set, the reconfigure path should still prompt — don't skip credential setup just because providers.yaml exists. Check for actual key presence (environment variables or encrypted store) not just file existence.

### 10. Git Credential Safety in Installers

Use for: any installer that needs to clone from GitHub or configure git remotes.

### 9. Hermes Installation with SSH Fallback

Use for: installing Hermes from GitHub without hanging on credential prompts.

**Pitfall:** `git clone https://github.com/nousresearch/hermes-agent.git` prompts for username/password when SSH keys aren't configured, hanging the installer indefinitely. GitHub no longer accepts passwords (since 2021).

**Fix:** Check if `hermes` is already installed first (command or directory). If cloning is needed, try SSH with `BatchMode=yes` (non-interactive) first, then HTTPS with proper error handling.

```bash
# In preflight_checks — detect Hermes by command, not just directory
if command -v hermes &>/dev/null; then
    log_success "Hermes found: $(command -v hermes)"
elif [ -d "${HERMES_DIR}" ]; then
    log_success "Hermes directory found at ${HERMES_DIR}"
else
    log_warning "Hermes not found. Will install."
    install_hermes
fi

# In install_hermes — SSH first, HTTPS fallback
install_hermes() {
    local hermes_src="/tmp/hermes-agent"
    rm -rf "${hermes_src}"

    local clone_ok=false
    # BatchMode=yes prevents hanging on credential prompt
    if ssh -o BatchMode=yes -o ConnectTimeout=5 git@github.com 2>/dev/null; then
        git clone --depth 1 git@github.com:nousresearch/hermes-agent.git "${hermes_src}" 2>/dev/null && clone_ok=true
    fi

    if ! ${clone_ok}; then
        # GIT_TERMINAL_PROMPT=0: no interactivo, falla en vez de pedir credenciales
        GIT_TERMINAL_PROMPT=0 git clone --depth 1 https://github.com/nousresearch/hermes-agent.git "${hermes_src}" 2>/dev/null || {
            log_warning "Could not clone hermes-agent from GitHub"
            log_warning "Install Hermes manually: curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash"
            log_warning "Then re-run this installer."
            return 1
        }
    fi

    cd "${hermes_src}"
    if [ -f "setup.sh" ]; then
        bash setup.sh 2>/dev/null || {
            log_warning "Hermes setup failed — install manually"
            return 1
        }
    fi

    cd - > /dev/null
    rm -rf "${hermes_src}"
    log_success "Hermes installed"
}
```

### 10. Uninstaller Pattern

Use for: providing clean uninstall/rollback capability.

```bash
#!/usr/bin/env bash
# Two-mode uninstall: soft (preserve data) and purge (remove all)

set -euo pipefail
set -E
trap 'echo ""; log_error "Uninstaller interrupted at line $LINENO"; exit 1' ERR

PURGE=false
for arg in "$@"; do
    case "$arg" in
        --purge) PURGE=true ;;
    esac
done

# Always remove: symlink, venv, cron entries, shell rc modifications
# Remove on purge only: config dir, data dir

remove_symlink() {
    local link="${BIN_DIR}/ai"
    if [ -L "$link" ] && [[ "$(readlink "$link")" == *"aiep"* ]]; then
        rm -f "$link"
    fi
}

clean_shell_rc() {
    # Remove the block added by installer
    sed -i '/^# AI Engineering Platform$/,/^export PATH=.*aiep.*$/d' "$shell_rc"
}
```

**Pitfall:** Always confirm with user before destructive operations. Provide `--purge` flag for full removal vs soft uninstall that preserves config.

### 11. Error Trap for Transparent Failures

Use for: installers/uninstallers where silent exits confuse users.

```bash
set -euo pipefail   # exit on error
set -E                # inherit ERR trap in functions
trap 'echo ""; log_error "Installer interrupted at line $LINENO"; exit 1' ERR
```

**Pitfall:** Without `set -E`, the ERR trap is not inherited into functions, and `set -e` may silently skip failures in nested calls.

## Security Scanning Checklist

When reviewing code for security, scan for:

- [ ] Hardcoded secrets (API keys, tokens, passwords)
- [ ] Shell injection (`subprocess.shell=True`, `os.system()`)
- [ ] Git remote helper injection (`ext::`, `--upload-pack=`)
- [ ] `curl | bash` without checksum verification
- [ ] Silent exception swallowing (`except: pass`)
- [ ] Missing file locking on concurrent read-modify-write
- [ ] Sensitive files without chmod 0o600
- [ ] Secrets not cleared from memory after use
- [ ] `yaml.load()` instead of `yaml.safe_load()`
- [ ] User input passed to shell without sanitization

## References

- `references/security-patterns-python-cli.md` — Detailed patterns with code examples
- `references/encrypted-blob-2fa-impl.md` — Production-tested implementations: EncryptedBlob with JSON serialization, SecureStorage with legacy support, TOTP with clock skew tolerance, supply chain verification, memory cleanup
- `references/bundle-generation.md` — Generating the `bundle.aiep` that ships with the installer (pitfall: never point `generate_bundle.py` at `~/.hermes` — it hangs on `hermes-agent/` with 112K+ files; use a clean dir from `~/.config/aiep/hermes/`)
- `references/preexisting-test-detection.md` — Using `git stash` to verify whether a test failure is pre-existing (not caused by your changes) before attributing blame or declaring pass
- `references/uninstall-testing.md` — How to test install/uninstall cycles (full cycle test, purge mode test, common issues)
- `scripts/verify_bundle.py` — Verify a bundle decrypts correctly and list its contents. Usage: `python3 scripts/verify_bundle.py <bundle_path> <passphrase>`
