import { useState } from 'react'

interface AmplifyPanelProps {
  onResult: (result: any) => void
  onLoading: (loading: boolean) => void
  loading: boolean
}

export default function AmplifyPanel({ onResult, onLoading, loading }: AmplifyPanelProps) {
  const [idea, setIdea] = useState('')
  const [style, setStyle] = useState('')

  const examples = [
    'promoción de perfumes 2x800 pesos',
    '2x1 en zapatos 500 pesos, oferta limitada',
    'descuento 30% en electrónica, solo hoy',
    'nueva colección de lujo, exclusivo',
  ]

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
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4">🧠 AI Prompt Amplifier</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Tu idea de promoción</label>
          <textarea
            className="w-full bg-gray-700 text-white p-3 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none resize-none"
            rows={4}
            placeholder="Ej: promoción de perfumes 2x800 pesos"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Estilo (opcional)</label>
          <select
            className="w-full bg-gray-700 text-white p-3 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
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
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors"
        >
          {loading ? '⏳ Amplificando...' : '🚀 Amplificar'}
        </button>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-700">
        <p className="text-xs text-gray-500 mb-2">Ejemplos rápidos:</p>
        <div className="flex flex-wrap gap-1">
          {examples.map((ex, i) => (
            <button
              key={i}
              onClick={() => setIdea(ex)}
              className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            >
              {ex.slice(0, 25)}...
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
