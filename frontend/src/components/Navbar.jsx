import { Link, useLocation } from 'react-router-dom'
import { Shield, Activity, AlertTriangle, FolderOpen, Network, Brain, Settings, History } from 'lucide-react'

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: Activity },
  { to: '/graph', label: 'Flow Graph', icon: Network },
  { to: '/alerts', label: 'Alerts', icon: AlertTriangle },
  { to: '/cases', label: 'Cases', icon: FolderOpen },
  { to: '/custody', label: 'Custody Log', icon: History, roles: ['admin', 'investigator'] },
  { to: '/kibana', label: 'Analytics (Kibana)', icon: Activity },
  { to: '/ml', label: 'AI Settings', icon: Brain },
  { to: '/settings', label: 'System Settings', icon: Settings },
]

export default function Navbar({ user, onLogout }) {
  const { pathname } = useLocation()
  const visibleLinks = links.filter(link => !link.roles || link.roles.includes(user?.role))
  return (
    <nav className="relative bg-slate-950/80 backdrop-blur-md border-b border-cyan-500/30 px-6 py-3.5 flex items-center gap-8 shadow-[0_1px_15px_rgba(0,240,255,0.15)] z-40">
      {/* Top corner scanning laser effect */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-60" />
      
      <div className="flex items-center gap-2 font-mono">
        <Shield className="text-cyan-400 drop-shadow-[0_0_5px_rgba(0,240,255,0.6)] animate-pulse" size={22} />
        <span className="font-extrabold text-lg text-cyan-400 tracking-widest uppercase text-shadow-[0_0_6px_rgba(0,240,255,0.5)]">
          KanadShield
        </span>
        <span className="text-[9px] text-cyan-500/60 font-bold border border-cyan-500/20 px-1 rounded ml-1 bg-cyan-950/20">
          V7.4
        </span>
      </div>
      <div className="flex gap-1.5 font-mono">
        {visibleLinks.map(({ to, label, icon: Icon }) => {
          const active = pathname === to
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border
                ${active 
                  ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/40 shadow-[0_0_10px_rgba(0,240,255,0.2)]' 
                  : 'text-gray-400 border-transparent hover:text-cyan-300 hover:bg-cyan-950/20 hover:border-cyan-500/10'}`}
            >
              <Icon size={14} className={active ? 'text-cyan-400 animate-[spin_5s_linear_infinite]' : 'text-gray-500'} />
              <span>[{label.toUpperCase().replace(' ', '_')}]</span>
            </Link>
          )
        })}
      </div>
      <div className="ml-auto flex items-center gap-4 font-mono text-xs">
        <span className="text-right text-[10px] text-gray-500 hidden sm:block">
          <span className="text-cyan-400 font-bold">{user?.username.toUpperCase()}</span>
          {' '}· <span className="text-gray-400 uppercase">{user?.role}</span>
        </span>
        <button
          onClick={onLogout}
          className="text-[10px] font-bold bg-cyan-950/30 hover:bg-red-950/40 border border-cyan-800/30 hover:border-red-700/30 text-cyan-400 hover:text-red-400 px-3 py-1.5 rounded-lg transition-all cursor-pointer shadow-[inset_0_0_6px_rgba(0,240,255,0.05)]"
        >
          [LOGOUT]
        </button>
      </div>
    </nav>
  )
}
