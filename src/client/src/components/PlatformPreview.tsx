import { useState } from 'react'
import { Copy, Check, Edit3 } from 'lucide-react'
import type { Platform } from '../types'

interface PlatformPreviewProps {
  platform: Platform
  prompt: string
  format: string
  hashtags: string[]
  color: string
}

export default function PlatformPreview({ platform, prompt, format, hashtags, color }: PlatformPreviewProps) {
  const [copied, setCopied] = useState(false)

  function copyToClipboard() {
    navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatLabels: Record<string, string> = {
    '9:16': 'Story / Reel',
    '16:9': 'Feed Horizontal',
    '1:1': 'Feed Cuadrado',
  }

  return (
    <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div 
            className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
            style={{ background: color + '15', border: '1px solid ' + color + '30' }}
          >
            {platform.icon}
          </div>
          <div>
            <span className="text-sm font-medium text-white">{platform.name}</span>
            <p className="text-tertiary text-xs">{formatLabels[format] || format}</p>
          </div>
        </div>
        <span className="text-tertiary font-mono text-xs">{format}</span>
      </div>
      
      <p className="text-sm text-slate-400 leading-relaxed mb-3 line-clamp-3">
        {prompt.slice(0, 160)}...
      </p>
      
      <div className="flex flex-wrap gap-1.5 mb-3">
        {hashtags.slice(0, 3).map((tag, i) => (
          <span key={i} className="badge bg-blue-500/10 text-blue-400">
            {tag}
          </span>
        ))}
        {hashtags.length > 3 && (
          <span className="badge bg-slate-800 text-slate-500">+{hashtags.length - 3}</span>
        )}
      </div>

      <div className="flex gap-2 pt-3 border-t border-slate-800">
        <button
          onClick={copyToClipboard}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
        <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-slate-500 hover:text-white hover:bg-white/5 transition-colors">
          <Edit3 className="w-3.5 h-3.5" />
          Editar
        </button>
      </div>
    </div>
  )
}
