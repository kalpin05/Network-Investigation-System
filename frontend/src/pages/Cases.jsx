import { useEffect, useState, useCallback } from 'react'
import { FolderOpen, AlertTriangle, ExternalLink, Download, Shield, Globe, Terminal, ShieldAlert, AlertCircle, Sliders, Network } from 'lucide-react'
import axios from 'axios'
import { api } from '../api/client'
import StreamModal from '../components/StreamModal'
import { AttackChain } from '../components/AttackChain'

const API = window.location.protocol + '//' + window.location.hostname + ':8000'

const styleSheet = `
.scanlines {
    background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.1));
    background-size: 100% 4px;
    pointer-events: none;
    z-index: 50;
}
.crt-flicker {
    animation: flicker 0.15s infinite;
}
@keyframes flicker {
    0% { opacity: 0.98; }
    50% { opacity: 1; }
    100% { opacity: 0.98; }
}
.blinking-cursor::after {
    content: "_";
    animation: blink 1s step-end infinite;
}
@keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
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
}
.terminal-window::before { top: -1px; left: -1px; border-right: none; border-bottom: none; }
.terminal-window::after { bottom: -1px; right: -1px; border-left: none; border-top: none; }

.glow-active {
    box-shadow: 0 0 8px rgba(0, 255, 65, 0.6);
    text-shadow: 0 0 4px rgba(0, 255, 65, 0.8);
}

.custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
.custom-scrollbar::-webkit-scrollbar-track { background: #0c160a; border-left: 1px solid #3b4b37; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #00ff41; }
`

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

  const loadCases = useCallback(() => axios.get(`${API}/api/cases`).then(r => setCases(r.data)).catch(err => console.error(err)), [])

  useEffect(() => {
    loadCases()
    axios.get(`${API}/api/alerts?limit=50`).then(r => setAlerts(r.data)).catch(err => console.error(err))
  }, [loadCases])

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
      setPdfMsg('❌ Export failed.')
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
    <div className="space-y-6 text-[#ebffe2] font-mono select-none relative pb-12">
      <style dangerouslySetInnerHTML={{ __html: styleSheet }} />
      <div className="scanlines fixed inset-0 pointer-events-none" />

      {/* Header Info Banner */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 gap-4 border-b border-[#3b4b37] pb-4">
        <div>
          <h1 className="text-xl font-bold text-[#00ff41] uppercase tracking-widest blinking-cursor">
            &gt; FORENSIC CASES // MITRE ATT&amp;CK ANALYSIS v3.2
          </h1>
          <p className="text-[10px] text-[#84967e] mt-1">
            &gt; SYSTEM.MONITOR_ACTIVE(TRUE)
          </p>
        </div>
        <div>
          <button 
            onClick={() => setShowCreate(true)}
            className="border border-[#00ff41] hover:bg-[#00ff41]/10 text-[#00ff41] py-1.5 px-4 text-xs font-bold uppercase tracking-wider cursor-pointer rounded-sm"
          >
            [ + NEW_INVESTIGATION ]
          </button>
        </div>
      </header>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-12 gap-4">
        
        {/* Left Column: Active Cases list (3 cols) */}
        <div className="col-span-12 md:col-span-3 flex flex-col gap-4">
          <div className="terminal-window p-4 h-[584px] overflow-y-auto custom-scrollbar">
            <div className="border-b border-[#3b4b37] pb-2 mb-4 flex justify-between items-center text-xs font-bold text-[#00ff41]">
              <span className="uppercase tracking-wider">ACTIVE_CASES</span>
              <Sliders size={12} />
            </div>
            
            <div className="space-y-3">
              {cases.length === 0 && (
                <div className="text-center py-12 text-[#84967e] text-xs">
                  NO ACTIVE CASES REGISTERED. INITIALIZE NEW INVESTIGATION.
                </div>
              )}
              {cases.map(c => {
                const isActive = selected === c.case_id
                return (
                  <button
                    key={c.case_id}
                    onClick={() => openCase(c.case_id)}
                    className={`w-full text-left p-2.5 border transition-all cursor-pointer relative rounded-sm
                      ${isActive
                        ? 'border-[#00ff41] bg-[#00ff41]/5 shadow-[0_0_8px_rgba(0,255,65,0.15)]'
                        : 'border-[#3b4b37] hover:border-[#84967e] bg-transparent'
                      }`}
                  >
                    {isActive && (
                      <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-0 h-0 border-t-4 border-t-transparent border-l-4 border-l-[#00ff41] border-b-4 border-b-transparent"></div>
                    )}
                    <div className={`text-xs font-bold truncate ${isActive ? 'text-[#00ff41]' : 'text-[#a4cc9c]'}`}>
                      {c.title}
                    </div>
                    <div className="flex justify-between items-center mt-1.5 text-[9px] font-mono text-[#84967e]">
                      <span>INIT: {new Date(c.created_at).toLocaleDateString()}</span>
                      <span className={`border px-1 uppercase leading-none font-bold
                        ${c.status === 'closed' ? 'text-green-500 border-green-500/50 bg-green-950/10' :
                          c.status === 'investigating' ? 'text-red-500 border-red-500/50 bg-red-950/10 animate-pulse' :
                          'text-yellow-500 border-yellow-500/50 bg-yellow-950/10'}`}>
                        {c.status}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Details & Work Area (9 cols) */}
        <div className="col-span-12 md:col-span-9 flex flex-col gap-4">
          
          {caseDetail ? (
            <>
              {/* MITRE ATT&CK Visualization */}
              <div className="terminal-window p-4 shrink-0">
                <div className="border-b border-[#3b4b37] pb-2 mb-4 flex justify-between items-center text-xs">
                  <span className="font-bold text-[#00ff41] uppercase tracking-wider">KILL_CHAIN_ANALYSIS // MITRE</span>
                  <span className="text-yellow-500 text-xs">TARGET: {caseDetail.title}</span>
                </div>
                <div className="flex justify-between items-center relative py-4">
                  {/* Connecting Line */}
                  <div className="absolute top-1/2 left-0 w-full h-[1px] bg-[#3b4b37] -z-10 -translate-y-1/2"></div>
                  {/* Stages */}
                  <div className="flex flex-col items-center gap-2 bg-[#0c160a] px-2 text-[10px]">
                    <div className="w-8 h-8 rounded-full border border-[#00ff41] flex items-center justify-center bg-[#141414]">
                      <Globe size={14} className="text-[#00ff41]" />
                    </div>
                    <span className="text-[#84967e]">RECON</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 bg-[#0c160a] px-2 text-[10px]">
                    <div className="w-8 h-8 rounded-full border border-[#00ff41] flex items-center justify-center bg-[#141414]">
                      <Terminal size={14} className="text-[#00ff41]" />
                    </div>
                    <span className="text-[#84967e]">WEAPONIZE</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 bg-[#0c160a] px-2 relative text-[10px]">
                    {/* Threat Detected Marker if alerts present */}
                    {caseDetail.alerts?.length > 0 && (
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-red-500 text-[10px] animate-bounce">⚠️</div>
                    )}
                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center bg-[#141414]
                      ${caseDetail.alerts?.length > 0 ? 'border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'border-[#3b4b37]'}`}>
                      <AlertTriangle size={14} className={caseDetail.alerts?.length > 0 ? 'text-red-500' : 'text-[#84967e]'} />
                    </div>
                    <span className={caseDetail.alerts?.length > 0 ? 'text-red-500 font-bold' : 'text-[#84967e]'}>DELIVERY</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 bg-[#0c160a] px-2 text-[10px]">
                    <div className="w-8 h-8 rounded-full border border-[#3b4b37] flex items-center justify-center bg-[#141414]">
                      <AlertCircle size={14} className="text-[#84967e]" />
                    </div>
                    <span className="text-[#84967e]">EXPLOIT</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 bg-[#0c160a] px-2 text-[10px]">
                    <div className="w-8 h-8 rounded-full border border-[#3b4b37] flex items-center justify-center bg-[#141414]">
                      <Download size={14} className="text-[#84967e]" />
                    </div>
                    <span className="text-[#84967e]">INSTALL</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 bg-[#0c160a] px-2 text-[10px]">
                    <div className="w-8 h-8 rounded-full border border-[#3b4b37] flex items-center justify-center bg-[#141414]">
                      <Network size={14} className="text-[#84967e]" />
                    </div>
                    <span className="text-[#84967e]">C2</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 bg-[#0c160a] px-2 text-[10px]">
                    <div className="w-8 h-8 rounded-full border border-[#3b4b37] flex items-center justify-center bg-[#141414]">
                      <ShieldAlert size={14} className="text-[#84967e]" />
                    </div>
                    <span className="text-[#84967e]">ACTIONS</span>
                  </div>
                </div>
              </div>

              {/* Case Details, Status controls, and Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
                
                {/* Evidence Chain */}
                <div className="terminal-window p-4 flex flex-col justify-between">
                  <div>
                    <div className="border-b border-[#3b4b37] pb-2 mb-2 flex justify-between items-center">
                      <span className="text-xs font-bold text-[#00ff41] uppercase tracking-wider">EVIDENCE_CHAIN</span>
                      <span className="text-[10px] text-gray-500">ALERTS: {caseDetail.alerts?.length || 0}</span>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar text-xs text-[#84967e]">
                      {caseDetail.alerts?.map(a => (
                        <div key={a.alert_id} className="flex gap-2">
                          <span className="text-[#00ff41] font-bold">[*]</span>
                          <div>
                            <span className="text-white font-bold">{a.rule_name}</span> - <span>{a.src_ip} → {a.dst_ip}</span>
                          </div>
                        </div>
                      ))}
                      {(!caseDetail.alerts || caseDetail.alerts.length === 0) && (
                        <div className="text-center py-6 text-[#84967e]">NO DETECTED ALARMS LINKED TO CASE.</div>
                      )}
                    </div>
                  </div>

                  {/* Status Toggle buttons */}
                  <div className="flex gap-2 border-t border-[#3b4b37]/30 pt-3 mt-3">
                    {['open', 'investigating', 'closed'].map(s => (
                      <button
                        key={s}
                        onClick={() => updateStatus(caseDetail.case_id, s)}
                        className={`flex-1 border py-1 font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer rounded-sm
                          ${caseDetail.status === s
                            ? 'border-[#00ff41] text-black bg-[#00ff41]'
                            : 'border-[#3b4b37] text-[#84967e] bg-transparent hover:bg-[#00ff41]/5'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Case Notes Editor */}
                <div className="terminal-window p-4 flex flex-col h-[230px]">
                  <div className="border-b border-[#3b4b37] pb-2 mb-2">
                    <span className="text-xs font-bold text-[#00ff41] uppercase tracking-wider">CASE_NOTES</span>
                  </div>
                  <NotesEditor
                    key={caseDetail.case_id}
                    initial={caseDetail.notes}
                    onSave={notes => updateNotes(caseDetail.case_id, notes)}
                  />
                </div>

              </div>

              {/* MITRE ATT&CK Chain Reconstruction */}
              <div className="terminal-window p-4 shrink-0">
                <AttackChain caseId={caseDetail.case_id} />
              </div>

              {/* Elasticsearch Raw Dump (Packet Search) */}
              <PacketSearch />

              {/* Evidence Chain of Custody Log */}
              <div className="terminal-window p-4 space-y-3">
                <div className="border-b border-[#3b4b37] pb-2 text-xs font-bold text-[#00ff41] flex items-center gap-2">
                  <Shield size={14} className="text-[#00ff41]" />
                  EVIDENCE_CHAIN_OF_CUSTODY_LOG
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar text-xs">
                  {custodyLogs.map((entry, i) => (
                    <div key={entry.log_id || i} className="flex justify-between items-center p-2 bg-[#071106] border border-[#3b4b37]/30 text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="text-[#00ff41] font-bold font-mono">[{entry.action.toUpperCase()}]</span>
                        <span className="text-[#dae6d2] font-bold">{entry.username || 'System Seed'}</span>
                        <span className="text-[#84967e]">({entry.ip_address})</span>
                      </div>
                      <span className="text-gray-500 font-mono text-[10px]">{new Date(entry.accessed_at).toLocaleString()}</span>
                    </div>
                  ))}
                  {custodyLogs.length === 0 && (
                    <p className="text-[#84967e] text-xs py-2 text-center">No custody events logged yet for linked case evidence.</p>
                  )}
                </div>
              </div>

              {/* PDF Actions Footer */}
              <footer className="bg-[#071106] border border-[#3b4b37] py-2.5 px-4 flex justify-between items-center text-xs shrink-0 rounded-sm">
                <div className="flex items-center gap-4">
                  {/* Language Selector */}
                  <span className="text-[#84967e] text-[10px] uppercase font-bold">Language:</span>
                  <select
                    value={exportLang}
                    onChange={(e) => setExportLang(e.target.value)}
                    className="bg-[#141414] border border-[#3b4b37] text-white px-2 py-0.5 text-xs font-mono focus:outline-none w-28 cursor-pointer rounded-sm"
                  >
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="gu">Gujarati</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                    <option value="zh">中文</option>
                    <option value="ja">日本語</option>
                  </select>
                </div>

                <div className="flex gap-4 uppercase font-bold text-[10px]">
                  <button 
                    onClick={() => handleExportPDF(caseDetail.case_id)}
                    disabled={pdfLoading}
                    className="hover:text-yellow-500 underline transition-all cursor-pointer text-[#00ff41] bg-transparent"
                  >
                    {pdfLoading ? 'GENERATING...' : 'GENERATE_PDF'}
                  </button>
                  <button 
                    onClick={() => handleExportEvidence(caseDetail.alerts?.[0]?.session_id)}
                    className="hover:text-yellow-500 underline transition-all cursor-pointer text-[#00ff41] bg-transparent"
                  >
                    EXPORT_ZIP
                  </button>
                  {pdfMsg && <span className="text-yellow-500 animate-pulse">{pdfMsg}</span>}
                </div>
              </footer>
            </>
          ) : (
            <div className="terminal-window bg-[#071106] flex items-center justify-center h-[584px] text-center p-6 text-gray-500 text-xs">
              <div>
                <FolderOpen size={40} className="mx-auto mb-3 opacity-30 animate-pulse text-[#00ff41]" />
                AWAITING CASE FILE INDEX SELECTION...<br/>
                SELECT A ACTIVE CASE FILE FROM THE LEFT DIRECTORY TREE TO COMMENCE FORENSIC INVESTIGATIONS
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Create Case Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="relative overflow-hidden bg-gray-950 border border-[#00ff41]/30 rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-[0_0_40px_rgba(0,255,65,0.15)]">
            <div className="absolute top-0 right-0 w-12 h-12 border-r-2 border-t-2 border-[#00ff41]/20 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-12 h-12 border-l-2 border-b-2 border-[#00ff41]/20 pointer-events-none" />
            
            <div className="flex justify-between items-center border-b border-[#3b4b37] pb-3">
              <h2 className="text-md font-bold text-[#00ff41] uppercase tracking-wider">
                &gt; INITIALIZE_NEW_INVESTIGATION
              </h2>
            </div>

            <div className="space-y-4">
              <div className="bg-[#071106] p-4 rounded border border-[#3b4b37] space-y-2">
                <label className="block text-xs font-bold text-[#00ff41] uppercase">Case Title *</label>
                <input
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. SUSPECTED DNS EXFILTRATION"
                  className="w-full bg-[#141414] border border-[#3b4b37] px-3 py-2 text-[#ebffe2] text-xs font-mono focus:outline-none focus:border-[#00ff41]"
                />
              </div>

              <div className="bg-[#071106] p-4 rounded border border-[#3b4b37] space-y-2">
                <label className="block text-xs font-bold text-[#00ff41] uppercase">Initial Notes</label>
                <textarea
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  rows={3}
                  placeholder="Describe the incident timeline..."
                  className="w-full bg-[#141414] border border-[#3b4b37] px-3 py-2 text-[#ebffe2] text-xs font-mono focus:outline-none focus:border-[#00ff41] resize-none"
                />
              </div>

              {alerts.length > 0 && (
                <div className="bg-[#071106] p-4 rounded border border-[#3b4b37] space-y-2">
                  <label className="block text-xs font-bold text-[#00ff41] uppercase">
                    Link Detected Alarms ({selectedAlerts.length} selected)
                  </label>
                  <div className="max-h-32 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                    {alerts.map(a => (
                      <label key={a.alert_id} className="flex items-center gap-2 p-2 rounded hover:bg-[#00ff41]/5 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={selectedAlerts.includes(a.alert_id)}
                          onChange={e => {
                            if (e.target.checked) setSelectedAlerts(p => [...p, a.alert_id])
                            else setSelectedAlerts(p => p.filter(id => id !== a.alert_id))
                          }}
                          className="accent-[#00ff41]"
                        />
                        <span className="font-mono text-red-500 font-bold">{a.rule_name}</span>
                        <span className="text-[#84967e] font-mono text-[10px] truncate">({a.src_ip} → {a.dst_ip})</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={createCase} 
                className="flex-1 border border-[#00ff41] text-[#00ff41] bg-transparent hover:bg-[#00ff41]/10 py-2.5 rounded text-xs font-bold uppercase cursor-pointer"
              >
                CREATE_CASE
              </button>
              <button 
                onClick={() => setShowCreate(false)} 
                className="flex-1 bg-transparent border border-red-500/40 text-red-500 hover:bg-red-500/10 py-2.5 rounded text-xs font-bold uppercase cursor-pointer"
              >
                ABORT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Notes editor with auto-save (Terminal Style) ──────────────────────────────
function NotesEditor({ initial, onSave }) {
  const [notes, setNotes] = useState(initial || '')
  const [saved, setSaved] = useState(true)

  const handleSave = () => {
    onSave(notes)
    setSaved(true)
  }

  return (
    <div className="flex-grow flex flex-col h-full justify-between">
      <textarea
        value={notes}
        onChange={e => { setNotes(e.target.value); setSaved(false) }}
        rows={3}
        placeholder="ENTER INVESTIGATION NOTES HERE..."
        className="w-full bg-[#071106] border border-[#3b4b37] px-3 py-2 text-[#ebffe2] text-xs font-mono
          focus:outline-none focus:border-[#00ff41] resize-none h-24 custom-scrollbar"
      />
      <div className="flex justify-between items-center mt-2 text-[10px]">
        <span className={saved ? 'text-[#84967e]' : 'text-yellow-500 animate-pulse font-bold'}>
          {saved ? 'SYS: FINDINGS FLUSHED TO DATABASE' : 'SYS: NOTES MODIFIED, AWAITING FLUSH'}
        </span>
        <button
          onClick={handleSave}
          disabled={saved}
          className={`border px-3 py-1 font-bold text-xs uppercase cursor-pointer transition-all rounded-sm
            ${saved 
              ? 'border-[#3b4b37] text-gray-500 cursor-not-allowed' 
              : 'border-[#00ff41] text-[#00ff41] hover:bg-[#00ff41]/10'}`}
        >
          {saved ? 'FLUSHED' : 'FLUSH'}
        </button>
      </div>
    </div>
  )
}

// ── Packet search component (Elasticsearch Raw Dump Style) ──────────────────────────────────────────────────
function PacketSearch() {
  const [params, setParams] = useState({ src_ip: '', dst_ip: '', protocol: '', limit: 100 })
  const [results, setResults] = useState({ packets: [], total: 0 })
  const [loading, setLoading] = useState(false)
  const [streamModalOpen, setStreamModalOpen] = useState(false)
  const [selectedPacket, setSelectedPacket] = useState(null)
  const [cliQuery, setCliQuery] = useState('index=netflow status=blocked')

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
    <div className="terminal-window p-4 flex flex-col overflow-hidden">
      <div className="flex flex-wrap justify-between items-center border-b border-[#3b4b37] pb-2 mb-3 shrink-0 gap-2">
        <span className="text-xs font-bold text-[#00ff41] uppercase tracking-wider">ELASTICSEARCH_RAW_DUMP</span>
        
        {/* Quick Search CLI bar */}
        <div className="flex items-center gap-2 flex-grow max-w-lg">
          <span className="text-[#00ff41] text-xs font-bold">&gt;</span>
          <input 
            value={cliQuery}
            onChange={e => setCliQuery(e.target.value)}
            placeholder="index=netflow status=blocked dst_port=443"
            className="bg-[#0c160a] border border-[#3b4b37] text-[#00ff41] text-xs font-mono px-2 py-1 w-full focus:outline-none focus:border-[#00ff41]" 
            type="text"
          />
        </div>
      </div>

      {/* Actual Search Filter Fields */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3 shrink-0">
        {[{ key: 'src_ip', label: 'SRC_IP' }, { key: 'dst_ip', label: 'DST_IP' }, { key: 'protocol', label: 'PROTOCOL' }].map(({ key, label }) => (
          <div key={key} className="flex items-center gap-1.5 border border-[#3b4b37] bg-[#141414] px-2 py-0.5 text-xs rounded-sm">
            <span className="text-[#84967e] text-[10px] font-bold font-mono">{label}:</span>
            <input
              value={params[key]}
              onChange={e => setParams(p => ({ ...p, [key]: e.target.value }))}
              placeholder="Filter..."
              className="bg-transparent border-none text-[#ebffe2] text-xs focus:ring-0 focus:outline-none w-full font-mono"
              onKeyDown={e => e.key === 'Enter' && search()}
            />
          </div>
        ))}
        <button
          onClick={search}
          className="border border-[#00ff41] hover:bg-[#00ff41]/10 text-[#00ff41] py-1 text-xs uppercase font-bold cursor-pointer transition-all rounded-sm"
        >
          {loading ? 'RUNNING_QUERY...' : 'EXECUTE_QUERY'}
        </button>
      </div>

      {/* Search results list */}
      <div className="overflow-auto custom-scrollbar max-h-[220px] min-h-[150px]">
        {results.packets.length > 0 ? (
          <table className="w-full text-left text-xs font-mono">
            <thead className="text-[#84967e] sticky top-0 bg-[#0c160a] border-b border-[#3b4b37]/50 uppercase">
              <tr>
                <th className="py-2 px-2">TIMESTAMP</th>
                <th className="py-2 px-2">SRC_IP</th>
                <th className="py-2 px-2">DST_IP</th>
                <th className="py-2 px-2">PROTOCOL</th>
                <th className="py-2 px-2">LEN</th>
                <th className="py-2 px-2 text-center">STREAM</th>
              </tr>
            </thead>
            <tbody className="text-[#00ff41] divide-y divide-[#3b4b37]/20">
              {results.packets.map((p, i) => (
                <tr key={i} className="hover:bg-[#00ff41]/10 transition-colors group">
                  <td className="py-1 px-2 text-gray-500">
                    {p.timestamp ? new Date(p.timestamp).toLocaleTimeString() : '-'}
                  </td>
                  <td className="py-1 px-2">{p.src_ip}</td>
                  <td className="py-1 px-2 text-red-500">{p.dst_ip}</td>
                  <td className="py-1 px-2">{p.protocol}</td>
                  <td className="py-1 px-2 text-gray-400">{p.packet_length}B</td>
                  <td className="py-1 px-2 text-center">
                    {(p.protocol === 'TCP' || p.flags || ['HTTP', 'TLS', 'SSL', 'SSH'].includes(p.protocol)) && p.src_port > 0 && p.dst_port > 0 ? (
                      <button 
                        onClick={() => openStream(p)} 
                        className="text-[#00ff41] hover:text-[#00ff41]/80 cursor-pointer bg-transparent"
                      >
                        <ExternalLink size={12} />
                      </button>
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-12 text-[#84967e] text-xs">
            {loading ? 'EXECUTING SEARCH QUERY AGAINST ELASTICSEARCH KERNEL...' : 'AWAITING SEARCH TERM INPUT OR RAW CLI INJECTION...'}
          </div>
        )}
      </div>

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
