import { useState } from 'react'
import AmplifyPanel from './components/AmplifyPanel'
import ResultPanel from './components/ResultPanel'
import PlatformGrid from './components/PlatformGrid'
import type { AmplifyResponse } from './types'

export default function App() {
  const [result, setResult] = useState<AmplifyResponse | null>(null)
  const [loading, setLoading] = useState(false)

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-lg shadow-lg shadow-indigo-500/20">
              MR
            </div>
            <div>
              <h1 className="text-lg font-bold gradient-text">Mis Redes Sociales</h1>
              <p className="text-xs text-gray-500">AI Content Engine</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="pulse-dot" />
            <span className="text-xs text-gray-400">Activo</span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Panel - Amplify */}
          <div className="lg:col-span-4">
            <AmplifyPanel 
              onResult={setResult} 
              onLoading={setLoading}
              loading={loading}
            />
          </div>

          {/* Right Panel - Results */}
          <div className="lg:col-span-8">
            {loading ? (
              <div className="card p-12 flex flex-col items-center justify-center min-h-[400px]">
                <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6" />
                <p className="text-gray-300 font-medium">Amplificando tu idea...</p>
                <p className="text-gray-500 text-sm mt-1">Generando prompts optimizados</p>
              </div>
            ) : result ? (
              <div className="space-y-6 fade-in">
                <ResultPanel result={result} />
                <PlatformGrid result={result} />
              </div>
            ) : (
              <div className="card p-12 text-center min-h-[400px] flex flex-col items-center justify-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center mb-6">
                  <span className="text-4xl">🚀</span>
                </div>
                <h2 className="text-xl font-bold mb-2">Bienvenido al AI Content Engine</h2>
                <p className="text-gray-400 max-w-md">
                  Introduce tu idea de promoción y amplifícala automáticamente para todas las plataformas
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
