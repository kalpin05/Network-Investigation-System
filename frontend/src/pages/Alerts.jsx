import { useEffect, useState } from 'react'
import { AlertTriangle, AlertCircle, Info, RefreshCw, ShieldAlert, X, Copy, Check, Terminal } from 'lucide-react'
import axios from 'axios'

const API = window.location.protocol + '//' + window.location.hostname + ':8000'

const SEVERITY_CONFIG = {
  critical: { color: 'red',    bg: 'bg-red-900/50',    text: 'text-red-300',    border: 'border-red-700',    icon: AlertCircle },
  high:     { color: 'orange', bg: 'bg-orange-900/50', text: 'text-orange-300', border: 'border-orange-700', icon: AlertTriangle },
  medium:   { color: 'yellow', bg: 'bg-yellow-900/50', text: 'text-yellow-300', border: 'border-yellow-700', icon: AlertTriangle },
  low:      { color: 'blue',   bg: 'bg-blue-900/50',   text: 'text-blue-300',   border: 'border-blue-700',   icon: Info },
}

export default function Alerts() {
  const [alerts, setAlerts] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [containmentIp, setContainmentIp] = useState(null)

  const load = async () => {
    setLoading(true)
    const params = filter !== 'all' ? { severity: filter } : {}
    try {
      const r = await axios.get(`${API}/api/alerts`, { params })
      setAlerts(r.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filter])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Alerts</h1>
        <div className="flex gap-2 items-center">
          {['all', 'critical', 'high', 'medium', 'low'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded text-sm font-medium capitalize transition-colors
                ${filter === s ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >
              {s}
            </button>
          ))}
          <button onClick={load} className="p-2 bg-gray-800 rounded hover:bg-gray-700">
            <RefreshCw size={16} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {alerts.map(alert => {
          const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.low
          const Icon = cfg.icon
          return (
            <div key={alert.alert_id} className={`${cfg.bg} border ${cfg.border} rounded-xl p-4`}>
              <div className="flex items-start gap-3">
                <Icon size={20} className={`${cfg.text} mt-0.5 flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`font-mono font-bold text-sm ${cfg.text}`}>{alert.rule_name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium uppercase
                      ${cfg.text} border ${cfg.border}`}>
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-gray-300 text-sm">{alert.description}</p>
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    <span>SRC: <span className="text-gray-400 font-mono">{alert.src_ip}</span></span>
                    <span>DST: <span className="text-gray-400 font-mono">{alert.dst_ip}</span></span>
                    <span>{new Date(alert.fired_at).toLocaleString()}</span>
                  </div>
                </div>
                
                <button
                  onClick={() => setContainmentIp(alert.src_ip)}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <ShieldAlert size={14} />
                  Block Offender
                </button>
              </div>
            </div>
          )
        })}
        {alerts.length === 0 && !loading && (
          <div className="text-center py-16 text-gray-500">No alerts. Upload a malicious PCAP to test detection.</div>
        )}
      </div>

      {containmentIp && (
        <ContainmentModal ip={containmentIp} onClose={() => setContainmentIp(null)} />
      )}
    </div>
  )
}

function ContainmentModal({ ip, onClose }) {
  const [activeTab, setActiveTab] = useState('linux')
  const [copied, setCopied] = useState(false)

  const scripts = {
    linux: `sudo iptables -A INPUT -s ${ip} -j DROP\nsudo iptables-save > /etc/iptables/rules.v4`,
    windows: `New-NetFirewallRule -DisplayName "Block ${ip}" -Direction Inbound -Action Block -RemoteAddress ${ip}`
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(scripts[activeTab])
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden">
        <div className="bg-gray-800 px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="text-red-500" size={24} />
            <h2 className="text-lg font-bold text-white">Incident Response Playbook</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <p className="text-gray-300 text-sm mb-6">
            Execute the following containment script to immediately block all inbound traffic from malicious IP: <strong className="text-red-400 font-mono">{ip}</strong>
          </p>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab('linux')}
              className={`px-4 py-2 rounded-t-lg text-sm font-semibold transition-colors border-b-2 ${
                activeTab === 'linux' ? 'border-red-500 text-white bg-gray-800' : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              Linux (iptables)
            </button>
            <button
              onClick={() => setActiveTab('windows')}
              className={`px-4 py-2 rounded-t-lg text-sm font-semibold transition-colors border-b-2 ${
                activeTab === 'windows' ? 'border-red-500 text-white bg-gray-800' : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              Windows (PowerShell)
            </button>
          </div>

          <div className="bg-black rounded-lg border border-gray-800 p-4 relative group">
            <pre className="font-mono text-sm text-green-400 overflow-x-auto p-2">
              <code>{scripts[activeTab]}</code>
            </pre>
            <button
              onClick={handleCopy}
              className="absolute top-4 right-4 bg-gray-800 hover:bg-gray-700 text-gray-300 p-2 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2"
            >
              {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
              <span className="text-xs font-semibold">{copied ? 'Copied!' : 'Copy Script'}</span>
            </button>
          </div>
        </div>

        <div className="bg-gray-800/50 px-6 py-4 border-t border-gray-700 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded font-medium transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
