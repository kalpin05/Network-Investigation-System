import { useState, useEffect } from 'react'
import { Activity, ShieldAlert, Cpu } from 'lucide-react'
import axios from 'axios'
import StreamModal from './StreamModal'
import ThreatIntelModal from './ThreatIntelModal'

const API = window.location.protocol + '//' + window.location.hostname + ':8000'

export default function PacketTable({ sessionId }) {
  const [packets, setPackets] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  const [streamModalOpen, setStreamModalOpen] = useState(false)
  const [selectedPacket, setSelectedPacket] = useState(null)
  
  const [intelIp, setIntelIp] = useState(null)

  useEffect(() => {
    if (!sessionId) return
    setLoading(true)
    axios.get(`${API}/api/sessions/${sessionId}/packets`)
      .then(r => {
        if (r.data.error) {
          setError(r.data.error)
        } else {
          setPackets(r.data)
          setError(null)
        }
      })
      .catch(err => {
        setError(err.message)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [sessionId])

  if (!sessionId) {
    return (
      <div className="bg-slate-950/60 border border-cyan-900/30 rounded-xl p-8 text-center font-mono text-xs text-cyan-500/60 backdrop-blur-md">
        [SYS_PROMPT: SELECT A CAPTURE SESSION TO INITIALIZE TELEMETRY DATA]
      </div>
    )
  }

  return (
    <div className="bg-slate-950/60 border border-cyan-500/30 rounded-xl overflow-hidden mt-6 backdrop-blur-md shadow-[0_0_20px_rgba(0,240,255,0.1)]">
      <div className="px-5 py-4 border-b border-cyan-500/20 flex items-center justify-between bg-gray-900/20 font-mono">
        <div className="flex items-center gap-2 font-bold text-cyan-400">
          <Activity size={18} className="text-cyan-400 animate-pulse" />
          <span>[PARSED_PACKETS_DIAGNOSTIC] // SESSION: {sessionId.slice(0, 8)}...</span>
        </div>
        <div className="text-[10px] text-cyan-400 bg-cyan-950/40 border border-cyan-500/20 px-2 py-0.5 rounded font-bold">
          INDEX: {packets.length} PKTS
        </div>
      </div>

      {loading && (
        <div className="py-16 text-center text-cyan-500 flex flex-col items-center justify-center gap-3 font-mono">
          <Cpu className="animate-spin text-cyan-400" size={36} />
          <span className="text-xs font-bold tracking-widest text-cyan-400">[QUERYING_ELASTICSEARCH_INDEX...]</span>
        </div>
      )}

      {error && (
        <div className="py-12 text-center text-red-400 px-4 font-mono">
          <ShieldAlert className="mx-auto mb-2 text-red-500 animate-bounce" size={36} />
          <p className="font-bold text-sm">[ELASTICSEARCH_QUERY_FAILURE]</p>
          <p className="text-[10px] text-gray-500 font-mono mt-2">{error}</p>
        </div>
      )}

      {!loading && !error && packets.length === 0 && (
        <div className="py-12 text-center text-cyan-600/60 font-mono text-xs">
          [NULL: NO DATAFRAMES ENCOUNTERED FOR THIS CONSOLE SESSION]
        </div>
      )}

      {!loading && !error && packets.length > 0 && (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-950 text-gray-400 font-mono text-[10px] tracking-wider uppercase border-b border-cyan-900/30">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Protocol</th>
                <th className="px-4 py-3">Source IP : Port</th>
                <th className="px-4 py-3">Destination IP : Port</th>
                <th className="px-4 py-3 text-right">Length (B)</th>
                <th className="px-4 py-3">Info</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-900/40">
              {packets.map((p, idx) => (
                <tr key={p.id || idx} className="hover:bg-cyan-500/10 transition-colors text-gray-300 font-mono text-xs">
                  <td className="px-4 py-3 text-gray-400">
                    {p.timestamp ? new Date(p.timestamp).toLocaleTimeString() : 'N/A'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-950/40 text-cyan-300 border border-cyan-500/30 shadow-[0_0_6px_rgba(0,240,255,0.15)]">
                      {p.protocol || 'UNKNOWN'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-cyan-400">
                    <span 
                      onClick={() => setIntelIp(p.src_ip)}
                      className="cursor-pointer hover:text-cyan-300 hover:underline transition-colors font-bold"
                      title="View Threat Intelligence"
                    >
                      {p.src_ip}
                    </span>
                    {p.src_port > 0 && <span className="text-gray-500">:{p.src_port}</span>}
                  </td>
                  <td className="px-4 py-3 text-cyan-400">
                    <span 
                      onClick={() => setIntelIp(p.dst_ip)}
                      className="cursor-pointer hover:text-cyan-300 hover:underline transition-colors font-bold"
                      title="View Threat Intelligence"
                    >
                      {p.dst_ip}
                    </span>
                    {p.dst_port > 0 && <span className="text-gray-500">:{p.dst_port}</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-white">{p.packet_length?.toLocaleString()}</td>
                  <td className="px-4 py-3 truncate max-w-xs text-[11px]">
                    {p.dns_query && <span className="text-yellow-400 font-bold">DNS: {p.dns_query}</span>}
                    {p.http_host && <span className="text-emerald-400 font-bold">HTTP: {p.http_host}</span>}
                    {p.flags && !p.dns_query && !p.http_host && <span className="text-fuchsia-400">Flags: {p.flags}</span>}
                    {!p.dns_query && !p.http_host && !p.flags && <span className="text-gray-600">-</span>}
                  </td>
                  <td className="px-4 py-3">
                    {(p.protocol === 'TCP' || p.flags || ['HTTP', 'TLS', 'SSL', 'SSH', 'FTP', 'SMTP'].includes(p.protocol)) && p.src_port > 0 && p.dst_port > 0 && (
                      <button 
                        onClick={() => {
                          setSelectedPacket(p);
                          setStreamModalOpen(true);
                        }}
                        className="bg-cyan-950/40 hover:bg-cyan-500/20 text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 text-[9px] px-2 py-1 rounded font-bold uppercase transition-all cursor-pointer hover:shadow-[0_0_8px_rgba(0,240,255,0.2)]"
                      >
                        [FOLLOW]
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {streamModalOpen && selectedPacket && (
        <StreamModal 
          packet={selectedPacket} 
          sessionId={selectedPacket.session_id || sessionId} 
          onClose={() => setStreamModalOpen(false)} 
        />
      )}

      {intelIp && (
        <ThreatIntelModal 
          ip={intelIp} 
          onClose={() => setIntelIp(null)} 
        />
      )}
    </div>
  )
}
