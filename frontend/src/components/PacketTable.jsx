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
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">
        Select a session from the table above to view its parsed packets.
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mt-6">
      <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-gray-300">
          <Activity size={18} className="text-blue-400" />
          <span>Parsed Packets (Session: {sessionId.slice(0, 8)})</span>
        </div>
        <div className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">
          Showing up to {packets.length} packets
        </div>
      </div>

      {loading && (
        <div className="py-12 text-center text-gray-500 flex flex-col items-center justify-center gap-2">
          <Cpu className="animate-spin text-blue-400" size={32} />
          <span>Querying Elasticsearch...</span>
        </div>
      )}

      {error && (
        <div className="py-12 text-center text-red-400 px-4">
          <ShieldAlert className="mx-auto mb-2 text-red-500" size={32} />
          <p className="font-semibold">Elasticsearch Query Failed</p>
          <p className="text-xs text-gray-500 font-mono mt-1">{error}</p>
        </div>
      )}

      {!loading && !error && packets.length === 0 && (
        <div className="py-12 text-center text-gray-500">
          No packets found in Elasticsearch for this session.
        </div>
      )}

      {!loading && !error && packets.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-800 text-gray-400 uppercase tracking-wider text-[10px] border-b border-gray-800">
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
            <tbody className="divide-y divide-gray-850">
              {packets.map((p, idx) => (
                <tr key={p.id || idx} className={`hover:bg-gray-850/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-gray-900/30'}`}>
                  <td className="px-4 py-3 text-gray-400 font-mono">
                    {p.timestamp ? new Date(p.timestamp).toLocaleTimeString() : 'N/A'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-900/30 text-blue-300 border border-blue-800/40">
                      {p.protocol || 'UNKNOWN'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-300">
                    <span 
                      onClick={() => setIntelIp(p.src_ip)}
                      className="cursor-pointer hover:text-blue-400 hover:underline transition-colors"
                      title="View Threat Intelligence"
                    >
                      {p.src_ip}
                    </span>
                    {p.src_port > 0 && <span className="text-gray-500">:{p.src_port}</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-300">
                    <span 
                      onClick={() => setIntelIp(p.dst_ip)}
                      className="cursor-pointer hover:text-blue-400 hover:underline transition-colors"
                      title="View Threat Intelligence"
                    >
                      {p.dst_ip}
                    </span>
                    {p.dst_port > 0 && <span className="text-gray-500">:{p.dst_port}</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300">{p.packet_length?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-400 font-mono truncate max-w-xs">
                    {p.dns_query && <span className="text-yellow-400/80">DNS: {p.dns_query}</span>}
                    {p.http_host && <span className="text-green-400/80">HTTP: {p.http_host}</span>}
                    {p.flags && !p.dns_query && !p.http_host && <span className="text-purple-400/80">Flags: {p.flags}</span>}
                    {!p.dns_query && !p.http_host && !p.flags && <span className="text-gray-600">-</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {(p.protocol === 'TCP' || p.flags || ['HTTP', 'TLS', 'SSL', 'SSH', 'FTP', 'SMTP'].includes(p.protocol)) && p.src_port > 0 && p.dst_port > 0 && (
                      <button 
                        onClick={() => {
                          setSelectedPacket(p);
                          setStreamModalOpen(true);
                        }}
                        className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] px-2 py-1 rounded font-bold uppercase transition-colors"
                      >
                        Follow
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
