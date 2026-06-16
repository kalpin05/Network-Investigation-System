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
    <nav className="relative bg-[#071106] border-b border-[#3b4b37] px-6 py-3.5 flex items-center gap-8 shadow-[0_1px_15px_rgba(0,255,65,0.15)] z-40">
      {/* Top corner scanning laser effect */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#00ff41] to-transparent opacity-60" />
      
      <div className="flex items-center gap-2 font-mono">
        <Shield className="text-[#00ff41] drop-shadow-[0_0_5px_rgba(0,255,65,0.6)] animate-pulse" size={22} />
        <span className="font-extrabold text-lg text-[#00ff41] tracking-widest uppercase text-shadow-[0_0_6px_rgba(0,255,65,0.5)]">
          KanadShield
        </span>
        <span className="text-[9px] text-[#00ff41]/60 font-bold border border-[#00ff41]/20 px-1 rounded ml-1 bg-[#0c160a]/20">
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
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-all border
                ${active 
                  ? 'bg-[#00ff41]/10 text-[#00ff41] border-[#00ff41] shadow-[0_0_10px_rgba(0,255,65,0.2)]' 
                  : 'text-[#dae6d2]/70 border-transparent hover:text-[#00ff41] hover:bg-[#0c160a]/40 hover:border-[#3b4b37]'}`}
            >
              <Icon size={14} className={active ? 'text-[#00ff41] animate-[spin_5s_linear_infinite]' : 'text-[#dae6d2]/50'} />
              <span>[{label.toUpperCase().replace(' ', '_')}]</span>
            </Link>
          )
        })}
      </div>
      <div className="ml-auto flex items-center gap-4 font-mono text-xs">
        <span className="text-right text-[10px] text-gray-500 hidden sm:block">
          <span className="text-[#00ff41] font-bold">{user?.username.toUpperCase()}</span>
          {' '}· <span className="text-[#dae6d2]/70 uppercase">{user?.role}</span>
        </span>
        <button
          onClick={onLogout}
          className="text-[10px] font-bold bg-[#0c160a]/30 hover:bg-red-950/40 border border-[#3b4b37] hover:border-red-700/30 text-[#00ff41] hover:text-red-400 px-3 py-1.5 rounded transition-all cursor-pointer shadow-[inset_0_0_6px_rgba(0,255,65,0.05)]"
        >
          [LOGOUT]
        </button>
      </div>
    </nav>
  )
}
