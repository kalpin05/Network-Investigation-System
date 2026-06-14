import { useState, useEffect } from 'react'
import { ShieldAlert, Globe, MapPin, AlertTriangle, CheckCircle, Activity, X } from 'lucide-react'
import axios from 'axios'

const API = 'http://localhost:8000'

export default function ThreatIntelModal({ ip, onClose }) {
  const [intel, setIntel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    axios.get(`${API}/api/threat-intel/${ip}`)
      .then(res => {
        setIntel(res.data)
        setError(null)
      })
      .catch(err => {
        console.error("Threat intel failed", err)
        setError("Failed to fetch intelligence dossier.")
      })
      .finally(() => setLoading(false))
  }, [ip])

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-gray-800 px-6 py-4 flex items-center justify-between border-b border-gray-700">
          <div className="flex items-center gap-3">
            <ShieldAlert className="text-blue-400" size={24} />
            <div>
              <h2 className="text-xl font-bold text-white leading-none">Cyber Intelligence Dossier</h2>
              <span className="text-xs text-gray-400">National Cyber Crime Database Integration</span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors cursor-pointer p-1 rounded-md hover:bg-gray-700">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && (
            <div className="py-20 flex flex-col items-center justify-center gap-4 text-blue-400">
              <Activity className="animate-spin" size={40} />
              <p className="font-semibold tracking-widest text-sm">QUERYING INTELLIGENCE FEEDS...</p>
            </div>
          )}

          {error && (
            <div className="py-20 text-center text-red-400">
              <ShieldAlert className="mx-auto mb-3" size={40} />
              <p className="font-semibold text-lg">{error}</p>
            </div>
          )}

          {!loading && !error && intel && (
            <div className="space-y-6">
              
              {/* Top Section: IP and Risk Score */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-3xl font-mono font-bold text-white tracking-wider">{intel.ip}</h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                    <span className="flex items-center gap-1"><MapPin size={14} /> {intel.geo.city}, {intel.geo.country}</span>
                    <span className="flex items-center gap-1"><Globe size={14} /> {intel.geo.isp}</span>
                  </div>
                </div>
                
                {/* Risk Badge */}
                <div className={`flex flex-col items-center justify-center p-3 rounded-xl border min-w-[120px] shadow-lg
                  ${intel.threat.threat_level === 'CRITICAL' ? 'bg-red-900/30 border-red-700 text-red-400' :
                    intel.threat.threat_level === 'HIGH' ? 'bg-orange-900/30 border-orange-700 text-orange-400' :
                    intel.threat.threat_level === 'MEDIUM' ? 'bg-yellow-900/30 border-yellow-700 text-yellow-400' :
                    'bg-green-900/30 border-green-700 text-green-400'}`}
                >
                  <span className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">Risk Score</span>
                  <span className="text-3xl font-black">{intel.threat.risk_score}</span>
                  <span className="text-[10px] font-bold uppercase mt-1 px-2 py-0.5 rounded bg-black/30">
                    {intel.threat.threat_level}
                  </span>
                </div>
              </div>

              {/* Tags & History */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-800">
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Known Affiliations</h4>
                  <div className="flex flex-wrap gap-2">
                    {intel.threat.tags.map(tag => (
                      <span key={tag} className={`px-2.5 py-1 rounded text-xs font-bold shadow-sm
                        ${tag === 'Clean' || tag === 'Internal Network' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Incident History</h4>
                  <div className="bg-gray-800 rounded-lg p-4 space-y-2 border border-gray-750">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Reported Incidents:</span>
                      <span className="font-bold text-white">{intel.threat.reported_incidents}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Last Seen:</span>
                      <span className="font-bold text-white">{intel.threat.last_seen}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Warning Banner */}
              {intel.threat.risk_score > 60 && (
                <div className="mt-4 bg-red-950/50 border border-red-800 rounded-lg p-4 flex items-start gap-3">
                  <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
                  <div>
                    <h4 className="text-sm font-bold text-red-400">High Risk Indicator</h4>
                    <p className="text-xs text-red-300 mt-1">This IP address is associated with active cyber threats. Ensure all outbound connections to this host are blocked by KanadShield firewall rules.</p>
                  </div>
                </div>
              )}
              {intel.threat.risk_score <= 30 && (
                <div className="mt-4 bg-green-950/30 border border-green-800/50 rounded-lg p-4 flex items-start gap-3">
                  <CheckCircle className="text-green-500 shrink-0 mt-0.5" size={20} />
                  <div>
                    <h4 className="text-sm font-bold text-green-400">No Imminent Threat</h4>
                    <p className="text-xs text-green-300/70 mt-1">This IP does not currently appear on major blocklists. Proceed with standard analysis.</p>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  )
}
