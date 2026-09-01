import type { Platform } from '../types'

interface PlatformPreviewProps {
  platform: Platform
  prompt: string
  format: string
  hashtags: string[]
  color: string
}

export default function PlatformPreview({ platform, prompt, format, hashtags, color }: PlatformPreviewProps) {
  const formatLabels: Record<string, string> = {
    '9:16': 'Story / Reel',
    '16:9': 'Feed Horizontal',
    '1:1': 'Feed Cuadrado',
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
            style={{ background: `${color}22`, border: `1px solid ${color}44` }}
          >
            {platform.icon}
          </div>
          <div>
            <span className="font-semibold text-white">{platform.name}</span>
            <p className="text-xs text-gray-500">{formatLabels[format] || format}</p>
          </div>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-lg bg-white/5 text-gray-400 font-medium">
          {format}
        </span>
      </div>
      
      <div 
        className="rounded-xl p-4 mb-4 min-h-[100px] flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${color}11, ${color}22)` }}
      >
        <p className="text-sm text-gray-300 text-center leading-relaxed">
          {prompt.slice(0, 180)}...
        </p>
      </div>
      
      <div className="flex flex-wrap gap-1.5">
        {hashtags.slice(0, 4).map((tag, i) => (
          <span key={i} className="tag bg-blue-500/15 text-blue-300">
            {tag}
          </span>
        ))}
        {hashtags.length > 4 && (
          <span className="tag bg-white/5 text-gray-500">+{hashtags.length - 4}</span>
        )}
      </div>
    </div>
  )
}
