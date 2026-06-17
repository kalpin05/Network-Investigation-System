import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../api/client'
import { API_BASE_URL } from '../config'

const COLORS = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#a855f7','#06b6d4','#f97316','#84cc16']

export default function DPIPanel({ sessionId }) {
  const [dpi, setDpi] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!sessionId) return
    let active = true
    Promise.resolve().then(() => {
      if (active) setLoading(true)
    })
    api.get(`${API_BASE_URL}/api/sessions/${sessionId}/dpi`)
      .then(r => {
        if (active) setDpi(r.data)
      })
      .catch(err => console.error("Failed to load DPI summary:", err))
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [sessionId])

  if (!sessionId) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">
        Select a session to view its DPI breakdown
      </div>
    )
  }

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">
        Loading DPI metrics from Elasticsearch...
      </div>
    )
  }

  if (!dpi || dpi.error) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-red-400">
        No DPI metrics available or failed to load.
      </div>
    )
  }

  return (
    <div className="space-y-6 mt-6">
      <div className="grid grid-cols-2 gap-4">
        {/* Protocol pie */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Protocol Distribution</h3>
          <div className="h-[180px]">
            {dpi.protocols && dpi.protocols.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dpi.protocols} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={e => e.name}>
                    {dpi.protocols.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-gray-600">No protocol data</div>
            )}
          </div>
        </div>

        {/* Entropy + stats */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-300">Payload Analysis</h3>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Avg Payload Entropy</span>
            <span className={`font-mono font-bold ${dpi.avg_entropy > 6 ? 'text-red-400' : 'text-green-400'}`}>
              {dpi.avg_entropy} bits/byte
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">High-Entropy Packets (&gt;7.0)</span>
            <span className={`font-mono font-bold ${dpi.high_entropy_pkts > 0 ? 'text-red-400' : 'text-gray-400'}`}>
              {dpi.high_entropy_pkts}
            </span>
          </div>
          {dpi.high_entropy_pkts > 0 && (
            <div className="text-xs text-red-400 bg-red-950/30 border border-red-800 rounded p-2 leading-relaxed">
              High entropy suggests encrypted or compressed payload — possible obfuscated C2 or data staging.
            </div>
          )}
        </div>
      </div>

      {/* DNS Queries */}
      {dpi.dns_queries && dpi.dns_queries.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">DNS Queries Observed</h3>
          <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
            {dpi.dns_queries.map(q => (
              <div key={q.query} className="flex justify-between text-xs border-b border-gray-800/40 pb-1">
                <span className="font-mono text-blue-300 truncate">{q.query}</span>
                <span className="text-gray-500 ml-4 font-mono">{q.count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HTTP Hosts */}
      {dpi.http_hosts && dpi.http_hosts.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">HTTP Hosts Contacted</h3>
          <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
            {dpi.http_hosts.map(h => (
              <div key={h.host} className="flex justify-between text-xs border-b border-gray-800/40 pb-1">
                <span className="font-mono text-green-300">{h.host}</span>
                <span className="text-gray-500 font-mono">{h.count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
