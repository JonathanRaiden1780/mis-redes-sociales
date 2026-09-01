import type { AmplifyResponse } from '../types'
import PlatformPreview from './PlatformPreview'

interface PlatformGridProps {
  result: AmplifyResponse
}

const platforms = [
  { name: 'Instagram', icon: '📸', color: '#E1306C' },
  { name: 'TikTok', icon: '🎵', color: '#00f2ea' },
  { name: 'Facebook', icon: '👥', color: '#1877F2' },
  { name: 'WhatsApp', icon: '💬', color: '#25D366' },
]

export default function PlatformGrid({ result }: PlatformGridProps) {
  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.5)',
      border: '1px solid #1e293b',
      borderRadius: '12px',
      padding: '24px'
    }}>
      <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'white', marginBottom: '16px' }}>
        Prompts por Plataforma
      </h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {platforms.map((platform) => {
          const pp = result.platform_prompts[platform.name.toLowerCase()]
          if (!pp) return null
          return (
            <PlatformPreview
              key={platform.name}
              platform={platform}
              prompt={pp.prompt}
              format={pp.format}
              hashtags={pp.hashtags}
              color={platform.color}
            />
          )
        })}
      </div>
    </div>
  )
}
