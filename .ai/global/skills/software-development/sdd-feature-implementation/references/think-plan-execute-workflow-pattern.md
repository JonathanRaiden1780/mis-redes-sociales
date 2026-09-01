# Think → Plan → Execute Workflow Pattern

Pattern para implementar un workflow estructurado de tres fases que se integra con agentes y adapters de ejecución existentes.

## Cuándo usarlo

- La plataforma ya tiene agentes y execution adapters
- Se necesita un pipeline de razonamiento determinista antes de ejecutar
- El workflow debe ser opcional (backward compatible)
- Se quiere trazabilidad de cada fase

## Estructura

```
src/aiep/workflow/
  models.py     → WorkflowPolicy, PhaseArtifact, PlanStep, WorkflowResult
  think.py      → ThinkPhase (analiza + clasifica tarea)
  plan.py       → PlanPhase (produce pasos deterministas)
  execute.py    → ExecutePhase (ejecuta con observabilidad)
  engine.py     → WorkflowEngine (orquesta las 3 fases)
```

## Componentes

### WorkflowPolicy (enum)
- `STRICT` — todas las fases obligatorias
- `ADVISORY` — fases recomendadas, skipeables con flags
- `OFF` — ejecución directa (backward compatible)

### ThinkPhase
- Usa `ContextSelector` existente para gather context
- Clasifica tarea por keywords (design, debug, implement, refactor, test, document, general)
- Retorna `PhaseArtifact` con metadata (task_type, context_chars, task)

### PlanPhase
- Recibe `PhaseArtifact` de ThinkPhase
- Produce `list[PlanStep]` determinista según task_type
- Cada `PlanStep` tiene: action, agent, provider, description
- No usa LLM — es 100% determinista

### ExecutePhase
- Recibe `PhaseArtifact` de PlanPhase
- Itera steps, ejecuta cada uno via callback `execute_fn`
- Si un step falla, retorna inmediatamente con error
- Si `execute_fn` es None, retorna artifact informativo

### WorkflowEngine
- Orquesta las 3 fases en orden
- Aplica `WorkflowPolicy` para decidir qué fases correr
- Soporta `skip_think` y `skip_plan` para policy ADVISORY

## CLI integration

```python
# commands/run.py
def run(
    task: str,
    workflow: str = typer.Option("off", "--workflow", "-w"),
    skip_think: bool = typer.Option(False, "--skip-think"),
    skip_plan: bool = typer.Option(False, "--skip-plan"),
) -> None:
    policy = WorkflowPolicy(workflow)
    if policy != WorkflowPolicy.OFF:
        engine = WorkflowEngine()
        result = engine.run(task, agents, providers, policy, ...)
```

## Testing patterns

```python
# TestThinkPhase
phase = ThinkPhase()
assert phase._classify_task("Design a new API") == "design"

# TestPlanPhase
phase = PlanPhase()
artifact = PhaseArtifact(phase="think", metadata={"task_type": "design"})
result = phase.run(artifact, ["architect"], ["local"])
assert len(result.metadata["steps"]) > 0

# TestExecutePhase
phase = ExecutePhase()
mock_execute = Mock(return_value=Mock(success=True))
result = phase.run(artifact, mock_execute)

# TestWorkflowEngine
engine = WorkflowEngine()
result = engine.run(task, agents, providers, policy=WorkflowPolicy.ADVISORY)
assert result.think_artifact is not None
assert result.plan_artifact is not None
```

## Pitfalls

### ExecutePhase con execute_fn=None
Si no se pasa callback, retornar artifact informativo en vez de crashear:
```python
if execute_fn is None:
    return PhaseArtifact(phase="execute", content="No execute function provided")
```

### ThinkPhase sin .ai/ directory
Usar `tmp_path` en tests — `ContextSelector.select()` funciona sin `.ai/` y retorna contexto vacío.

### PlanPhase con task_type desconocido
Siempre tener un fallback (step único `execute`) para task_types no reconocidos.

## Referencias relacionadas

- `references/execution-backend-integration-pattern.md` — adapters que el workflow puede usar
- `references/mcp-integration-pattern.md` — herramientas MCP que steps pueden invocar
