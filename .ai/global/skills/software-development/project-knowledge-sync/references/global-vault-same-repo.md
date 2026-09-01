# Global Vault en el Mismo Repositorio

Patrón donde la memoria global vive en `.ai/global/` dentro del mismo repositorio del proyecto.

## Cuándo usar

- Quieres compartir memoria/contexto entre máquinas del equipo
- No quieres configurar URL externa de sync
- Las IAs externas (Claude, Trae) leen el contexto en vez de recibir instrucciones
- El sync viaja con el proyecto en git push/pull

## Arquitectura

```
Tu repo
├── .ai/
│   ├── memory.yaml          # Memoria local del proyecto
│   ├── state.yaml           # Estado local
│   ├── rules.md             # Reglas locales
│   └── global/              # ← Cerebro compartido
│       ├── rules/           # Reglas del equipo (Markdown)
│       ├── skills/          # Skills descubiertos (YAML)
│       ├── patterns/        # Patrones de arquitectura (YAML)
│       ├── projects/        # Índice de proyectos (YAML)
│       └── index.yaml       # Búsqueda rápida
├── docs/
│   ├── specs/
│   ├── adr/
│   └── ARCHITECTURE.md
├── MASTERPROMPT.md          # Generado por ai init (contexto ajustado al proyecto)
└── src/
```

## Flujo completo

### 1. Inicializar proyecto
```bash
cd ~/proyecto-nuevo
ai init
```
- Hermes lee `.ai/global/` (rules, skills, patterns)
- Genera `MASTERPROMPT.md` con contexto del proyecto + global
- Crea `.ai/` base (memory.yaml, state.yaml)
- Registra el proyecto en `.ai/global/projects/`

### 2. Trabajar con IA externa
```bash
# Claude Code, Trae, etc.
# Abren el proyecto → leen MASTERPROMPT.md
# Trabajan con reglas, skills, patrones del global
```

### 3. Sync de nuevos conocimientos
```bash
ai sync
```
- Hermes lee lo que hizo la IA externa
- Detecta nuevos skills/patrones/herramientas
- Actualiza `.ai/global/`
- Auto-sync a otras máquinas (cron o manual)

### 4. En otra máquina
```bash
git pull  # Trae .ai/global/ actualizado
cd ~/proyecto
# Claude/Trae leen MASTERPROMPT.md → contexto completo sin configuración
```

## Componentes

### GlobalVault (almacén)
- `add_rule(name, content)` → reglas del equipo
- `add_skill(name, description, metadata)` → skills descubiertos
- `add_pattern(name, description, template)` → patrones reutilizables
- `add_project(name, path, description)` → índice de proyectos
- `search(query)` → búsqueda en el índice
- `get_context_summary()` → resumen para IAs externas

### ContextProvider (carga de contexto)
- `load_project_context()` → contexto local del proyecto
- `load_global_context()` → contexto del global vault
- `get_full_context()` → contexto completo para IAs externas
- `generate_masterprompt(name, type)` → genera MASTERPROMPT con contexto global

### GlobalSyncService (sync)
- `sync()` → commit + push de `.ai/global/`
- `has_unpulled_changes()` → verifica si hay cambios remotos
- `pull()` → trae cambios
- `push()` → empuja cambios

## Ventajas

- **Sin configuración externa** — no hay que pedir URL
- **Offline-first** — el repo local ya tiene todo
- **Token-efficient** — las IAs leen contexto estructurado, no instrucciones largas
- **Auto-versionado** — git ya trackea todo
- **Multi-proyecto** — cada repo tiene su MASTERPROMPT pero comparte el global

## Protección de datos

| Archivo | Permisos | Encriptación |
|---------|----------|--------------|
| `.ai/global/skills/*.yaml` | 600 | No (público) |
| `.ai/global/patterns/*.yaml` | 600 | No (público) |
| `~/.config/aiep/providers.yaml` | 600 | Sí (Fernet + PBKDF2) |
| `~/.config/aiep/2fa.yaml` | 600 | Sí (automático) |

## Pregunta clave antes de implementar

> "Cuando dices 'memoria global' o 'cerebro', ¿la plataforma ejecuta tareas directamente usando esa memoria, o prepara el contexto para que IAs externas lo lean?"

La respuesta determina si el sistema es un **Task Executor** o un **Context Provider**.
