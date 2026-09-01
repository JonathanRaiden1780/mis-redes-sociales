# Patrón de módulo en MiNegocio (React + Firestore)

Estructura estándar para crear un nuevo módulo/feature en el proyecto MiNegocio.

## Estructura de archivos

```
src/
├── types/index.ts                    # Agregar tipos (interface, type)
├── lib/<feature>Configs.ts           # Configuración dinámica (estatus, opciones)
├── hooks/use<Feature>Collection.ts   # Hook cache-first para Firestore
├── components/<feature>/             # Componentes del módulo
│   ├── <Feature>Form.tsx             # Formulario crear/editar
│   ├── <Feature>BitacoraForm.tsx     # Formulario de bitácora (si aplica)
│   └── <Feature>Library.tsx          # Biblioteca de estrategias (si aplica)
├── pages/<Feature>.tsx               # Página principal con tabs/filtros
├── App.tsx                           # Import + Route
├── components/layout/DashboardLayout.tsx  # Nav item + icono
└── firestore.rules                   # Regla sameBusiness + admin delete
```

## Imports por nivel

| Archivo | Nivel | Imports usan |
|---|---|---|
| `src/pages/X.tsx` | 2 | `../lib/`, `../context/`, `../types/`, `../hooks/`, `../components/` |
| `src/hooks/X.tsx` | 2 | `../lib/`, `../firestoreClient` |
| `src/components/x/X.tsx` | 3 | `../../lib/`, `../../context/`, `../../types/` |
| `src/lib/X.ts` | 2 | `./firebase`, `./firestoreClient` |

## Patrón Firestore (cache-first)

```typescript
// hooks/use<Feature>Collection.ts
import { useEffect, useRef, useState, useMemo } from 'react';
import { collection, query, where, limit, type Query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { cacheFirstGetDocs, serverGetDocs } from '../lib/firestoreClient';
import { mapDocs, type WithId } from '../lib/firestoreMappers';

const buildQuery = useMemo((): Query | null => {
  if (!businessId) return null;
  return query(collection(db, 'leads'), where('businessId', '==', businessId), limit(500));
}, [businessId]);

useEffect(() => {
  cacheFirstGetDocs('leads/list', q)
    .then((snap) => {
      const items = mapDocs(snap) as unknown as Array<WithId<Lead>>;
      items.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
      setDocs(items);
    });
}, [enabled, businessId, buildQuery]);
```

## Patrón de reglas Firestore

```javascript
match /leads/{id} {
  allow read: if sameBusiness(resource.data);
  allow create: if sameBusiness(request.resource.data);
  allow update: if sameBusiness(resource.data) && sameBusiness(request.resource.data);
  allow delete: if isAdmin() && sameBusiness(resource.data);
}
```

## Verificación obligatoria

```bash
pnpm run build   # Debe pasar sin errores
pnpm run lint    # 0 errores (warnings preexistentes OK)
pnpm run test    # Sin fallos nuevos
```

## Documentación obligatoria

Al cerrar cada feature:
1. Actualizar `MASTERPROMPT.md` (arquitectura, flujos, colecciones, memoria)
2. Actualizar `docs/ROADMAP.md` (fases, métricas)
