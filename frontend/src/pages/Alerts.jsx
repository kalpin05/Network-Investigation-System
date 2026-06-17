import { useEffect, useState } from 'react'
import { AlertCircle, AlertTriangle, RefreshCw, ShieldAlert, Terminal, Sliders, Globe } from 'lucide-react'
import { api } from '../api/client'
import { API_BASE_URL as API } from '../config'

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

.pulse-red {
    animation: pulse-red 2s infinite;
}
@keyframes pulse-red {
    0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
    70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
    100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
}

.custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
.custom-scrollbar::-webkit-scrollbar-track { background: #0c160a; border-left: 1px solid #3b4b37; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #00ff41; }
`

export default function Alerts() {
  const [alerts, setAlerts] = useState([])
  const [filter, setFilter] = useState('all') // severity filter
  const [typeFilter, setTypeFilter] = useState('all') // category filter
  const [timeFilter, setTimeFilter] = useState('all') // time filter
  const [loading, setLoading] = useState(false)
  const [selectedAlert, setSelectedAlert] = useState(null)
  const [activeTab, setActiveTab] = useState('linux')
  const [copied, setCopied] = useState(false)
  const [containmentSuccess, setContainmentSuccess] = useState(false)

  const [syncTrigger, setSyncTrigger] = useState(0)

  useEffect(() => {
    let active = true
    const load = async () => {
      Promise.resolve().then(() => {
        if (active) setLoading(true)
      })
      const params = filter !== 'all' ? { severity: filter } : {}
      try {
        const r = await api.get(`${API}/api/alerts`, { params })
        if (active) {
          const list = Array.isArray(r.data) ? r.data : []
          setAlerts(list)
          if (list.length > 0) {
            setSelectedAlert(list[0])
          }
        }
      } catch (e) {
        console.error(e)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [filter, syncTrigger])

  // Client-side filtering logic to make category and time filters fully interactive
  const filteredAlerts = alerts.filter(a => {
    if (typeFilter !== 'all') {
      const name = a.rule_name.toLowerCase()
      if (typeFilter === 'malware') {
        if (!name.includes('tunnel') && !name.includes('port') && !name.includes('malware') && !name.includes('covert')) return false
      }
      if (typeFilter === 'phishing') {
        if (!name.includes('phish')) return false
      }
      if (typeFilter === 'ddos') {
        if (!name.includes('flood') && !name.includes('scan')) return false
      }
    }

    if (timeFilter !== 'all') {
      const firedTime = new Date(a.fired_at || a.upload_time)
      const diffMs = new Date() - firedTime
      if (timeFilter === '1h' && diffMs > 60 * 60 * 1000) return false
      if (timeFilter === '24h' && diffMs > 24 * 60 * 60 * 1000) return false
      if (timeFilter === '7d' && diffMs > 7 * 24 * 60 * 60 * 1000) return false
    }

    return true
  })

  // Playbook script generators based on currently selected alert IP
  const ip = selectedAlert?.src_ip || '127.0.0.1'
  const linuxScript = `#!/bin/bash
# Isolate host
sudo iptables -A INPUT -s ${ip} -j DROP
sudo iptables -A OUTPUT -d ${ip} -j DROP
# Kill active beacon processes
sudo kill -9 $(sudo lsof -t -i:443 -sTCP:ESTABLISHED)
echo "Containment complete."`

  const winScript = `# Isolate via Windows Firewall
New-NetFirewallRule -DisplayName "Block Outbound ${ip}" -Direction Outbound -Action Block -RemoteAddress ${ip}
New-NetFirewallRule -DisplayName "Block Inbound ${ip}" -Direction Inbound -Action Block -RemoteAddress ${ip}
# Terminate Malicious Process Beaconing to IP (Query & stop active socket owner)
Get-NetTCPConnection -RemoteAddress ${ip} | Select-Object -ExpandProperty OwningProcess | Stop-Process -Force
Write-Host "Containment complete."`

  const handleCopyScript = (scriptText) => {
    navigator.clipboard.writeText(scriptText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleContainClick = () => {
    const script = activeTab === 'linux' ? linuxScript : winScript
    navigator.clipboard.writeText(script)
    setContainmentSuccess(true)
    setTimeout(() => setContainmentSuccess(false), 3000)
  }

  return (
    <div className="space-y-6 text-[#ebffe2] font-mono select-none relative pb-12">
      <style dangerouslySetInnerHTML={{ __html: styleSheet }} />
      <div className="scanlines fixed inset-0 pointer-events-none" />

      {/* Header Info Banner */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4 border-b border-[#3b4b37] pb-4">
        <div>
          <h1 className="text-xl font-bold text-[#00ff41] uppercase tracking-widest blinking-cursor">
            &gt; ALERTS PANEL // THREAT DETECTION v1.8
          </h1>
          <p className="text-[10px] text-[#84967e] mt-2">
            MONITORING ACTIVE DATASTREAMS FOR ANOMALOUS INTERCEPTS
          </p>
        </div>
        <div className="bg-red-950/20 border border-red-500 px-4 py-2 flex items-center gap-3">
          <AlertCircle className="text-red-500 animate-pulse" size={16} />
          <span className="text-xs font-bold text-red-500 uppercase">
            ACTIVE_THREATS: {alerts.length}
          </span>
        </div>
      </header>

      {/* Main Grid: Stitch Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        
        {/* Left Column: Filter and Alert log (8 cols) */}
        <div className="xl:col-span-8 flex flex-col gap-4">
          
          {/* Filters Panel */}
          <div className="terminal-window bg-[#071106] p-4 flex flex-wrap gap-4 items-center">
            <span className="text-xs font-bold text-[#00ff41] uppercase tracking-wider">
              &gt;&gt; FILTERS:
            </span>
            
            {/* Category Filter */}
            <div className="flex items-center gap-1.5 border border-[#3b4b37] bg-[#141414] px-2 py-0.5 text-xs rounded-sm">
              <Sliders size={12} className="text-[#84967e]" />
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="bg-transparent border-none text-[#ebffe2] text-[11px] focus:ring-0 w-28 cursor-pointer focus:outline-none"
              >
                <option value="all">ALL_TYPES</option>
                <option value="malware">MALWARE</option>
                <option value="phishing">PHISHING</option>
                <option value="ddos">DDOS/SCANS</option>
              </select>
            </div>

            {/* Severity Filter */}
            <div className="flex items-center gap-1.5 border border-[#3b4b37] bg-[#141414] px-2 py-0.5 text-xs rounded-sm">
              <AlertTriangle size={12} className="text-[#84967e]" />
              <select
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="bg-transparent border-none text-[#ebffe2] text-[11px] focus:ring-0 w-32 cursor-pointer focus:outline-none"
              >
                <option value="all">ALL_SEVERITIES</option>
                <option value="critical">SEV_CRITICAL</option>
                <option value="high">SEV_HIGH</option>
                <option value="medium">SEV_MEDIUM</option>
                <option value="low">SEV_LOW</option>
              </select>
            </div>

            {/* Time Filter */}
            <div className="flex items-center gap-1.5 border border-[#3b4b37] bg-[#141414] px-2 py-0.5 text-xs rounded-sm">
              <RefreshCw size={12} className="text-[#84967e]" />
              <select
                value={timeFilter}
                onChange={e => setTimeFilter(e.target.value)}
                className="bg-transparent border-none text-[#ebffe2] text-[11px] focus:ring-0 w-28 cursor-pointer focus:outline-none"
              >
                <option value="all">ALL_TIME</option>
                <option value="1h">LAST_1H</option>
                <option value="24h">LAST_24H</option>
                <option value="7d">LAST_7D</option>
              </select>
            </div>

            {/* Refresh Button */}
            <button 
              onClick={() => setSyncTrigger(p => p + 1)} 
              disabled={loading}
              className="ml-auto bg-transparent border border-[#00ff41] hover:bg-[#00ff41]/10 text-[#00ff41] py-1 px-3 text-xs uppercase tracking-wider cursor-pointer font-bold rounded-sm flex items-center gap-1.5 transition-all"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              SYNC
            </button>
          </div>

          {/* Event Log Table */}
          <div className="terminal-window bg-[#071106] overflow-x-auto flex-1 h-[520px] custom-scrollbar">
            <div className="bg-[#00ff41]/10 px-4 py-2 border-b border-[#00ff41]/30 flex justify-between items-center sticky top-0 backdrop-blur-sm z-10">
              <span className="text-xs font-bold text-[#00ff41] uppercase tracking-widest">&gt;&gt; EVENT_LOG</span>
              <span className="text-[10px] text-[#84967e] font-mono">TAIL -F /VAR/LOG/SECURE</span>
            </div>

            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-[#141e12] border-b border-[#3b4b37] text-[#84967e] uppercase sticky top-8 z-10">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">TIMESTAMP</th>
                  <th className="py-2.5 px-4 font-semibold">SEVERITY</th>
                  <th className="py-2.5 px-4 font-semibold">RULE_MATCH</th>
                  <th className="py-2.5 px-4 font-semibold">SOURCE_IP</th>
                  <th className="py-2.5 px-4 font-semibold">STATUS</th>
                  <th className="py-2.5 px-4 font-semibold">ACT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3b4b37]/30">
                {filteredAlerts.map((alert) => {
                  const isSelected = selectedAlert?.alert_id === alert.alert_id
                  return (
                    <tr 
                      key={alert.alert_id} 
                      onClick={() => setSelectedAlert(alert)}
                      className={`hover:bg-[#00ff41]/10 transition-colors cursor-pointer border-b border-[#3b4b37]/20
                        ${isSelected ? 'bg-[#00ff41]/5 text-white font-bold' : ''}`}
                    >
                      <td className="py-3 px-4 text-[#dae6d2]/85">
                        {new Date(alert.fired_at || alert.upload_time).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase leading-none
                          ${alert.severity === 'critical' ? 'bg-red-950/40 text-red-400 border-red-700/40 animate-pulse' :
                            alert.severity === 'high' ? 'bg-orange-950/40 text-orange-400 border-orange-700/40' :
                            alert.severity === 'medium' ? 'bg-yellow-950/40 text-yellow-400 border-yellow-700/40' :
                            'bg-blue-950/40 text-blue-400 border-blue-700/40'}`}
                        >
                          {alert.severity}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#00ff41]">{alert.rule_name}</td>
                      <td className="py-3 px-4 font-mono text-[#84967e]">{alert.src_ip}</td>
                      <td className="py-3 px-4">
                        {alert.severity === 'critical' ? (
                          <span className="text-red-500 font-bold animate-pulse">UNRESOLVED</span>
                        ) : (
                          <span className="text-yellow-500 font-bold">INVESTIGATING</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <button 
                          className="text-[#00ff41] hover:opacity-80 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); setSelectedAlert(alert); }}
                        >
                          <Terminal size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {filteredAlerts.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="text-center py-20 text-[#84967e] font-sans">
                      NO THREAT RECORDS MATCHING FILTERS FOUND
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Detail Panel (4 cols) */}
        <div className="xl:col-span-4 flex flex-col gap-4">
          {selectedAlert ? (
            <div className="terminal-window bg-[#071106] flex flex-col h-[584px] relative">
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#00ff41] opacity-50 m-2 pointer-events-none"></div>
              
              <div className="p-4 border-b border-[#3b4b37]/30 bg-[#2d382a]/30">
                <h3 className="text-xs font-bold text-[#00ff41] flex items-center gap-2 uppercase tracking-wide">
                  <ShieldAlert size={16} />
                  INCIDENT RESPONSE CONTAINMENT PLAYBOOK
                </h3>
                <p className="text-[10px] text-[#84967e] mt-1 font-mono uppercase truncate">
                  SELECTED_ALERT: {selectedAlert.rule_name} (ID: #{selectedAlert.alert_id.slice(0, 8)})
                </p>
              </div>

              <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
                <div className="bg-[#141e12]/60 p-3 border border-[#3b4b37]">
                  <h4 className="text-[10px] text-[#84967e] uppercase mb-2 font-bold">&gt; RECOMMENDED_ACTIONS</h4>
                  <p className="text-xs text-[#dae6d2] mb-1.5 leading-relaxed">
                    1. Isolate host <strong className="text-[#00ff41] font-mono">{selectedAlert.src_ip}</strong> from internal network.
                  </p>
                  <p className="text-xs text-[#dae6d2] mb-1.5 leading-relaxed">
                    2. Terminate identified connections to destination <strong className="text-yellow-500 font-mono">{selectedAlert.dst_ip}</strong>.
                  </p>
                  <p className="text-xs text-[#dae6d2] leading-relaxed">
                    3. Dump packet session evidence payload for deep packet analysis.
                  </p>
                </div>

                {/* Automation Scripts tabs */}
                <div className="flex-1 flex flex-col gap-2">
                  <h4 className="text-[10px] text-[#00ff41] uppercase font-bold">&gt;&gt; EXECUTE_CONTAINMENT_SCRIPTS</h4>
                  
                  {/* Tabs */}
                  <div className="flex gap-2 border-b border-[#3b4b37]/30 pb-2">
                    <button
                      onClick={() => setActiveTab('linux')}
                      className={`text-[10px] font-bold px-2 py-1 border transition-all cursor-pointer rounded-sm
                        ${activeTab === 'linux' ? 'border-[#00ff41] text-[#00ff41] bg-[#00ff41]/10' : 'border-[#3b4b37] text-[#84967e]'}`}
                    >
                      Linux (iptables)
                    </button>
                    <button
                      onClick={() => setActiveTab('windows')}
                      className={`text-[10px] font-bold px-2 py-1 border transition-all cursor-pointer rounded-sm
                        ${activeTab === 'windows' ? 'border-[#00ff41] text-[#00ff41] bg-[#00ff41]/10' : 'border-[#3b4b37] text-[#84967e]'}`}
                    >
                      Windows (PowerShell)
                    </button>
                  </div>

                  <div className="bg-[#050a05] border border-[#3b4b37] p-2 relative group mt-1">
                    <div className="absolute top-0 right-0 bg-[#3b4b37] text-[#dae6d2] px-2 py-0.5 text-[8px] font-bold font-mono">
                      {activeTab === 'linux' ? 'LINUX_X64_SHELL' : 'WIN_X64_POWERSHELL'}
                    </div>
                    <pre className="font-mono text-[10px] text-[#84967e] overflow-x-auto mt-4 pb-1 select-all whitespace-pre-wrap leading-normal">
                      {activeTab === 'linux' ? linuxScript : winScript}
                    </pre>
                    <button
                      onClick={() => handleCopyScript(activeTab === 'linux' ? linuxScript : winScript)}
                      className="absolute bottom-2 right-2 bg-[#2d382a] hover:bg-[#00ff41] hover:text-black text-[#00ff41] px-2 py-1 text-[9px] font-bold border border-[#3b4b37] transition-all cursor-pointer rounded-sm"
                    >
                      {copied ? 'COPIED!' : 'COPY'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="p-4 border-t border-[#3b4b37]/30 bg-[#2d382a]/10 flex flex-col gap-2.5 mt-auto">
                <button 
                  onClick={handleContainClick}
                  className="w-full bg-red-950/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-500 py-3 text-xs font-bold uppercase tracking-wider transition-colors pulse-red flex justify-center items-center gap-2 cursor-pointer rounded-sm"
                >
                  <ShieldAlert size={14} />
                  {containmentSuccess ? 'CONTAINMENT COPIED!' : 'CONTAIN OFFENDER'}
                </button>
                {containmentSuccess && (
                  <div className="text-[10px] text-red-400 text-center font-bold font-mono uppercase blink-fast">
                    &gt; QUARANTINE SCRIPTS COPIED TO CLIPBOARD
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="terminal-window bg-[#071106] flex items-center justify-center h-[584px] text-center p-6 text-gray-500 text-xs">
              <div>
                <Globe size={40} className="mx-auto mb-3 opacity-30 animate-pulse text-[#00ff41]" />
                AWAITING HOST EVENT SELECTION...<br/>
                SELECT AN EVENT FROM THE event_log LEDGER TO COMMENCE CONTAINMENT PLAYBOOK ACTIONS
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
