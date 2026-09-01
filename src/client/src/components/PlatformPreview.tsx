import { useState } from 'react'
import { Copy, Check, Edit3, Image, Video, Loader2, AlertCircle } from 'lucide-react'
import type { Platform } from '../types'

interface PlatformPreviewProps {
  platform: Platform
  prompt: string
  format: string
  hashtags: string[]
  color: string
  campaignId: number
}

export default function PlatformPreview({ platform, prompt, format, hashtags, color, campaignId }: PlatformPreviewProps) {
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generatedType, setGeneratedType] = useState<string | null>(null)
  const [generationResult, setGenerationResult] = useState<any>(null)

  function copyToClipboard() {
    navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function generateContent(type: 'image' | 'video') {
    setGenerating(true)
    setGeneratedType(type)
    setGenerationResult(null)
    try {
      const res = await fetch(`/api/generate/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaignId, platform: platform.name.toLowerCase() }),
      })
      const data = await res.json()
      setGenerationResult(data)
    } catch (err) {
      console.error(err)
      setGenerationResult({ success: false, message: 'Error de conexión' })
    } finally {
      setGenerating(false)
      setGeneratedType(null)
    }
  }

  const formatLabels: Record<string, string> = {
    '9:16': 'Story / Reel',
    '16:9': 'Feed Horizontal',
    '1:1': 'Feed Cuadrado',
  }

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.4)',
      border: '1px solid #1e293b',
      borderRadius: '12px',
      padding: '16px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: color + '15',
            border: '1px solid ' + color + '30',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px'
          }}>
            {platform.icon}
          </div>
          <div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>{platform.name}</span>
            <p style={{ fontSize: '11px', color: '#475569' }}>{formatLabels[format] || format}</p>
          </div>
        </div>
        <span style={{ fontSize: '11px', color: '#475569', fontFamily: 'monospace' }}>{format}</span>
      </div>
      
      <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5, marginBottom: '12px' }}>
        {prompt.slice(0, 140)}...
      </p>
      
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
        {hashtags.slice(0, 3).map((tag, i) => (
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
            {tag}
          </span>
        ))}
        {hashtags.length > 3 && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 500,
            background: '#1e293b',
            color: '#52525b'
          }}>
            +{hashtags.length - 3}
          </span>
        )}
      </div>

      {generationResult && (
        <div style={{
          marginBottom: '12px',
          padding: '8px',
          borderRadius: '6px',
          background: generationResult.fallback ? 'rgba(251, 191, 36, 0.1)' : 'rgba(16, 185, 129, 0.1)',
          border: '1px solid ' + (generationResult.fallback ? 'rgba(251, 191, 36, 0.3)' : 'rgba(16, 185, 129, 0.3)')
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {generationResult.fallback ? (
              <AlertCircle style={{ width: '12px', height: '12px', color: '#fbbf24' }} />
            ) : (
              <Check style={{ width: '12px', height: '12px', color: '#34d399' }} />
            )}
            <span style={{ fontSize: '11px', color: generationResult.fallback ? '#fbbf24' : '#34d399' }}>
              {generationResult.fallback ? 'Modo placeholder (Agnes no disponible)' : 'Contenido generado'}
            </span>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '6px', paddingTop: '12px', borderTop: '1px solid #1e293b' }}>
        <button
          onClick={copyToClipboard}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '8px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 500,
            color: '#71717a',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          {copied ? <Check style={{ width: '14px', height: '14px' }} /> : <Copy style={{ width: '14px', height: '14px' }} />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
        <button
          onClick={() => generateContent('image')}
          disabled={generating}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '8px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 500,
            color: generating && generatedType === 'image' ? '#8b5cf6' : '#71717a',
            background: 'transparent',
            border: 'none',
            cursor: generating ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          {generating && generatedType === 'image' ? <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} /> : <Image style={{ width: '14px', height: '14px' }} />}
          Imagen
        </button>
        <button
          onClick={() => generateContent('video')}
          disabled={generating}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '8px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 500,
            color: generating && generatedType === 'video' ? '#8b5cf6' : '#71717a',
            background: 'transparent',
            border: 'none',
            cursor: generating ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          {generating && generatedType === 'video' ? <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} /> : <Video style={{ width: '14px', height: '14px' }} />}
          Video
        </button>
        <button style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          padding: '8px',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: 500,
          color: '#71717a',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.15s ease'
        }}>
          <Edit3 style={{ width: '14px', height: '14px' }} />
          Editar
        </button>
      </div>
    </div>
  )
}
