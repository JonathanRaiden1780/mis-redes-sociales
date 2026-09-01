# Global Auto-Distribution Pattern

Pattern para auto-sincronización global automática en plataformas tipo "instalar una vez, reutilizar en todas partes". Implementa la capa que conecta todas las máquinas del equipo con un cerebro central.

## Cuándo usarlo

- Plataforma que se instala una vez y se usa en múltiples máquinas
- Necesidad de distribución automática de memoria, skills, MCPs, herramientas entre equipos
- Cada comando `ai` debe sincronizar automáticamente sin intervención del usuario
- Detección automática de nuevas herramientas/skills que se registran globalmente

## Arquitectura (VALIDADA)

```
Tu proyecto (tu repo)
├── .ai/
│   ├── MASTERPROMPT.md         ← Generado por ai project init (contexto proyecto + global)
│   ├── memory.yaml             ← Memoria local indexada
│   ├── state.yaml              ← Estado local
│   └── global/                 ← CEREBRO COMPARTIDO (viaja con el proyecto)
│       ├── rules/              ← Reglas del equipo
│       ├── skills/             ← Skills/herramientas descubiertos
│       ├── patterns/           ← Patrones de arquitectura reutilizables
│       ├── projects/           ← Índice de proyectos del equipo
│       └── index.yaml          ← Búsqueda rápida
├── docs/
└── src/

Cuando haces git push/pull:
  .ai/global/ viaja con el proyecto → Tu equipo tiene lo último
```

**Principio**: La memoria global vive en `.ai/global/` **dentro del mismo repositorio del proyecto**. NO usa repositorio externo. La memoria se versiona junto con el código.

## Componentes

### 1. GlobalVault (`src/aiep/vault.py`)

Gestiona el cerebro global compartido.

```python
class GlobalVault:
    GLOBAL_DIR = ".ai/global"
    RULES_DIR = f"{GLOBAL_DIR}/rules"
    SKILLS_DIR = f"{GLOBAL_DIR}/skills"
    PATTERNS_DIR = f"{GLOBAL_DIR}/patterns"
    PROJECTS_DIR = f"{GLOBAL_DIR}/projects"
    INDEX_FILE = f"{GLOBAL_DIR}/index.yaml"

    def ensure_structure(self) -> None: ...
    def add_rule(self, name: str, content: str) -> Path: ...
    def add_skill(self, name: str, description: str, metadata: dict | None = None) -> Path: ...
    def add_pattern(self, name: str, description: str, template: str = "") -> Path: ...
    def add_project(self, name: str, path: str, description: str = "") -> Path: ...
    def search(self, query: str) -> list[dict]: ...
    def get_context_summary(self) -> str: ...
    def get_vault_stats(self) -> dict[str, int]: ...
```

### 2. ContextProvider (`src/aiep/context/provider.py`)

Carga contexto para IAs externas.

```python
class ContextProvider:
    def load_project_context(self) -> dict[str, Any]: ...
    def load_global_context(self) -> dict[str, Any]: ...
    def get_full_context(self) -> str: ...
    def generate_masterprompt(self, project_name: str, project_type: str) -> str: ...
```

### 3. BundleManager (`src/aiep/security/bundle.py`)

Gestiona bundles encriptados para distribución de configuración base.

```python
class BundleManager:
    def create_bundle(self, config_dir: Path, output_path: Path, passphrase: str) -> Path: ...
    def extract_bundle(self, bundle_path: Path, output_dir: Path, passphrase: str) -> list[str]: ...
    def get_bundle_info(self, bundle_path: Path) -> dict[str, Any]: ...
```

**Uso durante instalación**:
```bash
# El install.sh incluye un bundle.aiep encriptado con passphrase compartida
# El usuario ingresa la passphrase durante la instalación
# El bundle se desempaqueta en ~/.config/aiep/hermes/
```

### 4. SecureConfigStore (`src/aiep/security/secure_config.py`)

Almacena configuración encriptada con passphrase.

```python
class SecureConfigStore:
    def lock(self, passphrase: str | None = None) -> None: ...    # Encripta todos los archivos
    def unlock(self, passphrase: str | None = None) -> None: ...  # Desencripta todos los archivos
    def load(self, filename: str) -> dict | str: ...
    def save(self, filename: str, data: Any) -> None: ...
    def is_encrypted(self) -> bool: ...
```

### 5. GlobalSyncService (`src/aiep/global_sync.py`)

Sincronización dentro del proyecto.

```python
class GlobalSyncService:
    GLOBAL_DIR = ".ai/global"

    def sync(self, message: str | None = None, dry_run: bool = False) -> dict: ...
    def pull(self) -> bool: ...
    def push(self) -> bool: ...
    def has_unpulled_changes(self) -> bool: ...
    def get_changed_global_files(self) -> list[str]: ...
    def ensure_global_dir(self) -> None: ...
```

**Nota**: Solo sincroniza cambios en `.ai/global/`, no todo el repositorio.

### 6. Comandos CLI

| Comando | Función |
|---------|---------|
| `ai project init` | Inicializa proyecto (genera MASTERPROMPT + plantillas) |
| `ai project sync` | Lee proyecto y actualiza global vault |
| `ai sync-status` | Muestra estado de sincronización |
| `ai doctor` | Diagnóstico completo incluyendo sync |

## Instalación (install.sh)

### Pre-flight checks (obligatorios)

```bash
preflight_checks() {
    # 1. Verificar herramientas de sistema
    for tool in git curl sha256sum; do ...
    
    # 2. Verificar Python 3.12+
    check_python || install_python
    
    # 3. Verificar venv module
    # 4. Verificar uv (opcional)
    # 5. Verificar Docker (opcional)
    # 6. Verificar Ollama (opcional)
    # 7. Verificar VSCode (opcional)
    # 8. Verificar Trae (opcional)
    # 9. Verificar Hermes (requerido)
}
```

**Auto-instalación**: Si falta Python o herramientas de sistema, el install.sh las instala automáticamente (apt, brew, dnf, pacman, apk).

### Configuración de Hermes (Bundle Opción B)

**No copiar de la máquina actual** — usar bundle encriptado que viene con el instalador.

```bash
copy_hermes_config() {
    local bundle_path="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/bundle.aiep"
    
    if [ -f "${bundle_path}" ]; then
        read -rp "  Bundle passphrase: " bundle_pass
        # Extrae bundle encriptado con passphrase
        python3 -c "
from aiep.security.bundle import BundleManager
manager = BundleManager(passphrase='${bundle_pass}')
manager.extract_bundle(Path('${bundle_path}'), Path('${aiep_hermes_dir}'))
"
    else
        generate_fresh_config  # Fallback: config genérica
    fi
}
```

### Protección de configuración

```bash
# Durante install.sh, preguntar passphrase para encriptar
read -rp "  Passphrase to encrypt config (or Enter to skip): " config_pass
if [ -n "${config_pass}" ]; then
    python3 -c "
from aiep.security.secure_config import SecureConfigStore
store = SecureConfigStore(Path('${aiep_hermes_dir}'), passphrase='${config_pass}')
store.lock()
"
fi
```

### Auditoría de seguridad (POST-INSTALACIÓN)

```bash
# Verificar que no se cuelen secrets en git
grep -rn --include='*.py' -E "(api_key|secret|password|token|passwd)\s*=\s*['\"][^'\"]" src/
grep -rn --include='*.py' -E "subprocess.*shell=True|os\.system\(" src/
grep -rn --include='*.py' -E "\beval\(|\bexec\(" src/

# Verificar permisos de archivos
ls -la ~/.config/aiep/hermes/
# Debe ser 600 para .env, auth.json, config.yaml

# Verificar que el bundle está encriptado
file bundle.aiep  # No debe ser texto plano
```

## Seguridad

| Capa | Implementación |
|------|----------------|
| En reposo | Fernet (AES-128-CBC) + PBKDF2 (600k iteraciones) |
| En tránsito | HTTPS/SSH (git) |
| Acceso | 2FA/TOTP + passphrase para config |
| Archivos | chmod 600 + file locking (fcntl) |
| Bundle | Encriptado con passphrase compartida |
| Git audit | Verificar que no hay secrets en repo |

## Flujo de trabajo completo

### 1. Inicializar proyecto

```bash
cd ~/mi-proyecto
ai project init --type web
```

**Hermes hace:**
1. Lee `.ai/global/` (rules, skills, patterns del equipo)
2. Genera `MASTERPROMPT.md` con contexto del proyecto + global
3. Crea `.ai/memory.yaml` y `.ai/state.yaml`
4. Indexa el proyecto en `.ai/global/projects/`

### 2. Trabajar con IA externa

```bash
# Claude Code, Trae, etc.
# → Lee MASTERPROMPT.md (contexto completo)
# → Sigue las reglas del equipo
# → Usa los skills y patrones definidos
```

### 3. Sincronizar descubrimientos

```bash
ai project sync
```

**Hermes hace:**
1. Lee lo que la IA externa hizo
2. Detecta nuevos skills, patrones, herramientas
3. Actualiza `.ai/global/` con la nueva información
4. Auto-sync a todas las máquinas (via git push)

### 4. En otra máquina

```bash
git pull                          # Trae .ai/global/ actualizado
cd ~/mi-proyecto
# → Claude/Trae lee MASTERPROMPT.md (actualizado)
```

## Tests

### Mocking de imports diferenciados (PITFALL CRÍTICO)

```python
# ✅ CORRECTO — módulo original donde está definido:
with patch("aiep.global_sync.GlobalSyncService") as mock_service:
    mock_service.return_value.pull.return_value = True

# ❌ INCORRECTO — no funciona con imports diferidos:
with patch("aiep.sync.trigger.GlobalSyncService") as mock_service:
    ...  # Nunca intercepta el import real
```

### Mocking de GitPython Repo

```python
def _make_mock_repo(remotes=True, branch="master", local_sha="abc123", remote_sha="abc123"):
    mock_repo = MagicMock()
    if remotes:
        mock_remote = MagicMock()
        mock_remote.name = "origin"
        mock_remotes = MagicMock()
        mock_remotes.__iter__ = MagicMock(return_value=iter([mock_remote]))
        mock_remotes.origin = mock_remote
        mock_repo.remotes = mock_remotes
    else:
        mock_remotes = MagicMock()
        mock_remotes.__iter__ = MagicMock(return_value=iter([]))
        mock_remotes.__bool__ = MagicMock(return_value=False)
        mock_repo.remotes = mock_remotes
    mock_repo.head.is_detached = False
    mock_repo.active_branch.name = branch
    mock_repo.head.commit.hexsha = local_sha
    mock_ref = MagicMock()
    mock_ref.commit.hexsha = remote_sha
    mock_repo.refs.__getitem__ = MagicMock(return_value=mock_ref)
    return mock_repo
```

## Referencias relacionadas

- `references/global-onboarding-and-continuity-pattern.md` — onboarding global y continuidad
- `references/security-audit-checklist.md` — checklist de seguridad
- `references/encryption-and-2fa-pattern.md` — encriptación y 2FA
