import { useState } from 'react'
import { Sparkles, Zap } from 'lucide-react'
import AmplifyPanel from './components/AmplifyPanel'
import ResultPanel from './components/ResultPanel'
import PlatformGrid from './components/PlatformGrid'
import type { AmplifyResponse } from './types'

export default function App() {
  const [result, setResult] = useState<AmplifyResponse | null>(null)
  const [loading, setLoading] = useState(false)

  return (
    <div className="min-h-screen bg-[#0c0c11]">
      {/* Header */}
      <header className="border-b border-[#27272a] sticky top-0 z-50 glass-strong">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-white">Mis Redes Sociales</h1>
              <p className="text-xs text-[#71717a]">Amplificador de Contenido IA</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="badge bg-violet-500/10 text-violet-400">v0.1</span>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse-subtle" />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 pt-12 pb-8 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
          Convierte ideas en contenido{' '}
          <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
            viral
          </span>
        </h2>
        <p className="text-[#71717a] max-w-xl mx-auto text-base">
          Amplifica tus promociones con IA para todas las plataformas. 
          Genera prompts optimizados en segundos.
        </p>
      </section>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left - Input */}
          <div className="lg:col-span-5">
            <AmplifyPanel 
              onResult={setResult} 
              onLoading={setLoading}
              loading={loading}
            />
          </div>

          {/* Right - Results */}
          <div className="lg:col-span-7">
            {loading ? (
              <div className="surface p-12 flex flex-col items-center justify-center min-h-[400px]" role="status" aria-label="Cargando">
                <div className="w-12 h-12 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin mb-4" />
                <p className="text-[#a1a1aa] font-medium">Amplificando tu idea...</p>
                <p className="text-tertiary mt-1">Generando prompts optimizados</p>
              </div>
            ) : result ? (
              <div className="space-y-6 animate-fade">
                <ResultPanel result={result} />
                <PlatformGrid result={result} />
              </div>
            ) : (
              <div className="surface p-12 text-center min-h-[400px] flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8 text-violet-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Sin resultado aún</h3>
                <p className="text-[#71717a] max-w-sm">
                  Introduce tu idea de promoción y presiona Amplificar para generar contenido optimizado
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
