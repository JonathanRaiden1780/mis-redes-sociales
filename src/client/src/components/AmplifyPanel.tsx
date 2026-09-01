import { useState } from 'react'
import { Sparkles, Wand2 } from 'lucide-react'

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
    <div style={{
      background: 'rgba(15, 23, 42, 0.5)',
      border: '1px solid #1e293b',
      borderRadius: '12px',
      padding: '24px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: 'rgba(139, 92, 246, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Wand2 style={{ width: '16px', height: '16px', color: '#8b5cf6' }} />
        </div>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>Prompt de Amplificación</h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>
            Tu idea
          </label>
          <div style={{ position: 'relative' }}>
            <textarea
              style={{
                width: '100%',
                padding: '12px 14px',
                background: 'rgba(2, 6, 23, 0.8)',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '14px',
                lineHeight: 1.5,
                resize: 'none',
                minHeight: '80px'
              }}
              rows={3}
              placeholder="Ej: promoción de perfumes 2x800 pesos"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              maxLength={500}
            />
            <span style={{
              position: 'absolute',
              bottom: '8px',
              right: '12px',
              fontSize: '11px',
              color: '#475569'
            }}>
              {idea.length}/500
            </span>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>
            Estilo
          </label>
          <select
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'rgba(2, 6, 23, 0.8)',
              border: '1px solid #1e293b',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '14px'
            }}
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
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            width: '100%',
            padding: '12px 20px',
            background: loading || !idea.trim() ? '#374151' : 'linear-gradient(135deg, #7c3aed, #6366f1)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: loading || !idea.trim() ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          {loading ? (
            <>
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: 'white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              Amplificando...
            </>
          ) : (
            <>
              <Sparkles style={{ width: '16px', height: '16px' }} />
              Amplificar Idea
            </>
          )}
        </button>
      </div>

      <div style={{ height: '1px', background: '#1e293b', margin: '20px 0' }} />

      <div>
        <p style={{ fontSize: '12px', color: '#475569', marginBottom: '8px' }}>Sugerencias rápidas</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {examples.map((ex, i) => (
            <button
              key={i}
              onClick={() => setIdea(ex)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                background: 'rgba(30, 41, 59, 0.4)',
                border: '1px solid #1e293b',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#94a3b8',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {ex.length > 24 ? ex.slice(0, 24) + '...' : ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
