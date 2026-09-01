# Installer and Bundle Pattern

Pattern para instalación robusta con auto-instalación de prerequisitos y configuración encriptada via bundles.

## Cuándo usarlo

- Plataforma que se instala en múltiples máquinas con diferentes estados iniciales
- Necesidad de configuración base encriptada que viaja con el instalador
- Requisito de no romper la instalación por falta de herramientas opcionales

## Pre-flight Checks (obligatorios)

El install.sh debe verificar y auto-instalar:

| Herramienta | Requerido | Auto-install |
|-------------|-----------|--------------|
| Python 3.12+ | ✅ Sí | ✅ Sí (si python3 es muy viejo, busca python3.12) |
| git, curl, sha256sum | ✅ Sí | ✅ Sí |
| venv module | ✅ Sí | ✅ Sí |
| uv | Recomendado | ✅ Sí |
| Docker | Opcional | No (manual) |
| Ollama | Opcional | No (manual) |
| VSCode | Opcional | No (manual) |
| Trae | Opcional | No (manual) |
| Hermes | Requerido | ✅ Sí (clonar de GitHub) |

## Config Bundle Pattern (Opción B — validada)

**No copiar configuración de la máquina actual** — usar bundle encriptado que viene con el instalador.

```python
# Generar bundle (desarrollador, una vez):
python3 scripts/generate_bundle.py \
  --config-dir ./base-config \
  --output bundle.aiep \
  --passphrase "PASSPHRASE_COMPARTIDA"
```

**Durante instalación**:
```bash
read -rp "Bundle passphrase: " bundle_pass
python3 -c "
from aiep.security.bundle import BundleManager
manager = BundleManager(passphrase='${bundle_pass}')
manager.extract_bundle(Path('bundle.aiep'), Path('${aiep_hermes_dir}'))
"
```

El bundle contiene config base genérica (modelo por defecto, agentes disponibles, personalidad) — **NO credenciales reales**.

## Configuración protegida

Toda configuración sensible se encripta con Fernet + PBKDF2:

```python
from aiep.security.secure_config import SecureConfigStore

store = SecureConfigStore(config_dir, passphrase="user-passphrase")
store.lock()    # Encripta todos los archivos
store.unlock()  # Desencripta todos los archivos
```

| Archivo | Permisos | Encriptación |
|---------|----------|--------------|
| `.env` | 600 | Sí (con passphrase) |
| `auth.json` | 600 | Sí (con passphrase) |
| `config.yaml` | 600 | Sí (con passphrase) |
| `SOUL.md` | 600 | No (público) |

## Flujo de instalación

```bash
bash install.sh
  → Pre-flight checks (verifica prerequisitos)
  → Auto-instala lo que falta (Python, git, curl, etc.)
  → Crea venv e instala AIEP
  → Configura shell PATH
  → Configura autenticación de Git (SSH-first, sin prompts interactivos)
  → Copia/extrae config de Hermes (bundle o fresh)
  → Pregunta passphrase para encriptar config
  → Pregunta API keys (opcional)
  → Crea .ai/global/ en el proyecto
  → Programa sync periódico (cada 6h)
```

## Configuración de autenticación de Git (OBLIGATORIO)

El instalador **NUNCA** debe pedir usuario/contraseña de GitHub. GitHub ya no soporta autenticación por password.

```bash
# En install.sh — configurar ANTES de cualquier operación git
configure_git_auth() {
    # Preferir SSH (sin prompt de credenciales)
    git config --global url."git@github.com:".insteadOf "https://github.com/"
    # Desactivar prompts interactivos — fallar en vez de colgarse
    git config --global credential.helper ""
    export GIT_TERMINAL_PROMPT=0
}
```

## Seguridad

- Bundle encriptado con passphrase compartida
- Config local encriptada con passphrase del usuario
- Permisos 600 en archivos sensibles
- Sin secrets en git (auditoría post-instalación)
- Passphrase nunca se guarda en disco

## Credentials Bundle Pattern (NUEVO — sesión bundle)

Cuando el usuario pida generar un bundle con credenciales para distribuir e instalar en otras máquinas:

### Generación

Script `scripts/generate_credentials_bundle.py` con dos modos:

1. **Modo CLI** (recomendado para automatización):
```bash
python scripts/generate_credentials_bundle.py \
  --output bundle.aiep \
  --passphrase demo123 \
  --openai-key sk-... \
  --anthropic-key sk-ant-... \
  --openrouter-key sk-or-... \
  --git-token ghp_... \
  --git-username Blackfriday1780 \
  --git-email me@example.com \
  --hermes-config ~/.hermes/config.yaml \
  --include-auth
```

2. **Modo interactivo** (pregunta cada campo con `getpass` — NO usar con input redirigido porque `getpass` levanta `EOFError` sin terminal)

El bundle incluye:
- `credentials.yaml` — API keys + git token/user/email
- `config.yaml` — Hermes config (model, providers, agents, toolsets)
- `auth.json` — Hermes OAuth tokens (si `--include-auth`)

### Instalación

`install.sh` extrae y configura automáticamente:

```bash
# Extraer credenciales
python -c "
import yaml
creds = yaml.safe_load(open('credentials.yaml'))
# Output: PROVIDER_KEY=openai=sk-..., GIT_TOKEN=ghp_..."
```

- **Providers**: `ai provider use <name> --key <key> --passphrase <pass>`
- **Git**: `git config --global credential.helper store`, user.name, user.email
- **Hermes auth**: `cp auth.json ~/.hermes/auth.json && chmod 600`

### Preservar auth.json (tokens OAuth)

El usuario espera que `auth.json` de Hermes (tokens OAuth) se preserve durante la instalación. **No lo omitas** — pregunta explícitamente si incluirlo (`--include-auth`) y aplícalo en el `HERMES_DIR` destino:

```bash
if [ -f "${aiep_hermes_dir}/auth.json" ] && [ ! -f "${HERMES_DIR}/auth.json" ]; then
    cp "${aiep_hermes_dir}/auth.json" "${HERMES_DIR}/auth.json"
    chmod 600 "${HERMES_DIR}/auth.json"
fi
```

### Documentación contextualizada desde el vault

Cuando el usuario reporte que los documentos generados (`ARCHITECTURE.md`, `ROADMAP.md`, `ADR`, `MASTERPROMPT.md`) son solo plantillas genéricas sin contenido real, el problema es que el document generator **no lee el global vault**. El generator debe inyectar reglas, skills, y patrones del vault en cada documento.

```python
# docgen.py debe recibir/usar GlobalVault
self.vault = GlobalVault(self.root)

# Y en cada método, leer del vault:
rules = self.vault.get_rules()
skills = self.vault.get_skills()
patterns = self.vault.get_patterns()
```

El masterprompt también debe incluir vault context (reglas, skills, patrones) en vez de solo análisis del proyecto. Documentación sin vault context es documentación muerta.

## Referencias relacionadas

- `references/encryption-and-2fa-pattern.md` — encriptación y 2FA
- `references/security-audit-checklist.md` — checklist de seguridad
- `references/global-auto-distribution-pattern.md` — sync en mismo proyecto
