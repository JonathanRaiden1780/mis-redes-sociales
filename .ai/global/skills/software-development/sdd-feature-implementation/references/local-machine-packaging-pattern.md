# Local Machine Packaging Pattern

Pattern for creating local machine packaging for Windows, macOS, and Linux portability.

## Structure

```
install.sh              # Universal bootstrap installer (Linux/macOS)
install.ps1             # PowerShell bootstrap installer (Windows)
packaging/
    pyinstaller.spec    # PyInstaller spec for single-binary distribution
    build.py            # Build script for all platforms
    release.py          # Release automation script
src/aiep/platform_info.py  # Platform detection utilities
```

## install.sh (Linux/macOS)

### Structure
1. **Configuration** — version, install paths, bin dir
2. **Logging functions** — color-coded output
3. **Platform detection** — `uname -s` for OS, `uname -m` for arch
4. **Python check** — verify Python 3.12+ exists
5. **Python install** — platform-specific (apt, brew, dnf)
6. **uv install** — fast package manager (optional but preferred)
7. **Platform install** — create venv, install package, create symlink
8. **Shell setup** — add bin to PATH in shell rc file

### Key decisions
- Use `uv` if available, fall back to `pip`
- Create symlink in `~/.local/bin` for global access
- Detect shell type for rc file (.bashrc, .zshrc, .profile)
- Idempotent: check before install

### Pattern for platform detection
```bash
detect_platform() {
    local os arch
    case "$(uname -s)" in
        Linux*)     os="linux";;
        Darwin*)    os="macos";;
        *)          os="unknown";;
    esac
    case "$(uname -m)" in
        x86_64|amd64)   arch="x86_64";;
        arm64|aarch64)  arch="arm64";;
        *)              arch="unknown";;
    esac
    echo "${os}-${arch}"
}
```

## install.ps1 (Windows)

### Structure
1. **Configuration** — version, install paths
2. **Platform detection** — `[System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture`
3. **Python check** — `python --version`
4. **Python install** — `winget install Python.Python.3.12`
5. **Platform install** — create venv, install package, create batch wrapper
6. **PATH setup** — add to user PATH via `[Environment]::SetEnvironmentVariable`

### Key differences from install.sh
- Uses PowerShell 5.1+ syntax
- Batch wrapper instead of symlink
- `winget` for Python installation
- User-level PATH modification

## Platform Detection (Python)

### Pattern
```python
from dataclasses import dataclass
from enum import Enum

class OS(str, Enum):
    LINUX = "linux"
    MACOS = "macos"
    WINDOWS = "windows"

class Arch(str, Enum):
    X86_64 = "x86_64"
    ARM64 = "arm64"

@dataclass
class PlatformInfo:
    os: OS
    arch: Arch
    python_version: str
    is_64bit: bool

    @property
    def identifier(self) -> str:
        return f"{self.os.value}-{self.arch.value}"
```

Use `platform.system()` for OS, `platform.machine()` for arch, `struct.calcsize("P") * 8 == 64` for 64-bit check.

## PyInstaller Spec

### Key configuration
- `Analysis` with hidden imports for all dependencies
- `console=True` for CLI tool
- `upx=True` for compression
- Include `datas` for package catalogs

## Build Script

### Pattern
1. Build wheel with `python -m build --wheel`
2. Build binary with `pyinstaller`
3. Compute SHA256 checksums
4. Generate `dist-manifest.json` with version, platforms, sizes, checksums

### QA gate in build
- Run pytest before building
- Fail early if tests don't pass

## Release Script

### Pattern
1. Run QA (pytest)
2. Generate changelog from git log
3. Update version in pyproject.toml
4. Build distribution
5. Git tag

## Pitfalls

### ruff BLE001
Use specific exceptions (`OSError`, `subprocess.SubprocessError`) instead of blind `Exception` in build scripts.

### ruff PLW1510
Always add `check=False` to `subprocess.run` when you handle the return code manually.

### datetime DTZ011
Use `datetime.now(UTC).date()` instead of `date.today()`.
