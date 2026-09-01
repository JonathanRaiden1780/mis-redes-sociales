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
    <div className="min-h-screen bg-slate-950">
      {/* Navbar */}
      <header className="border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-white">Mis Redes Sociales</span>
            <span className="badge bg-purple-500/10 text-purple-400">v0.1</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs text-slate-500">Activo</span>
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <section className="max-w-6xl mx-auto px-6 pt-10 pb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Amplificador de Contenido</h1>
        <p className="text-slate-400 text-sm max-w-lg">
          Transforma una idea simple en publicaciones optimizadas para todas tus redes en segundos.
        </p>
      </section>

      {/* Main Grid */}
      <main className="max-w-6xl mx-auto px-6 pb-12">
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
                <div className="w-10 h-10 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mb-3" />
                <span className="text-sm text-slate-400">Amplificando...</span>
              </div>
            ) : result ? (
              <div className="space-y-6 animate-fade">
                <ResultPanel result={result} />
                <PlatformGrid result={result} />
              </div>
            ) : (
              <div className="card min-h-[400px] flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
                  <Sparkles className="w-7 h-7 text-purple-400" />
                </div>
                <h3 className="text-base font-semibold text-white mb-1">Sin resultado aún</h3>
                <p className="text-sm text-slate-500 max-w-xs">
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
