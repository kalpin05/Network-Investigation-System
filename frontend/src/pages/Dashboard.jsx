import { useState, useEffect, useCallback } from 'react'
import { Upload, Download, Database, BarChart3, Terminal, Radio, Globe, Sliders } from 'lucide-react'
import { api } from '../api/client'
import PacketTable from '../components/PacketTable'
import DPIPanel from '../components/DPIPanel'
import PacketTimeline from '../components/PacketTimeline'
import { API_BASE_URL as API, WS_BASE_URL } from '../config'

const styleSheet = `
body {
    background-color: #0c160a;
    color: #dae6d2;
    position: relative;
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
    padding: 2px 8px;
    display: inline-block;
    margin-bottom: 8px;
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

.custom-scrollbar::-webkit-scrollbar {
    width: 5px;
    height: 5px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: #0c160a;
    border-left: 1px solid #3b4b37;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background: #00ff41;
}

.table-row-hover:hover {
    background-color: rgba(0, 255, 65, 0.05);
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


// ── Spinning Holographic Globe ───────────────────────────────────
function HolographicGlobe() {
  return (
    <div className="relative w-60 h-60 mx-auto flex items-center justify-center">
      {/* Outer Orbit Rings */}
      <div className="absolute w-full h-full border border-[#00ff41]/10 rounded-full animate-[spin_30s_linear_infinite]" />
      <div className="absolute w-[92%] h-[92%] border border-dashed border-[#00ff41]/25 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
      <div className="absolute w-[84%] h-[84%] border border-[#00ff41]/5 rounded-full" />
      
      {/* Globe Wireframe Sphere */}
      <svg className="w-[80%] h-[80%] text-[#00ff41]/80 animate-[spin_50s_linear_infinite]" viewBox="0 0 100 100">
        <defs>
          <radialGradient id="globeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00ff41" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#00ff41" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="45" fill="url(#globeGlow)" stroke="rgba(0, 255, 65, 0.25)" strokeWidth="0.5" />
        
        {/* Latitudes */}
        <ellipse cx="50" cy="50" rx="45" ry="12" fill="none" stroke="rgba(0, 255, 65, 0.15)" strokeWidth="0.5" />
        <ellipse cx="50" cy="50" rx="45" ry="26" fill="none" stroke="rgba(0, 255, 65, 0.15)" strokeWidth="0.5" />
        <line x1="5" y1="50" x2="95" y2="50" stroke="rgba(0, 255, 65, 0.3)" strokeWidth="0.5" />
        
        {/* Longitudes */}
        <ellipse cx="50" cy="50" rx="12" ry="45" fill="none" stroke="rgba(0, 255, 65, 0.15)" strokeWidth="0.5" />
        <ellipse cx="50" cy="50" rx="26" ry="45" fill="none" stroke="rgba(0, 255, 65, 0.15)" strokeWidth="0.5" />
        <line x1="50" y1="5" x2="50" y2="95" stroke="rgba(0, 255, 65, 0.3)" strokeWidth="0.5" />

        {/* Threat vectors & hotspots */}
        <circle cx="25" cy="35" r="1.5" className="fill-red-500 animate-pulse" />
        <circle cx="75" cy="55" r="1.5" className="fill-[#00ff41] animate-pulse" />
        <circle cx="50" cy="15" r="1.5" className="fill-[#00ff41] animate-pulse" />
        <circle cx="32" cy="72" r="1.5" className="fill-yellow-500 animate-pulse" />
        
        <path d="M 25 35 Q 50 15 75 55" fill="none" stroke="rgba(0, 255, 65, 0.35)" strokeWidth="0.5" strokeDasharray="2,2" />
        <path d="M 32 72 Q 50 45 50 15" fill="none" stroke="rgba(239, 68, 68, 0.35)" strokeWidth="0.5" strokeDasharray="3,1" />
      </svg>
      
      {/* Radar scanning sweep */}
      <div className="absolute w-[80%] h-[80%] rounded-full border border-[#00ff41]/10 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 w-full h-full bg-gradient-to-tr from-[#00ff41]/10 to-transparent origin-top-left animate-[spin_4s_linear_infinite]" style={{ transform: 'translate(-100%, -100%)' }} />
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [sessions, setSessions] = useState([])
  const [uploading, setUploading] = useState(false)
  const [stats, setStats] = useState({ sessions: 0, packets: 0, alerts: 0 })
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [custodyLogs, setCustodyLogs] = useState([])
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [activeTab, setActiveTab] = useState('packets')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [alerts, setAlerts] = useState([])

  const fetchCustodyLogs = useCallback(() => {
    api.get(`${API}/api/custody`)
      .then(r => setCustodyLogs(r.data))
      .catch(err => console.error("[Custody] Load failed", err))
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    api.get(`${API}/api/sessions`).then(r => {
      setSessions(r.data)
      if (r.data.length > 0) {
        setSelectedSessionId(r.data[0].session_id)
      }
    })
    api.get(`${API}/api/dashboard`).then(r => setStats(r.data)).catch(() => {})
    api.get(`${API}/api/alerts`).then(r => setAlerts(r.data)).catch(() => {})
    fetchCustodyLogs()
  }, [fetchCustodyLogs])

  const handleUploadSubmit = async (pcapFile, keylogFile) => {
    if (!pcapFile) return
    setUploading(true)
    const form = new FormData()
    form.append('file', pcapFile)
    if (keylogFile) form.append('keylog_file', keylogFile)
    
    try {
      setShowUploadModal(false)
      const res = await api.post(`${API}/api/pcap/upload`, form)
      const r = await api.get(`${API}/api/sessions`)
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
      const res = await api.get(`${API}/api/evidence/${sessionId}`, {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `evidence_${filename}.zip`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      fetchCustodyLogs()
    } catch (err) {
      console.error("[Download] Evidence download failed", err)
    }
  }

  // Metrics configurations
  const threatRatio = Math.min(Math.round(((stats.alerts || 0) / Math.max(sessions.length * 10, 1)) * 100), 100)
  const networkRatio = 52 // simulated load
  const integrityRatio = Math.max(100 - Math.round(((stats.alerts || 0) / Math.max(sessions.length * 5, 1)) * 30), 10)

  return (
    <div className="min-h-screen bg-[#0c160a] text-[#dae6d2] font-mono flex flex-col relative overflow-hidden select-none pb-12 space-y-6">
      <style dangerouslySetInnerHTML={{ __html: styleSheet }} />
      <ShaderBackground />
      <div className="crt-scanlines absolute inset-0 w-full h-full pointer-events-none" />
      <div className="crt-overlay absolute inset-0 w-full h-full pointer-events-none" />
      <div className="scanner-line pointer-events-none" />

      {/* Header Info Banner */}
      <header className="flex justify-between items-center bg-[#071106] border-b border-[#3b4b37] px-4 py-3 font-headline-sm uppercase">
        <div className="flex items-center space-x-4">
          <span className="text-lg font-bold text-[#00ff41] animate-pulse">SYS_STATUS_v4.02</span>
          <span className="text-xs text-[#00ff41]/70">root@cyberspace_node [{currentTime.toLocaleTimeString('en-US', { hour12: false })}]</span>
        </div>
        <div className="flex items-center space-x-3 text-xs">
          <Sliders size={14} className="cursor-pointer text-[#00ff41] hover:opacity-80" />
          <Terminal size={14} className="cursor-pointer text-[#00ff41] hover:opacity-80" />
          <Radio size={14} className="cursor-pointer text-[#00ff41] animate-pulse" />
        </div>
      </header>

      {/* Main Grid: Stitch Cyber-Terminal layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        
        {/* Left Column: Network Traffic Monitor */}
        <div className="terminal-window col-span-12 md:col-span-4 flex flex-col p-4">
          <div className="text-xs font-bold terminal-header w-max">[NETWORK TRAFFIC MONITOR]</div>
          <div className="flex-grow min-h-[260px] relative border border-[#3b4b37] bg-[#071106] flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#00ff41 1px, transparent 1px)', backgroundSize: '15px 15px' }} />
            <div className="text-center text-xs text-[#00ff41] opacity-50 absolute pointer-events-none">
              <Globe size={40} className="mx-auto mb-2 opacity-30 animate-pulse" />
              UPLINK ESTABLISHED<br/>
              SCANNING SECTORS...
            </div>
            <HolographicGlobe />
          </div>
          <div className="mt-2 text-[10px] text-[#00ff41]/85 flex justify-between uppercase">
            <span>NODES: {sessions.length * 15 || 120}</span>
            <span className="text-yellow-500">THREATS: {stats.alerts || 0}</span>
          </div>
        </div>

        {/* Center Column: Live Traffic Tap */}
        <div className="terminal-window col-span-12 md:col-span-5 flex flex-col p-4">
          <div className="text-xs font-bold terminal-header w-max">[LIVE TRAFFIC TAP]</div>
          <div className="flex-grow min-h-[260px] bg-[#071106] border border-[#3b4b37] p-3 flex flex-col justify-between text-xs text-[#b9ccb2] overflow-hidden">
            <LiveFeed />
          </div>
        </div>

        {/* Right Column: System Metrics */}
        <div className="terminal-window col-span-12 md:col-span-3 flex flex-col p-4">
          <div className="text-xs font-bold terminal-header w-max">[SYSTEM METRICS]</div>
          <div className="flex-grow min-h-[260px] flex flex-col justify-around bg-[#071106] border border-[#3b4b37] p-4 text-xs">
            
            {/* Metric 1 */}
            <div>
              <div className="flex justify-between text-[10px] mb-1 uppercase tracking-wider">
                <span>THREAT_LEVEL</span>
                <span className="text-[#ff0040]">{threatRatio}%</span>
              </div>
              <div className="w-full h-3 bg-[#2d382a] border border-[#3b4b37]">
                <div className="h-full bg-[#ff0040] transition-all duration-1000" style={{ width: `${threatRatio}%` }} />
              </div>
            </div>

            {/* Metric 2 */}
            <div>
              <div className="flex justify-between text-[10px] mb-1 uppercase tracking-wider">
                <span>NETWORK_LOAD</span>
                <span className="text-[#00ff41]">{networkRatio}%</span>
              </div>
              <div className="w-full h-3 bg-[#2d382a] border border-[#3b4b37]">
                <div className="h-full bg-[#00ff41] transition-all duration-1000" style={{ width: `${networkRatio}%` }} />
              </div>
            </div>

            {/* Metric 3 */}
            <div>
              <div className="flex justify-between text-[10px] mb-1 uppercase tracking-wider">
                <span>MALWARE_ACTIVITY</span>
                <span className="text-yellow-500">{stats.alerts || 0} alerts</span>
              </div>
              <div className="w-full h-3 bg-[#2d382a] border border-[#3b4b37]">
                <div className="h-full bg-yellow-500 transition-all duration-1000" style={{ width: `${Math.min((stats.alerts / 20) * 100, 100)}%` }} />
              </div>
            </div>

            {/* Metric 4 */}
            <div>
              <div className="flex justify-between text-[10px] mb-1 uppercase tracking-wider">
                <span>SYSTEM_INTEGRITY</span>
                <span className="text-[#00ff41]">{integrityRatio}%</span>
              </div>
              <div className="w-full h-3 bg-[#2d382a] border border-[#3b4b37]">
                <div className="h-full bg-[#00ff41] transition-all duration-1000" style={{ width: `${integrityRatio}%` }} />
              </div>
            </div>

          </div>
        </div>

        {/* Bottom Left: Hex Packet Analysis */}
        <div className="terminal-window col-span-12 md:col-span-6 flex flex-col p-4">
          <div className="text-xs font-bold terminal-header w-max">[PACKET DUMP ANALYSIS]</div>
          <div className="flex-grow min-h-[120px] bg-[#071106] border border-[#3b4b37] p-3 overflow-hidden text-xs text-[#84967e]/90 font-mono leading-relaxed">
            <div>0x00A1  4F 32 11 AA 00 FF E1 22  O2....."</div>
            <div>0x00A9  <span className="text-red-500 blink">FF FF</span> 00 12 34 56 78 90  ....4Vx.</div>
            <div>0x00B1  01 02 03 04 <span className="text-[#00ff41]">05 06 07 08</span>  ........</div>
            <div>0x00B9  AA BB CC DD EE FF 00 11  ........</div>
            <div>0x00C1  22 33 44 55 66 77 88 99  "3DUfw..</div>
          </div>
        </div>

        {/* Bottom Right: Active Threats list (Alert processes table) */}
        <div className="terminal-window col-span-12 md:col-span-6 flex flex-col p-4">
          <div className="text-xs font-bold terminal-header w-max">[ACTIVE THREAT LOGS]</div>
          <div className="flex-grow min-h-[120px] bg-[#071106] border border-[#3b4b37] p-2 overflow-y-auto custom-scrollbar text-xs text-[#dae6d2]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#3b4b37] text-[#84967e] text-[10px] uppercase font-bold">
                  <th className="py-1">PID</th>
                  <th>THREAT_RULE</th>
                  <th>SEVERITY</th>
                </tr>
              </thead>
              <tbody>
                {alerts.slice(0, 4).map((a, idx) => (
                  <tr key={idx} className="border-b border-[#3b4b37]/30 hover:bg-[#00ff41]/5">
                    <td className="py-1.5 font-mono">{a.alert_id.slice(0, 3)}</td>
                    <td className="font-mono text-[#00ff41]">{a.rule_name}</td>
                    <td className={a.severity === 'critical' ? 'text-red-500 blink' : a.severity === 'high' ? 'text-yellow-500 font-bold' : 'text-[#84967e]'}>
                      {a.severity.toUpperCase()}
                    </td>
                  </tr>
                ))}
                {alerts.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center py-6 text-gray-500">NO THREAT PROCESSES DETECTED</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Control Actions bar */}
      <div className="bg-[#071106] border border-[#3b4b37] flex flex-wrap gap-3 py-3 px-4 justify-center items-center">
        <button 
          onClick={() => setShowUploadModal(true)}
          className="border border-[#00ff41] text-[#00ff41] px-4 py-1.5 text-xs font-bold uppercase tracking-wider glow-hover transition-all cursor-pointer"
        >
          [ RUN PCAP INGESTION ]
        </button>
        <div className="text-xs text-[#00ff41]/60">
          CYBER-DECK SYSTEMS // v8.1.0 DATA_LINK: ESTABLISHED
        </div>
      </div>

      {showUploadModal && (
        <UploadModal 
          onClose={() => setShowUploadModal(false)}
          onSubmit={handleUploadSubmit}
          uploading={uploading}
        />
      )}

      {/* Traffic analytics bar trackers */}
      {stats.top_talkers && stats.top_talkers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="terminal-window p-1">
            <TopTalkers data={stats.top_talkers} />
          </div>
          <div className="terminal-window p-1">
            <TopProtocols data={stats.top_protocols} />
          </div>
          <div className="terminal-window p-1">
            <TopPorts data={stats.top_ports} />
          </div>
        </div>
      )}

      {/* Exchange Data Repository: Ingested sessions directory grid */}
      <div className="terminal-window flex flex-col p-4 mt-6">
        <div className="text-xs font-bold terminal-header w-max">[INDEXED DATA SESSIONS]</div>
        <div className="overflow-x-auto custom-scrollbar max-h-[300px]">
          <table className="w-full text-left">
            <thead className="bg-[#071106] text-[#84967e] text-xs border-b border-[#3b4b37]">
              <tr>
                {['Filename', 'Packets', 'Threat Score', 'Status', 'Uploaded', 'SHA-256', 'Evidence'].map(h => (
                  <th key={h} className="px-4 py-3 font-semibold uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3b4b37]/30 text-xs">
              {sessions.map((s) => (
                <tr 
                  key={s.session_id} 
                  onClick={() => setSelectedSessionId(s.session_id)}
                  className={`cursor-pointer transition-colors
                    ${selectedSessionId === s.session_id 
                      ? 'bg-[#00ff41]/10 text-white border-l-2 border-[#00ff41]' 
                      : 'hover:bg-[#00ff41]/5 text-[#dae6d2]'}`}
                >
                  <td className="px-4 py-3 text-[#00ff41] max-w-[150px] truncate" title={s.filename}>{s.filename}</td>
                  <td className="px-4 py-3 font-bold">{s.packet_count?.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <ThreatScoreBadge score={s.threat_score} />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border
                      ${s.status === 'complete' 
                        ? 'bg-emerald-950/40 text-emerald-300 border-emerald-700/40' 
                        : 'bg-amber-950/40 text-amber-300 border-amber-700/40'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#84967e]">{new Date(s.upload_time).toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-500">{s.sha256_hash?.slice(0, 15)}...</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => downloadEvidence(s.session_id, s.filename)}
                      className="bg-transparent hover:bg-[#00ff41]/10 border border-[#3b4b37] hover:border-[#00ff41] text-[#00ff41] p-1.5 rounded transition-all cursor-pointer"
                      title="Download ZIP Evidence"
                    >
                      <Download size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sessions.length === 0 && (
            <div className="text-center py-12 text-[#84967e]">No sessions yet. Upload a PCAP to begin.</div>
          )}
        </div>
      </div>

      {/* Packet Timeline rates */}
      <div className="mt-6">
        <PacketTimeline sessionId={selectedSessionId} />
      </div>

      {/* Segment detail tab selectors */}
      {selectedSessionId && (
        <div className="flex gap-4 border-b border-[#3b4b37]/50 pb-2 mt-8">
          <button
            onClick={() => setActiveTab('packets')}
            className={`flex items-center gap-2 pb-2 text-xs font-bold border-b-2 cursor-pointer transition-all ${
              activeTab === 'packets'
                ? 'border-[#00ff41] text-[#00ff41] shadow-[0_4px_10px_-4px_rgba(0,255,65,0.4)]'
                : 'border-transparent text-[#84967e] hover:text-white'
            }`}
          >
            <Database size={14} /> [PARSED_PACKETS]
          </button>
          <button
            onClick={() => setActiveTab('dpi')}
            className={`flex items-center gap-2 pb-2 text-xs font-bold border-b-2 cursor-pointer transition-all ${
              activeTab === 'dpi'
                ? 'border-[#00ff41] text-[#00ff41] shadow-[0_4px_10px_-4px_rgba(0,255,65,0.4)]'
                : 'border-transparent text-[#84967e] hover:text-white'
            }`}
          >
            <BarChart3 size={14} /> [DEEP_INSPECTION_DPI]
          </button>
        </div>
      )}

      {selectedSessionId && activeTab === 'packets' && (
        <PacketTable sessionId={selectedSessionId} />
      )}

      {selectedSessionId && activeTab === 'dpi' && (
        <DPIPanel sessionId={selectedSessionId} />
      )}

      {/* Security registry log */}
      <CustodyLogs logs={custodyLogs} />
    </div>
  )
}

// ── Chain of custody audit log table component ──────────────────────────────
function CustodyLogs({ logs }) {
  return (
    <div className="terminal-window flex flex-col p-4 mt-6">
      <div className="text-xs font-bold terminal-header w-max">[CHAIN_OF_CUSTODY_AUDIT_LOG]</div>
      <div className="overflow-x-auto custom-scrollbar max-h-[300px]">
        <table className="w-full text-left">
          <thead className="bg-[#071106] text-[#84967e] text-xs border-b border-[#3b4b37]">
            <tr>
              {['Timestamp', 'User', 'Action', 'Session ID', 'IP Address'].map(h => (
                <th key={h} className="px-4 py-3 font-semibold uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#3b4b37]/30 text-xs">
            {logs.map((l) => (
              <tr key={l.log_id} className="hover:bg-[#00ff41]/5 text-[#dae6d2]">
                <td className="px-4 py-2.5 text-gray-400">{new Date(l.accessed_at).toLocaleString()}</td>
                <td className="px-4 py-2.5 text-[#00ff41] font-bold">{l.username || 'System'}</td>
                <td className="px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize border
                    ${l.action === 'upload' 
                      ? 'bg-emerald-950/40 text-[#00ff41] border-emerald-700/30' : 
                      l.action.startsWith('export') 
                        ? 'bg-yellow-950/40 text-yellow-400 border-yellow-700/30' : 
                        'bg-orange-950/40 text-orange-300 border-orange-700/30'}`}>
                    {l.action.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-500">{l.session_id || 'N/A'}</td>
                <td className="px-4 py-2.5 text-gray-400">{l.ip_address}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-[#84967e]">No audit log entries found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function UploadModal({ onClose, onSubmit, uploading }) {
  const [pcapFile, setPcapFile] = useState(null)
  const [keylogFile, setKeylogFile] = useState(null)

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className="relative overflow-hidden bg-gray-950 border border-[#00ff41]/30 rounded-2xl p-6 w-full max-w-lg space-y-5 shadow-[0_0_40px_rgba(0,255,65,0.15)]">
        <div className="absolute top-0 right-0 w-12 h-12 border-r-2 border-t-2 border-[#00ff41]/20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-12 h-12 border-l-2 border-b-2 border-[#00ff41]/20 pointer-events-none" />

        <div className="flex justify-between items-center border-b border-[#3b4b37] pb-3">
          <h2 className="text-lg font-bold text-[#00ff41] flex items-center gap-2">
            <Upload size={18} /> [INGEST_FORENSIC_STREAM]
          </h2>
        </div>

        <div className="space-y-4">
          <div className="bg-[#071106] p-4 rounded border border-[#3b4b37] space-y-2">
            <label className="block text-xs font-bold text-[#00ff41] uppercase">1. PCAP File (Required)</label>
            <p className="text-[10px] text-gray-500">Format: .pcap, .pcapng. Packets will be parsed and indexed.</p>
            <input 
              type="file" 
              accept=".pcap,.pcapng" 
              onChange={e => setPcapFile(e.target.files[0])}
              className="block w-full text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border file:border-[#00ff41]/20 file:text-xs file:font-semibold file:bg-[#00ff41]/10 file:text-[#00ff41] hover:file:bg-[#00ff41]/20 file:cursor-pointer cursor-pointer"
            />
          </div>

          <div className="bg-[#071106] p-4 rounded border border-[#3b4b37] space-y-2">
            <label className="block text-xs font-bold text-[#00ff41] uppercase flex items-center gap-2">
              2. TLS Keylog File (Optional) <span className="px-2 py-0.5 rounded text-[9px] bg-purple-950 text-purple-300 border border-purple-800/40">HTTPS DECRYPT</span>
            </label>
            <p className="text-[10px] text-gray-500">Upload the pre-master secrets keylog file to inspect encrypted HTTP request headers.</p>
            <input 
              type="file" 
              accept=".log,.txt" 
              onChange={e => setKeylogFile(e.target.files[0])}
              className="block w-full text-xs text-[#84967e] file:mr-4 file:py-2 file:px-4 file:rounded file:border file:border-[#3b4b37] file:text-xs file:font-semibold file:bg-[#141414] file:text-gray-300 hover:file:bg-[#2d382a] file:cursor-pointer cursor-pointer"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-3">
          <button 
            onClick={() => onSubmit(pcapFile, keylogFile)}
            disabled={!pcapFile || uploading}
            className={`flex-1 py-3 rounded text-xs font-bold transition-all border
              ${(!pcapFile || uploading) 
                ? 'bg-gray-900 text-gray-600 border-gray-800 cursor-not-allowed' 
                : 'bg-transparent text-[#00ff41] border-[#00ff41] hover:bg-[#00ff41]/10 hover:shadow-[0_0_15px_rgba(0,255,65,0.2)] cursor-pointer'}`}
          >
            {uploading ? 'PARSING_DATA...' : 'EXECUTE_ANALYSIS'}
          </button>
          <button 
            onClick={onClose}
            disabled={uploading}
            className="flex-1 bg-transparent hover:bg-red-500/10 text-red-500 border border-red-500/40 py-3 rounded text-xs font-bold transition-colors cursor-pointer"
          >
            ABORT
          </button>
        </div>
      </div>
    </div>
  )
}

function ThreatScoreBadge({ score }) {
  if (score === undefined || score === null) return <span className="text-gray-600 text-xs font-mono">—</span>
  const color =
    score >= 70 ? 'bg-red-950/40 text-red-400 border-red-700/40' :
    score >= 40 ? 'bg-orange-950/40 text-orange-400 border-orange-700/40' :
    score >= 20 ? 'bg-yellow-950/40 text-yellow-400 border-yellow-700/40' :
                  'bg-green-950/40 text-[#00ff41] border-green-700/40'
  return (
    <span className={`px-2 py-0.5 rounded border text-[10px] font-bold leading-none ${color}`}>
      {score}/100
    </span>
  )
}

// ── Live capture feed component ─────────────────────────────────────────────
function LiveFeed() {
  const [active, setActive] = useState(false)
  const [packets, setPackets] = useState([])

  useEffect(() => {
    let ws = null
    if (active) {
      const wsUrl = `${WS_BASE_URL}/ws/capture`
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
    <div className="flex flex-col h-full justify-between">
      <div className="flex items-center justify-between border-b border-[#3b4b37] pb-2 mb-3">
        <span className="text-[10px] text-[#00ff41]/85 uppercase tracking-widest flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className={`absolute inline-flex h-full w-full rounded-full bg-[#00ff41] opacity-75 ${active ? 'animate-ping' : ''}`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${active ? 'bg-[#00ff41]' : 'bg-gray-600'}`}></span>
          </span>
          STATUS: {active ? 'TAP_ACTIVE' : 'TAP_HALTED'}
        </span>
        <button
          onClick={() => setActive(!active)}
          className="text-[10px] font-bold px-2 py-0.5 border border-[#00ff41] text-[#00ff41] bg-transparent hover:bg-[#00ff41]/10 transition-colors cursor-pointer rounded-sm"
        >
          {active ? '[ HALT ]' : '[ ENGAGE ]'}
        </button>
      </div>
      <div className="flex-grow overflow-y-auto space-y-2 pr-1 custom-scrollbar text-xs text-[#b9ccb2]">
        {packets.map((p, idx) => (
          <div key={idx} className="flex justify-between border-b border-[#3b4b37]/20 pb-1 leading-normal hover:bg-[#00ff41]/5 px-1 rounded-sm transition-colors font-mono">
            <span className="text-[#00ff41] font-bold truncate max-w-[100px]">{p.src_ip}</span>
            <span className="text-gray-600">➔</span>
            <span className="text-[#84967e] truncate max-w-[100px]">{p.dst_ip}</span>
            <span className="text-yellow-500 font-bold text-[9px] px-1 bg-yellow-950/20 border border-yellow-700/20 rounded-sm">{p.protocol}</span>
            <span className="text-gray-400 text-[9px]">{p.packet_length}B</span>
          </div>
        ))}
        {packets.length === 0 && (
          <div className="text-center py-20 text-[#84967e]/55 text-xs">
            {active ? 'SCANNING FOR RAW INTERCEPTS...' : 'ENGAGE TAP TO COMMENCE PACKET SNIFFING'}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Traffic breakdown panels ────────────────────────────────────────────────
function TopTalkers({ data }) {
  if (!data || data.length === 0) return null
  const max = data[0]?.bytes || 1

  return (
    <div className="p-4 flex flex-col justify-between h-full bg-[#071106] border border-[#3b4b37]/30">
      <div className="font-bold text-xs text-[#00ff41] border-b border-[#3b4b37] pb-2 mb-3">[TOP_TRAFFIC_TALKERS]</div>
      <div className="space-y-3">
        {data.map((t, i) => (
          <div key={t.ip}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#a4cc9c] font-bold">{t.ip}</span>
              <span className="text-gray-500">{(t.bytes / 1024).toFixed(1)} KB</span>
            </div>
            <div className="h-2 bg-[#141414] border border-[#3b4b37]/80">
              <div
                className={`h-full ${i === 0 ? 'bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.5)]' : 'bg-[#00ff41] shadow-[0_0_8px_rgba(0,255,65,0.5)]'}`}
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
    <div className="p-4 flex flex-col justify-between h-full bg-[#071106] border border-[#3b4b37]/30">
      <div className="font-bold text-xs text-[#00ff41] border-b border-[#3b4b37] pb-2 mb-3">[PROTOCOL_DISTRIBUTION]</div>
      <div className="space-y-3">
        {data.map((p, i) => (
          <div key={p.protocol}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#a4cc9c] font-bold">{p.protocol}</span>
              <span className="text-gray-500">{p.count} packets</span>
            </div>
            <div className="h-2 bg-[#141414] border border-[#3b4b37]/80">
              <div
                className={`h-full ${i === 0 ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]' : 'bg-[#00ff41] shadow-[0_0_8px_rgba(0,255,65,0.5)]'}`}
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
    <div className="p-4 flex flex-col justify-between h-full bg-[#071106] border border-[#3b4b37]/30">
      <div className="font-bold text-xs text-[#00ff41] border-b border-[#3b4b37] pb-2 mb-3">[TOP_DESTINATION_PORTS]</div>
      <div className="space-y-3">
        {data.map((p, i) => (
          <div key={p.port}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#a4cc9c] font-bold">Port {p.port}</span>
              <span className="text-gray-500">{p.count} packets</span>
            </div>
            <div className="h-2 bg-[#141414] border border-[#3b4b37]/80">
              <div
                className={`h-full ${i === 0 ? 'bg-purple-600 shadow-[0_0_8px_rgba(147,51,234,0.5)]' : 'bg-[#00ff41] shadow-[0_0_8px_rgba(0,255,65,0.5)]'}`}
                style={{ width: `${(p.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
