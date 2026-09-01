import { useState } from 'react'
import { MessageCircle, Send, Users, AlertCircle, Check, Loader2 } from 'lucide-react'

interface WhatsAppPanelProps {
  campaignId: number
}

export default function WhatsAppPanel({ campaignId }: WhatsAppPanelProps) {
  const [phone, setPhone] = useState('')
  const [recipients, setRecipients] = useState('')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<any>(null)
  const [config, setConfig] = useState<any>(null)

  async function checkConfig() {
    try {
      const res = await fetch('/api/whatsapp/config')
      const data = await res.json()
      setConfig(data)
    } catch (err) {
      console.error(err)
    }
  }

  useState(() => {
    checkConfig()
  })

  async function sendSingle() {
    if (!phone.trim()) return
    setSending(true)
    setSendResult(null)
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaignId, to: phone }),
      })
      const data = await res.json()
      setSendResult(data)
    } catch (err) {
      setSendResult({ success: false, error: 'Error de conexión' })
    } finally {
      setSending(false)
    }
  }

  async function sendBroadcast() {
    const list = recipients.split('\n').map(r => r.trim()).filter(r => r)
    if (list.length === 0) return
    setSending(true)
    setSendResult(null)
    try {
      const res = await fetch('/api/whatsapp/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaignId, recipients: list }),
      })
      const data = await res.json()
      setSendResult(data)
    } catch (err) {
      setSendResult({ success: false, error: 'Error de conexión' })
    } finally {
      setSending(false)
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
        <MessageCircle style={{ width: '16px', height: '16px', color: '#25D366' }} />
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>WhatsApp Business</h2>
      </div>

      {config && !config.configured && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px',
          borderRadius: '6px',
          background: 'rgba(251, 191, 36, 0.1)',
          border: '1px solid rgba(251, 191, 36, 0.3)',
          marginBottom: '16px'
        }}>
          <AlertCircle style={{ width: '14px', height: '14px', color: '#fbbf24' }} />
          <span style={{ fontSize: '12px', color: '#fbbf24' }}>
            Twilio no configurado. Usa la difusión manual como alternativa.
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Single Message */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>
            Enviar a un número
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="tel"
              placeholder="+521234567890"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{
                flex: 1,
                padding: '10px 12px',
                background: 'rgba(2, 6, 23, 0.8)',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '13px'
              }}
            />
            <button
              onClick={sendSingle}
              disabled={sending || !phone.trim()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 16px',
                borderRadius: '8px',
                background: sending ? '#374151' : '#25D366',
                color: 'white',
                border: 'none',
                fontSize: '13px',
                fontWeight: 500,
                cursor: sending ? 'not-allowed' : 'pointer'
              }}
            >
              {sending ? <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} /> : <Send style={{ width: '14px', height: '14px' }} />}
              Enviar
            </button>
          </div>
        </div>

        {/* Broadcast */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginBottom: '6px' }}>
            Difusión múltiple (un número por línea)
          </label>
          <textarea
            placeholder="+521234567890&#10;&#11;+529876543210"
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
            rows={3}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'rgba(2, 6, 23, 0.8)',
              border: '1px solid #1e293b',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '13px',
              resize: 'none',
              marginBottom: '8px'
            }}
          />
          <button
            onClick={sendBroadcast}
            disabled={sending || !recipients.trim()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 16px',
              borderRadius: '8px',
              background: sending ? '#374151' : 'linear-gradient(135deg, #25D366, #128C7E)',
              color: 'white',
              border: 'none',
              fontSize: '13px',
              fontWeight: 500,
              cursor: sending ? 'not-allowed' : 'pointer'
            }}
          >
            {sending ? <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} /> : <Users style={{ width: '14px', height: '14px' }} />}
            Enviar a todos
          </button>
        </div>

        {/* Result */}
        {sendResult && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px',
            borderRadius: '6px',
            background: sendResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: '1px solid ' + (sendResult.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)')
          }}>
            {sendResult.success ? (
              <Check style={{ width: '14px', height: '14px', color: '#34d399' }} />
            ) : (
              <AlertCircle style={{ width: '14px', height: '14px', color: '#ef4444' }} />
            )}
            <span style={{ fontSize: '12px', color: sendResult.success ? '#34d399' : '#ef4444' }}>
              {sendResult.success 
                ? `Enviado: ${sendResult.sent || 1} mensaje(s)` 
                : sendResult.error || 'Error al enviar'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}