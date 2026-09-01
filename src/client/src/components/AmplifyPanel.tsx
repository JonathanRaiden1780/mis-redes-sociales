import { useState } from 'react'
import { Sparkles, Wand2, Type, Palette, TrendingUp, Crown, Gem, Flame, DollarSign } from 'lucide-react'

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

const styleOptions = [
  { value: '', label: 'Auto-detectar', icon: Sparkles },
  { value: 'luxury', label: 'Lujo', icon: Gem },
  { value: 'premium', label: 'Premium', icon: Crown },
  { value: 'elegant', label: 'Elegante', icon: Palette },
  { value: 'budget', label: 'Económico', icon: DollarSign },
  { value: 'trending', label: 'Tendencia', icon: TrendingUp },
  { value: 'hot', label: 'Hot', icon: Flame },
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
    <div className="space-y-6 sticky top-24">
      {/* Input Card */}
      <div className="surface p-6 glow-purple">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <Wand2 className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Prompt de Amplificación</h2>
            <p className="text-tertrix">Convierte tu idea en contenido para redes</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Idea Input */}
          <div>
            <label className="label" htmlFor="idea-input">
              <span className="flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5" />
                Tu idea
              </span>
            </label>
            <div className="relative">
              <textarea
                id="idea-input"
                className="input-ai resize-none pr-12"
                rows={4}
                placeholder="Ej: promoción de perfumes 2x800 pesos"
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                maxLength={500}
              />
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                <span className="text-tertiary text-xs">{idea.length}/500</span>
                <Sparkles className="w-4 h-4 text-violet-400/50" />
              </div>
            </div>
          </div>

          {/* Style Selector */}
          <div>
            <label className="label" htmlFor="style-select">
              <span className="flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5" />
                Estilo
              </span>
            </label>
            <select
              id="style-select"
              className="input-ai"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
            >
              {styleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Amplify Button */}
          <button
            onClick={handleAmplify}
            disabled={loading || !idea.trim()}
            className="btn btn-primary w-full py-3.5"
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
      </div>

      {/* Examples Card */}
      <div className="surface p-5">
        <p className="text-tertiary mb-3">Ejemplos rápidos</p>
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
