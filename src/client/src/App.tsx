import { useState, useEffect } from 'react'
import { Sparkles, Zap, LayoutDashboard, History, Settings, Trash2, RotateCcw } from 'lucide-react'
import AmplifyPanel from './components/AmplifyPanel'
import ResultPanel from './components/ResultPanel'
import PlatformGrid from './components/PlatformGrid'
import type { AmplifyResponse } from './types'

interface Campaign {
  id: number
  name: string
  raw_idea: string
  sale_type: string
  emotion: string
  tone: string
  style: string
  status: string
  created_at: string
}

function Header() {
  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      background: 'rgba(15, 23, 42, 0.9)',
      backdropFilter: 'blur(8px)',
      borderBottom: '1px solid #1e293b'
    }}>
      <div style={{
        maxWidth: '1152px',
        margin: '0 auto',
        padding: '0 24px',
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Zap style={{ width: '16px', height: '16px', color: 'white' }} />
            </div>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>Mis Redes</span>
            <span style={{ fontSize: '11px', color: '#64748b' }}>v0.1</span>
          </a>
          <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <a href="#" style={{
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
              color: 'white',
              background: 'rgba(255,255,255,0.05)',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <LayoutDashboard style={{ width: '14px', height: '14px' }} />
              Dashboard
            </a>
            <a href="#" style={{
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#94a3b8',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <History style={{ width: '14px', height: '14px' }} />
              Historial
            </a>
            <a href="#" style={{
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#94a3b8',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Settings style={{ width: '14px', height: '14px' }} />
              Configuración
            </a>
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '9999px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.2)'
          }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
            <span style={{ fontSize: '11px', fontWeight: 500, color: '#34d399' }}>Activo</span>
          </div>
          <button style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: '6px',
            background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
            color: 'white',
            border: 'none',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer'
          }}>
            <Sparkles style={{ width: '14px', height: '14px' }} />
            Nuevo
          </button>
        </div>
      </div>
    </header>
  )
}

function CampaignHistory({ 
  campaigns, 
  onSelect, 
  onDelete,
}: { 
  campaigns: Campaign[]
  onSelect: (idea: string) => void
  onDelete: (id: number) => void
}) {
  if (campaigns.length === 0) {
    return (
      <div style={{
        background: 'rgba(15, 23, 42, 0.5)',
        border: '1px solid #1e293b',
        borderRadius: '12px',
        padding: '24px',
        textAlign: 'center'
      }}>
        <p style={{ fontSize: '13px', color: '#64748b' }}>No hay campañas aún</p>
      </div>
    )
  }

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.5)',
      border: '1px solid #1e293b',
      borderRadius: '12px',
      padding: '16px'
    }}>
      <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'white', marginBottom: '12px' }}>
        Historial de Campañas
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
        {campaigns.map((c) => (
          <div
            key={c.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '12px', fontWeight: 500, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.name}
              </p>
              <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                {c.sale_type} · {c.emotion} · {c.created_at?.slice(0, 10)}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
              <button
                onClick={() => onSelect(c.raw_idea)}
                title="Reutilizar"
                style={{
                  padding: '4px',
                  borderRadius: '4px',
                  background: 'transparent',
                  border: 'none',
                  color: '#71717a',
                  cursor: 'pointer'
                }}
              >
                <RotateCcw style={{ width: '14px', height: '14px' }} />
              </button>
              <button
                onClick={() => onDelete(c.id)}
                title="Eliminar"
                style={{
                  padding: '4px',
                  borderRadius: '4px',
                  background: 'transparent',
                  border: 'none',
                  color: '#71717a',
                  cursor: 'pointer'
                }}
              >
                <Trash2 style={{ width: '14px', height: '14px' }} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const [result, setResult] = useState<AmplifyResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])

  async function loadCampaigns() {
    try {
      const res = await fetch('/api/campaigns/')
      const data = await res.json()
      setCampaigns(data.campaigns || [])
    } catch (err) {
      console.error('Failed to load campaigns:', err)
    }
  }

  useEffect(() => {
    loadCampaigns()
  }, [])

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar esta campaña?')) return
    try {
      await fetch(`/api/campaigns/${id}`, { method: 'DELETE' })
      loadCampaigns()
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }


  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0' }}>
      <Header />
      <main style={{ maxWidth: '1152px', margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'white', marginBottom: '8px' }}>
          Amplificador de Contenido
        </h1>
        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '32px', maxWidth: '448px' }}>
          Transforma una idea simple en publicaciones optimizadas para todas tus redes en segundos.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '32px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <AmplifyPanel 
              onResult={setResult} 
              onLoading={setLoading}
              loading={loading}
              onSaved={loadCampaigns}
            />
            <CampaignHistory 
              campaigns={campaigns}
              onSelect={(idea) => {
                const input = document.getElementById('idea-input') as HTMLTextAreaElement
                if (input) input.value = idea
              }}
              onDelete={handleDelete}
            />
          </div>
          <div>
            {loading ? (
              <div style={{
                background: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid #1e293b',
                borderRadius: '12px',
                padding: '48px',
                minHeight: '400px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  border: '3px solid rgba(139, 92, 246, 0.3)',
                  borderTopColor: '#8b5cf6',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                <span style={{ marginTop: '16px', color: '#94a3b8' }}>Amplificando tu idea...</span>
              </div>
            ) : result ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <ResultPanel result={result} />
                <PlatformGrid result={result} />
              </div>
            ) : (
              <div style={{
                background: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid #1e293b',
                borderRadius: '12px',
                padding: '48px',
                minHeight: '400px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center'
              }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  background: 'rgba(139, 92, 246, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px'
                }}>
                  <Sparkles style={{ width: '24px', height: '24px', color: '#8b5cf6' }} />
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'white', marginBottom: '4px' }}>
                  Sin resultado aún
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '280px' }}>
                  Introduce tu idea de promoción y presiona Amplificar para generar contenido optimizado.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
