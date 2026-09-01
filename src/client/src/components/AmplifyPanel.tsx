import { useState } from 'react'

interface AmplifyPanelProps {
  onResult: (result: any) => void
  onLoading: (loading: boolean) => void
  loading: boolean
}

const examples = [
  { text: 'promoción de perfumes 2x800 pesos', icon: '🌸' },
  { text: '2x1 en zapatos 500 pesos', icon: '👟' },
  { text: 'descuento 30% en electrónica', icon: '💻' },
  { text: 'nueva colección de lujo', icon: '✨' },
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
    <div className="card p-6 sticky top-24">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-2xl">🧠</span>
        <h2 className="text-lg font-bold">AI Prompt Amplifier</h2>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Tu idea de promoción
          </label>
          <textarea
            className="input-field w-full text-white p-4 rounded-xl resize-none text-sm"
            rows={4}
            placeholder="Ej: promoción de perfumes 2x800 pesos"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Estilo (opcional)
          </label>
          <select
            className="input-field w-full text-white p-3 rounded-xl text-sm"
            value={style}
            onChange={(e) => setStyle(e.target.value)}
          >
            <option value="">🎯 Auto-detectar</option>
            <option value="luxury">💎 Lujo</option>
            <option value="premium">⭐ Premium</option>
            <option value="elegant">🌙 Elegante</option>
            <option value="budget">💰 Económico</option>
            <option value="trending">🔥 Tendencia</option>
            <option value="hot">🌶️ Hot</option>
          </select>
        </div>

        <button
          onClick={handleAmplify}
          disabled={loading || !idea.trim()}
          className="btn-primary w-full text-white px-6 py-3.5 rounded-xl font-semibold text-sm"
        >
          {loading ? '⏳ Amplificando...' : '🚀 Amplificar Idea'}
        </button>
      </div>

      <div className="mt-6 pt-6 border-t border-white/5">
        <p className="text-xs text-gray-500 mb-3">Ejemplos rápidos:</p>
        <div className="grid grid-cols-2 gap-2">
          {examples.map((ex, i) => (
            <button
              key={i}
              onClick={() => setIdea(ex.text)}
              className="text-xs px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all text-left"
            >
              <span className="mr-1">{ex.icon}</span>
              {ex.text.slice(0, 18)}...
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
