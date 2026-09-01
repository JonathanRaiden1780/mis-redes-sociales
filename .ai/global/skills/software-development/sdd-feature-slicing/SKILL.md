---
name: sdd-feature-slicing
description: >
  Partir features grandes en SPEC/TASK por habilitador.
---

# SDD Feature Slicing

## Trigger

Use when:
- Una feature nueva atraviesa 2+ capas existentes.
- Hay múltiples submódulos candidatos y hay que elegir el orden.
- La feature necesita un habilitador transversal antes de que submódulos individuales sean útiles.

## Decisión: qué SPEC crear primero

Elegir por criterio de **habilitador**: ¿cuál bloque, implementado solo, ya hace que el resto sea más útil?

Criterios:
1. **Alimenta el sistema global**: el bloque hace que datos fluyan hacia un lugar que otros consumirán.
2. **Reduce complejidad de los siguientes bloques**: B es más fácil después de A.
3. **No deja submódulos como capas pasivas**: sin el habilitador, un submódulo no hace nada útil.

Cuándo NO usar habilitador primero:
- Si el habilitador es speculative y los submódulos son claros y testables.
- Si el habilitador introduce riesgo arquitectónico grande.

## Flujo SDD

1. Elegir orden de SPECs por habilitador.
2. Crear SPEC principal.
3. Crear TASK principal.
4. Implementar (extraer interfaces compartidas en el mismo incremento si se descubren).
5. Tests + QA gate (black, ruff, mypy).
6. Commit SPEC + TASK + código juntos.
7. Siguiente SPEC con interfaces ya definidas.

## Interfaz primero

Diseñar las interfaces públicas que submódulos futuros van a consumir. Documentar en el SPEC como "future contract".

## Pitfalls

- Specs paralelos sin orden claro: se pierde la ventaja del habilitador.
- Submódulos como capas pasivas: evaluar siempre ¿este submódulo, solo, hace algo útil?
- Extraer interfaces speculative: solo crear la interfaz que el habilitador necesita publicar.
- Commitar SPEC y código en incrementos separados.

## Validación

Al final de cada incremento preguntar:
- ¿El bloque implementado, solo, hace algo útil?
- ¿Los bloques restantes son más fáciles ahora?
- ¿Las interfaces públicas están documentadas para los siguientes bloques?

## Relación con otros skills

- `test-driven-development`: ciclo RED-GREEN-REFACTOR por submódulo.
- `python-typer-cli`: wiring de nuevos comandos CLI.
- `systematic-debugging`: depurar cada capa por separado.

## Support files

- `references/typado-cli-wiring.md` — lecciones concretas del typado estricto y CLI wiring durante feature slicing.
