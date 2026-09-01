import { useState } from 'react'
import AmplifyPanel from './components/AmplifyPanel'
import ResultPanel from './components/ResultPanel'
import PlatformGrid from './components/PlatformGrid'
import type { AmplifyResponse } from './types'

export default function App() {
  const [result, setResult] = useState<AmplifyResponse | null>(null)
  const [loading, setLoading] = useState(false)

  return (
    <div className="min-h-screen bg-[#09090b]">
      {/* Header */}
      <header className="border-b border-[#27272a]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center">
              <span className="text-black text-xs font-bold">MR</span>
            </div>
            <span className="text-sm font-medium text-white">Mis Redes Sociales</span>
          </div>
          <span className="text-tertiary">v0.1</span>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-6 py-8">
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
              <div className="surface p-12 flex flex-col items-center justify-center min-h-[300px]" role="status" aria-label="Cargando">
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin mb-3" />
                <span className="text-secondary">Amplificando...</span>
              </div>
            ) : result ? (
              <div className="space-y-6 animate-fade">
                <ResultPanel result={result} />
                <PlatformGrid result={result} />
              </div>
            ) : (
              <div className="surface p-12 text-center min-h-[300px] flex flex-col items-center justify-center">
                <p className="text-secondary mb-1">Sin resultado</p>
                <p className="text-tertiary">Introduce una idea y presiona Amplificar</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
