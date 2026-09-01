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
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-500 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{platform.icon}</span>
          <span className="font-semibold text-white">{platform.name}</span>
        </div>
        <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">
          {formatLabels[format] || format}
        </span>
      </div>
      
      <div 
        className="rounded-lg p-4 mb-3 min-h-[120px] flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${color}22, ${color}44)` }}
      >
        <p className="text-sm text-gray-200 text-center">
          {prompt.slice(0, 200)}...
        </p>
      </div>
      
      <div className="flex flex-wrap gap-1">
        {hashtags.slice(0, 4).map((tag, i) => (
          <span key={i} className="text-xs px-2 py-0.5 rounded bg-blue-900/50 text-blue-300">
            {tag}
          </span>
        ))}
        {hashtags.length > 4 && (
          <span className="text-xs text-gray-500">+{hashtags.length - 4}</span>
        )}
      </div>
    </div>
  )
}
