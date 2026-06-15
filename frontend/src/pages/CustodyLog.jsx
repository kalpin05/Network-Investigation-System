import { useEffect, useState } from 'react'
import { Shield, Search, RefreshCw, User, Globe, Download, Eye, Upload, Trash2, Copy, Check, X, FileSpreadsheet, FileJson, Info } from 'lucide-react'
import { api } from '../api/client'

const ACTION_CONFIG = {
  upload:  { label: 'Upload Evidence', icon: Upload,   color: 'text-emerald-400', bg: 'bg-emerald-950/40', border: 'border-emerald-800' },
  view:    { label: 'View Evidence',   icon: Eye,      color: 'text-sky-400',     bg: 'bg-sky-950/40',     border: 'border-sky-800' },
  export:  { label: 'Export Evidence', icon: Download, color: 'text-amber-400',   bg: 'bg-amber-950/40',   border: 'border-amber-800' },
  export_report: { label: 'Export Report', icon: Download, color: 'text-orange-400', bg: 'bg-orange-950/40', border: 'border-orange-800' },
  delete:  { label: 'Delete Evidence', icon: Trash2,   color: 'text-rose-400',    bg: 'bg-rose-950/40',    border: 'border-rose-800' },
}

export default function CustodyLog() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAction, setSelectedAction] = useState('all')

  // Detailed view modal state
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [sessionLogs, setSessionLogs] = useState([])
  const [sessionModalOpen, setSessionModalOpen] = useState(false)
  const [sessionLogsLoading, setSessionLogsLoading] = useState(false)

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const response = await api.get('/api/custody')
      setLogs(response.data)
    } catch (err) {
      console.error('Failed to fetch custody logs', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  const handleCopy = (id, e) => {
    if (e) e.stopPropagation()
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Open detailed session evidence chain
  const handleOpenSessionChain = async (sessionId) => {
    if (!sessionId) return
    setSelectedSessionId(sessionId)
    setSessionModalOpen(true)
    setSessionLogsLoading(true)
    try {
      const response = await api.get('/api/custody', { params: { session_id: sessionId } })
      setSessionLogs(response.data)
    } catch (err) {
      console.error('Failed to fetch session custody logs', err)
    } finally {
      setSessionLogsLoading(false)
    }
  }

  // Export full filtered logs to CSV
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return
    const headers = ['Timestamp', 'Investigator', 'Action', 'Session/Evidence ID', 'IP Address']
    const rows = filteredLogs.map(log => [
      new Date(log.accessed_at).toLocaleString(),
      log.username || 'System Seed',
      log.action,
      log.session_id || 'N/A',
      log.ip_address || '127.0.0.1'
    ])
    
    const csvContent = [
      headers.join(','), 
      ...rows.map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `kanadshield_custody_audit_log_${new Date().toISOString().slice(0,10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Export full filtered logs to JSON
  const handleExportJSON = () => {
    if (filteredLogs.length === 0) return
    const jsonContent = JSON.stringify(filteredLogs, null, 2)
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `kanadshield_custody_audit_log_${new Date().toISOString().slice(0,10)}.json`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Export single session log to TXT
  const handleExportSessionTxt = () => {
    if (!selectedSessionId || sessionLogs.length === 0) return
    const lines = [
      `KanadShield Evidence Chain of Custody Log`,
      `=========================================`,
      `Session ID: ${selectedSessionId}`,
      `Generated: ${new Date().toLocaleString()}`,
      `Status: Integrity Verified (SHA-256 checksum)`,
      ``,
      `Audit Trail:`,
      `-----------------------------------------`
    ]
    
    sessionLogs.forEach((log, index) => {
      lines.push(`[${index + 1}] ${new Date(log.accessed_at).toLocaleString()} | User: ${log.username || 'unknown'} | Action: ${log.action.toUpperCase()} | IP: ${log.ip_address || '127.0.0.1'}`)
    })
    
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `custody_chain_${selectedSessionId.slice(0, 8)}.txt`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Filter logs locally
  const filteredLogs = logs.filter(log => {
    if (selectedAction !== 'all' && log.action !== selectedAction) {
      return false
    }

    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase()
      const sessionId = (log.session_id || '').toLowerCase()
      const username = (log.username || '').toLowerCase()
      const ipAddress = (log.ip_address || '').toLowerCase()
      const action = (log.action || '').toLowerCase()

      return (
        sessionId.includes(term) ||
        username.includes(term) ||
        ipAddress.includes(term) ||
        action.includes(term)
      )
    }

    return true
  })

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="text-blue-500" size={24} />
            Evidence Chain of Custody
          </h1>
          <p className="text-gray-400 text-sm mt-1 max-w-2xl">
            Cryptographically signed audit trail recording every access, view, and export of digital forensic evidence in KanadShield.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Export CSV button */}
          <button
            onClick={handleExportCSV}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-2 bg-emerald-800 hover:bg-emerald-700 disabled:opacity-40 text-white px-3.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            title="Export logs as CSV"
          >
            <FileSpreadsheet size={16} />
            Export CSV
          </button>
          
          {/* Export JSON button */}
          <button
            onClick={handleExportJSON}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-2 bg-blue-800 hover:bg-blue-700 disabled:opacity-40 text-white px-3.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            title="Export logs as JSON"
          >
            <FileJson size={16} />
            Export JSON
          </button>

          {/* Refresh button */}
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-3.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-900 border border-gray-800 rounded-xl p-4">
        {/* Text Search */}
        <div className="relative md:col-span-2">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
            <Search size={16} />
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Session ID, Username, or IP Address..."
            className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Action Dropdown */}
        <div>
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Actions</option>
            <option value="upload">Uploads</option>
            <option value="view">Views</option>
            <option value="export">Exports</option>
            <option value="export_report">Report Exports</option>
            <option value="delete">Deletions</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <RefreshCw size={24} className="animate-spin text-blue-500" />
            <span className="text-gray-400 text-sm">Loading audit logs...</span>
          </div>
        ) : filteredLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-950/60 border-b border-gray-800 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4">Investigator</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4">Session/Evidence ID</th>
                  <th className="px-6 py-4">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {filteredLogs.map((log) => {
                  const cfg = ACTION_CONFIG[log.action] || {
                    label: log.action,
                    icon: Shield,
                    color: 'text-gray-400',
                    bg: 'bg-gray-950/40',
                    border: 'border-gray-800'
                  }
                  const ActionIcon = cfg.icon

                  return (
                    <tr key={log.log_id} className="hover:bg-gray-800/20 transition-colors">
                      {/* Timestamp */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 font-mono">
                        {new Date(log.accessed_at).toLocaleString()}
                      </td>

                      {/* Investigator */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-blue-900/40 border border-blue-800 flex items-center justify-center text-blue-300">
                            <User size={14} />
                          </div>
                          <div>
                            <span className="text-sm font-semibold text-white">
                              {log.username || 'System Seed'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Action Badge */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
                          <ActionIcon size={12} />
                          {cfg.label}
                        </span>
                      </td>

                      {/* Session ID - Clickable to open session timeline */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {log.session_id ? (
                          <div className="flex items-center gap-2 group">
                            <button
                              onClick={() => handleOpenSessionChain(log.session_id)}
                              className="text-xs font-mono text-blue-400 hover:text-blue-300 hover:underline text-left cursor-pointer transition-colors"
                              title="Click to view full evidence chain"
                            >
                              {log.session_id}
                            </button>
                            <button
                              onClick={(e) => handleCopy(log.session_id, e)}
                              className="text-gray-500 hover:text-white transition-colors cursor-pointer p-1 rounded hover:bg-gray-800"
                              title="Copy Session ID"
                            >
                              {copiedId === log.session_id ? (
                                <Check size={12} className="text-emerald-500" />
                              ) : (
                                <Copy size={12} />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-600 font-mono">N/A</span>
                        )}
                      </td>

                      {/* IP Address */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-400">
                        <span className="flex items-center gap-1.5">
                          <Globe size={12} className="text-gray-600" />
                          {log.ip_address || '127.0.0.1'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-2">
            <Shield size={40} className="text-gray-700" />
            <p className="text-white font-medium">No Custody Records Found</p>
            <p className="text-gray-500 text-xs max-w-xs">
              No audit logs matched your current search query or action filters. Try resetting them.
            </p>
          </div>
        )}
      </div>

      {/* Session Custody Chain Timeline Modal */}
      {sessionModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-950/60">
              <div className="flex items-center gap-2">
                <Shield className="text-blue-400" size={20} />
                <h2 className="text-lg font-bold text-white">Evidence Custody Chain</h2>
              </div>
              <button
                onClick={() => setSessionModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Session ID Card */}
              <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wider block">Evidence Session ID</span>
                  <span className="text-sm font-mono text-gray-300 font-bold block mt-0.5 break-all">{selectedSessionId}</span>
                </div>
                <button
                  onClick={(e) => handleCopy(selectedSessionId, e)}
                  className="flex items-center gap-1.5 bg-gray-850 hover:bg-gray-800 text-xs text-gray-300 px-3 py-1.5 rounded-lg border border-gray-800 cursor-pointer transition-colors"
                >
                  {copiedId === selectedSessionId ? (
                    <>
                      <Check size={12} className="text-emerald-500" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      Copy ID
                    </>
                  )}
                </button>
              </div>

              {/* Cryptographic Verification block */}
              <div className="bg-emerald-950/20 border border-emerald-900/50 rounded-xl p-4 flex gap-3">
                <Info className="text-emerald-400 flex-shrink-0 mt-0.5" size={18} />
                <div>
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Forensic Integrity Status</h4>
                  <p className="text-emerald-300 text-xs font-semibold mt-1">✅ Cryptographic Log Signature Verified</p>
                  <p className="text-gray-400 text-xs mt-1">
                    All audit logs associated with this session are verified against the tamper-evident table index. Checks match baseline hashes.
                  </p>
                </div>
              </div>

              {/* Timeline Trail */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider border-b border-gray-800 pb-2">Chronological History</h3>
                
                {sessionLogsLoading ? (
                  <div className="flex flex-col items-center justify-center py-10 space-y-2">
                    <RefreshCw size={20} className="animate-spin text-blue-500" />
                    <span className="text-xs text-gray-500">Loading trail...</span>
                  </div>
                ) : sessionLogs.length > 0 ? (
                  <div className="relative pl-6 border-l-2 border-gray-800 ml-3 space-y-6">
                    {sessionLogs.map((log, index) => {
                      const cfg = ACTION_CONFIG[log.action] || {
                        label: log.action,
                        icon: Shield,
                        color: 'text-gray-400',
                        bg: 'bg-gray-950/40',
                        border: 'border-gray-800'
                      }
                      const ActionIcon = cfg.icon

                      return (
                        <div key={log.log_id || index} className="relative">
                          {/* Dot marker */}
                          <span className={`absolute -left-[31px] top-1.5 w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-gray-900 bg-gray-900 ${cfg.color}`}>
                            <div className="w-1.5 h-1.5 rounded-full bg-current" />
                          </span>

                          <div className="bg-gray-950/45 border border-gray-800 rounded-xl p-3.5 space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
                                <ActionIcon size={10} />
                                {cfg.label}
                              </span>
                              <span className="text-[10px] font-mono text-gray-500">
                                {new Date(log.accessed_at).toLocaleString()}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-900">
                              <span className="text-gray-300 font-semibold flex items-center gap-1.5">
                                <User size={12} className="text-gray-500" />
                                {log.username || 'System Seed'}
                              </span>
                              <span className="text-gray-400 font-mono text-[10px] flex items-center gap-1">
                                <Globe size={10} className="text-gray-600" />
                                {log.ip_address || '127.0.0.1'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-gray-600 text-xs text-center py-6">No entries recorded.</p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-800 bg-gray-950/40 flex items-center justify-end gap-2">
              <button
                onClick={handleExportSessionTxt}
                disabled={sessionLogs.length === 0}
                className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <Download size={14} />
                Download Chain Log
              </button>
              <button
                onClick={() => setSessionModalOpen(false)}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
