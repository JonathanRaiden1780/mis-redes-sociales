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
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-2xl">📱</span>
        <h2 className="text-lg font-bold">Prompts por Plataforma</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
