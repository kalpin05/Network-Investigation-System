import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Shield, Activity, AlertTriangle, FolderOpen, Network, Brain, Settings, History, Menu, X } from 'lucide-react'

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

const styleSheet = `
@keyframes slideFromLeft {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(0); }
}
.animate-slide-from-left {
  animation: slideFromLeft 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
`

export default function Navbar({ user, onLogout }) {
  const { pathname } = useLocation()
  const [isOpen, setIsOpen] = useState(false)
  const visibleLinks = links.filter(link => !link.roles || link.roles.includes(user?.role))

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styleSheet }} />
      <nav className="relative bg-[#071106] border-b border-[#3b4b37] px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-[0_1px_15px_rgba(0,255,65,0.15)] z-40">
        {/* Top corner scanning laser effect */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#00ff41] to-transparent opacity-60" />
        
        <div className="flex items-center gap-4">
          {/* Hamburger Menu Icon for mobile */}
          <button
            onClick={() => setIsOpen(true)}
            className="xl:hidden text-[#00ff41] hover:brightness-125 transition-all p-1 cursor-pointer bg-transparent border-0"
            aria-label="Toggle Menu"
          >
            <Menu size={22} />
          </button>

          <div className="flex items-center gap-2 font-mono">
            <Shield className="text-[#00ff41] drop-shadow-[0_0_5px_rgba(0,255,65,0.6)] animate-pulse" size={22} />
            <span className="font-extrabold text-lg text-[#00ff41] tracking-widest uppercase text-shadow-[0_0_6px_rgba(0,255,65,0.5)]">
              KanadShield
            </span>
            <span className="text-[9px] text-[#00ff41]/60 font-bold border border-[#00ff41]/20 px-1 rounded ml-1 bg-[#0c160a]/20">
              V7.4
            </span>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <div className="hidden xl:flex gap-1.5 font-mono">
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

        {/* Desktop Operative Clearance & Logout */}
        <div className="hidden sm:flex items-center gap-4 font-mono text-xs">
          <span className="text-right text-[10px] text-gray-500">
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

        {/* Simple logout button for extra-small mobile viewport headers */}
        <button
          onClick={onLogout}
          className="sm:hidden text-[9px] font-bold border border-red-700/30 text-red-400 bg-red-950/20 px-2.5 py-1 rounded cursor-pointer"
        >
          [OUT]
        </button>
      </nav>

      {/* Mobile Sidebar Navigation Drawer */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/75 backdrop-blur-xs z-40 transition-opacity"
          />

          {/* Drawer Panel */}
          <aside className="fixed top-0 left-0 h-screen w-64 bg-[#071106] border-r border-[#3b4b37] z-50 p-5 flex flex-col justify-between shadow-[0_0_30px_rgba(0,255,65,0.15)] font-mono animate-slide-from-left">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-[#3b4b37] pb-4">
                <div className="flex items-center gap-2">
                  <Shield className="text-[#00ff41] animate-pulse" size={20} />
                  <span className="text-sm font-extrabold tracking-widest text-[#00ff41]">KANADSHIELD</span>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-white p-1 cursor-pointer bg-transparent border-0"
                  aria-label="Close Menu"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Vertical Navigation Links */}
              <nav className="flex flex-col gap-2">
                {visibleLinks.map(({ to, label, icon: Icon }) => {
                  const active = pathname === to
                  return (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded text-xs font-bold transition-all border
                        ${active 
                          ? 'bg-[#00ff41]/10 text-[#00ff41] border-[#00ff41] shadow-[0_0_10px_rgba(0,255,65,0.15)]' 
                          : 'text-[#dae6d2]/70 border-transparent hover:text-[#00ff41] hover:bg-[#0c160a]/40 hover:border-[#3b4b37]'}`}
                    >
                      <Icon size={14} className={active ? 'text-[#00ff41] animate-pulse' : 'text-[#dae6d2]/50'} />
                      <span>[{label.toUpperCase().replace(' ', '_')}]</span>
                    </Link>
                  )
                })}
              </nav>
            </div>

            {/* Drawer Bottom Profile Indicator */}
            <div className="border-t border-[#3b4b37] pt-4 mt-auto flex flex-col gap-3">
              <div className="text-[10px] text-gray-500 leading-normal">
                <div>OPERATIVE ID:</div>
                <div className="text-[#00ff41] font-bold text-xs uppercase truncate">{user?.username}</div>
                <div className="text-[#dae6d2]/60 text-[9px] uppercase tracking-wider mt-0.5">{user?.role} CLEARANCE</div>
              </div>
              <button
                onClick={() => {
                  setIsOpen(false);
                  onLogout();
                }}
                className="w-full text-center text-[10px] font-bold bg-red-950/20 border border-red-700/30 hover:border-red-600 text-red-400 py-2 rounded transition-all cursor-pointer"
              >
                [LOGOUT OPERATIVE]
              </button>
            </div>
          </aside>
        </>
      )}
    </>
  )
}
