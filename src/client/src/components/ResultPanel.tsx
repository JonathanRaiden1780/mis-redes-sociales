import type { AmplifyResponse } from '../types'

interface ResultPanelProps {
  result: AmplifyResponse
}

export default function ResultPanel({ result }: ResultPanelProps) {
  return (
    <div className="surface p-5">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-medium text-white">Resultado</h2>
        <span className="badge bg-green-500/10 text-green-400">Generado</span>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div>
          <p className="text-tertiary mb-0.5">Venta</p>
          <p className="text-sm font-medium text-white">{result.sale_type}</p>
        </div>
        <div>
          <p className="text-tertiary mb-0.5">Emoción</p>
          <p className="text-sm font-medium text-white">{result.emotion}</p>
        </div>
        <div>
          <p className="text-tertiary mb-0.5">Tono</p>
          <p className="text-sm font-medium text-white">{result.tone}</p>
        </div>
        <div>
          <p className="text-tertiary mb-0.5">Estilo</p>
          <p className="text-sm font-medium text-white">{result.style}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-tertiary mb-1">Texto Overlay</p>
          <p className="text-lg font-semibold text-white">{result.text_overlay}</p>
        </div>
        
        <div>
          <p className="text-tertiary mb-1">Call to Action</p>
          <p className="text-sm text-white">{result.cta}</p>
        </div>

        <div>
          <p className="text-tertiary mb-1.5">Triggers Psicológicos</p>
          <div className="flex gap-1.5 flex-wrap">
            {result.psychological_triggers.map((t, i) => (
              <span key={i} className="badge bg-orange-500/10 text-orange-400">
                {t}
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="text-tertiary mb-1.5">Paleta</p>
          <div className="flex gap-1.5">
            {result.color_palette.map((c, i) => (
              <div
                key={i}
                className="w-6 h-6 rounded border border-white/10"
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="text-tertiary mb-1.5">Hashtags</p>
          <div className="flex gap-1.5 flex-wrap">
            {result.hashtags.map((h, i) => (
              <span key={i} className="badge bg-blue-500/10 text-blue-400">
                {h}
              </span>
            ))}
          </div>
        </div>

        {result.diffusion_message && (
          <div className="pt-4 border-t border-[#27272a]">
            <p className="text-tertiary mb-1.5">Difusión WhatsApp</p>
            <pre className="text-xs text-[#a1a1aa] whitespace-pre-wrap font-mono bg-[#09090b] p-3 rounded-md border border-[#27272a]">
              {result.diffusion_message}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
