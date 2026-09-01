import { useState } from 'react'
import { Sparkles, Wand2 } from 'lucide-react'

interface AmplifyPanelProps {
  onResult: (result: any) => void
  onLoading: (loading: boolean) => void
  loading: boolean
}

const examples = [
  { text: 'promoción de perfumes 2x800 pesos', icon: '🌸' },
  { text: '2x1 en zapatos 500 pesos, oferta limitada', icon: '👟' },
  { text: 'descuento 30% en electrónica, solo hoy', icon: '💻' },
  { text: 'nueva colección de lujo, exclusivo', icon: '✨' },
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
    <div className="card space-y-5">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
          <Wand2 className="w-4 h-4 text-purple-400" />
        </div>
        <h2 className="text-sm font-semibold text-white">Prompt de Amplificación</h2>
      </div>

      <div className="space-y-4">
        {/* Idea Input */}
        <div>
          <label className="label" htmlFor="idea-input">Tu idea</label>
          <div className="relative">
            <textarea
              id="idea-input"
              className="input-field resize-none pr-14"
              rows={4}
              placeholder="Ej: promoción de perfumes 2x800 pesos"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              maxLength={500}
            />
            <span className="absolute bottom-3 right-3 text-tertiary">{idea.length}/500</span>
          </div>
        </div>

        {/* Style Selector */}
        <div>
          <label className="label" htmlFor="style-select">Estilo</label>
          <select
            id="style-select"
            className="input-field"
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

        {/* Amplify Button */}
        <button
          onClick={handleAmplify}
          disabled={loading || !idea.trim()}
          className="btn-primary"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Amplificando...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Amplificar Idea
            </>
          )}
        </button>
      </div>

      <div className="divider" />

      {/* Examples */}
      <div>
        <p className="text-tertiary mb-2">Sugerencias rápidas</p>
        <div className="flex flex-wrap gap-2">
          {examples.map((ex, i) => (
            <button
              key={i}
              onClick={() => setIdea(ex.text)}
              className="chip"
            >
              <span>{ex.icon}</span>
              {ex.text.length > 24 ? ex.text.slice(0, 24) + '...' : ex.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
