import { useState } from 'react'
import { 
  Zap, 
  Sparkles, 
  LayoutDashboard, 
  History, 
  Settings, 
  Menu,
  X
} from 'lucide-react'

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/60">
      <div className="max-w-6xl mx-auto px-6">
        <div className="h-16 flex items-center justify-between">
          {/* Left: Logo + Brand */}
          <div className="flex items-center gap-8">
            <a href="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20 group-hover:shadow-violet-500/40 transition-shadow">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <span className="text-sm font-semibold text-white">Mis Redes</span>
                <span className="text-xs text-slate-500 ml-1.5">v0.1</span>
              </div>
            </a>

            {/* Nav Links - Desktop */}
            <nav className="hidden md:flex items-center gap-1">
              <a href="#" className="px-3 py-2 rounded-lg text-sm font-medium text-white bg-white/5">
                <span className="flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </span>
              </a>
              <a href="#" className="px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
                <span className="flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Historial
                </span>
              </a>
              <a href="#" className="px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
                <span className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Configuración
                </span>
              </a>
            </nav>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            {/* Status Indicator */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-emerald-400">IA Activa</span>
            </div>

            {/* CTA Button */}
            <button className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-violet-500/25 transition-all">
              <Sparkles className="w-4 h-4" />
              Nuevo
            </button>

            {/* Mobile Menu Toggle */}
            <button 
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="md:hidden py-4 border-t border-slate-800">
            <nav className="flex flex-col gap-1">
              <a href="#" className="px-3 py-2 rounded-lg text-sm font-medium text-white bg-white/5">
                <span className="flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </span>
              </a>
              <a href="#" className="px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5">
                <span className="flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Historial
                </span>
              </a>
              <a href="#" className="px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5">
                <span className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Configuración
                </span>
              </a>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
