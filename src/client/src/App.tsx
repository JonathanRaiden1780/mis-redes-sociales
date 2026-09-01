import { useState, useEffect } from 'react'
import { Sparkles, Zap, LayoutDashboard, History, Settings, Trash2 } from 'lucide-react'
import AmplifyPanel from './components/AmplifyPanel'
import ResultPanel from './components/ResultPanel'
import PlatformGrid from './components/PlatformGrid'
import ManualDiffusion from './components/ManualDiffusion'
import WhatsAppPanel from './components/WhatsAppPanel'
import HistoryScreen from './components/HistoryScreen'
import SettingsScreen from './components/SettingsScreen'
import type { AmplifyResponse } from './types'

type Screen = 'dashboard' | 'history' | 'settings'

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

function Header({ currentScreen, onNavigate }: { currentScreen: Screen; onNavigate: (s: Screen) => void }) {
  const navItems = [
    { id: 'dashboard' as Screen, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'history' as Screen, label: 'Historial', icon: History },
    { id: 'settings' as Screen, label: 'Configuración', icon: Settings },
  ]

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
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
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = currentScreen === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: isActive ? 'white' : '#94a3b8',
                    background: isActive ? 'rgba(255,255,255,0.05)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon style={{ width: '14px', height: '14px' }} />
                  {item.label}
                </button>
              )
            })}
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
        </div>
      </div>
    </header>
  )
}

function Dashboard() {
  const [result, setResult] = useState<AmplifyResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [currentCampaignId, setCurrentCampaignId] = useState<number | null>(null)

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

  function handleResult(data: any) {
    setResult(data)
    if (data.campaign_id) {
      setCurrentCampaignId(data.campaign_id)
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'white', marginBottom: '8px' }}>
        Amplificador de Contenido
      </h1>
      <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '32px', maxWidth: '448px' }}>
        Transforma una idea simple en publicaciones optimizadas para todas tus redes en segundos.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <AmplifyPanel
            onResult={handleResult}
            onLoading={setLoading}
            loading={loading}
            onSaved={loadCampaigns}
          />
          <div style={{
            background: 'rgba(15, 23, 42, 0.5)',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '16px'
          }}>
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'white', marginBottom: '12px' }}>
              Historial Reciente
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
              {campaigns.slice(0, 5).map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.02)'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '12px', fontWeight: 500, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.name}
                    </p>
                    <p style={{ fontSize: '11px', color: '#64748b' }}>{c.sale_type} · {c.created_at?.slice(0, 10)}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(c.id)}
                    style={{ padding: '4px', background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer' }}
                  >
                    <Trash2 style={{ width: '12px', height: '12px' }} />
                  </button>
                </div>
              ))}
            </div>
          </div>
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
              <div style={{ width: '40px', height: '40px', border: '3px solid rgba(139, 92, 246, 0.3)', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <span style={{ marginTop: '16px', color: '#94a3b8' }}>Amplificando tu idea...</span>
            </div>
          ) : result ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <ResultPanel result={result} />
              <PlatformGrid result={result} campaignId={currentCampaignId || 0} />
              <ManualDiffusion result={result} />
              <WhatsAppPanel campaignId={currentCampaignId || 0} />
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
    </div>
  )
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard')

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0' }}>
      <Header currentScreen={currentScreen} onNavigate={setCurrentScreen} />
      <main style={{ maxWidth: '1152px', margin: '0 auto', padding: '32px 24px' }}>
        {currentScreen === 'dashboard' && <Dashboard />}
        {currentScreen === 'history' && <HistoryScreen />}
        {currentScreen === 'settings' && <SettingsScreen />}
      </main>
    </div>
  )
}