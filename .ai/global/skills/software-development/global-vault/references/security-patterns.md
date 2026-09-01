# Security Patterns — Global Vault

## Issues Found During Review

### 1. Git Remote Helper Injection
**Risk:** `ext::sh -c "..."` URLs can execute arbitrary commands when added as git remotes.
**Fix:** Validate URLs against `^(ext::|--upload-pack=|ssh://.*\\|)`. Only accept `https://`, `git@`, `git://`.

### 2. Credential File Permissions
**Risk:** `~/.config/aiep/providers.yaml` could be world-readable by default.
**Fix:** Always `chmod 0o600` after writing credential files. SyncTracker and NewToolNotifier must apply on every `_save()`.

### 3. API Key in Memory
**Risk:** API keys remain in Python process memory after use.
**Fix:** Overwrite with `key = "x" * len(key)` after writing to disk. Consider `del key` after.

### 4. Race Conditions on Shared Files
**Risk:** Concurrent `ai` commands on the same machine can corrupt YAML files.
**Fix:** Use `fcntl.flock(LOCK_EX)` in `SyncTracker._save()` and `NewToolNotifier._save()`.

### 5. Silent Exception Swallowing
**Risk:** `except Exception: pass` hides sync/network failures from users.
**Fix:** Replace with `except Exception as exc: logger.debug("...", exc)` and return False.

### 6. YAML Deserialization
**Risk:** `yaml.load()` can execute arbitrary Python objects.
**Fix:** Always use `yaml.safe_load()` — never `yaml.load()` without Loader.

### 7. curl | bash Supply Chain
**Risk:** `curl | bash` for installing uv is vulnerable to MITM or compromised server.
**Fix:** Download installer, verify SHA256 checksum, then execute.

### 8. Hardcoded `changes=0`
**Risk:** `pending_changes` field in SyncTracker never updates after pull.
**Fix:** Read actual state after pull, don't hardcode.

## Encryption Standard

- **Symmetric:** Fernet (AES-128-CBC with PKCS7 padding)
- **Key Derivation:** PBKDF2-HMAC-SHA256
- **Iterations:** 600,000 (OWASP 2023 recommendation)
- **Salt:** 32 bytes random per file
- **File Permissions:** 0o600 on all encrypted files

## 2FA Standard

- **Algorithm:** TOTP (RFC 6238)
- **Hash:** SHA1
- **Digits:** 6
- **Period:** 30 seconds
- **Tolerance:** ±1 period (30 seconds before/after for clock skew)
- **Provisioning:** `otpauth://` URI for QR code generation
- **Storage:** Encrypted YAML with 0o600 permissions
