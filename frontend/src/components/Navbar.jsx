import { Link, useLocation } from 'react-router-dom'
import { Shield, Activity, AlertTriangle, FolderOpen, Network, Brain, Settings } from 'lucide-react'

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: Activity },
  { to: '/graph', label: 'Flow Graph', icon: Network },
  { to: '/alerts', label: 'Alerts', icon: AlertTriangle },
  { to: '/cases', label: 'Cases', icon: FolderOpen },
  { to: '/kibana', label: 'Analytics (Kibana)', icon: Activity },
  { to: '/ml', label: 'AI Settings', icon: Brain },
  { to: '/settings', label: 'System Settings', icon: Settings },
]

export default function Navbar({ user, onLogout }) {
  const { pathname } = useLocation()
  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-8">
      <div className="flex items-center gap-2">
        <Shield className="text-blue-400" size={24} />
        <span className="font-bold text-xl text-blue-400 tracking-wide">KanadShield</span>
      </div>
      <div className="flex gap-1">
        {links.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${pathname === to ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-3">
        <span className="text-xs text-gray-400">
          <span className="text-blue-400 font-medium">{user?.username}</span>
          {' '}· {user?.role}
        </span>
        <button
          onClick={onLogout}
          className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
        >
          Logout
        </button>
      </div>
    </nav>
  )
}

