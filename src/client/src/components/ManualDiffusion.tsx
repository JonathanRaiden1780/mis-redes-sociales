import { useState } from 'react'
import { Copy, Check, MessageCircle, Send, Video, Tv, AtSign } from 'lucide-react'

interface ManualDiffusionProps {
  result: any
}

interface DiffusionKit {
  whatsapp_message: string
  telegram_message: string
  instagram_caption: string
  tiktok_caption: string
  facebook_post: string
  twitter_post: string
  text_overlay: string
  hashtags: string
  cta: string
  image_prompt: string
  video_script: string
}

export default function ManualDiffusion({ result }: ManualDiffusionProps) {
  const [kit, setKit] = useState<DiffusionKit | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  async function prepareDiffusion() {
    setLoading(true)
    try {
      const res = await fetch('/api/diffuse/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: result.raw_idea || 'promoción' }),
      })
      const data = await res.json()
      setKit(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const platforms = [
    { id: 'whatsapp', name: 'WhatsApp', icon: MessageCircle, color: '#25D366', message: kit?.whatsapp_message },
    { id: 'telegram', name: 'Telegram', icon: Send, color: '#0088cc', message: kit?.telegram_message },
    { id: 'instagram', name: 'Instagram', icon: Tv, color: '#E1306C', message: kit?.instagram_caption },
    { id: 'tiktok', name: 'TikTok', icon: Video, color: '#00f2ea', message: kit?.tiktok_caption },
    { id: 'facebook', name: 'Facebook', icon: MessageCircle, color: '#1877F2', message: kit?.facebook_post },
    { id: 'twitter', name: 'X/Twitter', icon: AtSign, color: '#1DA1F2', message: kit?.twitter_post },
  ]

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.5)',
      border: '1px solid #1e293b',
      borderRadius: '12px',
      padding: '24px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Send style={{ width: '16px', height: '16px', color: '#8b5cf6' }} />
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>Difusión Manual</h2>
        </div>
        <button
          onClick={prepareDiffusion}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '6px',
            background: loading ? '#374151' : 'linear-gradient(135deg, #7c3aed, #6366f1)',
            color: 'white',
            border: 'none',
            fontSize: '12px',
            fontWeight: 500,
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? (
            <>
              <div style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              Generando...
            </>
          ) : (
            <>
              <Send style={{ width: '12px', height: '12px' }} />
              Generar Kit
            </>
          )}
        </button>
      </div>

      {!kit && (
        <div style={{ textAlign: 'center', padding: '24px' }}>
          <p style={{ fontSize: '13px', color: '#64748b' }}>
            Genera un kit de difusión manual para copiar y pegar en cualquier plataforma.
            <br />
            No requiere APIs externas.
          </p>
        </div>
      )}

      {kit && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {platforms.map((platform) => {
            const Icon = platform.icon
            return (
              <div
                key={platform.id}
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid #1e293b',
                  borderRadius: '8px',
                  padding: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Icon style={{ width: '14px', height: '14px', color: platform.color }} />
                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'white' }}>{platform.name}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(platform.message || '', platform.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      background: 'transparent',
                      border: '1px solid #1e293b',
                      color: copied === platform.id ? '#34d399' : '#71717a',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                  >
                    {copied === platform.id ? <Check style={{ width: '12px', height: '12px' }} /> : <Copy style={{ width: '12px', height: '12px' }} />}
                    {copied === platform.id ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
                <pre style={{
                  fontSize: '11px',
                  color: '#94a3b8',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'inherit',
                  lineHeight: 1.5
                }}>
                  {platform.message}
                </pre>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}