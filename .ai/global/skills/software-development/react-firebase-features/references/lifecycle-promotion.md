# Lifecycle Stage Promotion (Prospect → Inicio)

**Used in:** `src/pages/Starts.tsx` (Inicios/Prospectos module)  
**Date:** 2026-08-19

## Pattern

When a lead moves between lifecycle stages (e.g., prospect → inicio), use a dedicated "promote" action rather than just a status change. This preserves the audit trail in bitácora and prevents accidental transitions.

## The rule

Use a confirmation dialog + bitácora entry when promoting a lead to the next lifecycle stage. The action button should only appear on the tab where promotion is logical (e.g., "Promover a Inicio" only on `prospect` tab).

```typescript
const handlePromoteToInicio = async (lead: Lead) => {
  if (isDemo || !lead) return;
  if (!window.confirm(`¿Promover a "${lead.name}" a Inicio?`)) return;
  setSaving(true);
  try {
    const entry: BitacoraEntry = {
      id: Date.now().toString(),
      type: 'note',
      content: 'Promovido de Prospecto a Inicio',
      createdAt: Date.now(),
      authorUid: userProfile?.uid,
      authorName: userProfile?.displayName,
    };
    const updatedBitacora = [...(lead.bitacora || []), entry];
    await updateDoc(doc(db, 'leads', lead.id), {
      lifecycle: 'inicio',
      bitacora: updatedBitacora,
      updatedAt: serverTimestamp(),
      lastActivityAt: Date.now(),
    });
    touchBusinessMetaDebounced(businessId, 4000);
    await reloadFromServer();
    alert(`"${lead.name}" fue promovido a Inicio exitosamente`);
  } catch (error) {
    console.error('Error promoting to inicio:', error);
    alert('Error al promover a inicio');
  } finally {
    setSaving(false);
  }
};
```

## UI placement

Place the "Promote" button in the card action bar, only on the source tab:

```typescript
{activeTab === 'prospect' && (
  <button
    onClick={(e) => { e.stopPropagation(); handlePromoteToInicio(lead); }}
    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors border border-indigo-200"
  >
    <TrendingUp className="w-3 h-3" />
    Promover a Inicio
  </button>
)}
```

## Why a dedicated promote action (not just status change)?

1. **Audit trail** — Promotions are significant funnel events; they deserve a bitácora entry
2. **Confirmation** — Prevents accidental drag-and-drop between lifecycle stages
3. **Analytics** — Tracking conversion rates between stages requires explicit events
4. **User intent** — "Promover" signals a deliberate business action, not just reclassification

## Pitfall

Don't conflate lifecycle stages with status. A lead can be `prospect` lifecycle with status `listo_para_iniciar`. The promotion action changes the lifecycle (affecting which tab it appears in), not the status (which reflects where they are in the sales process).
