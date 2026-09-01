import type { Platform } from '../types'

interface PlatformPreviewProps {
  platform: Platform
  prompt: string
  format: string
  hashtags: string[]
  color: string
}

export default function PlatformPreview({ platform, prompt, format, hashtags }: PlatformPreviewProps) {
  const formatLabels: Record<string, string> = {
    '9:16': 'Story / Reel',
    '16:9': 'Feed Horizontal',
    '1:1': 'Feed Cuadrado',
  }

  return (
    <div className="surface surface-hover p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">{platform.icon}</span>
          <div>
            <span className="text-sm font-medium text-white">{platform.name}</span>
            <p className="text-tertiary">{formatLabels[format] || format}</p>
          </div>
        </div>
        <span className="text-tertiary font-mono text-xs">{format}</span>
      </div>
      
      <p className="text-xs text-[#71717a] leading-relaxed mb-3 line-clamp-3">
        {prompt.slice(0, 160)}...
      </p>
      
      <div className="flex flex-wrap gap-1">
        {hashtags.slice(0, 3).map((tag, i) => (
          <span key={i} className="badge bg-blue-500/10 text-blue-400">
            {tag}
          </span>
        ))}
        {hashtags.length > 3 && (
          <span className="badge bg-[#27272a] text-[#52525b]">+{hashtags.length - 3}</span>
        )}
      </div>
    </div>
  )
}
