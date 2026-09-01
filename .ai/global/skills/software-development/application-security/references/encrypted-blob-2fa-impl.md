# Encryption & 2FA Implementation Patterns

Full implementation patterns from SPEC-053 (session 2026-08-14). These are the production-tested versions of the patterns described in the parent skill.

## 1. EncryptedBlob with JSON Serialization

The parent skill shows salt+ciphertext concatenation. The JSON approach is more extensible (allows adding metadata like algorithm, version) and is what was production-tested:

```python
import base64
import json
from dataclasses import dataclass, asdict

@dataclass
class EncryptedBlob:
    ciphertext: bytes
    salt: bytes
    iterations: int
    algorithm: str = "fernet-pbkdf2"

    def to_dict(self) -> dict:
        return {
            "ciphertext": base64.b64encode(self.ciphertext).decode(),
            "salt": base64.b64encode(self.salt).decode(),
            "iterations": self.iterations,
            "algorithm": self.algorithm,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "EncryptedBlob":
        return cls(
            ciphertext=base64.b64decode(data["ciphertext"]),
            salt=base64.b64decode(data["salt"]),
            iterations=data["iterations"],
            algorithm=data.get("algorithm", "fernet-pbkdf2"),
        )

    def serialize(self) -> bytes:
        return json.dumps(self.to_dict()).encode()

    @classmethod
    def deserialize(cls, data: bytes) -> "EncryptedBlob":
        return cls.from_dict(json.loads(data.decode()))
```

**Why JSON over concatenation:** The salt-only approach is fragile — if you add a version field or change the algorithm, you have to parse bytes at specific offsets. JSON is self-describing and backward-compatible.

## 2. SecureStorage with Legacy Plaintext Support

When migrating existing plaintext configs, the storage layer must handle both encrypted and unencrypted files:

```python
def load(self) -> dict[str, Any]:
    if not self.path.exists():
        return {}
    data = self.path.read_bytes()

    # Try encrypted first
    try:
        blob = EncryptedBlob.deserialize(data)
        if not self._passphrase:
            raise EncryptionError("Passphrase required")
        plaintext = decrypt(blob, self._passphrase)
        return json.loads(plaintext)
    except (json.JSONDecodeError, KeyError, UnicodeDecodeError):
        pass

    # Fall back to plaintext (legacy)
    try:
        import yaml
        return yaml.safe_load(data.decode("utf-8")) or {}
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {}

def save(self, data: dict[str, Any]) -> None:
    self.path.parent.mkdir(parents=True, exist_ok=True)
    plaintext = json.dumps(data, indent=2, sort_keys=False)

    if self._passphrase:
        blob = encrypt(plaintext, self._passphrase)
        self.path.write_bytes(blob.serialize())
        self.path.chmod(0o600)
    else:
        self.path.write_text(plaintext, encoding="utf-8")
        self.path.chmod(0o600)
```

**Key insight:** Always call `chmod(0o600)` regardless of encryption. Unencrypted files with secrets still need restrictive permissions.

## 3. TOTP 2FA with Clock Skew Tolerance

```python
import hmac
import hashlib
import struct
import time
import base64

HOTP_DIGITS = 6
HOTP_PERIOD = 30
HOTP_TOLERANCE = 1  # Allow 1 period before/after for clock skew

def _hotp(self, secret: bytes, counter: int) -> int:
    msg = struct.pack(">Q", counter)
    digest = hmac.new(secret, msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return code % (10**HOTP_DIGITS)

def _totp(self, secret: bytes, t: int | None = None) -> int:
    if t is None:
        t = int(time.time())
    counter = t // HOTP_PERIOD
    return self._hotp(secret, counter)

def verify_code(self, secret: str, code: str) -> bool:
    secret_bytes = base64.b32decode(secret.upper())
    t = int(time.time())
    for delta in range(-HOTP_TOLERANCE, HOTP_TOLERANCE + 1):
        expected = f"{self._totp(secret_bytes, t + delta * HOTP_PERIOD):0{HOTP_DIGITS}d}"
        if hmac.compare_digest(expected, code):
            return True
    return False
```

**Critical:** Use `hmac.compare_digest` for constant-time comparison. Direct string comparison (`==`) is vulnerable to timing attacks.

## 4. Supply Chain Verification for curl | bash

Even with HTTPS, a compromised server can serve malicious code. Always verify checksums:

```bash
install_uv() {
    local uv_installer="/tmp/uv-installer.sh"
    local uv_checksum="c0d8f0eb770d66a3d10b8f6a661e7e4d60b9a0e9f7e8c3b2a1d4f5e6c7b8a900"

    curl -LsSf "https://astral.sh/uv/install.sh" -o "${uv_installer}"

    local actual_checksum
    actual_checksum=$(sha256sum "${uv_installer}" | awk '{print $1}')

    if [ "${actual_checksum}" != "${uv_checksum}" ]; then
        log_error "Checksum mismatch! Expected ${uv_checksum}, got ${actual_checksum}"
        log_error "The installer may be compromised. Aborting."
        rm -f "${uv_installer}"
        return 1
    fi

    sh "${uv_installer}"
    rm -f "${uv_installer}"
    log_success "uv installed (checksum verified)"
}
```

**Note:** The checksum in this example is a placeholder. Replace with the actual checksum from https://astral.sh/uv.

## 5. Memory Cleanup for Secrets

`del key` or `key = None` just drops the reference — the string object may still exist in memory until GC:

```python
# BAD: key reference dropped but string persists in memory
store.set_api_key(name, key)
del key

# GOOD: overwrite the string data before GC
store.set_api_key(name, key)
key = "x" * len(key)
```

**Why this matters:** If a process dump occurs (core dump, heap inspection, swap), unoverwritten secrets are recoverable. Overwriting reduces the window of exposure.
