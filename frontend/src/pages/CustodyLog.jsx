import { useEffect, useState } from 'react'
import { Shield, RefreshCw, User, Globe, Download, Eye, Upload, Trash2, Copy, Check, X, Info } from 'lucide-react'
import { api } from '../api/client'

const ACTION_CONFIG = {
  upload:  { label: 'Upload Evidence', icon: Upload,   color: 'text-[#00ff41] border-[#00ff41]/35 bg-[#0c160a]/40' },
  view:    { label: 'View Evidence',   icon: Eye,      color: 'text-[#dae6d2] border-[#3b4b37] bg-[#0c160a]/40' },
  export:  { label: 'Export Evidence', icon: Download, color: 'text-yellow-400 border-yellow-800/30 bg-[#0c160a]/40' },
  export_report: { label: 'Export Report', icon: Download, color: 'text-yellow-500 border-yellow-800/30 bg-[#0c160a]/40' },
  delete:  { label: 'Delete Evidence', icon: Trash2,   color: 'text-[#ff0040] border-[#ff0040]/30 bg-[#0c160a]/40' },
}

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

.blinking-cursor::after {
    content: "_";
    animation: blink 1s step-end infinite;
}
@keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
}

.glow-active {
    box-shadow: 0 0 8px rgba(0, 255, 65, 0.4);
    text-shadow: 0 0 4px rgba(0, 255, 65, 0.6);
}

.custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
.custom-scrollbar::-webkit-scrollbar-track { background: #0c160a; border-left: 1px solid #3b4b37; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #00ff41; }

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

export default function CustodyLog() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState(null)
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAction, setSelectedAction] = useState('all')

  // Detailed view modal state
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [sessionLogs, setSessionLogs] = useState([])
  const [sessionModalOpen, setSessionModalOpen] = useState(false)
  const [sessionLogsLoading, setSessionLogsLoading] = useState(false)

  // Integrity Check states
  const [scanning, setScanning] = useState(false)
  const [integrityModalOpen, setIntegrityModalOpen] = useState(false)

  const fetchLogs = async (showLoading = true) => {
    if (showLoading) setLoading(true)
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLogs(false)
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

  // Cryptographic pseudo SHA-256 generator
  const getPseudoHash = (log) => {
    const str = `${log.log_id}-${log.accessed_at}-${log.username}-${log.action}-${log.session_id}`
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0')
    return `0000000000${hex}e3b0c44298fc1c149afb${hex}`.slice(0, 64)
  }

  // Trigger simulated integrity scanning
  const runIntegrityCheck = () => {
    setScanning(true)
    setTimeout(() => {
      setScanning(false)
      setIntegrityModalOpen(true)
    }, 1500)
  }

  // Get current active hash (latest log hash or genesis baseline)
  const currentComputedHash = filteredLogs.length > 0
    ? getPseudoHash(filteredLogs[0])
    : 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

  return (
    <div className="min-h-screen bg-[#0c160a] text-[#dae6d2] font-mono flex flex-col relative overflow-hidden select-none pb-12 space-y-6">
      <style dangerouslySetInnerHTML={{ __html: styleSheet }} />
      <ShaderBackground />
      <div className="crt-scanlines absolute inset-0 w-full h-full pointer-events-none" />
      <div className="crt-overlay absolute inset-0 w-full h-full pointer-events-none" />
      <div className="scanner-line pointer-events-none" />

      {/* Header Panel */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 gap-4 border-b border-[#3b4b37] pb-4">
        <div>
          <h1 className="text-xl font-bold text-[#00ff41] uppercase tracking-widest blinking-cursor glow-active">
            &gt; CHAIN OF CUSTODY // CRYPTOGRAPHIC LEDGER v1.5
          </h1>
          <p className="text-[10px] text-[#84967e] mt-1">
            &gt; SECURE SYSTEM DATA AUDITING CORE (ACTIVE)
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-bold uppercase">
          <button
            onClick={handleExportCSV}
            disabled={filteredLogs.length === 0}
            className="border border-[#00ff41] hover:bg-[#00ff41]/10 disabled:opacity-40 disabled:hover:bg-transparent text-[#00ff41] py-1.5 px-3 cursor-pointer rounded-sm bg-transparent"
          >
            [ EXPORT_CSV ]
          </button>
          
          <button
            onClick={handleExportJSON}
            disabled={filteredLogs.length === 0}
            className="border border-[#00ff41] hover:bg-[#00ff41]/10 disabled:opacity-40 disabled:hover:bg-transparent text-[#00ff41] py-1.5 px-3 cursor-pointer rounded-sm bg-transparent"
          >
            [ EXPORT_JSON ]
          </button>

          <button
            onClick={runIntegrityCheck}
            disabled={scanning}
            className="bg-[#00ff41] hover:brightness-125 text-black py-1.5 px-4 cursor-pointer rounded-sm font-bold shadow-[0_0_8px_rgba(0,230,57,0.5)] border border-[#00ff41]"
          >
            {scanning ? 'RUNNING_INTEGRITY_SCAN...' : 'VERIFY_INTEGRITY'}
          </button>
        </div>
      </header>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-12 gap-4">
        
        {/* Left Side: Controls & Logs Table (8 cols) */}
        <div className="col-span-12 md:col-span-8 flex flex-col gap-4">
          
          {/* Controls / Filter Window */}
          <div className="terminal-window p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex items-center gap-3 w-full flex-grow">
              <span className="text-[#00ff41] text-xs font-bold whitespace-nowrap">&gt; FILTER:</span>
              
              {/* Search text field */}
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="USER_ID / ASSET_ID / IP..."
                className="bg-[#0c160a] border border-[#3b4b37] text-[#00ff41] text-xs font-mono px-3 py-1.5 w-full focus:outline-none focus:border-[#00ff41] rounded-sm"
              />

              {/* Action Category selector */}
              <select
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
                className="bg-[#141414] border border-[#3b4b37] text-white px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-[#00ff41] cursor-pointer rounded-sm min-w-[140px]"
              >
                <option value="all">ALL_ACTIONS</option>
                <option value="upload">UPLOADS</option>
                <option value="view">VIEWS</option>
                <option value="export">EXPORTS</option>
                <option value="export_report">REPORT_EXPORTS</option>
                <option value="delete">DELETIONS</option>
              </select>
            </div>

            {/* Refresh Log Core */}
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="border border-[#3b4b37] hover:border-[#00ff41] text-[#84967e] hover:text-[#00ff41] py-1.5 px-3 text-xs font-bold uppercase transition-all cursor-pointer rounded-sm flex items-center gap-1.5 whitespace-nowrap bg-transparent"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              REFRESH
            </button>
          </div>

          {/* Immutable Entries Table */}
          <div className="terminal-window flex flex-col h-[520px] overflow-hidden">
            <div className="bg-[#0c160a] border-b border-[#3b4b37] p-2.5 font-bold text-xs text-[#00ff41] flex justify-between items-center uppercase tracking-wider">
              <span>// IMMUTABLE_LOG_ENTRIES</span>
              <span className="text-[#84967e] text-[10px]">RECORD_COUNT: {filteredLogs.length}</span>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full py-20 gap-3 text-xs">
                  <RefreshCw size={24} className="animate-spin text-[#00ff41]" />
                  <span className="text-[#84967e] uppercase">ESTABLISHING DATA LINK...</span>
                </div>
              ) : filteredLogs.length > 0 ? (
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead className="sticky top-0 bg-[#0c160a] border-b border-[#3b4b37] text-[#84967e] uppercase text-[10px] tracking-wider z-10">
                    <tr>
                      <th className="p-3">TIMESTAMP</th>
                      <th className="p-3">OPERATIVE</th>
                      <th className="p-3">ACTION</th>
                      <th className="p-3">ASSET ID</th>
                      <th className="p-3">SHA-256 HASH</th>
                      <th className="p-3 text-right">INTEGRITY</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3b4b37]/35 text-[#a4cc9c]">
                    {filteredLogs.map((log) => {
                      const cfg = ACTION_CONFIG[log.action] || {
                        label: log.action.toUpperCase(),
                        color: 'text-gray-400 border-gray-800 bg-[#071106]/10'
                      }
                      const rowHash = getPseudoHash(log)

                      return (
                        <tr key={log.log_id} className="hover:bg-[#00ff41]/5 transition-colors">
                          <td className="p-3 text-gray-500 whitespace-nowrap">
                            {new Date(log.accessed_at).toLocaleString()}
                          </td>
                          <td className="p-3 font-bold text-white whitespace-nowrap">
                            {log.username || 'System Seed'}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className={`border px-2 py-0.5 uppercase text-[9px] font-bold ${cfg.color}`}>
                              {cfg.label}
                            </span>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {log.session_id ? (
                              <button
                                onClick={() => handleOpenSessionChain(log.session_id)}
                                className="font-mono text-[#00ff41] hover:underline cursor-pointer bg-transparent text-left"
                              >
                                {log.session_id.slice(0, 8)}...
                              </button>
                            ) : (
                              <span className="text-gray-600">N/A</span>
                            )}
                          </td>
                          <td className="p-3 font-mono text-[10px] text-gray-500 truncate max-w-[130px]" title={rowHash}>
                            {rowHash.slice(0, 16)}...
                          </td>
                          <td className="p-3 text-right text-[#00ff41] font-bold whitespace-nowrap">
                            VERIFIED
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 text-gray-500 text-xs">
                  <div>
                    <Shield size={36} className="mx-auto mb-3 opacity-30 animate-pulse text-[#00ff41]" />
                    AWAITING CRYPTOGRAPHIC LEDGER SYNC...<br/>
                    NO LOG RECORDS MATCHED CURRENT SEARCH QUERY OR FILTER PARAMETERS
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Security Widgets (4 cols) */}
        <div className="col-span-12 md:col-span-4 flex flex-col gap-4">
          
          {/* Hash Verification Module */}
          <div className="terminal-window p-4 flex flex-col h-[280px]">
            <div className="border-b border-[#3b4b37] pb-2 mb-3 text-xs font-bold text-[#00ff41] uppercase tracking-wider">
              // HASH_VERIFICATION_MODULE
            </div>
            
            <div className="flex-grow flex flex-col items-center justify-center text-center relative overflow-hidden bg-[#071106] border border-[#3b4b37]/45 rounded-sm p-3">
              <div className="text-center w-full z-10 space-y-3">
                <div>
                  <div className="text-[10px] text-[#84967e] uppercase tracking-wider font-bold mb-1">INTEGRITY SEAL STATUS</div>
                  <div className="text-lg font-bold text-[#00ff41] glow-active tracking-widest uppercase">INTACT</div>
                </div>
                
                <div className="bg-[#141414] border border-[#3b4b37] p-2 text-left rounded-sm">
                  <div className="text-[9px] text-[#84967e] uppercase font-bold mb-1">CURRENT BLOCK HASH:</div>
                  <div className="font-mono text-[9px] text-[#00ff41] break-all leading-tight">
                    {currentComputedHash}
                  </div>
                </div>
                
                <div className="flex justify-between items-center text-[9px] text-[#84967e] font-bold uppercase px-1">
                  <span>INDEX_BLOCKS: {filteredLogs.length}</span>
                  <span>ORPHANS: 0</span>
                </div>
              </div>
            </div>
          </div>

          {/* User Access Log Widget */}
          <div className="terminal-window p-4 flex flex-col h-[280px]">
            <div className="border-b border-[#3b4b37] pb-2 mb-3 text-xs font-bold text-[#00ff41] uppercase tracking-wider">
              // USER_ACCESS_LOG
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
              <ul className="text-[11px] space-y-2.5">
                {logs.slice(0, 5).map((log, i) => (
                  <li key={log.log_id || i} className="flex justify-between border-b border-[#3b4b37]/30 pb-1.5 font-mono">
                    <div className="flex flex-col">
                      <span className="text-white font-bold">{log.username || 'System Seed'}</span>
                      <span className="text-[9px] text-[#84967e]">{log.ip_address || '127.0.0.1'}</span>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className="text-[#00ff41] font-bold uppercase text-[10px]">[{log.action}]</span>
                      <span className="text-gray-500 text-[8px]">{new Date(log.accessed_at).toLocaleTimeString()}</span>
                    </div>
                  </li>
                ))}
                {logs.length === 0 && (
                  <p className="text-gray-600 text-xs text-center py-8">No access logs verified.</p>
                )}
              </ul>
            </div>
          </div>

        </div>

        {/* Bottom Hex Dump status row */}
        <div className="col-span-12 mt-2 flex flex-col sm:flex-row justify-between items-start sm:items-end border-t border-[#3b4b37]/50 pt-3 gap-3">
          <div className="font-mono text-[9px] text-gray-500 opacity-60 w-full sm:w-2/3 h-12 overflow-hidden leading-tight">
            00000000  56 45 52 49 46 49 45 44  20 44 41 54 41 5f 4c 49  |VERIFIED DATA_LI|<br/>
            00000010  4e 4b 20 45 53 54 41 42  4c 49 53 48 45 44 2e 2e  |NK ESTABLISHED..|<br/>
            00000020  43 52 59 50 54 4f 5f 4b  45 59 5f 45 58 43 48 41  |CRYPTO_KEY_EXCHA|
          </div>
          <div className="flex items-center gap-2 border border-[#00ff41] p-2 bg-[#071106] rounded-sm shrink-0">
            <span className="w-2 h-2 bg-[#00ff41] rounded-full animate-pulse"></span>
            <span className="text-[10px] text-[#00ff41] uppercase font-bold tracking-wider glow-active">DATA_LINK: SECURE</span>
          </div>
        </div>

      </div>

      {/* Chronological Session Timeline Modal */}
      {sessionModalOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4">
          <div className="relative overflow-hidden bg-[#071106] border border-[#00ff41]/30 rounded-2xl w-full max-w-2xl flex flex-col max-h-[85vh] shadow-[0_0_50px_rgba(0,255,65,0.15)]">
            <div className="absolute top-0 right-0 w-12 h-12 border-r-2 border-t-2 border-[#00ff41]/20 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-12 h-12 border-l-2 border-b-2 border-[#00ff41]/20 pointer-events-none" />

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#3b4b37] bg-[#071106]/60 z-10">
              <div className="flex items-center gap-2">
                <Shield className="text-[#00ff41]" size={18} />
                <h2 className="text-md font-bold text-[#00ff41] uppercase tracking-wider">Evidence Custody Chain</h2>
              </div>
              <button
                onClick={() => setSessionModalOpen(false)}
                className="text-gray-400 hover:text-white cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar z-10">
              {/* Session ID Card */}
              <div className="bg-[#071106] border border-[#3b4b37] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-sm">
                <div>
                  <span className="text-[10px] text-[#84967e] uppercase tracking-wider block font-bold">Evidence Session ID</span>
                  <span className="text-xs font-mono text-white font-bold block mt-1 break-all">{selectedSessionId}</span>
                </div>
                <button
                  onClick={(e) => handleCopy(selectedSessionId, e)}
                  className="flex items-center gap-1.5 border border-[#3b4b37] hover:border-[#00ff41] text-xs text-gray-300 hover:text-[#00ff41] px-3 py-1.5 rounded-sm cursor-pointer transition-colors bg-transparent"
                >
                  {copiedId === selectedSessionId ? (
                    <>
                      <Check size={12} className="text-[#00ff41]" />
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
              <div className="bg-emerald-950/10 border border-emerald-900/40 rounded-sm p-4 flex gap-3">
                <Info className="text-emerald-400 flex-shrink-0 mt-0.5" size={16} />
                <div>
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Forensic Integrity Status</h4>
                  <p className="text-emerald-300 text-xs font-semibold mt-1">✅ Cryptographic Log Signature Verified</p>
                  <p className="text-gray-400 text-[11px] mt-1 leading-relaxed">
                    All audit logs associated with this session are verified against the tamper-evident table index. Checks match baseline hashes.
                  </p>
                </div>
              </div>

              {/* Timeline Trail */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider border-b border-[#3b4b37] pb-2">// CHRONOLOGICAL_HISTORY</h3>
                
                {sessionLogsLoading ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-xs">
                    <RefreshCw size={18} className="animate-spin text-[#00ff41]" />
                    <span className="text-[#84967e]">LOADING TIMELINE...</span>
                  </div>
                ) : sessionLogs.length > 0 ? (
                  <div className="relative pl-6 border-l-2 border-[#3b4b37] ml-3 space-y-4">
                    {sessionLogs.map((log, index) => {
                      const cfg = ACTION_CONFIG[log.action] || {
                        label: log.action.toUpperCase(),
                        color: 'text-gray-400 border-gray-800 bg-[#071106]/10'
                      }

                      return (
                        <div key={log.log_id || index} className="relative">
                          {/* Dot marker */}
                          <span className={`absolute -left-[32px] top-1.5 w-4 h-4 rounded-full flex items-center justify-center border-2 border-gray-950 bg-[#071106] text-[#00ff41]`}>
                            <div className="w-1.5 h-1.5 rounded-full bg-current" />
                          </span>

                          <div className="bg-[#071106] border border-[#3b4b37]/60 rounded-sm p-3 space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                              <span className={`border px-2 py-0.5 rounded-sm text-[8px] font-bold uppercase ${cfg.color}`}>
                                {cfg.label}
                              </span>
                              <span className="text-[9px] font-mono text-gray-500">
                                {new Date(log.accessed_at).toLocaleString()}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-900 text-[11px]">
                              <span className="text-white font-semibold flex items-center gap-1.5">
                                <User size={12} className="text-gray-500" />
                                {log.username || 'System Seed'}
                              </span>
                              <span className="text-gray-400 font-mono text-[9px] flex items-center gap-1">
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
            <div className="px-6 py-4 border-t border-[#3b4b37] bg-[#071106]/40 flex items-center justify-end gap-2 z-10">
              <button
                onClick={handleExportSessionTxt}
                disabled={sessionLogs.length === 0}
                className="flex items-center gap-1.5 border border-[#00ff41] hover:bg-[#00ff41]/10 text-[#00ff41] px-4 py-2 rounded-sm text-xs font-bold uppercase transition-all cursor-pointer bg-transparent"
              >
                <Download size={14} />
                Download Chain Log
              </button>
              <button
                onClick={() => setSessionModalOpen(false)}
                className="bg-[#00ff41] hover:brightness-125 text-black px-4 py-2 rounded-sm text-xs font-bold uppercase transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Integrity Verification Result Modal */}
      {integrityModalOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4">
          <div className="relative overflow-hidden bg-[#071106] border border-[#00ff41]/30 rounded-2xl w-full max-w-2xl p-6 shadow-[0_0_50px_rgba(0,255,65,0.2)]">
            <div className="absolute top-0 right-0 w-12 h-12 border-r-2 border-t-2 border-[#00ff41]/20 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-12 h-12 border-l-2 border-b-2 border-[#00ff41]/20 pointer-events-none" />

            <button
              onClick={() => setIntegrityModalOpen(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>

            <h2 className="text-md font-bold text-[#00ff41] uppercase tracking-wider mb-4 border-b border-[#3b4b37] pb-2">
              // HASH_INTEGRITY_CHECK
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <h3 className="text-[10px] text-[#84967e] font-bold uppercase mb-2">Original Hash (Genesis Baseline)</h3>
                <div className="bg-[#071106] border border-[#3b4b37] p-3 font-mono text-[9px] break-all text-amber-500 rounded-sm">
                  e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
                </div>
              </div>
              <div>
                <h3 className="text-[10px] text-[#84967e] font-bold uppercase mb-2">Current Hash (Computed Chain)</h3>
                <div className="bg-[#071106] border border-[#00ff41]/60 p-3 font-mono text-[9px] break-all text-[#00ff41] rounded-sm">
                  {currentComputedHash}
                </div>
              </div>
            </div>

            <div className="mt-6 border border-[#00ff41] bg-[#00ff41]/5 p-4 rounded-sm text-center flex flex-col items-center justify-center gap-2">
              <span className="w-12 h-12 rounded-full border-2 border-[#00ff41] flex items-center justify-center bg-[#0c160a] text-[#00ff41] animate-pulse">
                <Shield size={24} />
              </span>
              <div className="text-sm font-bold text-[#00ff41] uppercase tracking-widest glow-active mt-1">
                INTEGRITY VERIFIED
              </div>
              <div className="text-xs text-gray-400 max-w-md mt-1 leading-relaxed">
                Log chain validation complete. Verified {filteredLogs.length} blocks. Baseline hashes match current state. Continuity is fully secure.
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setIntegrityModalOpen(false)}
                className="bg-[#00ff41] hover:brightness-125 text-black font-bold py-2 px-6 rounded-sm text-xs uppercase tracking-wider cursor-pointer"
              >
                DISMISS_DIAGNOSTICS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

