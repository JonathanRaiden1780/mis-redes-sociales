import { useState, useEffect } from 'react'
import { Settings, Key, MessageCircle, Image, Check, X, Eye, EyeOff } from 'lucide-react'

interface ConfigState {
  agnes_url: string
  agnes_key: string
  twilio_sid: string
  twilio_token: string
  twilio_number: string
  instagram_token: string
  instagram_account: string
  tiktok_token: string
  tiktok_key: string
  facebook_token: string
  facebook_page: string
}

export default function SettingsScreen() {
  const [config, setConfig] = useState<ConfigState>({
    agnes_url: 'http://localhost:8765',
    agnes_key: '',
    twilio_sid: '',
    twilio_token: '',
    twilio_number: 'whatsapp:+14155238886',
    instagram_token: '',
    instagram_account: '',
    tiktok_token: '',
    tiktok_key: '',
    facebook_token: '',
    facebook_page: '',
  })
  const [showSecrets, setShowSecrets] = useState(false)
  const [saved, setSaved] = useState(false)
  const [status, setStatus] = useState<any>({})

  useEffect(() => {
    loadStatus()
  }, [])

  async function loadStatus() {
    try {
      const [waRes, pubRes] = await Promise.all([
        fetch('/api/whatsapp/config'),
        fetch('/api/publish/config'),
      ])
      const wa = await waRes.json()
      const pub = await pubRes.json()
      setStatus({ whatsapp: wa, publish: pub })
    } catch (err) {
      console.error(err)
    }
  }

  function handleChange(key: keyof ConfigState, value: string) {
    setConfig(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  async function saveConfig() {
    // In a real app, this would save to backend/env
    // For now, show success message
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const StatusBadge = ({ configured }: { configured: boolean }) => (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: 500,
      background: configured ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
      color: configured ? '#34d399' : '#ef4444'
    }}>
      {configured ? <Check style={{ width: '12px', height: '12px' }} /> : <X style={{ width: '12px', height: '12px' }} />}
      {configured ? 'Configurado' : 'No configurado'}
    </span>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
      {/* Services Status */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.5)',
        border: '1px solid #1e293b',
        borderRadius: '12px',
        padding: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Settings style={{ width: '16px', height: '16px', color: '#8b5cf6' }} />
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>Estado de Servicios</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Image style={{ width: '16px', height: '16px', color: '#8b5cf6' }} />
              <span style={{ fontSize: '13px', color: 'white' }}>Agnes Video Generator</span>
            </div>
            <span style={{ fontSize: '11px', color: '#64748b' }}>{config.agnes_url}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageCircle style={{ width: '16px', height: '16px', color: '#25D366' }} />
              <span style={{ fontSize: '13px', color: 'white' }}>WhatsApp (Twilio)</span>
            </div>
            <StatusBadge configured={status.whatsapp?.configured || false} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>📸</span>
              <span style={{ fontSize: '13px', color: 'white' }}>Instagram</span>
            </div>
            <StatusBadge configured={status.publish?.instagram?.configured || false} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>🎵</span>
              <span style={{ fontSize: '13px', color: 'white' }}>TikTok</span>
            </div>
            <StatusBadge configured={status.publish?.tiktok?.configured || false} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>👥</span>
              <span style={{ fontSize: '13px', color: 'white' }}>Facebook</span>
            </div>
            <StatusBadge configured={status.publish?.facebook?.configured || false} />
          </div>
        </div>
      </div>

      {/* Configuration Form */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.5)',
        border: '1px solid #1e293b',
        borderRadius: '12px',
        padding: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Key style={{ width: '16px', height: '16px', color: '#8b5cf6' }} />
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>Configuración de APIs</h2>
          </div>
          <button
            onClick={() => setShowSecrets(!showSecrets)}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'transparent', border: '1px solid #1e293b', borderRadius: '4px', padding: '4px 8px', color: '#71717a', fontSize: '11px', cursor: 'pointer' }}
          >
            {showSecrets ? <EyeOff style={{ width: '12px', height: '12px' }} /> : <Eye style={{ width: '12px', height: '12px' }} />}
            {showSecrets ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Agnes */}
          <div>
            <p style={{ fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '8px' }}>Agnes Video Generator</p>
            <input
              type="text"
              placeholder="URL (ej: http://localhost:8765)"
              value={config.agnes_url}
              onChange={(e) => handleChange('agnes_url', e.target.value)}
              style={{ width: '100%', padding: '8px 12px', background: 'rgba(2, 6, 23, 0.8)', border: '1px solid #1e293b', borderRadius: '6px', color: '#f8fafc', fontSize: '13px', marginBottom: '8px' }}
            />
          </div>

          {/* Twilio */}
          <div>
            <p style={{ fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '8px' }}>Twilio (WhatsApp)</p>
            <input
              type="text"
              placeholder="Account SID"
              value={config.twilio_sid}
              onChange={(e) => handleChange('twilio_sid', e.target.value)}
              style={{ width: '100%', padding: '8px 12px', background: 'rgba(2, 6, 23, 0.8)', border: '1px solid #1e293b', borderRadius: '6px', color: '#f8fafc', fontSize: '13px', marginBottom: '8px' }}
            />
            <input
              type={showSecrets ? 'text' : 'password'}
              placeholder="Auth Token"
              value={config.twilio_token}
              onChange={(e) => handleChange('twilio_token', e.target.value)}
              style={{ width: '100%', padding: '8px 12px', background: 'rgba(2, 6, 23, 0.8)', border: '1px solid #1e293b', borderRadius: '6px', color: '#f8fafc', fontSize: '13px', marginBottom: '8px' }}
            />
          </div>

          {/* Instagram */}
          <div>
            <p style={{ fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '8px' }}>Instagram (Meta Graph API)</p>
            <input
              type={showSecrets ? 'text' : 'password'}
              placeholder="Access Token"
              value={config.instagram_token}
              onChange={(e) => handleChange('instagram_token', e.target.value)}
              style={{ width: '100%', padding: '8px 12px', background: 'rgba(2, 6, 23, 0.8)', border: '1px solid #1e293b', borderRadius: '6px', color: '#f8fafc', fontSize: '13px', marginBottom: '8px' }}
            />
            <input
              type="text"
              placeholder="Account ID"
              value={config.instagram_account}
              onChange={(e) => handleChange('instagram_account', e.target.value)}
              style={{ width: '100%', padding: '8px 12px', background: 'rgba(2, 6, 23, 0.8)', border: '1px solid #1e293b', borderRadius: '6px', color: '#f8fafc', fontSize: '13px' }}
            />
          </div>

          <button
            onClick={saveConfig}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              background: saved ? '#10b981' : 'linear-gradient(135deg, #7c3aed, #6366f1)',
              color: 'white',
              border: 'none',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            {saved ? '✓ Guardado' : 'Guardar Configuración'}
          </button>
        </div>
      </div>
    </div>
  )
}