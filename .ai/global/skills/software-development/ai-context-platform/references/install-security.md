# Install.sh Security & Prerequisite Patterns

## Prerequisite Verification (Must Auto-Install)

The installer MUST verify and auto-install:
1. **Python 3.12+** — check `python3` first, then `python3.12` specifically
2. **venv module** — required for creating virtual environments
3. **System tools** — git, curl, sha256sum
4. **uv** (optional) — fast Python package manager

### Handling Python Version Mismatch

When `python3` is too old but `python3.12` exists:
```bash
# Create symlink in user's bin directory
mkdir -p "${BIN_DIR}"
ln -sf "$(which python3.12)" "${BIN_DIR}/python3"
export PATH="${BIN_DIR}:${PATH}"
```

### Package Manager Support

Support multiple package managers in order:
1. `apt-get` (Debian/Ubuntu)
2. `brew` (macOS)
3. `dnf` (Fedora/RHEL)
4. `pacman` (Arch)
5. `apk` (Alpine)
6. `yum` (older RHEL/CentOS)

### Checksum Verification

For downloaded installers (e.g., uv):
```bash
echo "${actual_checksum}" != "${uv_checksum}" && {
    log_error "Checksum mismatch! Installer may be compromised."
    exit 1
}
```

## Credential Protection

### Encryption at Rest
- **Fernet (AES-128-CBC)** for data encryption
- **PBKDF2-HMAC-SHA256** with 600,000 iterations (OWASP 2023)
- Random 32-byte salt per file
- `chmod 0o600` on credential files

### Memory Cleanup
After using sensitive data in Python:
```python
# Overwrite the variable
key = "x" * len(key)
```

### 2FA/TOTP (RFC 6238)
- Time-based codes with ±30 second clock skew tolerance
- Compatible with Google Authenticator, Authy, 1Password, Bitwarden
- `otpauth://` URI for QR code setup

## Input Validation

### Git URL Validation
Prevent git remote helper injection:
```bash
# Reject dangerous URL patterns
if echo "${url}" | grep -qE '^(ext::|--upload-pack=|ssh://.*\\|)'; then
    log_error "Invalid URL: git remote helpers are not allowed"
    return 1
fi

# Accept only safe formats
if ! echo "${url}" | grep -qE '^(https://|git@|git://)'; then
    log_error "Invalid URL format"
    return 1
fi
```

### File Operations
- Use `yaml.safe_load()` to prevent arbitrary code execution
- Use `fcntl.flock(LOCK_EX)` for race condition prevention
- Always validate paths before file operations

## Auto-Sync Pattern

Use Typer's `call_on_close()` for reliable post-command sync:
```python
@app.callback(invoke_without_command=True)
def main_callback(ctx: typer.Context) -> None:
    if ctx.invoked_subcommand:
        _auto_sync_before_command()
        ctx.call_on_close(_auto_sync_after_command)  # Always runs, even on error
```

This ensures sync happens even if the command fails.
