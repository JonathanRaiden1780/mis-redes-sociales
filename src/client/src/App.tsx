import { useState } from 'react'

export default function App() {
  const [idea, setIdea] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  async function handleAmplify() {
    if (!idea.trim()) return
    setLoading(true)
    try {
      const res = await fetch('/api/amplify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea }),
      })
      const data = await res.json()
      setResult(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-4xl font-bold mb-2">Mis Redes Sociales</h1>
      <p className="text-gray-400 mb-8">Social Media Content Engine</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-3">🧠 AI Prompt Amplifier</h2>
          <textarea
            className="w-full bg-gray-700 text-white p-3 rounded-lg border border-gray-600"
            rows={4}
            placeholder="Ej: promoción de perfumes 2x800 pesos"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
          />
          <button
            onClick={handleAmplify}
            disabled={loading || !idea.trim()}
            className="mt-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            {loading ? 'Amplificando...' : '🚀 Amplificar'}
          </button>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-3">🎯 Resultado</h2>
          {result ? (
            <div className="space-y-3 text-sm">
              <div className="bg-gray-700 p-3 rounded">
                <span className="text-gray-400">Venta:</span>{' '}
                <span className="text-green-400 font-medium">{result.sale_type}</span>
              </div>
              <div className="bg-gray-700 p-3 rounded">
                <span className="text-gray-400">Tono:</span>{' '}
                <span className="text-yellow-400 font-medium">{result.tone}</span>
              </div>
              <div className="bg-gray-700 p-3 rounded">
                <span className="text-gray-400">CTA:</span>{' '}
                <span className="text-purple-400">{result.cta}</span>
              </div>
              <div className="bg-gray-700 p-3 rounded">
                <span className="text-gray-400">Hashtags:</span>{' '}
                <span className="text-blue-400">{result.hashtags?.join(' ')}</span>
              </div>
              {result.image_prompt && (
                <div className="bg-gray-700 p-3 rounded">
                  <span className="text-gray-400">Prompt de imagen:</span>
                  <p className="text-gray-300 mt-1 text-xs">{result.image_prompt}</p>
                </div>
              )}
              {result.diffusion_message && (
                <div className="bg-gray-700 p-3 rounded">
                  <span className="text-gray-400">Difusión WhatsApp:</span>
                  <pre className="text-green-400 mt-1 whitespace-pre-wrap text-xs">{result.diffusion_message}</pre>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500">Introduce una idea y amplifícala</p>
          )}
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-3">📱 Publicación</h2>
          <div className="grid grid-cols-3 gap-2">
            <button className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-3 rounded-lg text-sm font-medium">Instagram</button>
            <button className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-3 rounded-lg text-sm font-medium border border-gray-600">TikTok</button>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg text-sm font-medium">Facebook</button>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-3">📩 WhatsApp</h2>
          <p className="text-gray-400 text-sm mb-3">Difunde ofertas por WhatsApp</p>
          <button className="w-full bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg font-medium transition-colors">
            Enviar Difusión
          </button>
        </div>
      </div>
    </div>
  )
}
