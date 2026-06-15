import { useEffect, useState } from 'react'
import { FolderOpen, Plus, ChevronRight, AlertTriangle, CheckCircle, Clock, FileText, FileSearch, Hash, Play, Pause, ExternalLink, Download, Loader2, Shield } from 'lucide-react'
import axios from 'axios'
import { api } from '../api/client'
import StreamModal from '../components/StreamModal'
import { AttackChain } from '../components/AttackChain'


const API = window.location.protocol + '//' + window.location.hostname + ':8000'

const STATUS_CONFIG = {
  open:          { icon: Clock,         color: 'text-yellow-400', bg: 'bg-yellow-900/30', border: 'border-yellow-700' },
  investigating: { icon: AlertTriangle, color: 'text-blue-400',   bg: 'bg-blue-900/30',   border: 'border-blue-700' },
  closed:        { icon: CheckCircle,   color: 'text-green-400',  bg: 'bg-green-900/30',  border: 'border-green-700' },
}

export default function Cases() {
  const [cases, setCases] = useState([])
  const [selected, setSelected] = useState(null)
  const [caseDetail, setCaseDetail] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [alerts, setAlerts] = useState([])
  const [selectedAlerts, setSelectedAlerts] = useState([])
  const [exportLang, setExportLang] = useState('en')
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfMsg, setPdfMsg] = useState('')
  const [custodyLogs, setCustodyLogs] = useState([])

  useEffect(() => {
    loadCases()
    axios.get(`${API}/api/alerts?limit=50`).then(r => setAlerts(r.data)).catch(err => console.error(err))
  }, [])

  const loadCases = () => axios.get(`${API}/api/cases`).then(r => setCases(r.data)).catch(err => console.error(err))

  const loadCustodyLogs = async (caseAlerts) => {
    if (!caseAlerts || caseAlerts.length === 0) {
      setCustodyLogs([])
      return
    }
    const sessionIds = [...new Set(caseAlerts.map(a => a.session_id).filter(Boolean))]
    if (sessionIds.length === 0) {
      setCustodyLogs([])
      return
    }
    try {
      const promises = sessionIds.map(sid => 
        api.get('/api/custody', { params: { session_id: sid } })
      )
      const results = await Promise.all(promises)
      const allLogs = results.flatMap(r => r.data)
      const uniqueLogs = Array.from(new Map(allLogs.map(item => [item.log_id, item])).values())
      uniqueLogs.sort((a, b) => new Date(b.accessed_at) - new Date(a.accessed_at))
      setCustodyLogs(uniqueLogs)
    } catch (err) {
      console.error('Failed to load case custody logs', err)
    }
  }

  const openCase = (caseId) => {
    setSelected(caseId)
    axios.get(`${API}/api/cases/${caseId}`).then(r => {
      setCaseDetail(r.data)
      loadCustodyLogs(r.data.alerts)
    }).catch(err => console.error(err))
  }

  const createCase = async () => {
    if (!newTitle.trim()) return
    await axios.post(`${API}/api/cases`, {
      title: newTitle,
      notes: newNotes,
      alert_ids: selectedAlerts,
    }).catch(err => console.error(err))
    setShowCreate(false)
    setNewTitle('')
    setNewNotes('')
    setSelectedAlerts([])
    loadCases()
  }

  const updateStatus = async (caseId, status) => {
    await axios.patch(`${API}/api/cases/${caseId}`, { status }).catch(err => console.error(err))
    openCase(caseId)
    loadCases()
  }

  const updateNotes = async (caseId, notes) => {
    await axios.patch(`${API}/api/cases/${caseId}`, { notes }).catch(err => console.error(err))
  }

  const handleExportPDF = async (caseId) => {
    setPdfLoading(true)
    setPdfMsg('')
    try {
      const response = await api.get(`${API}/api/cases/${caseId}/export?lang=${exportLang}`, {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `kanadshield_case_${caseId.slice(0, 8)}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      setPdfMsg('✅ PDF downloaded!')
      if (caseDetail) {
        loadCustodyLogs(caseDetail.alerts)
      }
    } catch (err) {
      console.error('PDF export failed', err)
      setPdfMsg('❌ Export failed. Try again.')
    } finally {
      setPdfLoading(false)
      setTimeout(() => setPdfMsg(''), 4000)
    }
  }

  const handleExportEvidence = async (sessionId) => {
    if (!sessionId) { alert('No session linked to this case.'); return }
    try {
      const response = await api.get(`${API}/api/evidence/${sessionId}`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/zip' }))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `kanadshield_evidence_${sessionId.slice(0, 8)}.zip`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      if (caseDetail) {
        loadCustodyLogs(caseDetail.alerts)
      }
    } catch (err) {
      console.error('Evidence export failed', err)
      alert('Evidence export failed. Check if PCAP file exists.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Forensic Cases</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
        >
          <Plus size={16} /> New Case
        </button>
      </div>

      {/* Create Case Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg space-y-4">
            <h2 className="text-xl font-bold text-white">Create New Case</h2>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Case Title *</label>
              <input
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="e.g. Suspected DNS Exfiltration - June 2026"
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Initial Notes</label>
              <textarea
                value={newNotes}
                onChange={e => setNewNotes(e.target.value)}
                rows={3}
                placeholder="Describe the incident..."
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            {alerts.length > 0 && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">Link Alerts ({selectedAlerts.length} selected)</label>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {alerts.map(a => (
                    <label key={a.alert_id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedAlerts.includes(a.alert_id)}
                        onChange={e => {
                          if (e.target.checked) setSelectedAlerts(p => [...p, a.alert_id])
                          else setSelectedAlerts(p => p.filter(id => id !== a.alert_id))
                        }}
                        className="accent-blue-500"
                      />
                      <span className="text-xs font-mono text-red-400">{a.rule_name}</span>
                      <span className="text-xs text-gray-400 truncate">{a.src_ip} → {a.dst_ip}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={createCase} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer">
                Create Case
              </button>
              <button onClick={() => setShowCreate(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {/* Cases list */}
        <div className="col-span-1 space-y-2">
          {cases.length === 0 && (
            <div className="text-center py-12 text-gray-500 text-sm">
              No cases yet. Create one from detected alerts.
            </div>
          )}
          {cases.map(c => {
            const cfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.open
            const Icon = cfg.icon
            return (
              <button
                key={c.case_id}
                onClick={() => openCase(c.case_id)}
                className={`w-full text-left p-4 rounded-xl border transition-colors cursor-pointer
                  ${selected === c.case_id
                    ? 'bg-blue-900/40 border-blue-600'
                    : 'bg-gray-900 border-gray-800 hover:border-gray-600'
                  }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-white text-sm line-clamp-2">{c.title}</span>
                  <ChevronRight size={16} className="text-gray-500 flex-shrink-0 mt-0.5" />
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span className={`flex items-center gap-1 text-xs ${cfg.color}`}>
                    <Icon size={12} /> {c.status}
                  </span>
                  <span className="text-xs text-gray-500">{c.alert_count || 0} alerts</span>
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {new Date(c.created_at).toLocaleDateString()}
                </div>
              </button>
            )
          })}
        </div>

        {/* Case detail */}
        <div className="col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
          {!caseDetail ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm py-20">
              Select a case to view details
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">{caseDetail.title}</h2>
                  <p className="text-gray-400 text-sm mt-1">
                    Case ID: <span className="font-mono text-xs">{caseDetail.case_id}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  {['open', 'investigating', 'closed'].map(s => (
                    <button
                      key={s}
                      onClick={() => updateStatus(caseDetail.case_id, s)}
                      className={`px-3 py-1.5 rounded text-xs font-medium capitalize transition-colors cursor-pointer
                        ${caseDetail.status === s
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <select
                  value={exportLang}
                  onChange={(e) => setExportLang(e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="en">🇬🇧 English</option>
                  <option value="hi">🇮🇳 Hindi</option>
                  <option value="gu">🇮🇳 Gujarati</option>
                  <option value="es">🇪🇸 Español</option>
                  <option value="fr">🇫🇷 Français</option>
                  <option value="de">🇩🇪 Deutsch</option>
                  <option value="zh">🇨🇳 中文</option>
                  <option value="ja">🇯🇵 日本語</option>
                  <option value="ru">🇷🇺 Русский</option>
                  <option value="ar">🇸🇦 العربية</option>
                </select>
                <button
                  onClick={() => handleExportPDF(caseDetail.case_id)}
                  disabled={pdfLoading}
                  className="flex items-center gap-2 bg-red-700 hover:bg-red-600 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                >
                  {pdfLoading
                    ? <><Loader2 size={15} className="animate-spin" /> Generating...</>
                    : <><FileText size={16} /> Export PDF Report</>}
                </button>
                <button
                  onClick={() => handleExportEvidence(caseDetail.alerts?.[0]?.session_id)}
                  className="flex items-center gap-2 bg-indigo-700 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                >
                  <Download size={16} /> Evidence ZIP
                </button>
                {pdfMsg && (
                  <span className={`text-xs font-medium px-2 py-1 rounded ${
                    pdfMsg.startsWith('✅') ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                  }`}>{pdfMsg}</span>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Investigator Notes</label>
                <NotesEditor
                  initial={caseDetail.notes}
                  onSave={notes => updateNotes(caseDetail.case_id, notes)}
                />
              </div>

              {/* Linked alerts */}
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-3">
                  Linked Alerts ({caseDetail.alerts?.length || 0})
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {(caseDetail.alerts || []).map(a => (
                    <div key={a.alert_id} className="flex items-start gap-3 p-3 bg-gray-800 rounded-lg">
                      <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="flex gap-2 items-center">
                          <span className="text-red-400 font-mono text-xs font-bold">{a.rule_name}</span>
                          <span className="text-gray-500 text-xs capitalize">{a.severity}</span>
                        </div>
                        <p className="text-gray-300 text-xs mt-1">{a.description}</p>
                        <p className="text-gray-600 text-xs mt-1">
                          {a.src_ip} → {a.dst_ip} · {new Date(a.fired_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {(!caseDetail.alerts || caseDetail.alerts.length === 0) && (
                    <p className="text-gray-600 text-sm text-center py-4">No alerts linked to this case.</p>
                  )}
                </div>
              </div>

              {/* Attack kill chain timeline */}
              <AttackChain caseId={caseDetail.case_id} />

              {/* Evidence Chain of Custody Log */}
              <div className="bg-gray-800/40 border border-gray-700/60 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                  <Shield size={16} className="text-blue-400" />
                  Evidence Chain of Custody Log
                </h3>
                <p className="text-xs text-gray-400">
                  Secured chronological trail of actions involving this case's evidence.
                </p>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {custodyLogs.map((entry, i) => {
                    const cfg = {
                      upload: { label: 'Upload', color: 'text-emerald-400', bg: 'bg-emerald-950/30' },
                      view: { label: 'View', color: 'text-sky-400', bg: 'bg-sky-950/30' },
                      export: { label: 'Export', color: 'text-amber-400', bg: 'bg-amber-950/30' },
                      export_report: { label: 'Report Export', color: 'text-amber-400', bg: 'bg-amber-950/30' },
                      delete: { label: 'Delete', color: 'text-rose-400', bg: 'bg-rose-950/30' },
                    }[entry.action] || { label: entry.action, color: 'text-gray-400', bg: 'bg-gray-900/30' }

                    return (
                      <div key={entry.log_id || i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-gray-950/40 border border-gray-800/60 rounded-lg text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full font-medium text-[10px] ${cfg.color} ${cfg.bg}`}>
                            {cfg.label}
                          </span>
                          <span className="text-white font-semibold">{entry.username || 'System Seed'}</span>
                          <span className="text-gray-500 font-mono text-[10px]">({entry.ip_address || '127.0.0.1'})</span>
                        </div>
                        <span className="text-gray-400 font-mono text-[10px]">
                          {new Date(entry.accessed_at).toLocaleString()}
                        </span>
                      </div>
                    )
                  })}
                  {custodyLogs.length === 0 && (
                    <p className="text-gray-600 text-xs text-center py-4">No access events logged for this evidence yet.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Packet Search */}
      <PacketSearch />
    </div>
  )
}

// ── Notes editor with auto-save ──────────────────────────────────────────────
function NotesEditor({ initial, onSave }) {
  const [notes, setNotes] = useState(initial || '')
  const [saved, setSaved] = useState(true)

  // Sync state if initial changes (e.g. user selects a different case)
  useEffect(() => {
    setNotes(initial || '')
    setSaved(true)
  }, [initial])

  const handleSave = () => {
    onSave(notes)
    setSaved(true)
  }

  return (
    <div>
      <textarea
        value={notes}
        onChange={e => { setNotes(e.target.value); setSaved(false) }}
        rows={4}
        placeholder="Add investigation notes here..."
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm
          focus:outline-none focus:border-blue-500 resize-none"
      />
      <div className="flex justify-end mt-2">
        <button
          onClick={handleSave}
          className={`px-4 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer
            ${saved ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-green-700 hover:bg-green-600 text-white'}`}
          disabled={saved}
        >
          {saved ? 'Saved' : 'Save Notes'}
        </button>
      </div>
    </div>
  )
}

// ── Packet search component ──────────────────────────────────────────────────
function PacketSearch() {
  const [params, setParams] = useState({ src_ip: '', dst_ip: '', protocol: '', limit: 100 })
  const [results, setResults] = useState({ packets: [], total: 0 })
  const [loading, setLoading] = useState(false)
  const [streamModalOpen, setStreamModalOpen] = useState(false)
  const [selectedPacket, setSelectedPacket] = useState(null)

  const search = async () => {
    setLoading(true)
    const filteredParams = Object.fromEntries(Object.entries(params).filter(([, v]) => v))
    axios.get(`${API}/api/packets`, { params: filteredParams }).then(r => {
      setResults(r.data)
    }).catch(err => {
      console.error(err)
    }).finally(() => {
      setLoading(false)
    })
  }

  const openStream = (p) => {
    setSelectedPacket(p)
    setStreamModalOpen(true)
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h2 className="text-lg font-semibold text-white mb-4">Packet Search</h2>
      <div className="flex gap-3 mb-4">
        {[
          { key: 'src_ip', placeholder: 'Source IP' },
          { key: 'dst_ip', placeholder: 'Destination IP' },
          { key: 'protocol', placeholder: 'Protocol (TCP, DNS...)' },
        ].map(({ key, placeholder }) => (
          <input
            key={key}
            value={params[key]}
            onChange={e => setParams(p => ({ ...p, [key]: e.target.value }))}
            placeholder={placeholder}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm
              focus:outline-none focus:border-blue-500"
            onKeyDown={e => e.key === 'Enter' && search()}
          />
        ))}
        <button
          onClick={search}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {results.total > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-gray-400 bg-gray-800">
              <tr>
                <th className="px-3 py-2 text-left">Timestamp</th>
                <th className="px-3 py-2 text-left">Src IP</th>
                <th className="px-3 py-2 text-left">Dst IP</th>
                <th className="px-3 py-2 text-left">Protocol</th>
                <th className="px-3 py-2 text-left">Length (B)</th>
                <th className="px-3 py-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {results.packets.map((p, i) => (
                <tr key={i} className="hover:bg-gray-800/50">
                  <td className="px-3 py-2 text-gray-400 font-mono">
                    {p.timestamp ? new Date(p.timestamp).toLocaleTimeString() : '-'}
                  </td>
                  <td className="px-3 py-2 text-blue-300 font-mono">{p.src_ip}</td>
                  <td className="px-3 py-2 text-green-300 font-mono">{p.dst_ip}</td>
                  <td className="px-3 py-2 text-yellow-300">{p.protocol}</td>
                  <td className="px-3 py-2 text-gray-400">{p.packet_length}</td>
                  <td className="px-3 py-2 text-center">
                    {(p.protocol === 'TCP' || p.flags || ['HTTP', 'TLS', 'SSL', 'SSH', 'FTP', 'SMTP'].includes(p.protocol)) && p.src_port > 0 && p.dst_port > 0 && (
                      <button onClick={() => openStream(p)} className="text-blue-400 hover:text-blue-300">
                        <ExternalLink size={14} />
                    </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {results.total === 0 && results.packets.length === 0 && (
        <p className="text-gray-500 text-sm text-center py-6">Enter filters and search to find packets.</p>
      )}

      {streamModalOpen && selectedPacket && (
        <StreamModal 
          packet={selectedPacket} 
          sessionId={selectedPacket.session_id} 
          onClose={() => setStreamModalOpen(false)} 
        />
      )}
    </div>
  )
}
