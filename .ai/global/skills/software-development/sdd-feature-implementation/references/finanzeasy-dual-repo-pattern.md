# Finanzeasy Dual-Repo Sync Pattern

Patrón validado para mantener sincronización bidireccional entre repositorios Angular (web) y React Native (móvil) compartiendo Supabase como backend único.

## Arquitectura

```
[Finanzeasy Angular] ←→ [Supabase] ←→ [FinanzeasyReact Native]
     (Web)                  (BD)            (Móvil)
```

## Estructura de servicios compartidos

| Servicio | Angular | React Native |
|----------|---------|--------------|
| Cliente Supabase | `supabase.service.ts` | `supabase.ts` |
| Cuentas | `account.service.ts` | `accountService.ts` |
| Transacciones | `transaction.service.ts` | `transactionService.ts` |
| Préstamos | `loan.service.ts` | `loanService.ts` |
| Metas | `savings-goal.service.ts` | `goalService.ts` |
| Reportes | `report.service.ts` | `reportService.ts` |

## Reglas de sincronización

1. **BD compartida**: Ambos repos usan el mismo proyecto Supabase (mismas tablas, RLS, functions)
2. **Tipos alineados**: Los tipos de datos deben ser consistentes (snake_case en DB, camelCase en TS)
3. **Migraciones SQL**: Se crean en el repo Angular y se ejecutan en Supabase directamente
4. **Tests independientes**: Cada repo tiene sus propios tests (Angular: Karma/Jasmine, React: Jest)

## Features implementados en ambos repos

| Feature | Angular Tests | React Tests |
|---------|---------------|-------------|
| Dashboard | ✅ | ✅ |
| Transacciones | ✅ | ✅ |
| Presupuestos | ✅ | ✅ |
| Metas de Ahorro | ✅ | ✅ |
| Préstamos | ✅ | ✅ |
| Inversiones | ✅ | ✅ |
| Deudas | ✅ | ✅ |
| Suscripciones | ✅ | ✅ |
| Tarjetas de Crédito | ✅ | ✅ |
| Calendario | ✅ | ✅ |
| Conversor Moneda | ✅ | ✅ |
| Reportes PDF | ✅ | ✅ |

## Features solo Angular (web)

- Planificador de Deudas (avalancha/nieve)
- Excel Export (multi-hoja)
- Modo Familiar (invitaciones)
- Widgets de Pantalla
- Escaneo OCR (integración MiNegocio)
- Calculadora MSI
- Modo Vacaciones
- Backup en Nube
- Gamificación Avanzada

## Features solo React Native (móvil)

- Offline-first con SQLite
- Push Notifications
- Biometría
- Background Tasks
- SyncStatusBar

## GitFlow

| Repo | Rama desarrollo | Rama producción |
|------|-----------------|-----------------|
| Angular (Finanzeasy) | `testing/Ai` | `master` |
| React Native (FinanzeasyReact) | `test/ia` | `master` |

## QA Gate por repo

```bash
# Angular
export CHROME_BIN=/path/to/chrome && pnpm run test:ci

# React Native
pnpm test
```

## Lecciones aprendidas

1. **Tests de Storage requieren mock especial**: `from()` debe retornar el mismo mock, `upload/download/resolveTo` no `and.resolveTo`

2. **Cobertura se mide por repo**: 36.71% Angular, ~45% React Native (funciones)

3. **Documentación es parte del feature**: Actualizar MASTERPROMPT.md y ROADMAP.md es obligatorio al cerrar cada sprint

4. **Commits atómicos**: Un feature = un commit = un merge --no-ff

5. **Verificación post-merge**: Ejecutar tests después de cada merge para detectar regresiones temprano

## Próximos pasos

- Subir cobertura Angular al 50%
- Implementar features solo-Angular en React Native (si aplica)
- Agregar features solo-React a Angular (si aplica)
