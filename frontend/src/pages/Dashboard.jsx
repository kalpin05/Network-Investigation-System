import { useState, useEffect } from 'react'
import { Upload, Wifi, Shield, AlertTriangle, Download, Database, BarChart3, Clock, Compass, Activity, Server } from 'lucide-react'
import axios from 'axios'
import PacketTable from '../components/PacketTable'
import DPIPanel from '../components/DPIPanel'
import PacketTimeline from '../components/PacketTimeline'

const API = window.location.protocol + '//' + window.location.hostname + ':8000'

// ── Reusable 3D Tilt Wrapper ────────────────────────────────────────────────
function HologramScreen({ children }) {
  const [style, setStyle] = useState({
    transform: 'perspective(1500px) rotateY(-5deg) rotateX(2.5deg) scale(0.98)',
    transition: 'transform 0.5s ease, box-shadow 0.5s ease'
  })

  const handleMouseMove = (e) => {
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    const xc = rect.width / 2
    const yc = rect.height / 2
    
    // Fine-tuned tilt angles around the base tilted state
    const rotX = 2.5 - ((y - yc) / yc * 3) // base 2.5deg +- 3deg
    const rotY = -5 + ((x - xc) / xc * 3) // base -5deg +- 3deg
    
    setStyle({
      transform: `perspective(1500px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(1.005, 1.005, 1.005)`,
      transition: 'transform 0.15s ease-out, box-shadow 0.15s ease-out',
      boxShadow: '0 30px 70px rgba(0, 0, 0, 0.9), 0 0 40px rgba(0, 240, 255, 0.2)',
    })
  }

  const handleMouseLeave = () => {
    setStyle({
      transform: 'perspective(1500px) rotateY(-5deg) rotateX(2.5deg) scale(0.98)',
      transition: 'transform 0.5s ease, box-shadow 0.5s ease',
      boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 240, 255, 0.15)',
    })
  }

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={style}
      className="relative overflow-hidden bg-slate-950/70 backdrop-blur-xl border-2 border-cyan-400/50 rounded-2xl p-6 transition-all cyber-grid shadow-[0_20px_50px_rgba(0,0,0,0.8),_0_0_30px_rgba(0,240,255,0.15)]"
    >
      {/* Laser scanning beam overlay */}
      <div className="laser-line" />
      <div className="scanline-overlay" />
      
      {/* Corner Brackets */}
      <div className="absolute top-0 left-0 w-8 h-8 border-l-2 border-t-2 border-cyan-400 pointer-events-none" />
      <div className="absolute top-0 right-0 w-8 h-8 border-r-2 border-t-2 border-cyan-400 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-8 h-8 border-l-2 border-b-2 border-cyan-400 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-8 h-8 border-r-2 border-b-2 border-cyan-400 pointer-events-none" />
      
      {children}
    </div>
  )
}

// ── Circular SVG Gauge Component ─────────────────────────────────────────────
function RadialGauge({ value, label, color = "#00f0ff", max = 100 }) {
  const radius = 30
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / max) * circumference

  return (
    <div className="flex items-center gap-4 bg-cyan-950/20 border border-cyan-900/30 p-3 rounded-xl hover:border-cyan-400/40 transition-colors">
      <div className="relative w-16 h-16 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle 
            cx="32" cy="32" r={radius} 
            fill="none" stroke="rgba(0, 240, 255, 0.05)" strokeWidth="4" 
          />
          <circle 
            cx="32" cy="32" r={radius} 
            fill="none" stroke={color} strokeWidth="4.5" 
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
            style={{ filter: `drop-shadow(0 0 3px ${color})` }}
          />
        </svg>
        <span className="absolute text-[11px] font-mono font-bold text-white">{value}%</span>
      </div>
      <div className="font-mono">
        <div className="text-[9px] text-gray-500 uppercase tracking-widest">Sys Metric</div>
        <div className="text-xs font-bold text-cyan-300">{label}</div>
      </div>
    </div>
  )
}

// ── Interactive Spinning Holographic Globe ───────────────────────────────────
function HolographicGlobe() {
  return (
    <div className="relative w-64 h-64 mx-auto flex items-center justify-center">
      {/* Outer Orbit Rings */}
      <div className="absolute w-full h-full border border-cyan-500/10 rounded-full animate-[spin_30s_linear_infinite]" />
      <div className="absolute w-[92%] h-[92%] border border-dashed border-cyan-500/25 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
      <div className="absolute w-[84%] h-[84%] border border-cyan-500/5 rounded-full" />
      
      {/* Globe Wireframe Sphere */}
      <svg className="w-[80%] h-[80%] text-cyan-400/80 animate-[spin_50s_linear_infinite]" viewBox="0 0 100 100">
        <defs>
          <radialGradient id="globeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#00f0ff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="45" fill="url(#globeGlow)" stroke="rgba(0, 240, 255, 0.25)" strokeWidth="0.5" />
        
        {/* Latitudes */}
        <ellipse cx="50" cy="50" rx="45" ry="12" fill="none" stroke="rgba(0, 240, 255, 0.15)" strokeWidth="0.5" />
        <ellipse cx="50" cy="50" rx="45" ry="26" fill="none" stroke="rgba(0, 240, 255, 0.15)" strokeWidth="0.5" />
        <line x1="5" y1="50" x2="95" y2="50" stroke="rgba(0, 240, 255, 0.3)" strokeWidth="0.5" />
        
        {/* Longitudes */}
        <ellipse cx="50" cy="50" rx="12" ry="45" fill="none" stroke="rgba(0, 240, 255, 0.15)" strokeWidth="0.5" />
        <ellipse cx="50" cy="50" rx="26" ry="45" fill="none" stroke="rgba(0, 240, 255, 0.15)" strokeWidth="0.5" />
        <line x1="50" y1="5" x2="50" y2="95" stroke="rgba(0, 240, 255, 0.3)" strokeWidth="0.5" />

        {/* Threat vectors & hotspots */}
        <circle cx="25" cy="35" r="1.5" className="fill-red-500 animate-pulse" />
        <circle cx="75" cy="55" r="1.5" className="fill-green-400 animate-pulse" />
        <circle cx="50" cy="15" r="1.5" className="fill-cyan-400 animate-pulse" />
        <circle cx="32" cy="72" r="1.5" className="fill-yellow-500 animate-pulse" />
        
        <path d="M 25 35 Q 50 15 75 55" fill="none" stroke="rgba(0, 240, 255, 0.35)" strokeWidth="0.5" strokeDasharray="2,2" />
        <path d="M 32 72 Q 50 45 50 15" fill="none" stroke="rgba(239, 68, 68, 0.35)" strokeWidth="0.5" strokeDasharray="3,1" />
      </svg>
      
      {/* Radar scanning sweep */}
      <div className="absolute w-[80%] h-[80%] rounded-full border border-cyan-500/10 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 w-full h-full bg-gradient-to-tr from-cyan-400/10 to-transparent origin-top-left animate-[spin_4s_linear_infinite]" style={{ transform: 'translate(-100%, -100%)' }} />
      </div>
    </div>
  )
}

// ── World traffic map widget ─────────────────────────────────────────────────
function TrafficFlow() {
  return (
    <div className="p-4 bg-cyan-950/15 border border-cyan-900/35 rounded-xl h-36 font-mono text-[10px] text-gray-400 flex flex-col justify-between relative overflow-hidden">
      <div className="text-cyan-400 font-bold border-b border-cyan-950/50 pb-1 flex justify-between z-10">
        <span>[TRAFFIC_FLOW_MAP]</span>
        <span className="text-cyan-500">GLO_NET</span>
      </div>
      <div className="flex-1 flex items-center justify-center relative mt-2">
        <svg className="w-full h-full text-cyan-500/10" viewBox="0 0 200 100">
          {/* Dot clusters representing continents */}
          <circle cx="30" cy="30" r="1" className="fill-cyan-500/30" />
          <circle cx="45" cy="35" r="1.2" className="fill-cyan-500/30" />
          <circle cx="95" cy="25" r="1.5" className="fill-cyan-500/30" />
          <circle cx="115" cy="30" r="1.2" className="fill-cyan-500/30" />
          <circle cx="155" cy="40" r="1.5" className="fill-cyan-500/30" />
          <circle cx="145" cy="65" r="1" className="fill-cyan-500/30" />
          <circle cx="65" cy="70" r="1.2" className="fill-cyan-500/30" />
          
          <circle cx="40" cy="32" r="2.5" className="fill-red-500 animate-pulse" />
          <circle cx="110" cy="28" r="2.5" className="fill-red-500 animate-pulse" />
          <circle cx="150" cy="42" r="2.5" className="fill-green-400 animate-pulse" />
          
          <path d="M 40 32 Q 75 15 110 28" fill="none" stroke="rgba(239, 68, 68, 0.4)" strokeWidth="0.5" strokeDasharray="3,1" />
          <path d="M 110 28 Q 130 35 150 42" fill="none" stroke="rgba(0, 240, 255, 0.4)" strokeWidth="0.5" strokeDasharray="2,2" />
        </svg>
      </div>
    </div>
  )
}

// ── Forensic analytics alerts list widget ───────────────────────────────────
function ForensicAnalytics({ alerts }) {
  return (
    <div className="p-4 bg-cyan-950/15 border border-cyan-900/35 rounded-xl h-36 font-mono text-[10px] text-gray-400 flex flex-col justify-between">
      <div className="text-cyan-400 font-bold border-b border-cyan-950/50 pb-1 flex justify-between">
        <span>[FORENSIC_ANALYTICS]</span>
        <span className="text-red-500 animate-pulse">ALERT_ENGAGED</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-1.5 mt-2 custom-scrollbar pr-1 text-[9px]">
        {alerts.slice(0, 5).map((a, i) => (
          <div key={i} className="flex justify-between border-b border-cyan-950/20 pb-1 text-red-400/90 leading-tight">
            <span className="truncate max-w-[110px]">{a.rule_name}</span>
            <span className="text-gray-600">|</span>
            <span className="truncate max-w-[70px]">{a.src_ip}</span>
            <span className="text-gray-500 font-bold">{a.severity.toUpperCase()}</span>
          </div>
        ))}
        {alerts.length === 0 && (
          <div className="text-center py-6 text-cyan-600/50">NO THREAT DETECTED</div>
        )}
      </div>
    </div>
  )
}

// ── User access role nodes widget ────────────────────────────────────────────
function AccessMap() {
  return (
    <div className="p-4 bg-cyan-950/15 border border-cyan-900/35 rounded-xl h-36 font-mono text-[10px] text-gray-400 flex flex-col justify-between">
      <div className="text-cyan-400 font-bold border-b border-cyan-950/50 pb-1 flex justify-between">
        <span>[USER_ACCESS_MAP]</span>
        <span className="text-green-500">SECURE</span>
      </div>
      <div className="flex items-center justify-around flex-1 mt-2">
        <div className="flex flex-col items-center">
          <div className="w-7 h-7 rounded-full bg-cyan-950 border border-cyan-500 flex items-center justify-center text-cyan-400 font-bold shadow-[0_0_8px_rgba(6,182,212,0.4)]">A</div>
          <span className="mt-1 text-[9px] text-gray-500">ADMIN</span>
        </div>
        <div className="text-cyan-500 animate-pulse text-xs">➔</div>
        <div className="flex flex-col items-center">
          <div className="w-7 h-7 rounded-full bg-blue-950 border border-blue-500 flex items-center justify-center text-blue-400 font-bold shadow-[0_0_8px_rgba(59,130,246,0.4)]">I</div>
          <span className="mt-1 text-[9px] text-gray-500">INVEST</span>
        </div>
        <div className="text-cyan-500 animate-pulse text-xs">➔</div>
        <div className="flex flex-col items-center">
          <div className="w-7 h-7 rounded-full bg-slate-950 border border-gray-700 flex items-center justify-center text-gray-500 font-bold">V</div>
          <span className="mt-1 text-[9px] text-gray-500">VIEW</span>
        </div>
      </div>
    </div>
  )
}

const styleSheet = `
@keyframes scanline {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100%); }
}
.scanline-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(
    rgba(18, 16, 16, 0) 50%, 
    rgba(0, 240, 255, 0.05) 50%
  );
  background-size: 100% 4px;
  pointer-events: none;
  z-index: 5;
}
.laser-line {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, #00f0ff, transparent);
  box-shadow: 0 0 10px #00f0ff;
  animation: scanline 7s linear infinite;
  pointer-events: none;
  z-index: 6;
}
.cyber-grid {
  background-size: 20px 20px;
  background-image: 
    linear-gradient(to right, rgba(0, 240, 255, 0.02) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(0, 240, 255, 0.02) 1px, transparent 1px);
}
.terminal-glow {
  text-shadow: 0 0 6px rgba(0, 240, 255, 0.6);
}
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(0, 240, 255, 0.2);
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 240, 255, 0.5);
}
`;

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

  const fetchCustodyLogs = () => {
    axios.get(`${API}/api/custody`)
      .then(r => setCustodyLogs(r.data))
      .catch(err => console.error("[Custody] Load failed", err))
  }

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    axios.get(`${API}/api/sessions`).then(r => {
      setSessions(r.data)
      if (r.data.length > 0 && !selectedSessionId) {
        setSelectedSessionId(r.data[0].session_id)
      }
    })
    axios.get(`${API}/api/dashboard`).then(r => setStats(r.data)).catch(() => {})
    axios.get(`${API}/api/alerts`).then(r => setAlerts(r.data)).catch(() => {})
    fetchCustodyLogs()
  }, [])

  const handleUploadSubmit = async (pcapFile, keylogFile) => {
    if (!pcapFile) return
    setUploading(true)
    const form = new FormData()
    form.append('file', pcapFile)
    if (keylogFile) form.append('keylog_file', keylogFile)
    
    try {
      setShowUploadModal(false)
      const res = await axios.post(`${API}/api/pcap/upload`, form)
      const r = await axios.get(`${API}/api/sessions`)
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
      const res = await axios.get(`${API}/api/evidence/${sessionId}`, {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `evidence_${filename}.zip`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      fetchCustodyLogs()
    } catch (err) {
      console.error("[Download] Evidence download failed", err)
    }
  }

  // Derive metrics ratios for the radial gauges
  const threatRatio = Math.min(Math.round(((stats.alerts || 0) / Math.max(sessions.length * 10, 1)) * 100), 100)
  const networkRatio = 52 // simulated load
  const integrityRatio = Math.max(100 - Math.round(((stats.alerts || 0) / Math.max(sessions.length * 5, 1)) * 30), 10)

  return (
    <div className="space-y-6 pb-12">
      <style dangerouslySetInnerHTML={{ __html: styleSheet }} />

      {/* 3D Holographic Display Console Screen */}
      <HologramScreen>
        {/* Hologram Header Bar */}
        <div className="flex items-center justify-between border-b border-cyan-500/40 pb-3 mb-6 font-mono">
          <div className="flex items-center gap-3">
            <Server size={18} className="text-cyan-400" />
            <span className="text-xs font-bold text-cyan-400 tracking-wider uppercase">
              KANADSHIELD SECURITY DASHBOARD - FORENSIC CONSOLE V7.4
            </span>
          </div>
          <div className="flex items-center gap-5 text-gray-500 text-[10px]">
            <span className="text-green-400">SYSTEM STATUS: OPERATIONAL - ALERT!</span>
            <span>_ ▢ ✕</span>
          </div>
        </div>

        {/* HUD grid body */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* LEFT: Stacked radial Gauges */}
          <div className="flex flex-col justify-around gap-3 col-span-1">
            <RadialGauge value={threatRatio} label="Threat Level" color="#ef4444" />
            <RadialGauge value={networkRatio} label="Network Traffic" color="#3b82f6" />
            <RadialGauge value={stats.alerts || 77} label="Malware Activity" color="#eab308" max={200} />
            <RadialGauge value={integrityRatio} label="System Integrity" color="#10b981" />
          </div>

          {/* CENTER: spinning holographic globe map */}
          <div className="lg:col-span-2 flex flex-col items-center justify-center relative bg-cyan-950/5 border border-cyan-900/20 rounded-xl p-4 min-h-[300px]">
            <HolographicGlobe />
            <div className="absolute bottom-4 text-center font-mono text-[9px] text-cyan-500/70">
              GEOLOCATION: AGENT_NODE_AUDIT / CAPTURE_STREAM_GEO
            </div>
          </div>

          {/* RIGHT: scrollable diagnostic terminal output stream */}
          <div className="col-span-1 bg-black/40 border border-cyan-900/30 rounded-xl p-4 flex flex-col h-[320px] relative overflow-hidden">
            <div className="scanline-overlay" />
            <div className="laser-line" style={{ animationDuration: '4s', background: 'linear-gradient(90deg, transparent, #06b6d4, transparent)' }} />
            <div className="flex flex-col h-full z-10">
              <div className="text-[10px] font-bold text-cyan-400 border-b border-cyan-950 pb-2 mb-2 font-mono flex justify-between">
                <span>[PACKET_CAPTURE]</span>
                <span className="text-green-500 animate-pulse">FLOW</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 font-mono text-[9px] custom-scrollbar text-cyan-300/80 leading-normal">
                {sessions.map(s => (
                  <div key={s.session_id} className="border-b border-cyan-950/20 pb-0.5">
                    <div>FILE: {s.filename}</div>
                    <div className="text-gray-500">SIZE: {s.packet_count?.toLocaleString()} PKTS</div>
                    <div className="text-[8px] text-gray-600 font-bold">{s.sha256_hash?.slice(0, 20)}...</div>
                  </div>
                ))}
                {sessions.length === 0 && (
                  <div className="text-center py-24 text-cyan-600/40">NO INTERCEPT CAPTURES RUNNING</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM HUD panels */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 z-10 relative">
          <ForensicAnalytics alerts={alerts} />
          <AccessMap />
          <TrafficFlow />
        </div>
      </HologramScreen>

      {/* Control Actions & Sessions List */}
      <div className="flex items-center justify-between mt-8">
        <h2 className="text-xl font-bold font-mono text-cyan-400 flex items-center gap-2">
          <Database size={20} /> [EXCHANGE_DATA_REPOSITORY]
        </h2>
        <button 
          onClick={() => setShowUploadModal(true)}
          className="relative flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-mono font-semibold px-4 py-2 rounded-lg border border-cyan-400/30 transition-all cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.2)]"
        >
          <Upload size={16} />
          {uploading ? 'INGESTING...' : 'UPLOAD NEW PCAP'}
        </button>
      </div>

      {showUploadModal && (
        <UploadModal 
          onClose={() => setShowUploadModal(false)}
          onSubmit={handleUploadSubmit}
          uploading={uploading}
        />
      )}

      {/* Ingested sessions directory grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gray-950/40 border border-gray-900 rounded-xl overflow-hidden flex flex-col h-[380px]">
          <div className="px-5 py-4 border-b border-gray-900 font-mono font-bold text-sm text-cyan-400 bg-gray-900/20">
            [INDEXED_FORENSIC_SESSIONS]
          </div>
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-950 text-gray-400 font-mono text-xs border-b border-gray-900">
                <tr>
                  {['Filename', 'Packets', 'Threat Score', 'Status', 'Uploaded', 'SHA-256', 'Evidence'].map(h => (
                    <th key={h} className="px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-900/50">
                {sessions.map((s) => (
                  <tr 
                    key={s.session_id} 
                    onClick={() => setSelectedSessionId(s.session_id)}
                    className={`cursor-pointer transition-colors font-mono text-xs
                      ${selectedSessionId === s.session_id 
                        ? 'bg-cyan-500/10 text-cyan-200 border-l-2 border-cyan-400' 
                        : 'hover:bg-gray-850/40 text-gray-300'}`}
                  >
                    <td className="px-4 py-3 text-cyan-400/90 font-mono max-w-[150px] truncate" title={s.filename}>{s.filename}</td>
                    <td className="px-4 py-3 text-white font-bold">{s.packet_count?.toLocaleString()}</td>
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
                    <td className="px-4 py-3 text-gray-400 text-[10px]">{new Date(s.upload_time).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-[10px]">{s.sha256_hash?.slice(0, 10)}...</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => downloadEvidence(s.session_id, s.filename)}
                        className="bg-gray-900 hover:bg-gray-850 border border-gray-855 hover:border-cyan-500/50 hover:text-cyan-400 text-gray-400 p-1.5 rounded-lg transition-all cursor-pointer"
                        title="Download ZIP Evidence"
                      >
                        <Download size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sessions.length === 0 && (
              <div className="text-center py-20 text-gray-500 font-sans">No sessions yet. Upload a PCAP to begin.</div>
            )}
          </div>
        </div>

        {/* Live capture feed card */}
        <div className="bg-gray-950/40 border border-gray-900 rounded-xl overflow-hidden h-[380px]">
          <LiveFeed />
        </div>
      </div>

      {/* Recharts flow rates timeline */}
      <div className="bg-gray-950/40 border border-gray-900 rounded-xl p-5">
        <PacketTimeline sessionId={selectedSessionId} />
      </div>

      {/* Traffic analytics bar trackers */}
      {stats.top_talkers && stats.top_talkers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-950/40 border border-gray-900 rounded-xl">
            <TopTalkers data={stats.top_talkers} />
          </div>
          <div className="bg-gray-950/40 border border-gray-900 rounded-xl">
            <TopProtocols data={stats.top_protocols} />
          </div>
          <div className="bg-gray-950/40 border border-gray-900 rounded-xl">
            <TopPorts data={stats.top_ports} />
          </div>
        </div>
      )}

      {/* Segment detail selectors */}
      {selectedSessionId && (
        <div className="flex gap-4 border-b border-gray-850 pb-2 mt-8">
          <button
            onClick={() => setActiveTab('packets')}
            className={`flex items-center gap-2 pb-2 text-sm font-mono font-bold border-b-2 cursor-pointer transition-all ${
              activeTab === 'packets'
                ? 'border-cyan-500 text-cyan-400 shadow-[0_4px_10px_-4px_rgba(0,240,255,0.4)]'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Database size={16} /> [PARSED_PACKETS]
          </button>
          <button
            onClick={() => setActiveTab('dpi')}
            className={`flex items-center gap-2 pb-2 text-sm font-mono font-bold border-b-2 cursor-pointer transition-all ${
              activeTab === 'dpi'
                ? 'border-cyan-500 text-cyan-400 shadow-[0_4px_10px_-4px_rgba(0,240,255,0.4)]'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <BarChart3 size={16} /> [DEEP_INSPECTION_DPI]
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

// ── Live capture feed component ─────────────────────────────────────────────
function LiveFeed() {
  const [active, setActive] = useState(false)
  const [packets, setPackets] = useState([])

  useEffect(() => {
    let ws = null
    if (active) {
      const wsUrl = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.hostname + ':8000/ws/capture'
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
    <div className="relative flex flex-col justify-between h-full p-5 bg-black/40">
      <div className="scanline-overlay" />
      <div className="laser-line" style={{ animationDuration: '4s', background: 'linear-gradient(90deg, transparent, #06b6d4, transparent)' }} />
      
      <div className="flex flex-col h-full z-10">
        <div className="flex items-center justify-between border-b border-cyan-950 pb-3 mb-3">
          <span className="font-mono text-xs font-bold text-cyan-400 flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75 ${active ? 'animate-ping' : ''}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${active ? 'bg-cyan-500' : 'bg-gray-600'}`}></span>
            </span>
            [LIVE_TRAFFIC_TAP]
          </span>
          <button
            onClick={() => setActive(!active)}
            className={`font-mono text-[10px] font-bold px-3 py-1.5 rounded-lg border border-cyan-700/50 hover:bg-cyan-950/60 transition-colors text-cyan-400 cursor-pointer`}
          >
            {active ? 'HALT_TAP' : 'ENGAGE_TAP'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-[10px] custom-scrollbar text-cyan-300">
          {packets.map((p, idx) => (
            <div key={idx} className="flex justify-between border-b border-cyan-950/30 pb-1 leading-normal hover:bg-cyan-950/15 px-1 rounded transition-colors">
              <span className="text-cyan-400 font-bold truncate max-w-[100px]">{p.src_ip}</span>
              <span className="text-gray-600">➔</span>
              <span className="text-cyan-200 truncate max-w-[100px]">{p.dst_ip}</span>
              <span className="text-yellow-500 font-bold text-[9px] px-1 bg-yellow-950/20 border border-yellow-700/20 rounded">{p.protocol}</span>
              <span className="text-gray-400 text-[9px]">{p.packet_length}B</span>
            </div>
          ))}
          {packets.length === 0 && (
            <div className="text-center py-24 text-cyan-600/40 font-sans text-xs">
              {active ? 'SCANNING FOR RAW INTERCEPTS...' : 'CLICK ENGAGE TO COMMENCE PACKET SNIFFING'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Chain of custody audit log table component ──────────────────────────────
function CustodyLogs({ logs }) {
  return (
    <div className="bg-gray-950/40 border border-gray-900 rounded-xl mt-8">
      <div className="px-5 py-4 border-b border-gray-900 font-mono font-bold text-sm text-cyan-400 bg-gray-900/20">
        [CHAIN_OF_CUSTODY_AUDIT_LOG]
      </div>
      <div className="overflow-x-auto custom-scrollbar max-h-[300px]">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-950 text-gray-400 font-mono text-xs border-b border-gray-900">
            <tr>
              {['Timestamp', 'User', 'Action', 'Session ID', 'IP Address'].map(h => (
                <th key={h} className="px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-900/50">
            {logs.map((l) => (
              <tr key={l.log_id} className="border-t border-gray-900/30 hover:bg-gray-850/20 text-gray-300 font-mono text-xs">
                <td className="px-4 py-2.5 text-gray-400">{new Date(l.accessed_at).toLocaleString()}</td>
                <td className="px-4 py-2.5 text-cyan-400 font-bold">{l.username || 'System'}</td>
                <td className="px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize border
                    ${l.action === 'upload' 
                      ? 'bg-emerald-950/40 text-emerald-300 border-emerald-700/30' : 
                      l.action.startsWith('export') 
                        ? 'bg-purple-950/40 text-purple-300 border-purple-700/30' : 
                        'bg-blue-950/40 text-blue-300 border-blue-700/30'}`}>
                    {l.action.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-500 font-mono text-[10px]">{l.session_id || 'N/A'}</td>
                <td className="px-4 py-2.5 text-gray-400 font-mono">{l.ip_address}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-gray-500 font-sans">No audit log entries found.</td>
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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="relative overflow-hidden bg-gray-950 border border-cyan-500/30 rounded-2xl p-6 w-full max-w-lg space-y-5 shadow-[0_0_40px_rgba(0,240,255,0.15)] cyber-grid">
        <div className="absolute top-0 right-0 w-12 h-12 border-r-2 border-t-2 border-cyan-500/20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-12 h-12 border-l-2 border-b-2 border-cyan-500/20 pointer-events-none" />
        <div className="laser-line" style={{ animationDuration: '3s' }} />

        <div className="flex justify-between items-center border-b border-gray-800 pb-3">
          <h2 className="text-lg font-bold font-mono text-cyan-400 flex items-center gap-2">
            <Upload size={18} /> [INGEST_FORENSIC_STREAM]
          </h2>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-950 space-y-2">
            <label className="block text-xs font-bold font-mono text-cyan-300 uppercase">1. PCAP File (Required)</label>
            <p className="text-[10px] text-gray-500 font-mono">Format: .pcap, .pcapng. Packets will be parsed and indexed.</p>
            <input 
              type="file" 
              accept=".pcap,.pcapng" 
              onChange={e => setPcapFile(e.target.files[0])}
              className="block w-full text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-cyan-500/20 file:text-xs file:font-semibold file:bg-cyan-950/40 file:text-cyan-300 hover:file:bg-cyan-900/60 file:cursor-pointer cursor-pointer"
            />
          </div>

          <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-950 space-y-2">
            <label className="block text-xs font-bold font-mono text-cyan-300 uppercase flex items-center gap-2">
              2. TLS Keylog File (Optional) <span className="px-2 py-0.5 rounded text-[9px] bg-purple-950 text-purple-300 border border-purple-800/40 font-mono">HTTPS DECRYPT</span>
            </label>
            <p className="text-[10px] text-gray-500 font-mono">Upload the pre-master secrets keylog file to inspect encrypted HTTP request headers.</p>
            <input 
              type="file" 
              accept=".log,.txt" 
              onChange={e => setKeylogFile(e.target.files[0])}
              className="block w-full text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-gray-800 file:text-xs file:font-semibold file:bg-gray-900 file:text-gray-300 hover:file:bg-gray-800 file:cursor-pointer cursor-pointer"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-3">
          <button 
            onClick={() => onSubmit(pcapFile, keylogFile)}
            disabled={!pcapFile || uploading}
            className={`flex-1 py-3 rounded-lg text-xs font-bold font-mono transition-all border
              ${(!pcapFile || uploading) 
                ? 'bg-gray-900 text-gray-600 border-gray-800 cursor-not-allowed' 
                : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white border-cyan-400/30 hover:shadow-[0_0_15px_rgba(0,240,255,0.3)] cursor-pointer'}`}
          >
            {uploading ? 'PARSING_DATA...' : 'EXECUTE_ANALYSIS'}
          </button>
          <button 
            onClick={onClose}
            disabled={uploading}
            className="flex-1 bg-gray-900 hover:bg-gray-800 text-white border border-gray-800 py-3 rounded-lg text-xs font-bold font-mono transition-colors cursor-pointer"
          >
            ABORT
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Traffic breakdown panels ────────────────────────────────────────────────
function TopTalkers({ data }) {
  if (!data || data.length === 0) return null
  const max = data[0]?.bytes || 1

  return (
    <div className="p-5 flex flex-col justify-between h-full bg-gray-900/10">
      <div className="font-mono font-bold text-sm text-blue-400 border-b border-gray-800 pb-3 mb-4">[TOP_TRAFFIC_TALKERS]</div>
      <div className="space-y-3">
        {data.map((t, i) => (
          <div key={t.ip}>
            <div className="flex justify-between text-xs mb-1 font-mono">
              <span className="text-blue-300 font-bold">{t.ip}</span>
              <span className="text-gray-400">{(t.bytes / 1024).toFixed(1)} KB</span>
            </div>
            <div className="h-2 bg-gray-950 rounded-full overflow-hidden border border-gray-850">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${i === 0 ? 'from-red-600 to-orange-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'from-blue-600 to-cyan-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]'}`}
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
    <div className="p-5 flex flex-col justify-between h-full bg-gray-900/10">
      <div className="font-mono font-bold text-sm text-green-400 border-b border-gray-800 pb-3 mb-4">[PROTOCOL_DISTRIBUTION]</div>
      <div className="space-y-3">
        {data.map((p, i) => (
          <div key={p.protocol}>
            <div className="flex justify-between text-xs mb-1 font-mono">
              <span className="text-green-300 font-bold">{p.protocol}</span>
              <span className="text-gray-400">{p.count} packets</span>
            </div>
            <div className="h-2 bg-gray-950 rounded-full overflow-hidden border border-gray-850">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${i === 0 ? 'from-amber-500 to-yellow-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'from-green-600 to-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`}
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
    <div className="p-5 flex flex-col justify-between h-full bg-gray-900/10">
      <div className="font-mono font-bold text-sm text-purple-400 border-b border-gray-800 pb-3 mb-4">[TOP_DESTINATION_PORTS]</div>
      <div className="space-y-3">
        {data.map((p, i) => (
          <div key={p.port}>
            <div className="flex justify-between text-xs mb-1 font-mono">
              <span className="text-purple-300 font-bold font-mono">Port {p.port}</span>
              <span className="text-gray-400">{p.count} packets</span>
            </div>
            <div className="h-2 bg-gray-950 rounded-full overflow-hidden border border-gray-850">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${i === 0 ? 'from-fuchsia-600 to-purple-500 shadow-[0_0_8px_rgba(217,70,239,0.5)]' : 'from-indigo-600 to-violet-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]'}`}
                style={{ width: `${(p.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
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
                  'bg-green-950/40 text-green-400 border-green-700/40'
  return (
    <span className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold leading-none ${color}`}>
      {score}/100
    </span>
  )
}
