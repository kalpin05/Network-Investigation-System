import { useEffect, useState } from 'react'
import { AlertTriangle, AlertCircle, Info, RefreshCw } from 'lucide-react'
import axios from 'axios'

const API = 'http://localhost:8000'

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
              </div>
            </div>
          )
        })}
        {alerts.length === 0 && !loading && (
          <div className="text-center py-16 text-gray-500">No alerts. Upload a malicious PCAP to test detection.</div>
        )}
      </div>
    </div>
  )
}
