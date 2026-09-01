import type { AmplifyResponse } from '../types'
import { Copy, Check, Sparkles } from 'lucide-react'
import { useState } from 'react'

interface ResultPanelProps {
  result: AmplifyResponse
}

export default function ResultPanel({ result }: ResultPanelProps) {
  const [copied, setCopied] = useState<string | null>(null)

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-semibold text-white">Resultado</h2>
        </div>
        <span className="badge bg-green-500/10 text-green-400">Generado</span>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-slate-800/50 p-3 rounded-lg">
          <p className="text-tertiary mb-0.5">Venta</p>
          <p className="text-sm font-medium text-white">{result.sale_type}</p>
        </div>
        <div className="bg-slate-800/50 p-3 rounded-lg">
          <p className="text-tertiary mb-0.5">Emoción</p>
          <p className="text-sm font-medium text-white">{result.emotion}</p>
        </div>
        <div className="bg-slate-800/50 p-3 rounded-lg">
          <p className="text-tertiary mb-0.5">Tono</p>
          <p className="text-sm font-medium text-white">{result.tone}</p>
        </div>
        <div className="bg-slate-800/50 p-3 rounded-lg">
          <p className="text-tertiary mb-0.5">Estilo</p>
          <p className="text-sm font-medium text-white">{result.style}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="bg-slate-800/50 p-3 rounded-lg">
          <p className="text-tertiary mb-1">Texto Overlay</p>
          <p className="text-lg font-bold text-white">{result.text_overlay}</p>
        </div>
        
        <div className="bg-slate-800/50 p-3 rounded-lg">
          <p className="text-tertiary mb-1">Call to Action</p>
          <p className="text-sm text-white">{result.cta}</p>
        </div>

        <div className="bg-slate-800/50 p-3 rounded-lg">
          <p className="text-tertiary mb-2">Triggers Psicológicos</p>
          <div className="flex gap-1.5 flex-wrap">
            {result.psychological_triggers.map((t, i) => (
              <span key={i} className="badge bg-orange-500/10 text-orange-400">
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-slate-800/50 p-3 rounded-lg">
          <p className="text-tertiary mb-2">Paleta de Colores</p>
          <div className="flex gap-1.5">
            {result.color_palette.map((c, i) => (
              <div
                key={i}
                className="w-6 h-6 rounded border border-slate-700"
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        </div>

        <div className="bg-slate-800/50 p-3 rounded-lg">
          <p className="text-tertiary mb-2">Hashtags</p>
          <div className="flex gap-1.5 flex-wrap">
            {result.hashtags.map((h, i) => (
              <span key={i} className="badge bg-blue-500/10 text-blue-400">
                {h}
              </span>
            ))}
          </div>
        </div>

        {result.diffusion_message && (
          <div className="pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <p className="text-tertiary">Difusión WhatsApp</p>
              <button
                onClick={() => copyToClipboard(result.diffusion_message, 'wa')}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-white transition-colors"
              >
                {copied === 'wa' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied === 'wa' ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <pre className="text-xs text-slate-400 whitespace-pre-wrap font-mono bg-slate-950 p-3 rounded-lg border border-slate-800">
              {result.diffusion_message}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
