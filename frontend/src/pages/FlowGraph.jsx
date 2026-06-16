import { useEffect, useState, useCallback } from 'react'
import { MapPin, Network, FolderOpen, Settings, Power, Sliders, Globe } from 'lucide-react'
import ReactFlow, {
  Background, Controls, MiniMap,
  useNodesState, useEdgesState
} from 'reactflow'
import 'reactflow/dist/style.css'
import axios from 'axios'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'

const API = window.location.protocol + '//' + window.location.hostname + ':8000'

const styleSheet = `
body {
    background-color: #0c160a;
    color: #dae6d2;
}

.crt-scanlines {
    background: linear-gradient(
        to bottom,
        rgba(255, 255, 255, 0),
        rgba(255, 255, 255, 0) 50%,
        rgba(0, 0, 0, 0.1) 50%,
        rgba(0, 0, 0, 0.1)
    );
    background-size: 100% 4px;
    pointer-events: none;
    z-index: 9999;
}

.crt-overlay {
    box-shadow: inset 0 0 100px rgba(0, 255, 65, 0.05);
    pointer-events: none;
    z-index: 9998;
}

.terminal-window {
    border: 1px solid #00ff41;
    background-color: rgba(20, 30, 18, 0.85);
    backdrop-filter: blur(4px);
    position: relative;
}

.terminal-window::before, .terminal-window::after {
    content: '';
    position: absolute;
    width: 8px;
    height: 8px;
    border: 2px solid #00ff41;
    transition: all 0.2s ease;
}
.terminal-window::before { top: -1px; left: -1px; border-right: none; border-bottom: none; }
.terminal-window::after { bottom: -1px; right: -1px; border-left: none; border-top: none; }

.terminal-header {
    border-bottom: 1px solid rgba(0, 255, 65, 0.3);
    background: linear-gradient(90deg, rgba(0, 255, 65, 0.1) 0%, transparent 100%);
}

.phosphor-glow {
    text-shadow: 0 0 4px rgba(0, 255, 65, 0.5);
    box-shadow: 0 0 8px rgba(0, 255, 65, 0.2);
}

.phosphor-glow-text {
    text-shadow: 0 0 8px rgba(0, 255, 65, 0.8);
}

.terminal-button {
    border: 1px solid #00ff41;
    background: transparent;
    color: #ebffe2;
    transition: all 0.15s ease-in-out;
}

.terminal-button:hover {
    background-color: #00ff41;
    color: #0c160a;
    box-shadow: 0 0 12px rgba(0, 255, 65, 0.6);
}

.blinking-cursor::after {
    content: '_';
    animation: blink 1s step-end infinite;
}

@keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
}

@keyframes scan {
    0% { transform: translateY(-100%); }
    100% { transform: translateY(100vh); }
}

.scanner-line {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 2px;
    background: rgba(0, 255, 65, 0.4);
    box-shadow: 0 0 10px rgba(0, 255, 65, 0.8);
    animation: scan 8s linear infinite;
    z-index: 10;
    pointer-events: none;
}

.table-row-hover:hover {
    background-color: rgba(253, 175, 0, 0.1);
}
`;

function ShaderBackground() {
  useEffect(() => {
    const canvas = document.getElementById('shader-canvas');
    if (!canvas) return;

    function syncSize() {
      const w = canvas.clientWidth || 1280;
      const h = canvas.clientHeight || 720;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    }
    syncSize();
    window.addEventListener('resize', syncSize);

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return;
    const vs = `attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;
    const fs = `precision highp float;
varying vec2 v_texCoord;
uniform float u_time;
uniform vec2 u_resolution;

float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

void main() {
    vec2 uv = (v_texCoord - 0.5) * u_resolution / min(u_resolution.x, u_resolution.y);
    vec2 gridUv = v_texCoord * 40.0;
    vec2 g = abs(fract(gridUv - 0.5) - 0.5) / fwidth(gridUv);
    float grid = 1.0 - min(g.x, g.y);
    vec3 color = vec3(0.0039, 0.0157, 0.0039);
    color += grid * 0.02 * vec3(0.0, 1.0, 0.25);
    
    for(float i = 0.0; i < 15.0; i++) {
        float h = hash(vec2(i, 123.45));
        vec2 pos = vec2(sin(u_time * 0.2 * h + i), cos(u_time * 0.15 * h + i)) * 0.4;
        float d = length(uv - pos);
        float node = smoothstep(0.015, 0.01, d);
        vec3 nodeCol = (h > 0.8) ? vec3(1.0, 0.0, 0.25) : ((h > 0.5) ? vec3(1.0, 0.69, 0.0) : vec3(0.0, 1.0, 0.25));
        color += node * nodeCol * (1.2 + sin(u_time * 2.0 + i) * 0.5);
    }
    
    float scanline = sin(v_texCoord.y * u_resolution.y * 0.8) * 0.03;
    color -= scanline;
    color *= 1.0 - length(v_texCoord - 0.5) * 0.7;
    gl_FragColor = vec4(color, 1.0);
}`;

    function cs(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    }
    const prog = gl.createProgram();
    gl.attachShader(prog, cs(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, cs(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uRes = gl.getUniformLocation(prog, 'u_resolution');

    let reqId;
    function render(t) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (uTime) gl.uniform1f(uTime, t * 0.001);
      if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      reqId = requestAnimationFrame(render);
    }
    render(0);

    return () => {
      cancelAnimationFrame(reqId);
      window.removeEventListener('resize', syncSize);
    };
  }, []);

  return <canvas id="shader-canvas" className="absolute inset-0 w-full h-full z-0 opacity-30 pointer-events-none" style={{ display: 'block' }} />;
}

function layoutNodes(nodes) {
  const cols = Math.ceil(Math.sqrt(nodes.length))
  return nodes.map((n, i) => ({
    ...n,
    position: {
      x: (i % cols) * 220 + Math.random() * 40,
      y: Math.floor(i / cols) * 140 + Math.random() * 20,
    },
    style: {
      background: n.alert_count > 0 ? '#5a1111' : n.is_internal ? '#132c44' : '#142c1b',
      color: '#ebffe2',
      border: `1px solid ${n.alert_count > 0 ? '#ff0040' : n.is_internal ? '#00e639' : '#ffd393'}`,
      borderRadius: 2,
      padding: '6px 12px',
      fontFamily: 'monospace',
      fontSize: 12,
      boxShadow: n.alert_count > 0 ? '0 0 10px rgba(255,0,64,0.4)' : 'none',
      minWidth: 130,
    },
    data: { label: `${n.ip}${n.alert_count > 0 ? ` ⚠️ [${n.alert_count}]` : ''}` },
  }))
}

function buildEdges(edges) {
  return edges.map(e => ({
    id: `${e.src}-${e.dst}`,
    source: e.src,
    target: e.dst,
    animated: e.suspicious,
    style: {
      stroke: e.suspicious ? '#ff0040' : '#84967e',
      strokeWidth: Math.max(1, Math.min(5, e.packet_count / 250)),
    },
    label: e.packet_count > 1000 ? `${(e.packet_count / 1000).toFixed(1)}k pkts` : undefined,
    labelStyle: { fill: '#dae6d2', fontSize: 9, fontFamily: 'monospace' },
  }))
}

export default function FlowGraph() {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selected, setSelected] = useState(null)
  const [nodeDetail, setNodeDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [timelineData, setTimelineData] = useState({ timeline: [], alert_markers: [] })
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const loadData = () => {
    setLoading(true)
    axios.get(`${API}/api/graph`).then(r => {
      setNodes(layoutNodes(r.data.nodes))
      setEdges(buildEdges(r.data.edges))
    }).catch(err => {
      console.error("[Graph] Load failed", err)
    }).finally(() => setLoading(false))

    axios.get(`${API}/api/timeline`).then(r => setTimelineData(r.data)).catch(() => {})
  }

  useEffect(() => {
    loadData()
  }, [])

  const onNodeClick = useCallback((_, node) => {
    const ip = node.id
    setSelected(ip)
    axios.get(`${API}/api/graph/node/${ip}`).then(r => setNodeDetail(r.data))
  }, [])

  const selectNodeFromTable = (ip) => {
    setSelected(ip)
    axios.get(`${API}/api/graph/node/${ip}`).then(r => setNodeDetail(r.data))
  }

  return (
    <div className="min-h-screen bg-[#0c160a] text-[#dae6d2] font-mono flex flex-col relative overflow-hidden select-none pb-12">
      <style dangerouslySetInnerHTML={{ __html: styleSheet }} />
      <ShaderBackground />
      <div className="crt-scanlines absolute inset-0 w-full h-full pointer-events-none" />
      <div className="crt-overlay absolute inset-0 w-full h-full pointer-events-none" />
      <div className="scanner-line pointer-events-none" />

      {/* Header Info Banner */}
      <header className="flex justify-between items-center bg-[#071106] border-b border-[#3b4b37] px-4 py-3 font-headline-sm uppercase z-50">
        <div className="flex items-center space-x-4">
          <span className="text-lg font-bold text-[#00ff41] animate-pulse">SYS_STATUS_v4.02</span>
          <span className="text-xs text-[#00ff41]/70">root@cyberspace_node [{currentTime.toLocaleTimeString('en-US', { hour12: false })}]</span>
        </div>
        <div className="flex items-center space-x-3 text-xs">
          <Sliders size={14} className="cursor-pointer text-[#00ff41] hover:opacity-80" />
          <Power size={14} className="cursor-pointer text-[#00ff41] hover:opacity-80" />
        </div>
      </header>

      {/* Main Grid: Topology layout */}
      <main className="flex-1 flex flex-col z-10 relative p-4 gap-4 w-full">
        
        {/* Top Section: sidebars + canvas */}
        <div className="grid grid-cols-12 gap-4 h-[460px]">
          
          {/* Left Sidebar: Dossier */}
          <aside className="col-span-12 md:col-span-3 flex flex-col terminal-window h-full">
            <div className="terminal-header p-2 flex items-center justify-between text-xs font-bold text-[#00ff41]">
              <span className="flex items-center gap-1.5"><FolderOpen size={14} /> OSINT REPUTATION DOSSIERS</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 custom-scrollbar text-xs">
              {selected ? (
                // Active dossier details
                <div className="space-y-4">
                  <div className="border border-[#00ff41] p-3 bg-[#182216]">
                    <div className="font-bold text-[#00ff41] border-b border-[#3b4b37] pb-1.5 mb-2 truncate">
                      NODE: {selected}
                    </div>
                    {nodeDetail?.geo && (
                      <div className="space-y-1 text-gray-400">
                        <div className="flex items-center gap-1"><MapPin size={12} className="text-[#00ff41]" /> {nodeDetail.geo.city}, {nodeDetail.geo.country}</div>
                        <div className="text-[10px] truncate">ISP: {nodeDetail.geo.isp}</div>
                      </div>
                    )}
                  </div>

                  {nodeDetail?.osint && (
                    <div className="border border-[#3b4b37] p-3 bg-[#141e12] space-y-2">
                      <div className="flex justify-between font-bold text-[10px] text-[#ffd393]">
                        <span>REPUTATION SCORE</span>
                        <span className={nodeDetail.osint.score > 70 ? 'text-red-500 font-black' : 'text-yellow-500'}>
                          {nodeDetail.osint.score}% Malicious
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#2d382a] rounded-full overflow-hidden">
                        <div className={`h-full ${nodeDetail.osint.score > 70 ? 'bg-red-600' : 'bg-yellow-500'}`} style={{ width: `${nodeDetail.osint.score}%` }} />
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {nodeDetail.osint.tags.map(tag => (
                          <span key={tag} className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#2d382a] border border-[#3b4b37] text-white">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {nodeDetail?.alerts?.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-red-500 font-bold text-[10px] uppercase tracking-wider">Node Alarms:</div>
                      {nodeDetail.alerts.map(a => (
                        <div key={a.alert_id} className="bg-red-950/20 border border-red-500/30 p-2.5 rounded text-[10px] leading-relaxed">
                          <div className="text-red-400 font-bold">{a.rule_name}</div>
                          <div className="text-gray-500 text-[9px] mt-0.5">{a.description}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                // Dossier Node lists when idle
                <div className="space-y-3">
                  <div className="text-gray-500 text-center py-10 font-sans text-xs">
                    Select a node in the graph or lookup cache to load intelligence dossier.
                  </div>
                  {nodes.slice(0, 3).map((n, i) => (
                    <div 
                      key={n.id} 
                      onClick={() => selectNodeFromTable(n.id)}
                      className="border border-[#3b4b37] p-2.5 bg-[#141e12] hover:border-[#00ff41] transition-colors cursor-pointer text-[10px]"
                    >
                      <div className="flex justify-between font-mono mb-1">
                        <span className="text-[#00ff41] font-bold">{n.id}</span>
                        <span className={n.alert_count > 0 ? 'text-red-500 font-bold' : 'text-[#84967e]'}>
                          {n.alert_count > 0 ? 'ALERT' : 'ACTIVE'}
                        </span>
                      </div>
                      <div className="text-gray-500">TAG: {n.is_internal ? 'INTERNAL_NODE' : 'EXTERNAL_NET'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>

          {/* Center Canvas: React Flow Map */}
          <div className="col-span-12 md:col-span-6 flex flex-col terminal-window h-full">
            <div className="terminal-header p-2 flex items-center justify-between text-xs font-bold text-[#00ff41]">
              <span className="flex items-center gap-1.5"><Globe size={14} /> INTERACTIVE TOPOLOGY CANVAS</span>
            </div>
            
            <div className="flex-1 relative bg-black/40 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center h-full text-gray-500 text-xs">
                  RUNNING INTRUSION TOPOLOGY SCAN...
                </div>
              ) : nodes.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500 text-xs">
                  NO LINK NODES LOADED. UPLOAD A PCAP FIRST.
                </div>
              ) : (
                <>
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onNodeClick={onNodeClick}
                    fitView
                  >
                    <Background color="#3b4b37" gap={20} size={1} />
                    <Controls className="!bg-[#141414] !border-[#00ff41] !text-[#00ff41] [&_button]:!border-[#3b4b37] [&_button]:!bg-transparent hover:[&_button]:!bg-[#00ff41]/15" />
                    <MiniMap
                      nodeColor={n => n.style?.border?.includes('ff0040') ? '#ff0040' : '#00ff41'}
                      maskColor="rgba(12,22,10,0.85)"
                      className="!bg-[#141414] !border-[#00ff41]"
                    />
                  </ReactFlow>

                  {/* Custom Node Legend Block */}
                  <div className="absolute bottom-4 left-4 bg-[#071106]/95 border border-[#00ff41] p-3 text-[10px] space-y-2 z-10 font-mono text-[#ebffe2] rounded-sm pointer-events-none shadow-[0_0_15px_rgba(0,255,65,0.15)]">
                    <div className="font-bold border-b border-[#3b4b37] pb-1 uppercase tracking-wider text-[#00ff41]">[ Node Legend ]</div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-[#132c44] border border-[#00ff41]" />
                        <span>INTERNAL NODE</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-[#142c1b] border border-[#ffd393]" />
                        <span>EXTERNAL NET</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-[#5a1111] border border-[#ff0040]" />
                        <span className="text-red-500 font-bold">SUSPICIOUS (ALARM)</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Sidebar: Bandwidth charts */}
          <aside className="col-span-12 md:col-span-3 flex flex-col terminal-window h-full">
            <div className="terminal-header p-2 flex items-center justify-between text-xs font-bold text-[#00ff41]">
              <span className="flex items-center gap-1.5"><Sliders size={14} /> BANDWIDTH TIMELINES</span>
            </div>
            
            <div className="flex-1 p-3 flex flex-col justify-around overflow-hidden gap-4 text-xs bg-[#071106]/40">
              
              {/* Uplink (Packets) */}
              <div className="flex flex-col h-1/2 min-h-[140px]">
                <div className="flex justify-between items-end mb-1 text-[10px]">
                  <span className="text-[#00ff41] font-bold">UPLINK (TX)</span>
                  <span className="text-[#00ff41] font-bold">
                    {timelineData.timeline.length > 0 ? Math.max(...timelineData.timeline.map(t => t.packet_count)) : 0} pkts/s
                  </span>
                </div>
                <div className="flex-grow border-b border-l border-[#3b4b37] relative h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timelineData.timeline.slice(-15)} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                      <defs>
                        <linearGradient id="upGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00ff41" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#00ff41" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="time" hide />
                      <Area type="monotone" dataKey="packet_count" stroke="#00ff41" fill="url(#upGrad)" strokeWidth={1.5} dot={false} />
                      {timelineData.alert_markers.map((m, i) => (
                        <ReferenceLine
                          key={i}
                          x={m.time}
                          stroke={m.severity === 'critical' ? '#ff0040' : '#ffd393'}
                          strokeDasharray="3 3"
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Downlink (Bytes) */}
              <div className="flex flex-col h-1/2 min-h-[140px]">
                <div className="flex justify-between items-end mb-1 text-[10px]">
                  <span className="text-yellow-500 font-bold font-mono">DOWNLINK (RX)</span>
                  <span className="text-yellow-500 font-bold font-mono">
                    {timelineData.timeline.length > 0 ? (Math.max(...timelineData.timeline.map(t => t.total_bytes)) / 1024).toFixed(1) : 0} KB/s
                  </span>
                </div>
                <div className="flex-grow border-b border-l border-[#3b4b37] relative h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timelineData.timeline.slice(-15)} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                      <defs>
                        <linearGradient id="downGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ffd393" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#ffd393" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="time" hide />
                      <Area type="monotone" dataKey="total_bytes" stroke="#ffd393" fill="url(#downGrad)" strokeWidth={1.5} dot={false} />
                      {timelineData.alert_markers.map((m, i) => (
                        <ReferenceLine
                          key={i}
                          x={m.time}
                          stroke={m.severity === 'critical' ? '#ff0040' : '#ffd393'}
                          strokeDasharray="3 3"
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          </aside>

        </div>

        {/* Bottom Section: GeoIP lookup cache table ledger */}
        <div className="terminal-window flex flex-col mt-4">
          <div className="terminal-header p-2 flex items-center justify-between text-xs font-bold text-[#00ff41] blinking-cursor">
            <span className="flex items-center gap-1.5"><Globe size={14} /> GEOIP LOOKUP CACHE</span>
          </div>
          
          <div className="overflow-x-auto custom-scrollbar max-h-[200px]">
            <table className="w-full text-left">
              <thead className="bg-[#071106] text-[#84967e] text-xs border-b border-[#3b4b37] sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-2">IP_ADDR</th>
                  <th className="px-4 py-2">ORIGIN</th>
                  <th className="px-4 py-2">SECURITY_ALARMS</th>
                  <th className="px-4 py-2">ISP</th>
                  <th className="px-4 py-2 text-right">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3b4b37]/30 text-xs text-[#dae6d2]">
                {nodes.map((n) => (
                  <tr 
                    key={n.id} 
                    onClick={() => selectNodeFromTable(n.id)}
                    className={`table-row-hover transition-colors cursor-pointer
                      ${selected === n.id ? 'bg-[#00ff41]/10 text-white' : ''}`}
                  >
                    <td className="px-4 py-2 font-mono text-[#00ff41]">{n.id}</td>
                    <td className="px-4 py-2 font-mono">{n.is_internal ? 'INTERNAL_NODE' : 'EXTERNAL_NET'}</td>
                    <td className="px-4 py-2 text-red-500 font-bold">{n.alert_count > 0 ? `${n.alert_count} ALARMS` : '0 ALARMS'}</td>
                    <td className="px-4 py-2 text-gray-500 font-mono truncate max-w-xs">{n.is_internal ? 'Local Network segment' : 'Public WAN connection'}</td>
                    <td className="px-4 py-2 text-right">
                      {n.alert_count > 0 ? (
                        <span className="text-red-500 font-bold blink-fast">BLOCK</span>
                      ) : n.is_internal ? (
                        <span className="text-[#00ff41]">ALLOW</span>
                      ) : (
                        <span className="text-yellow-500">MONITOR</span>
                      )}
                    </td>
                  </tr>
                ))}
                {nodes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-500">NO GEOIP RECORDS REGISTERED</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  )
}
