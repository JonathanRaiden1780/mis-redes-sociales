import { Zap, Sparkles, Menu, X } from 'lucide-react'
import { useState } from 'react'

export default function HeaderMinimal() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/60">
      <div className="max-w-6xl mx-auto px-6">
        <div className="h-16 flex items-center justify-between">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-white">Mis Redes</span>
          </a>

          {/* Nav Links - Center */}
          <nav className="hidden md:flex items-center gap-6">
            <a href="#" className="text-sm font-medium text-white">Dashboard</a>
            <a href="#" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Historial</a>
            <a href="#" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Configuración</a>
          </nav>

          {/* Right: CTA + Status */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-emerald-400">Activo</span>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-violet-500/25 transition-all">
              <Sparkles className="w-4 h-4" />
              Nuevo
            </button>
            <button 
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
