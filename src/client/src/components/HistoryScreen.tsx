import { useState, useEffect } from 'react'
import { History, Trash2, Eye, Copy, Check } from 'lucide-react'

interface HistoryItem {
  id: number
  name: string
  raw_idea: string
  sale_type: string
  emotion: string
  tone: string
  style: string
  status: string
  created_at: string
  platforms: string[]
  diffusion_message: string
}

export default function HistoryScreen() {
  const [campaigns, setCampaigns] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<HistoryItem | null>(null)
  const [copied, setCopied] = useState(false)

  async function loadCampaigns() {
    setLoading(true)
    try {
      const res = await fetch('/api/campaigns/')
      const data = await res.json()
      setCampaigns(data.campaigns || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCampaigns()
  }, [])

  async function deleteCampaign(id: number) {
    if (!confirm('¿Eliminar esta campaña?')) return
    try {
      await fetch(`/api/campaigns/${id}`, { method: 'DELETE' })
      loadCampaigns()
      if (selected?.id === id) setSelected(null)
    } catch (err) {
      console.error(err)
    }
  }

  function copyMessage(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
      {/* Campaign List */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.5)',
        border: '1px solid #1e293b',
        borderRadius: '12px',
        padding: '20px',
        maxHeight: '600px',
        overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <History style={{ width: '16px', height: '16px', color: '#8b5cf6' }} />
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>Historial de Campañas</h2>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px' }}>
            <div style={{ width: '24px', height: '24px', border: '2px solid rgba(139, 92, 246, 0.3)', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          </div>
        ) : campaigns.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', padding: '32px' }}>
            No hay campañas aún
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {campaigns.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelected(c)}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: selected?.id === c.id ? 'rgba(139, 92, 246, 0.1)' : 'rgba(255,255,255,0.02)',
                  border: selected?.id === c.id ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.name}
                    </p>
                    <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                      {c.sale_type} · {c.emotion} · {c.created_at?.slice(0, 10)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteCampaign(c.id) }}
                    style={{ padding: '4px', background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer' }}
                  >
                    <Trash2 style={{ width: '14px', height: '14px' }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Campaign Detail */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.5)',
        border: '1px solid #1e293b',
        borderRadius: '12px',
        padding: '20px',
        maxHeight: '600px',
        overflowY: 'auto'
      }}>
        {!selected ? (
          <div style={{ textAlign: 'center', padding: '48px 16px' }}>
            <Eye style={{ width: '32px', height: '32px', color: '#475569', margin: '0 auto 12px' }} />
            <p style={{ fontSize: '13px', color: '#64748b' }}>Selecciona una campaña para ver detalles</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'white' }}>{selected.name}</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px' }}>
                <p style={{ fontSize: '11px', color: '#475569' }}>Venta</p>
                <p style={{ fontSize: '12px', color: 'white' }}>{selected.sale_type}</p>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px' }}>
                <p style={{ fontSize: '11px', color: '#475569' }}>Emoción</p>
                <p style={{ fontSize: '12px', color: 'white' }}>{selected.emotion}</p>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px' }}>
                <p style={{ fontSize: '11px', color: '#475569' }}>Tono</p>
                <p style={{ fontSize: '12px', color: 'white' }}>{selected.tone}</p>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px' }}>
                <p style={{ fontSize: '11px', color: '#475569' }}>Estilo</p>
                <p style={{ fontSize: '12px', color: 'white' }}>{selected.style}</p>
              </div>
            </div>

            <div>
              <p style={{ fontSize: '11px', color: '#475569', marginBottom: '4px' }}>Idea Original</p>
              <p style={{ fontSize: '13px', color: '#94a3b8' }}>{selected.raw_idea}</p>
            </div>

            {selected.diffusion_message && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <p style={{ fontSize: '11px', color: '#475569' }}>Mensaje de Difusión</p>
                  <button
                    onClick={() => copyMessage(selected.diffusion_message)}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', color: '#71717a', fontSize: '11px', cursor: 'pointer' }}
                  >
                    {copied ? <Check style={{ width: '12px', height: '12px' }} /> : <Copy style={{ width: '12px', height: '12px' }} />}
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
                <pre style={{ fontSize: '12px', color: '#94a3b8', whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '6px' }}>
                  {selected.diffusion_message}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}