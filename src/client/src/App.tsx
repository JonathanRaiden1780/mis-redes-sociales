import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import Header from './components/Header'
import AmplifyPanel from './components/AmplifyPanel'
import ResultPanel from './components/ResultPanel'
import PlatformGrid from './components/PlatformGrid'
import type { AmplifyResponse } from './types'

export default function App() {
  const [result, setResult] = useState<AmplifyResponse | null>(null)
  const [loading, setLoading] = useState(false)

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Premium Header */}
      <Header />

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6 pt-12 pb-8">
        <div className="max-w-2xl">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight">
            Amplificador de Contenido
          </h1>
          <p className="text-slate-400 text-base leading-relaxed">
            Transforma una idea simple en publicaciones optimizadas para todas tus redes en segundos.
          </p>
        </div>
      </section>

      {/* Main Grid */}
      <main className="max-w-6xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column - Form (5 cols) */}
          <div className="lg:col-span-5">
            <AmplifyPanel 
              onResult={setResult} 
              onLoading={setLoading}
              loading={loading}
            />
          </div>

          {/* Right Column - Results (7 cols) */}
          <div className="lg:col-span-7">
            {loading ? (
              <div className="card min-h-[400px] flex flex-col items-center justify-center" role="status" aria-label="Cargando">
                <div className="w-12 h-12 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mb-4" />
                <span className="text-sm text-slate-400">Amplificando tu idea...</span>
              </div>
            ) : result ? (
              <div className="space-y-6 animate-fade">
                <ResultPanel result={result} />
                <PlatformGrid result={result} />
              </div>
            ) : (
              <div className="card min-h-[400px] flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8 text-violet-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Sin resultado aún</h3>
                <p className="text-sm text-slate-500 max-w-sm">
                  Introduce tu idea de promoción y presiona Amplificar para generar contenido optimizado.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
