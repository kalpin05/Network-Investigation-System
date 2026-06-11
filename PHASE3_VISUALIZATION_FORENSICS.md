# KanadShield — Phase 3: Visualization & Forensics
**Days 7–8 | June 16–17 | Goal: Flow graph + timeline + case management working**

---

## Deliverable at End of Phase 3
> Click Flow Graph tab → see node graph with red suspicious nodes → click a node → see its connections and alerts → open Timeline → see packet volume spikes with red alert lines → create a case from alerts → assign alerts → add notes → search historical packets by IP/protocol.

---

## Prerequisites
- Phase 1 + Phase 2 fully complete
- Alerts firing and stored in PostgreSQL
- Packets indexed in Elasticsearch
- React shell with Navbar routing working

---

## Day 7 — Flow Graph + Timeline

### backend/routers/graph.py

```python
from fastapi import APIRouter, Query
from db.postgres import get_pool
from db.elastic import es, PACKET_INDEX
from typing import Optional
from collections import defaultdict

router = APIRouter()

@router.get("/api/graph")
async def get_graph(session_id: Optional[str] = None):
    """
    Returns nodes (IPs) and edges (connections) for React Flow.
    Suspicious nodes are flagged with alert_count > 0.
    """
    pool = await get_pool()

    # Get all alerts to flag suspicious IPs
    async with pool.acquire() as conn:
        alert_rows = await conn.fetch(
            "SELECT src_ip, dst_ip, COUNT(*) as cnt FROM alerts GROUP BY src_ip, dst_ip"
        )

    suspicious_ips = defaultdict(int)
    for row in alert_rows:
        suspicious_ips[row["src_ip"]] += row["cnt"]
        suspicious_ips[row["dst_ip"]] += row["cnt"]

    # Query packet flows from Elasticsearch
    query = {
        "size": 0,
        "query": {"match_all": {}},
        "aggs": {
            "flows": {
                "composite": {
                    "size": 200,
                    "sources": [
                        {"src": {"terms": {"field": "src_ip"}}},
                        {"dst": {"terms": {"field": "dst_ip"}}},
                    ]
                },
                "aggs": {
                    "total_bytes": {"sum": {"field": "packet_length"}},
                    "packet_count": {"value_count": {"field": "packet_length"}},
                }
            }
        }
    }

    if session_id:
        query["query"] = {"term": {"session_id": session_id}}

    try:
        result = es.search(index=PACKET_INDEX, body=query)
        buckets = result["aggregations"]["flows"]["buckets"]
    except Exception as e:
        print(f"[ES] Graph query failed: {e}")
        buckets = []

    # Build nodes and edges
    node_set = {}
    edges = []

    for bucket in buckets:
        src = bucket["key"]["src"]
        dst = bucket["key"]["dst"]
        count = bucket["packet_count"]["value"]
        bytes_ = int(bucket["total_bytes"]["value"])

        # Skip loopback
        if src == dst or src.startswith("127.") or dst.startswith("127."):
            continue

        # Add nodes
        for ip in [src, dst]:
            if ip not in node_set:
                node_set[ip] = {
                    "id": ip,
                    "ip": ip,
                    "alert_count": suspicious_ips.get(ip, 0),
                    "is_internal": ip.startswith(("10.", "192.168.", "172.")),
                }

        edges.append({
            "src": src,
            "dst": dst,
            "packet_count": count,
            "total_bytes": bytes_,
            "suspicious": suspicious_ips.get(src, 0) > 0 or suspicious_ips.get(dst, 0) > 0,
        })

    return {
        "nodes": list(node_set.values()),
        "edges": edges,
    }


@router.get("/api/graph/node/{ip}")
async def get_node_detail(ip: str):
    """Drill-down: get all connections and alerts for a specific IP."""
    pool = await get_pool()

    async with pool.acquire() as conn:
        alerts = await conn.fetch(
            "SELECT * FROM alerts WHERE src_ip = $1 OR dst_ip = $1 ORDER BY fired_at DESC LIMIT 20",
            ip
        )

    # Get top connections from ES
    query = {
        "size": 0,
        "query": {"bool": {"should": [
            {"term": {"src_ip": ip}},
            {"term": {"dst_ip": ip}},
        ]}},
        "aggs": {
            "top_peers": {
                "terms": {
                    "field": "dst_ip" if True else "src_ip",
                    "size": 10
                },
                "aggs": {"bytes": {"sum": {"field": "packet_length"}}}
            }
        }
    }

    try:
        result = es.search(index=PACKET_INDEX, body=query)
        peers = result["aggregations"]["top_peers"]["buckets"]
    except Exception:
        peers = []

    return {
        "ip": ip,
        "alerts": [dict(a) for a in alerts],
        "top_connections": [{"ip": b["key"], "bytes": int(b["bytes"]["value"])} for b in peers],
    }


@router.get("/api/timeline")
async def get_timeline(session_id: Optional[str] = None, interval: str = "1m"):
    """
    Returns packet volume per time interval + alert timestamps for overlay.
    interval: 1m, 5m, 1h
    """
    pool = await get_pool()

    # Packet volume over time from ES
    query = {
        "size": 0,
        "query": {"match_all": {}} if not session_id else {"term": {"session_id": session_id}},
        "aggs": {
            "over_time": {
                "date_histogram": {
                    "field": "timestamp",
                    "fixed_interval": interval,
                    "min_doc_count": 0,
                },
                "aggs": {
                    "total_bytes": {"sum": {"field": "packet_length"}}
                }
            }
        }
    }

    try:
        result = es.search(index=PACKET_INDEX, body=query)
        buckets = result["aggregations"]["over_time"]["buckets"]
        timeline = [
            {
                "time": b["key_as_string"],
                "packet_count": b["doc_count"],
                "total_bytes": int(b["total_bytes"]["value"]),
            }
            for b in buckets
        ]
    except Exception as e:
        print(f"[ES] Timeline query failed: {e}")
        timeline = []

    # Alert timestamps
    async with pool.acquire() as conn:
        if session_id:
            alert_rows = await conn.fetch(
                "SELECT fired_at, rule_name, severity FROM alerts WHERE session_id = $1 ORDER BY fired_at",
                session_id
            )
        else:
            alert_rows = await conn.fetch(
                "SELECT fired_at, rule_name, severity FROM alerts ORDER BY fired_at DESC LIMIT 100"
            )

    alert_markers = [
        {
            "time": str(row["fired_at"]),
            "rule_name": row["rule_name"],
            "severity": row["severity"],
        }
        for row in alert_rows
    ]

    return {"timeline": timeline, "alert_markers": alert_markers}


@router.get("/api/packets")
async def search_packets(
    src_ip: Optional[str] = None,
    dst_ip: Optional[str] = None,
    protocol: Optional[str] = None,
    session_id: Optional[str] = None,
    page: int = 1,
    size: int = Query(default=50, le=200)
):
    """Search packets in Elasticsearch with filters."""
    must = []
    if src_ip:
        must.append({"term": {"src_ip": src_ip}})
    if dst_ip:
        must.append({"term": {"dst_ip": dst_ip}})
    if protocol:
        must.append({"term": {"protocol": protocol.upper()}})
    if session_id:
        must.append({"term": {"session_id": session_id}})

    query = {
        "from": (page - 1) * size,
        "size": size,
        "query": {"bool": {"must": must}} if must else {"match_all": {}},
        "sort": [{"timestamp": {"order": "desc"}}],
    }

    try:
        result = es.search(index=PACKET_INDEX, body=query)
        hits = result["hits"]["hits"]
        total = result["hits"]["total"]["value"]
        packets = [h["_source"] for h in hits]
    except Exception as e:
        print(f"[ES] Packet search failed: {e}")
        packets = []
        total = 0

    return {
        "packets": packets,
        "total": total,
        "page": page,
        "pages": (total + size - 1) // size,
    }
```

---

### backend/routers/cases.py

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from db.postgres import get_pool
import uuid

router = APIRouter()

class CreateCaseRequest(BaseModel):
    title: str
    notes: Optional[str] = ""
    alert_ids: Optional[list[str]] = []

class UpdateCaseRequest(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    alert_ids: Optional[list[str]] = None

@router.post("/api/cases")
async def create_case(req: CreateCaseRequest):
    pool = await get_pool()
    case_id = str(uuid.uuid4())
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO cases (case_id, title, notes, status) VALUES ($1, $2, $3, 'open')",
            case_id, req.title, req.notes or ""
        )
        # Link alerts to this case
        if req.alert_ids:
            for alert_id in req.alert_ids:
                await conn.execute(
                    "UPDATE alerts SET case_id = $1 WHERE alert_id = $2",
                    case_id, alert_id
                )
    return {"case_id": case_id, "title": req.title, "status": "open"}

@router.get("/api/cases")
async def list_cases():
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT c.*, COUNT(a.alert_id) as alert_count
            FROM cases c
            LEFT JOIN alerts a ON a.case_id = c.case_id
            GROUP BY c.case_id
            ORDER BY c.created_at DESC
        """)
    return [dict(r) for r in rows]

@router.get("/api/cases/{case_id}")
async def get_case(case_id: str):
    pool = await get_pool()
    async with pool.acquire() as conn:
        case = await conn.fetchrow("SELECT * FROM cases WHERE case_id = $1", case_id)
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        alerts = await conn.fetch(
            "SELECT * FROM alerts WHERE case_id = $1 ORDER BY fired_at DESC", case_id
        )
    return {
        **dict(case),
        "alerts": [dict(a) for a in alerts]
    }

@router.patch("/api/cases/{case_id}")
async def update_case(case_id: str, req: UpdateCaseRequest):
    pool = await get_pool()
    async with pool.acquire() as conn:
        if req.title:
            await conn.execute("UPDATE cases SET title = $1 WHERE case_id = $2", req.title, case_id)
        if req.notes is not None:
            await conn.execute("UPDATE cases SET notes = $1 WHERE case_id = $2", req.notes, case_id)
        if req.status:
            await conn.execute("UPDATE cases SET status = $1 WHERE case_id = $2", req.status, case_id)
        if req.alert_ids is not None:
            # Clear existing links then re-link
            await conn.execute("UPDATE alerts SET case_id = NULL WHERE case_id = $1", case_id)
            for alert_id in req.alert_ids:
                await conn.execute(
                    "UPDATE alerts SET case_id = $1 WHERE alert_id = $2", case_id, alert_id
                )
    return {"case_id": case_id, "updated": True}
```

---

## frontend/src/pages/FlowGraph.jsx

```jsx
import { useEffect, useState, useCallback } from 'react'
import ReactFlow, {
  Background, Controls, MiniMap,
  useNodesState, useEdgesState
} from 'reactflow'
import 'reactflow/dist/style.css'
import axios from 'axios'

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
                <h3 className="text-blue-400 font-mono font-bold text-lg">{selected}</h3>
                <p className="text-gray-400 text-xs mt-1">
                  {nodeDetail?.alerts?.length || 0} alerts · {nodeDetail?.top_connections?.length || 0} connections
                </p>
              </div>

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
import { AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'

function Timeline() {
  const [data, setData] = useState({ timeline: [], alert_markers: [] })

  useEffect(() => {
    axios.get(`${API}/api/timeline`).then(r => setData(r.data))
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
```

---

## Day 8 — Case Management + Packet Search

### frontend/src/pages/Cases.jsx

```jsx
import { useEffect, useState } from 'react'
import { FolderOpen, Plus, ChevronRight, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import axios from 'axios'

const API = 'http://localhost:8000'

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

  useEffect(() => {
    loadCases()
    axios.get(`${API}/api/alerts?limit=50`).then(r => setAlerts(r.data))
  }, [])

  const loadCases = () => axios.get(`${API}/api/cases`).then(r => setCases(r.data))

  const openCase = (caseId) => {
    setSelected(caseId)
    axios.get(`${API}/api/cases/${caseId}`).then(r => setCaseDetail(r.data))
  }

  const createCase = async () => {
    if (!newTitle.trim()) return
    await axios.post(`${API}/api/cases`, {
      title: newTitle,
      notes: newNotes,
      alert_ids: selectedAlerts,
    })
    setShowCreate(false)
    setNewTitle('')
    setNewNotes('')
    setSelectedAlerts([])
    loadCases()
  }

  const updateStatus = async (caseId, status) => {
    await axios.patch(`${API}/api/cases/${caseId}`, { status })
    openCase(caseId)
    loadCases()
  }

  const updateNotes = async (caseId, notes) => {
    await axios.patch(`${API}/api/cases/${caseId}`, { notes })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Forensic Cases</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
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
              <button onClick={createCase} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                Create Case
              </button>
              <button onClick={() => setShowCreate(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg text-sm font-medium transition-colors">
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
                className={`w-full text-left p-4 rounded-xl border transition-colors
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
                      className={`px-3 py-1.5 rounded text-xs font-medium capitalize transition-colors
                        ${caseDetail.status === s
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
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
          className={`px-4 py-1.5 rounded text-xs font-medium transition-colors
            ${saved ? 'bg-gray-700 text-gray-500' : 'bg-green-700 hover:bg-green-600 text-white'}`}
        >
          {saved ? 'Saved' : 'Save Notes'}
        </button>
      </div>
    </div>
  )
}

// ── Packet search component ──────────────────────────────────────────────────
function PacketSearch() {
  const [filters, setFilters] = useState({ src_ip: '', dst_ip: '', protocol: '' })
  const [results, setResults] = useState({ packets: [], total: 0 })
  const [searching, setSearching] = useState(false)

  const search = async () => {
    setSearching(true)
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    const r = await axios.get(`${API}/api/packets`, { params })
    setResults(r.data)
    setSearching(false)
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
            value={filters[key]}
            onChange={e => setFilters(p => ({ ...p, [key]: e.target.value }))}
            placeholder={placeholder}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm
              focus:outline-none focus:border-blue-500"
            onKeyDown={e => e.key === 'Enter' && search()}
          />
        ))}
        <button
          onClick={search}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {searching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {results.total > 0 && (
        <div>
          <p className="text-gray-400 text-xs mb-3">{results.total.toLocaleString()} packets found</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-gray-400 bg-gray-800">
                <tr>
                  {['Timestamp', 'Src IP', 'Dst IP', 'Protocol', 'Src Port', 'Dst Port', 'Length'].map(h => (
                    <th key={h} className="px-3 py-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.packets.map((p, i) => (
                  <tr key={i} className={`border-t border-gray-800 ${i % 2 ? 'bg-gray-900/50' : ''}`}>
                    <td className="px-3 py-2 text-gray-400 font-mono">
                      {p.timestamp ? new Date(p.timestamp).toLocaleTimeString() : '-'}
                    </td>
                    <td className="px-3 py-2 text-blue-300 font-mono">{p.src_ip}</td>
                    <td className="px-3 py-2 text-green-300 font-mono">{p.dst_ip}</td>
                    <td className="px-3 py-2 text-yellow-300">{p.protocol}</td>
                    <td className="px-3 py-2 text-gray-400">{p.src_port}</td>
                    <td className="px-3 py-2 text-gray-400">{p.dst_port}</td>
                    <td className="px-3 py-2 text-gray-400">{p.packet_length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {results.total === 0 && results.packets.length === 0 && (
        <p className="text-gray-500 text-sm text-center py-6">Enter filters and search to find packets.</p>
      )}
    </div>
  )
}
```

---

## npm packages to add for Phase 3

```bash
cd frontend
npm install reactflow
# recharts already installed in Phase 1
# axios already installed in Phase 1
```

---

## Phase 3 Acceptance Criteria

- [ ] `GET /api/graph` returns nodes + edges with alert_count per node
- [ ] Flow Graph page renders — nodes visible, suspicious nodes are RED
- [ ] Clicking a node opens detail panel with its alerts and connections
- [ ] `GET /api/timeline` returns packet volume buckets + alert markers
- [ ] Timeline chart renders with blue area + red reference lines for alerts
- [ ] `POST /api/cases` creates case and links alert IDs
- [ ] Cases list page shows all cases with status badges
- [ ] Case detail shows linked alerts + notes editor
- [ ] Notes save via PATCH endpoint
- [ ] Status update (open → investigating → closed) works from UI
- [ ] `GET /api/packets` search by src_ip returns correct results
- [ ] Packet search UI filters by IP and protocol
