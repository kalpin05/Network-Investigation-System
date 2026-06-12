import { useEffect, useState, useCallback } from 'react'
import { MapPin } from 'lucide-react'
import ReactFlow, {
  Background, Controls, MiniMap,
  useNodesState, useEdgesState
} from 'reactflow'
import 'reactflow/dist/style.css'
import axios from 'axios'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'

const API = 'http://localhost:8000'

// Layout: simple force-like grid placement
function layoutNodes(nodes) {
  const cols = Math.ceil(Math.sqrt(nodes.length))
  return nodes.map((n, i) => ({
    ...n,
    position: {
      x: (i % cols) * 220 + Math.random() * 40,
      y: Math.floor(i / cols) * 140 + Math.random() * 20,
    },
    style: {
      background: n.alert_count > 0 ? '#7f1d1d' : n.is_internal ? '#1e3a5f' : '#1a3a2a',
      color: 'white',
      border: `2px solid ${n.alert_count > 0 ? '#ef4444' : n.is_internal ? '#3b82f6' : '#22c55e'}`,
      borderRadius: 10,
      padding: '8px 14px',
      fontFamily: 'monospace',
      fontSize: 13,
      fontWeight: n.alert_count > 0 ? 'bold' : 'normal',
      boxShadow: n.alert_count > 0 ? '0 0 12px rgba(239,68,68,0.5)' : 'none',
      minWidth: 140,
    },
    data: { label: `${n.ip}${n.alert_count > 0 ? ` ⚠️ ${n.alert_count}` : ''}` },
  }))
}

function buildEdges(edges) {
  return edges.map(e => ({
    id: `${e.src}-${e.dst}`,
    source: e.src,
    target: e.dst,
    animated: e.suspicious,
    style: {
      stroke: e.suspicious ? '#ef4444' : '#64748b',
      strokeWidth: Math.max(1, Math.min(6, e.packet_count / 200)),
    },
    label: e.packet_count > 1000 ? `${(e.packet_count / 1000).toFixed(1)}k pkts` : undefined,
    labelStyle: { fill: '#94a3b8', fontSize: 10 },
  }))
}

export default function FlowGraph() {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selected, setSelected] = useState(null)
  const [nodeDetail, setNodeDetail] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    axios.get(`${API}/api/graph`).then(r => {
      setNodes(layoutNodes(r.data.nodes))
      setEdges(buildEdges(r.data.edges))
    }).catch(err => {
      console.error("[Graph] Load failed", err)
    }).finally(() => setLoading(false))
  }, [])

  const onNodeClick = useCallback((_, node) => {
    const ip = node.id
    setSelected(ip)
    axios.get(`${API}/api/graph/node/${ip}`).then(r => setNodeDetail(r.data))
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Network Flow Graph</h1>
        <div className="flex gap-4 text-sm text-gray-400">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Suspicious Node
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Internal IP
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> External IP
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Main graph */}
        <div className="col-span-2 bg-gray-950 border border-gray-800 rounded-xl overflow-hidden" style={{ height: 580 }}>
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              Loading graph...
            </div>
          ) : nodes.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              No traffic data. Upload a PCAP first.
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              fitView
            >
              <Background color="#1e293b" gap={20} />
              <Controls className="!bg-gray-900 !border-gray-700" />
              <MiniMap
                nodeColor={n => n.style?.border?.includes('ef4444') ? '#ef4444' : '#3b82f6'}
                maskColor="rgba(0,0,0,0.7)"
                className="!bg-gray-900 !border-gray-700"
              />
            </ReactFlow>
          )}
        </div>

        {/* Node detail panel */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 overflow-y-auto" style={{ height: 580 }}>
          {!selected ? (
            <div className="text-gray-500 text-sm text-center mt-8">
              Click a node to see details
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-blue-400 font-mono font-bold text-lg">{selected}</h3>
                  {nodeDetail?.geo && (
                    <div className="flex items-center gap-1 text-gray-300 text-xs bg-gray-800 w-fit px-2 py-0.5 rounded border border-gray-700">
                      <MapPin size={12} className="text-blue-400" />
                      <span className="font-semibold">{nodeDetail.geo.country} ({nodeDetail.geo.code})</span>
                    </div>
                  )}
                </div>
                <p className="text-gray-400 text-xs mt-1">
                  {nodeDetail?.alerts?.length || 0} alerts · {nodeDetail?.top_connections?.length || 0} connections
                </p>
              </div>

              {nodeDetail?.osint && (
                <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                  <h4 className="text-gray-300 font-semibold text-xs mb-2 uppercase tracking-wider">OSINT Reputation</h4>
                  
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 h-2 bg-gray-900 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${nodeDetail.osint.score > 80 ? 'bg-red-500' : nodeDetail.osint.score > 0 ? 'bg-yellow-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.max(nodeDetail.osint.score, 5)}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold ${nodeDetail.osint.score > 80 ? 'text-red-400' : nodeDetail.osint.score > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                      {nodeDetail.osint.score}% Malicious
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {nodeDetail.osint.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-gray-700 text-gray-300 border border-gray-600">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {nodeDetail?.alerts?.length > 0 && (
                <div>
                  <h4 className="text-red-400 font-semibold text-sm mb-2">Alerts</h4>
                  <div className="space-y-2">
                    {nodeDetail.alerts.map(a => (
                      <div key={a.alert_id} className="bg-red-950/40 border border-red-800 rounded-lg p-3">
                        <div className="text-red-300 font-mono text-xs font-bold">{a.rule_name}</div>
                        <div className="text-gray-400 text-xs mt-1 line-clamp-2">{a.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {nodeDetail?.top_connections?.length > 0 && (
                <div>
                  <h4 className="text-blue-400 font-semibold text-sm mb-2">Top Connections</h4>
                  <div className="space-y-1">
                    {nodeDetail.top_connections.map(c => (
                      <div key={c.ip} className="flex justify-between text-xs">
                        <span className="text-gray-300 font-mono">{c.ip}</span>
                        <span className="text-gray-500">{(c.bytes / 1024).toFixed(1)} KB</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      <Timeline />
    </div>
  )
}

// ── Timeline component ──────────────────────────────────────────────────
function Timeline() {
  const [data, setData] = useState({ timeline: [], alert_markers: [] })

  useEffect(() => {
    axios.get(`${API}/api/timeline`).then(r => setData(r.data)).catch(err => {
      console.error("[Timeline] Load failed", err)
    })
  }, [])

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h2 className="text-lg font-semibold text-white mb-4">Traffic Timeline</h2>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data.timeline} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <defs>
            <linearGradient id="packetGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickFormatter={t => new Date(t).toLocaleTimeString()}
          />
          <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
            labelStyle={{ color: '#94a3b8' }}
            formatter={(v) => [v.toLocaleString(), 'Packets']}
            labelFormatter={t => new Date(t).toLocaleString()}
          />
          <Area
            type="monotone"
            dataKey="packet_count"
            stroke="#3b82f6"
            fill="url(#packetGrad)"
            strokeWidth={2}
          />
          {data.alert_markers.map((m, i) => (
            <ReferenceLine
              key={i}
              x={m.time}
              stroke={m.severity === 'critical' ? '#ef4444' : '#f59e0b'}
              strokeDasharray="3 3"
              label={{ value: m.rule_name, fill: '#ef4444', fontSize: 10 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
