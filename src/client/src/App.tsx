import { useState } from 'react'
import AmplifyPanel from './components/AmplifyPanel'
import ResultPanel from './components/ResultPanel'
import PlatformGrid from './components/PlatformGrid'
import type { AmplifyResponse } from './types'

export default function App() {
  const [result, setResult] = useState<AmplifyResponse | null>(null)
  const [loading, setLoading] = useState(false)

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-sm">
              MR
            </div>
            <h1 className="text-xl font-bold">Mis Redes Sociales</h1>
          </div>
          <p className="text-sm text-gray-400">AI Content Engine</p>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Amplify */}
          <div className="lg:col-span-1 space-y-6">
            <AmplifyPanel 
              onResult={setResult} 
              onLoading={setLoading}
              loading={loading}
            />
          </div>

          {/* Right Panel - Results */}
          <div className="lg:col-span-2 space-y-6">
            {loading ? (
              <div className="bg-gray-800 rounded-lg p-12 flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-gray-400">Amplificando tu idea...</p>
              </div>
            ) : result ? (
              <div className="space-y-6">
                <ResultPanel result={result} />
                <PlatformGrid result={result} />
              </div>
            ) : (
              <div className="bg-gray-800 rounded-lg p-12 text-center">
                <p className="text-gray-500 text-lg mb-2">
                  👋 Bienvenido al AI Content Engine
                </p>
                <p className="text-gray-600">
                  Introduce tu idea de promoción y amplifícala para todas las plataformas
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}