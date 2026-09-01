# Encryption & 2FA Pattern for Sensitive Data

Pattern validated in SPEC-053 (Global Auto-Distribution). Use when the user explicitly asks for encryption of credentials/tokens and 2FA for sensitive operations.

## When to use

- User asks for "encriptación", "protección de credenciales", "datos sensibles"
- User asks for "2FA", "autenticación de dos factores", "verificación en dos pasos"
- Storing API keys, tokens, or credentials locally
- Protecting user data at rest

## Architecture

```
Passphrase → PBKDF2 (600k iterations, SHA256, salt 32 bytes) → Fernet key
                                                                      ↓
API Key → Fernet encrypt → base64 → providers.yaml (chmod 600)
```

## Components

### 1. Encryption Core (`src/aiep/security/crypto.py`)

- **Fernet (AES-128-CBC)** for symmetric encryption
- **PBKDF2-HMAC-SHA256** with 600,000 iterations (OWASP 2023 recommendation)
- **32-byte random salt** per file
- **Base64 URL-safe encoding** for storage

```python
from cryptography.fernet import Fernet, InvalidToken
import hashlib, secrets, base64

PBKDF2_ITERATIONS = 600_000
SALT_SIZE = 32
KEY_SIZE = 32

def _derive_key(passphrase: str, salt: bytes, iterations: int = PBKDF2_ITERATIONS) -> bytes:
    key = hashlib.pbkdf2_hmac(
        "sha256",
        passphrase.encode("utf-8"),
        salt,
        iterations,
        dklen=KEY_SIZE,
    )
    return base64.urlsafe_b64encode(key)

def encrypt(plaintext: str, passphrase: str) -> EncryptedBlob:
    salt = secrets.token_bytes(SALT_SIZE)
    key = _derive_key(passphrase, salt)
    f = Fernet(key)
    ciphertext = f.encrypt(plaintext.encode("utf-8"))
    return EncryptedBlob(ciphertext=ciphertext, salt=salt, iterations=PBKDF2_ITERATIONS)

def decrypt(blob: EncryptedBlob, passphrase: str) -> str:
    key = _derive_key(passphrase, blob.salt, blob.iterations)
    f = Fernet(key)
    plaintext = f.decrypt(blob.ciphertext)
    return plaintext.decode("utf-8")
```

### 2. SecureStorage (`src/aiep/security/crypto.py`)

Transparent file-level encryption with legacy plaintext fallback:

```python
class SecureStorage:
    def __init__(self, path: Path, passphrase: str | None = None):
        self.path = path
        self._passphrase = passphrase

    def load(self) -> dict[str, Any]:
        if not self.path.exists():
            return {}
        data = self.path.read_bytes()
        try:
            blob = EncryptedBlob.deserialize(data)
            if not self._passphrase:
                raise EncryptionError("Passphrase required")
            plaintext = decrypt(blob, self._passphrase)
            return json.loads(plaintext)
        except (json.JSONDecodeError, KeyError):
            pass
        # Legacy plaintext fallback
        return yaml.safe_load(data.decode("utf-8")) or {}

    def save(self, data: dict[str, Any]) -> None:
        plaintext = json.dumps(data, indent=2)
        if self._passphrase:
            blob = encrypt(plaintext, self._passphrase)
            self.path.write_bytes(blob.serialize())
        else:
            self.path.write_text(plaintext, encoding="utf-8")
        self.path.chmod(0o600)
```

### 3. TOTP 2FA (`src/aiep/security/two_factor.py`)

Time-based OTP with clock skew tolerance:

```python
class TOTP2FA:
    def generate_secret(self) -> str:
        return base64.b32encode(secrets.token_bytes(20)).decode("utf-8")

    def generate_code(self, secret: str, t: int | None = None) -> str:
        secret_bytes = base64.b32decode(secret.upper())
        code = self._totp(secret_bytes, t)
        return f"{code:06d}"

    def verify_code(self, secret: str, code: str) -> bool:
        secret_bytes = base64.b32decode(secret.upper())
        t = int(time.time())
        for delta in range(-1, 2):  # ±30s tolerance
            expected = f"{self._totp(secret_bytes, t + delta * 30):06d}"
            if hmac.compare_digest(expected, code):
                return True
        return False
```

### 4. SecureProviderStore (`src/aiep/providers/secure_store.py`)

Encrypted provider configuration:

```python
class SecureProviderStore:
    def __init__(self, config_path: Path | None = None, passphrase: str | None = None):
        self._path = config_path or (paths.config / "providers.yaml")
        self._storage = SecureStorage(self._path, passphrase)

    def set_api_key(self, name: str, api_key: str) -> None:
        data = self.load()
        if "providers" not in data:
            data["providers"] = {}
        if name not in data["providers"]:
            data["providers"][name] = {}
        data["providers"][name]["api_key"] = api_key
        self.save(data)
```

### 5. Memory Cleanup

Always clear sensitive values from memory after use:

```python
# BAD — key remains in memory
providers[name]["api_key"] = key

# GOOD — key is overwritten
providers[name]["api_key"] = key
key = "x" * len(key)  # Overwrite before GC
```

## CLI Commands

```bash
# Setup 2FA
ai security setup-2fa      # Shows QR code for authenticator app
ai security verify-2fa     # Verify a TOTP code
ai security disable-2fa    # Disable 2FA (requires code)
ai security status         # Show 2FA + encryption status

# Provider with encryption
ai provider use openai --key sk-... --passphrase "passphrase"
```

## Integration in `cli.py`

```python
@provider_app.command()
def use(
    name: str,
    key: str = typer.Option(None, "--key", "-k", help="API key"),
    passphrase: str = typer.Option(None, "--passphrase", "-p", help="Passphrase for encryption"),
) -> None:
    if key:
        _set_provider_key(name, key, passphrase)
        key = "x" * len(key)  # Clear from memory
    provider_use_command.run(name)
```

## Security Properties

| Property | Implementation |
|----------|----------------|
| Encryption at rest | Fernet (AES-128-CBC) |
| Key derivation | PBKDF2-HMAC-SHA256, 600k iterations |
| Salt | 32 bytes random per file |
| File permissions | chmod 0o600 |
| Memory cleanup | Key overwritten after use |
| 2FA | TOTP (RFC 6238), ±30s tolerance |
| Legacy support | Plaintext read, encrypted write |

## Dependencies

```
cryptography>=41.0.0  # Fernet + PBKDF2
```

## References

- `references/security-audit-checklist.md` — security audit pattern
- `references/global-auto-distribution-pattern.md` — sync pattern that uses this encryption
