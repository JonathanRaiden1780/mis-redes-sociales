# SPEC-053 Security Patterns

Security vulnerabilities found and fixed during SPEC-053 (Global Auto-Distribution)
audit in session 2026-08-14.

## Git Remote Helper Injection

**Install script that adds user-provided URL as git remote without validation.**

```bash
# BAD
git remote add origin "${sync_repo_url}"

# GOOD
if echo "${sync_repo_url}" | grep -qE '^(ext::|--upload-pack=)'; then
    log_error "Invalid URL: git remote helpers are not allowed"
    return 1
fi
if ! echo "${sync_repo_url}" | grep -qE '^(https://|git@|git://)'; then
    log_error "Invalid URL format"
    return 1
fi
git remote add origin "${sync_repo_url}"
```

## File Permission Leak

**State/credential YAML files created without chmod, leaving them world-readable.**

```python
# BAD
path.write_text(yaml.safe_dump(data))

# GOOD
path.write_text(yaml.safe_dump(data))
path.chmod(0o600)
```

## Race Condition in Shared State

**Read-modify-write on YAML without locking allows corruption from concurrent processes.**

```python
# BAD
data = yaml.safe_load(path.read_text())
data["key"] = value
path.write_text(yaml.safe_dump(data))

# GOOD
with open(path, "w") as f:
    fcntl.flock(f, fcntl.LOCK_EX)
    yaml.safe_dump(data, f)
path.chmod(0o600)
```

## Silent Exception Handlers

**except pass hides network/auth failures, making sync failures invisible.**

```python
# BAD
except Exception:
    pass

# GOOD
except Exception as exc:
    logger.debug("Sync operation failed: %s", exc)
```

## Incorrect Dedup Key

**Dedup by name alone allows different types (MCP vs skill) with same name to collide.**

```python
# BAD
existing = {n.get("name") for n in pending}

# GOOD
existing = {f"{n.get('name')}:{n.get('type')}" for n in pending}
```

## Hardcoded Counter

**changes=0 hardcoded means pending_changes field never updates after pull.**

```python
# BAD
_sync_tracker.record_pull("success", changes=0)

# GOOD
state = _sync_tracker.get_state()
_sync_tracker.record_pull("success", changes=state.pending_changes)
```

## Plaintext Credentials in Config Copy

**Copying Hermes .env/auth.json without encryption leaves credentials plaintext on disk.**

```bash
# BAD
cp -f "${HERMES_DIR}/${f}" "${aiep_hermes_dir}/${f}"

# GOOD (install.sh)
"${VENV_DIR}/bin/python3" -c "
from pathlib import Path
from aiep.security.secure_config import SecureConfigStore
store = SecureConfigStore(Path('${aiep_hermes_dir}'), passphrase='${config_pass}')
store.lock()
"
```

## Memory Cleanup (Not Just Delete)

**del key just drops reference; string object may still exist in memory until GC.**

```python
# BAD: del just drops reference
del key

# GOOD: overwrite the actual bytes
key = "x" * len(key)  # Overwrite before GC
```

## Supply Chain Risk (curl | bash)

**curl | bash without checksum verification allows MITM attacks.**

```bash
# BAD
curl -LsSf "https://astral.sh/uv/install.sh" | sh

# GOOD
curl -LsSf "https://astral.sh/uv/install.sh" -o "${uv_installer}"
actual_checksum=$(sha256sum "${uv_installer}" | awk '{print $1}')
if [ "${actual_checksum}" != "${expected}" ]; then
    log_error "Checksum mismatch"
    return 1
fi
sh "${uv_installer}"
rm -f "${uv_installer}"
```

## Installer Preflight Gaps

**Installer breaks if prerequisites are missing.**

```bash
# BAD: assumes python3 is available
python3 -m venv "${VENV_DIR}"

# GOOD: verify first, auto-install if missing
preflight_checks() {
    check_python || install_python
    command -v git &>/dev/null || install_system_tools "git"
    command -v curl &>/dev/null || install_system_tools "curl"
    command -v sha256sum &>/dev/null || install_system_tools "sha256sum"
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
