import { useState, useEffect } from 'react'
import { Upload, Wifi, Shield, AlertTriangle, Download, Database, BarChart3 } from 'lucide-react'
import axios from 'axios'
import PacketTable from '../components/PacketTable'
import DPIPanel from '../components/DPIPanel'

const API = 'http://localhost:8000'

export default function Dashboard() {
  const [sessions, setSessions] = useState([])
  const [uploading, setUploading] = useState(false)
  const [stats, setStats] = useState({ sessions: 0, packets: 0, alerts: 0 })
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [custodyLogs, setCustodyLogs] = useState([])
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [activeTab, setActiveTab] = useState('packets')

  const fetchCustodyLogs = () => {
    axios.get(`${API}/api/custody`)
      .then(r => setCustodyLogs(r.data))
      .catch(err => console.error("[Custody] Load failed", err))
  }

  useEffect(() => {
    axios.get(`${API}/api/sessions`).then(r => {
      setSessions(r.data)
      if (r.data.length > 0 && !selectedSessionId) {
        setSelectedSessionId(r.data[0].session_id)
      }
    })
    axios.get(`${API}/api/dashboard`).then(r => setStats(r.data)).catch(() => {})
    fetchCustodyLogs()
  }, [])

  const handleUploadSubmit = async (pcapFile, keylogFile) => {
    if (!pcapFile) return
    setUploading(true)
    const form = new FormData()
    form.append('file', pcapFile)
    if (keylogFile) form.append('keylog_file', keylogFile)
    
    try {
      setShowUploadModal(false)
      const res = await axios.post(`${API}/api/pcap/upload`, form)
      const r = await axios.get(`${API}/api/sessions`)
      setSessions(r.data)
      if (res.data.session_id) {
        setSelectedSessionId(res.data.session_id)
      }
      fetchCustodyLogs()
    } catch(err) {
      console.error("[Upload] Failed", err)
    } finally {
      setUploading(false)
    }
  }

  const downloadEvidence = async (sessionId, filename) => {
    try {
      const res = await axios.get(`${API}/api/evidence/${sessionId}`, {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `evidence_${filename}.zip`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      fetchCustodyLogs()
    } catch (err) {
      console.error("[Download] Evidence download failed", err)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <button 
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg cursor-pointer transition-colors"
        >
          <Upload size={16} />
          {uploading ? 'Uploading...' : 'Upload PCAP'}
        </button>
      </div>

      {showUploadModal && (
        <UploadModal 
          onClose={() => setShowUploadModal(false)}
          onSubmit={handleUploadSubmit}
          uploading={uploading}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Sessions', value: sessions.length, icon: Shield, colorClass: 'text-blue-400' },
          { label: 'Total Packets', value: sessions.reduce((a, s) => a + (s.packet_count || 0), 0).toLocaleString(), icon: Wifi, colorClass: 'text-green-400' },
          { label: 'Active Alerts', value: stats.alerts || 0, icon: AlertTriangle, colorClass: 'text-red-400' },
        ].map(({ label, value, icon: Icon, colorClass }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className={`${colorClass} mb-2`}><Icon size={20} /></div>
            <div className="text-2xl font-bold text-white">{value}</div>
            <div className="text-gray-400 text-sm mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Sessions and Live Capture */}
      <div className="grid grid-cols-3 gap-6">
        {/* Sessions table */}
        <div className="col-span-2 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden h-[360px] overflow-y-auto">
          <div className="px-5 py-4 border-b border-gray-800 font-semibold text-gray-300">Capture Sessions</div>
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-800 text-gray-400">
              <tr>
                {['Filename', 'Packets', 'Threat Score', 'Status', 'Uploaded', 'SHA-256', 'Evidence'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, i) => (
                <tr 
                  key={s.session_id} 
                  className={`border-t border-gray-800 cursor-pointer transition-colors 
                    ${selectedSessionId === s.session_id 
                      ? 'bg-blue-600/20 hover:bg-blue-600/30' 
                      : i % 2 === 0 ? 'hover:bg-gray-800/50' : 'bg-gray-900/50 hover:bg-gray-800/50'}`}
                >
                  <td onClick={() => setSelectedSessionId(s.session_id)} className="px-4 py-3 text-blue-300 font-mono text-xs">{s.filename}</td>
                  <td onClick={() => setSelectedSessionId(s.session_id)} className="px-4 py-3 text-white">{s.packet_count?.toLocaleString()}</td>
                  <td onClick={() => setSelectedSessionId(s.session_id)} className="px-4 py-3">
                    <ThreatScoreBadge score={s.threat_score} />
                  </td>
                  <td onClick={() => setSelectedSessionId(s.session_id)} className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium
                      ${s.status === 'complete' ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td onClick={() => setSelectedSessionId(s.session_id)} className="px-4 py-3 text-gray-400 text-xs">{new Date(s.upload_time).toLocaleString()}</td>
                  <td onClick={() => setSelectedSessionId(s.session_id)} className="px-4 py-3 text-gray-500 font-mono text-xs">{s.sha256_hash?.slice(0, 12)}...</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadEvidence(s.session_id, s.filename) }}
                      className="bg-gray-800 hover:bg-gray-700 text-gray-300 p-1.5 rounded transition-colors cursor-pointer"
                      title="Download ZIP Evidence"
                    >
                      <Download size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sessions.length === 0 && (
            <div className="text-center py-12 text-gray-500">No sessions yet. Upload a PCAP to begin.</div>
          )}
        </div>

        {/* Live Feed Card */}
        <LiveFeed />
      </div>

      {/* Traffic Breakdowns (Top Talkers, Protocols, Ports) */}
      {stats.top_talkers && stats.top_talkers.length > 0 && (
        <div className="grid grid-cols-3 gap-6">
          <TopTalkers data={stats.top_talkers} />
          <TopProtocols data={stats.top_protocols} />
          <TopPorts data={stats.top_ports} />
        </div>
      )}

      {/* Session Details Tabbed Navigation */}
      {selectedSessionId && (
        <div className="flex gap-4 border-b border-gray-800 pb-2 mt-6">
          <button
            onClick={() => setActiveTab('packets')}
            className={`flex items-center gap-2 pb-2 text-sm font-semibold border-b-2 cursor-pointer transition-all ${
              activeTab === 'packets'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Database size={16} /> Parsed Packets
          </button>
          <button
            onClick={() => setActiveTab('dpi')}
            className={`flex items-center gap-2 pb-2 text-sm font-semibold border-b-2 cursor-pointer transition-all ${
              activeTab === 'dpi'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <BarChart3 size={16} /> Deep Packet Inspection (DPI)
          </button>
        </div>
      )}

      {selectedSessionId && activeTab === 'packets' && (
        <PacketTable sessionId={selectedSessionId} />
      )}

      {selectedSessionId && activeTab === 'dpi' && (
        <DPIPanel sessionId={selectedSessionId} />
      )}

      {/* Chain of Custody Audit Log */}
      <CustodyLogs logs={custodyLogs} />
    </div>
  )
}

// ── Live capture feed component ─────────────────────────────────────────────
function LiveFeed() {
  const [active, setActive] = useState(false)
  const [packets, setPackets] = useState([])

  useEffect(() => {
    let ws = null
    if (active) {
      const wsUrl = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.hostname + ':8000/ws/capture'
      ws = new WebSocket(wsUrl)
      ws.onmessage = (e) => {
        const pkt = JSON.parse(e.data)
        setPackets(prev => [pkt, ...prev].slice(0, 15))
      }
      ws.onerror = (err) => {
        console.error("WebSocket error", err)
      }
      ws.onclose = () => {
        setActive(false)
      }
    }
    return () => {
      if (ws) ws.close()
    }
  }, [active])

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col justify-between h-[360px]">
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-3">
          <span className="font-semibold text-gray-300 flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${active ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`} />
            Live Capture Feed
          </span>
          <button
            onClick={() => setActive(!active)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors
              ${active ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
          >
            {active ? 'Stop Capture' : 'Start Capture'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-[11px]">
          {packets.map((p, idx) => (
            <div key={idx} className="flex justify-between border-b border-gray-800/40 pb-1 text-gray-300">
              <span className="text-blue-400">{p.src_ip}</span>
              <span className="text-gray-500">➔</span>
              <span className="text-green-400">{p.dst_ip}</span>
              <span className="text-yellow-500 font-bold">{p.protocol}</span>
              <span className="text-gray-400">{p.packet_length}B</span>
            </div>
          ))}
          {packets.length === 0 && (
            <div className="text-center py-20 text-gray-500 font-sans text-xs">
              {active ? 'Sniffing local interfaces...' : 'Click Start to listen to live packet traffic.'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Chain of custody audit log table component ──────────────────────────────
function CustodyLogs({ logs }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-800 font-semibold text-gray-300">Chain of Custody Audit Log</div>
      <table className="w-full text-sm text-left">
        <thead className="bg-gray-800 text-gray-400">
          <tr>
            {['Timestamp', 'User', 'Action', 'Session ID', 'IP Address'].map(h => (
              <th key={h} className="px-4 py-2.5 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.log_id} className="border-t border-gray-800/60 hover:bg-gray-800/30">
              <td className="px-4 py-2.5 text-gray-400">{new Date(l.accessed_at).toLocaleString()}</td>
              <td className="px-4 py-2.5 text-blue-300 font-semibold">{l.username || 'System'}</td>
              <td className="px-4 py-2.5">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize
                  ${l.action === 'upload' ? 'bg-green-900/40 text-green-300 border border-green-700/50' : 
                    l.action.startsWith('export') ? 'bg-purple-900/40 text-purple-300 border border-purple-700/50' : 
                    'bg-blue-900/40 text-blue-300 border border-blue-700/50'}`}>
                  {l.action.replace('_', ' ')}
                </span>
              </td>
              <td className="px-4 py-2.5 text-gray-500 font-mono text-[11px]">{l.session_id || 'N/A'}</td>
              <td className="px-4 py-2.5 text-gray-400 font-mono">{l.ip_address}</td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center py-8 text-gray-500 font-sans">No audit log entries found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function UploadModal({ onClose, onSubmit, uploading }) {
  const [pcapFile, setPcapFile] = useState(null)
  const [keylogFile, setKeylogFile] = useState(null)

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg space-y-5">
        <div className="flex justify-between items-center border-b border-gray-800 pb-3">
          <h2 className="text-xl font-bold text-white">Upload Capture Session</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">1. PCAP File (Required)</label>
            <input 
              type="file" 
              accept=".pcap,.pcapng" 
              onChange={e => setPcapFile(e.target.files[0])}
              className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-900/40 file:text-blue-300 hover:file:bg-blue-900/60 cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
              2. TLS Keylog File (Optional) <span className="px-2 py-0.5 rounded text-[10px] bg-purple-900/50 text-purple-300">Decryption</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">Upload the SSL/TLS pre-master secret log file to decrypt HTTPS traffic automatically.</p>
            <input 
              type="file" 
              accept=".log,.txt" 
              onChange={e => setKeylogFile(e.target.files[0])}
              className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-800 file:text-gray-300 hover:file:bg-gray-700 cursor-pointer"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-3">
          <button 
            onClick={() => onSubmit(pcapFile, keylogFile)}
            disabled={!pcapFile || uploading}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors
              ${(!pcapFile || uploading) ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'}`}
          >
            {uploading ? 'Processing...' : 'Upload & Analyze'}
          </button>
          <button 
            onClick={onClose}
            disabled={uploading}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Traffic breakdown panels ────────────────────────────────────────────────
function TopTalkers({ data }) {
  if (!data || data.length === 0) return null
  const max = data[0]?.bytes || 1

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h2 className="text-base font-semibold text-white mb-4 font-sans">Top Talkers</h2>
      <div className="space-y-2">
        {data.map((t, i) => (
          <div key={t.ip}>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-mono text-blue-300">{t.ip}</span>
              <span className="text-gray-400">{(t.bytes / 1024).toFixed(1)} KB</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${i === 0 ? 'bg-red-500' : 'bg-blue-500'}`}
                style={{ width: `${(t.bytes / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TopProtocols({ data }) {
  if (!data || data.length === 0) return null
  const max = data[0]?.count || 1

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h2 className="text-base font-semibold text-white mb-4 font-sans">Top Protocols</h2>
      <div className="space-y-2">
        {data.map((p, i) => (
          <div key={p.protocol}>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-mono text-green-300">{p.protocol}</span>
              <span className="text-gray-400">{p.count} packets</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${i === 0 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${(p.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TopPorts({ data }) {
  if (!data || data.length === 0) return null
  const max = data[0]?.count || 1

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h2 className="text-base font-semibold text-white mb-4 font-sans">Top Destination Ports</h2>
      <div className="space-y-2">
        {data.map((p, i) => (
          <div key={p.port}>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-mono text-purple-300">Port {p.port}</span>
              <span className="text-gray-400">{p.count} packets</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${i === 0 ? 'bg-purple-500' : 'bg-indigo-500'}`}
                style={{ width: `${(p.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ThreatScoreBadge({ score }) {
  if (score === undefined || score === null) return <span className="text-gray-600 text-xs">—</span>
  const color =
    score >= 70 ? 'bg-red-900/40 text-red-300 border-red-700' :
    score >= 40 ? 'bg-orange-900/40 text-orange-300 border-orange-700' :
    score >= 20 ? 'bg-yellow-900/40 text-yellow-300 border-yellow-700' :
                  'bg-green-900/40 text-green-300 border-green-700'
  return (
    <span className={`px-2 py-0.5 rounded border text-[11px] font-mono font-bold leading-none ${color}`}>
      {score}/100
    </span>
  )
}
