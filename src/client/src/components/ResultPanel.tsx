import type { AmplifyResponse } from '../types'

interface ResultPanelProps {
  result: AmplifyResponse
}

export default function ResultPanel({ result }: ResultPanelProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4">🎯 Resultado de Amplificación</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-gray-700 p-3 rounded-lg">
          <p className="text-xs text-gray-400">Venta</p>
          <p className="text-sm font-medium text-green-400">{result.sale_type}</p>
        </div>
        <div className="bg-gray-700 p-3 rounded-lg">
          <p className="text-xs text-gray-400">Emoción</p>
          <p className="text-sm font-medium text-yellow-400">{result.emotion}</p>
        </div>
        <div className="bg-gray-700 p-3 rounded-lg">
          <p className="text-xs text-gray-400">Tono</p>
          <p className="text-sm font-medium text-purple-400">{result.tone}</p>
        </div>
        <div className="bg-gray-700 p-3 rounded-lg">
          <p className="text-xs text-gray-400">Estilo</p>
          <p className="text-sm font-medium text-blue-400">{result.style}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="bg-gray-700 p-3 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Texto Overlay</p>
          <p className="text-lg font-bold text-white">{result.text_overlay}</p>
        </div>
        
        <div className="bg-gray-700 p-3 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">CTA</p>
          <p className="text-sm text-white">{result.cta}</p>
        </div>

        <div className="bg-gray-700 p-3 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Triggers Psicológicos</p>
          <div className="flex gap-1 flex-wrap">
            {result.psychological_triggers.map((t, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded bg-orange-900/50 text-orange-300">
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-gray-700 p-3 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Paleta de Colores</p>
          <div className="flex gap-1">
            {result.color_palette.map((c, i) => (
              <div
                key={i}
                className="w-8 h-8 rounded"
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        </div>

        <div className="bg-gray-700 p-3 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Hashtags</p>
          <div className="flex gap-1 flex-wrap">
            {result.hashtags.map((h, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded bg-blue-900/50 text-blue-300">
                {h}
              </span>
            ))}
          </div>
        </div>

        {result.diffusion_message && (
          <div className="bg-green-900/30 border border-green-700 p-3 rounded-lg">
            <p className="text-xs text-green-400 mb-1">📩 Difusión WhatsApp</p>
            <pre className="text-sm text-green-300 whitespace-pre-wrap">{result.diffusion_message}</pre>
          </div>
        )}
      </div>
    </div>
  )
}
