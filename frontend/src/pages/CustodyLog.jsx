import { useEffect, useState } from 'react'
import { Shield, Search, RefreshCw, User, Globe, Download, Eye, Upload, Trash2, Copy, Check } from 'lucide-react'
import { api } from '../api/client'

const ACTION_CONFIG = {
  upload:  { label: 'Upload Evidence', icon: Upload,   color: 'text-emerald-400', bg: 'bg-emerald-950/40', border: 'border-emerald-800' },
  view:    { label: 'View Evidence',   icon: Eye,      color: 'text-sky-400',     bg: 'bg-sky-950/40',     border: 'border-sky-800' },
  export:  { label: 'Export Evidence', icon: Download, color: 'text-amber-400',   bg: 'bg-amber-950/40',   border: 'border-amber-800' },
  delete:  { label: 'Delete Evidence', icon: Trash2,   color: 'text-rose-400',    bg: 'bg-rose-950/40',    border: 'border-rose-800' },
}

export default function CustodyLog() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAction, setSelectedAction] = useState('all')

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

  const handleCopy = (id) => {
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Filter logs locally
  const filteredLogs = logs.filter(log => {
    // Action filter
    if (selectedAction !== 'all' && log.action !== selectedAction) {
      return false
    }

    // Text search filter (Session ID, Username, or IP Address)
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
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Refreshing...' : 'Refresh Logs'}
        </button>
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

                      {/* Session ID */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {log.session_id ? (
                          <div className="flex items-center gap-2 group">
                            <span className="text-xs font-mono text-gray-400">
                              {log.session_id}
                            </span>
                            <button
                              onClick={() => handleCopy(log.session_id)}
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
    </div>
  )
}
