import type { AmplifyResponse } from '../types'

interface ResultPanelProps {
  result: AmplifyResponse
}

export default function ResultPanel({ result }: ResultPanelProps) {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎯</span>
          <h2 className="text-lg font-bold">Resultado de Amplificación</h2>
        </div>
        <span className="tag bg-green-500/20 text-green-400">
          ✓ Generado
        </span>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white/5 p-4 rounded-xl">
          <p className="text-xs text-gray-400 mb-1">Tipo de Venta</p>
          <p className="text-sm font-bold text-green-400">{result.sale_type}</p>
        </div>
        <div className="bg-white/5 p-4 rounded-xl">
          <p className="text-xs text-gray-400 mb-1">Emoción</p>
          <p className="text-sm font-bold text-yellow-400">{result.emotion}</p>
        </div>
        <div className="bg-white/5 p-4 rounded-xl">
          <p className="text-xs text-gray-400 mb-1">Tono</p>
          <p className="text-sm font-bold text-purple-400">{result.tone}</p>
        </div>
        <div className="bg-white/5 p-4 rounded-xl">
          <p className="text-xs text-gray-400 mb-1">Estilo</p>
          <p className="text-sm font-bold text-blue-400">{result.style}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white/5 p-4 rounded-xl">
          <p className="text-xs text-gray-400 mb-2">Texto Overlay</p>
          <p className="text-2xl font-black text-white tracking-tight">{result.text_overlay}</p>
        </div>
        
        <div className="bg-white/5 p-4 rounded-xl">
          <p className="text-xs text-gray-400 mb-2">Call to Action</p>
          <p className="text-base text-white font-medium">{result.cta}</p>
        </div>

        <div className="bg-white/5 p-4 rounded-xl">
          <p className="text-xs text-gray-400 mb-2">Triggers Psicológicos</p>
          <div className="flex gap-2 flex-wrap">
            {result.psychological_triggers.map((t, i) => (
              <span key={i} className="tag bg-orange-500/20 text-orange-300">
                🧲 {t}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-white/5 p-4 rounded-xl">
          <p className="text-xs text-gray-400 mb-2">Paleta de Colores</p>
          <div className="flex gap-2">
            {result.color_palette.map((c, i) => (
              <div
                key={i}
                className="color-swatch"
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        </div>

        <div className="bg-white/5 p-4 rounded-xl">
          <p className="text-xs text-gray-400 mb-2">Hashtags</p>
          <div className="flex gap-1.5 flex-wrap">
            {result.hashtags.map((h, i) => (
              <span key={i} className="tag bg-blue-500/20 text-blue-300">
                {h}
              </span>
            ))}
          </div>
        </div>

        {result.diffusion_message && (
          <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-xl">
            <p className="text-xs text-green-400 mb-2 font-medium">📩 Difusión WhatsApp</p>
            <pre className="text-sm text-green-300 whitespace-pre-wrap font-mono">{result.diffusion_message}</pre>
          </div>
        )}
      </div>
    </div>
  )
}
