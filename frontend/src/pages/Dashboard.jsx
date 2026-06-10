import { useState, useEffect } from 'react'
import { Upload, Wifi, Shield, AlertTriangle } from 'lucide-react'
import axios from 'axios'
import PacketTable from '../components/PacketTable'

const API = 'http://localhost:8000'

export default function Dashboard() {
  const [sessions, setSessions] = useState([])
  const [uploading, setUploading] = useState(false)
  const [stats, setStats] = useState({ sessions: 0, packets: 0, alerts: 0 })
  const [selectedSessionId, setSelectedSessionId] = useState(null)

  useEffect(() => {
    axios.get(`${API}/api/sessions`).then(r => {
      setSessions(r.data)
      if (r.data.length > 0 && !selectedSessionId) {
        setSelectedSessionId(r.data[0].session_id)
      }
    })
    axios.get(`${API}/api/dashboard`).then(r => setStats(r.data)).catch(() => {})
  }, [])

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await axios.post(`${API}/api/pcap/upload`, form)
      const r = await axios.get(`${API}/api/sessions`)
      setSessions(r.data)
      if (res.data.session_id) {
        setSelectedSessionId(res.data.session_id)
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <label className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg cursor-pointer transition-colors">
          <Upload size={16} />
          {uploading ? 'Uploading...' : 'Upload PCAP'}
          <input type="file" accept=".pcap,.pcapng" onChange={handleUpload} className="hidden" />
        </label>
      </div>

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

      {/* Sessions table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 font-semibold text-gray-300">Capture Sessions</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-800 text-gray-400">
            <tr>
              {['Filename', 'Packets', 'Status', 'Uploaded', 'SHA-256'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sessions.map((s, i) => (
              <tr 
                key={s.session_id} 
                onClick={() => setSelectedSessionId(s.session_id)}
                className={`border-t border-gray-800 cursor-pointer transition-colors 
                  ${selectedSessionId === s.session_id 
                    ? 'bg-blue-600/20 hover:bg-blue-600/30' 
                    : i % 2 === 0 ? 'hover:bg-gray-800/50' : 'bg-gray-900/50 hover:bg-gray-800/50'}`}
              >
                <td className="px-4 py-3 text-blue-300 font-mono text-xs">{s.filename}</td>
                <td className="px-4 py-3 text-white">{s.packet_count?.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium
                    ${s.status === 'complete' ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'}`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{new Date(s.upload_time).toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{s.sha256_hash?.slice(0, 12)}...</td>
              </tr>
            ))}
          </tbody>
        </table>
        {sessions.length === 0 && (
          <div className="text-center py-12 text-gray-500">No sessions yet. Upload a PCAP to begin.</div>
        )}
      </div>

      {/* Packet viewer table */}
      <PacketTable sessionId={selectedSessionId} />
    </div>
  )
}
