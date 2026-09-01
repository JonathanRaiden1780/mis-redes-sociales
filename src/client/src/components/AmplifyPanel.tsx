import { useState } from 'react'

interface AmplifyPanelProps {
  onResult: (result: any) => void
  onLoading: (loading: boolean) => void
  loading: boolean
}

const examples = [
  'promoción de perfumes 2x800 pesos',
  '2x1 en zapatos 500 pesos, oferta limitada',
  'descuento 30% en electrónica, solo hoy',
  'nueva colección de lujo, exclusivo',
]

export default function AmplifyPanel({ onResult, onLoading, loading }: AmplifyPanelProps) {
  const [idea, setIdea] = useState('')
  const [style, setStyle] = useState('')

  async function handleAmplify() {
    if (!idea.trim()) return
    onLoading(true)
    try {
      const res = await fetch('/api/amplify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea, style_override: style || undefined }),
      })
      const data = await res.json()
      onResult(data)
    } catch (err) {
      console.error(err)
    } finally {
      onLoading(false)
    }
  }

  return (
    <div className="surface p-5 space-y-5">
      <div>
        <h2 className="text-sm font-medium text-white mb-1">Prompt de Amplificación</h2>
        <p className="text-tertiary">Convierte tu idea en contenido para redes</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="idea-input">Tu idea</label>
          <textarea
            id="idea-input"
            className="input resize-none"
            rows={3}
            placeholder="Ej: promoción de perfumes 2x800 pesos"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="style-select">Estilo</label>
          <select
            id="style-select"
            className="input"
            value={style}
            onChange={(e) => setStyle(e.target.value)}
          >
            <option value="">Auto-detectar</option>
            <option value="luxury">Lujo</option>
            <option value="premium">Premium</option>
            <option value="elegant">Elegante</option>
            <option value="budget">Económico</option>
            <option value="trending">Tendencia</option>
            <option value="hot">Hot</option>
          </select>
        </div>

        <button
          onClick={handleAmplify}
          disabled={loading || !idea.trim()}
          className="btn btn-primary w-full"
        >
          {loading ? 'Amplificando...' : 'Amplificar'}
        </button>
      </div>

      <div className="divider" />

      <div>
        <p className="text-tertiary mb-2">Ejemplos</p>
        <div className="flex flex-wrap gap-1.5">
          {examples.map((ex, i) => (
            <button
              key={i}
              onClick={() => setIdea(ex)}
              className="text-xs px-2.5 py-1.5 rounded-md border border-[#27272a] text-[#71717a] hover:text-white hover:border-[#3f3f46] transition-colors"
            >
              {ex.length > 28 ? ex.slice(0, 28) + '...' : ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
