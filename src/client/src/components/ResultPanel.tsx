import type { AmplifyResponse } from '../types'
import { Copy, Check, Sparkles } from 'lucide-react'
import { useState } from 'react'

interface ResultPanelProps {
  result: AmplifyResponse
}

export default function ResultPanel({ result }: ResultPanelProps) {
  const [copied, setCopied] = useState<string | null>(null)

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.5)',
      border: '1px solid #1e293b',
      borderRadius: '12px',
      padding: '24px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles style={{ width: '16px', height: '16px', color: '#8b5cf6' }} />
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>Resultado</h2>
        </div>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 500,
          background: 'rgba(16, 185, 129, 0.1)',
          color: '#34d399'
        }}>
          Generado
        </span>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
          <p style={{ fontSize: '11px', color: '#475569', marginBottom: '2px' }}>Venta</p>
          <p style={{ fontSize: '13px', fontWeight: 500, color: 'white' }}>{result.sale_type}</p>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
          <p style={{ fontSize: '11px', color: '#475569', marginBottom: '2px' }}>Emoción</p>
          <p style={{ fontSize: '13px', fontWeight: 500, color: 'white' }}>{result.emotion}</p>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
          <p style={{ fontSize: '11px', color: '#475569', marginBottom: '2px' }}>Tono</p>
          <p style={{ fontSize: '13px', fontWeight: 500, color: 'white' }}>{result.tone}</p>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
          <p style={{ fontSize: '11px', color: '#475569', marginBottom: '2px' }}>Estilo</p>
          <p style={{ fontSize: '13px', fontWeight: 500, color: 'white' }}>{result.style}</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
          <p style={{ fontSize: '11px', color: '#475569', marginBottom: '4px' }}>Texto Overlay</p>
          <p style={{ fontSize: '18px', fontWeight: 700, color: 'white' }}>{result.text_overlay}</p>
        </div>
        
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
          <p style={{ fontSize: '11px', color: '#475569', marginBottom: '4px' }}>Call to Action</p>
          <p style={{ fontSize: '14px', color: 'white' }}>{result.cta}</p>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
          <p style={{ fontSize: '11px', color: '#475569', marginBottom: '8px' }}>Triggers Psicológicos</p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {result.psychological_triggers.map((t, i) => (
              <span key={i} style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 500,
                background: 'rgba(251, 146, 60, 0.1)',
                color: '#fb923c'
              }}>
                {t}
              </span>
            ))}
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
          <p style={{ fontSize: '11px', color: '#475569', marginBottom: '8px' }}>Paleta de Colores</p>
          <div style={{ display: 'flex', gap: '6px' }}>
            {result.color_palette.map((c, i) => (
              <div
                key={i}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '4px',
                  background: c,
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
                title={c}
              />
            ))}
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
          <p style={{ fontSize: '11px', color: '#475569', marginBottom: '8px' }}>Hashtags</p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {result.hashtags.map((h, i) => (
              <span key={i} style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 500,
                background: 'rgba(59, 130, 246, 0.1)',
                color: '#60a5fa'
              }}>
                {h}
              </span>
            ))}
          </div>
        </div>

        {result.diffusion_message && (
          <div style={{ paddingTop: '12px', borderTop: '1px solid #1e293b' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <p style={{ fontSize: '11px', color: '#475569' }}>Difusión WhatsApp</p>
              <button
                onClick={() => copyToClipboard(result.diffusion_message, 'wa')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  color: '#71717a',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                {copied === 'wa' ? <Check style={{ width: '12px', height: '12px' }} /> : <Copy style={{ width: '12px', height: '12px' }} />}
                {copied === 'wa' ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <pre style={{
              fontSize: '12px',
              color: '#a1a1aa',
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace',
              background: '#09090b',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #1e293b'
            }}>
              {result.diffusion_message}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
