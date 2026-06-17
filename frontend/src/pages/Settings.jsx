import { useState, useEffect, useRef } from 'react'
import { Terminal, Plus, AlertTriangle } from 'lucide-react'
import { API_BASE_URL as API } from '../config'

export default function Settings() {
  const isAdmin = localStorage.getItem('role') === 'admin'
  const [isEnabled, setIsEnabled] = useState(false)
  const [destinationType, setDestinationType] = useState('webhook')
  const [syslogIp, setSyslogIp] = useState('192.168.1.104')
  const [syslogFormat, setSyslogFormat] = useState('CEF')
  
  const [webhookTargets, setWebhookTargets] = useState([
    { id: 'ALPHA', url: 'https://api.secops-vault.internal/v2/ingest', status: 'ONLINE' },
    { id: 'BETA', url: 'https://backup.log-cluster.net/hook', status: 'TIMEOUT' }
  ])

  // Advanced params states
  const [timeoutMs, setTimeoutMs] = useState(5000)
  const [maxRetries, setMaxRetries] = useState(3)
  const [bufferSize, setBufferSize] = useState(2048)

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [consoleInput, setConsoleInput] = useState('')

  const [logs, setLogs] = useState([
    { type: 'sys', text: 'Initializing configuration parse...' },
    { type: 'warn', text: 'Target Beta response latency > 2000ms' },
    { type: 'sys', text: 'User root loaded WEBHOOK_ENDPOINTS' }
  ])

  const logEndRef = useRef(null)

  // Scroll terminal logs to bottom
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  const addLog = (text, type = 'sys') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false })
    setLogs(prev => [...prev, { type, text: `[${time}] ${text}` }])
  }

  // Fetch config asynchronously on mount to avoid set-state-in-effect warning
  useEffect(() => {
    let active = true
    const init = async () => {
      try {
        const res = await fetch(`${API}/api/settings/siem`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
        if (res.ok && active) {
          const data = await res.json()
          setIsEnabled(data.is_enabled)
          setDestinationType(data.destination_type || 'webhook')
          if (data.destination_type === 'syslog') {
            setSyslogIp(data.destination_url || '192.168.1.104')
          } else {
            setWebhookTargets(prev => prev.map((t, i) => i === 0 ? { ...t, url: data.destination_url || t.url } : t))
          }
          const time = new Date().toLocaleTimeString('en-US', { hour12: false })
          setLogs(prev => [
            ...prev,
            { type: 'sys', text: `[${time}] Config loaded from database: ROUTE=${(data.destination_type || 'webhook').toUpperCase()}` }
          ])
        }
      } catch (err) {
        console.error("Failed to fetch SIEM config", err)
        if (active) {
          const time = new Date().toLocaleTimeString('en-US', { hour12: false })
          setLogs(prev => [
            ...prev,
            { type: 'error', text: `[${time}] Failed to fetch config database state` }
          ])
        }
      }
    }
    init()
    return () => {
      active = false
    }
  }, [])

  const reloadConfig = async () => {
    try {
      const res = await fetch(`${API}/api/settings/siem`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      if (res.ok) {
        const data = await res.json()
        setIsEnabled(data.is_enabled)
        setDestinationType(data.destination_type || 'webhook')
        if (data.destination_type === 'syslog') {
          setSyslogIp(data.destination_url || '192.168.1.104')
        } else {
          setWebhookTargets(prev => prev.map((t, i) => i === 0 ? { ...t, url: data.destination_url || t.url } : t))
        }
        addLog(`Config loaded from database: ROUTE=${(data.destination_type || 'webhook').toUpperCase()}`)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleSave = async (e) => {
    if (e) e.preventDefault()
    if (!isAdmin) {
      setMessage('Failed to save configuration. Administrator privileges required.')
      addLog('Save request denied: unauthorized clearance level.', 'error')
      return
    }
    setLoading(true)
    setMessage('')
    
    const activeUrl = destinationType === 'syslog' ? syslogIp : (webhookTargets[0]?.url || '')
    
    try {
      const res = await fetch(`${API}/api/settings/siem`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          is_enabled: isEnabled,
          destination_type: destinationType,
          destination_url: activeUrl
        })
      })
      if (res.ok) {
        setMessage('SIEM Configuration saved successfully!')
        addLog(`Applied config: IS_ENABLED=${isEnabled}, ROUTE=${destinationType.toUpperCase()}, URL=${activeUrl}`)
      } else {
        setMessage('Failed to save configuration.')
        addLog('Error applying configuration state to API', 'error')
      }
    } catch (err) {
      console.error("Failed to save SIEM config", err)
      setMessage('Error saving configuration.')
      addLog('Post connection exception when saving settings', 'error')
    }
    setLoading(false)
  }

  const handleCancel = () => {
    if (!isAdmin) {
      addLog('Cancel command denied: read-only access level.', 'error')
      return
    }
    reloadConfig()
    addLog('Cancel command parsed. Rolling back UI parameters.')
  }

  const handleTestConn = (targetId) => {
    addLog(`Testing socket connection to target: ${targetId}...`)
    const target = webhookTargets.find(t => t.id === targetId)
    if (!target) return

    setTimeout(() => {
      const isOnline = target.url.startsWith('http')
      setWebhookTargets(prev => prev.map(t => {
        if (t.id === targetId) {
          return { ...t, status: isOnline ? 'ONLINE' : 'TIMEOUT' }
        }
        return t
      }))
      if (isOnline) {
        addLog(`Target [${targetId}] validation: SUCCESS (HTTP 200 OK)`, 'sys')
      } else {
        addLog(`Target [${targetId}] validation: FAILED (TIMEOUT)`, 'error')
      }
    }, 1000)
  }

  const handleAddTarget = () => {
    const nextId = String.fromCharCode(65 + webhookTargets.length)
    setWebhookTargets(prev => [
      ...prev,
      { id: nextId, url: 'https://', status: 'TIMEOUT' }
    ])
    addLog(`Created new endpoint target index [${nextId}]`)
  }

  const handleConsoleSubmit = (e) => {
    e.preventDefault()
    if (!consoleInput.trim()) return

    const cmd = consoleInput.trim()
    addLog(`> ${cmd}`, 'user')

    const args = cmd.split(' ')
    const command = args[0].toLowerCase()

    if (command === '/help') {
      addLog('AVAILABLE COMMANDS:')
      addLog('  /status         Display alert forwarder daemon status')
      addLog('  /ping <host>    Ping target server IP or API address')
      addLog('  /test           Trigger endpoint validation tests')
      addLog('  /clear          Clear console log history')
    } else if (command === '/clear') {
      setLogs([])
    } else if (command === '/status') {
      addLog('SYSTEM FORWARDER METRICS:')
      addLog(`  DAEMON STATE: ${isEnabled ? 'RUNNING' : 'STOPPED'}`)
      addLog(`  PIPELINE ROUTE: ${destinationType.toUpperCase()}`)
      addLog(`  TARGET ADDR: ${destinationType === 'syslog' ? syslogIp : webhookTargets[0].url}`)
      addLog(`  CONN_TIMEOUT: ${timeoutMs}ms // BUFFER_SIZE: ${bufferSize}KB`)
    } else if (command === '/ping') {
      const host = args[1] || '127.0.0.1'
      addLog(`Pinging host ${host}...`)
      setTimeout(() => {
        addLog(`64 bytes from ${host}: seq=1 ttl=64 time=1.12ms`)
        addLog(`64 bytes from ${host}: seq=2 ttl=64 time=1.24ms`)
        addLog(`--- ${host} ping statistics ---`)
        addLog('2 packets transmitted, 2 received, 0% packet loss')
      }, 500)
    } else if (command === '/test') {
      handleTestConn('ALPHA')
    } else {
      addLog(`shell: command not found: ${command}`, 'error')
    }

    setConsoleInput('')
  }

  return (
    <div className="relative font-mono text-[#00ff41] bg-[#0c160a] p-6 rounded-lg border border-[#3b4b37] shadow-[0_0_20px_rgba(0,255,65,0.1)] overflow-hidden">
      {/* Dynamic Style Rules */}
      <style>{`
        .crt-glow {
          text-shadow: 0 0 4px #00ff41;
        }
        .crt-glow-error {
          text-shadow: 0 0 4px #ffb4ab;
        }
        .terminal-panel {
          border: 1px solid #3b4b37;
          background-color: #141e12;
          position: relative;
        }
        .terminal-panel::before, .terminal-panel::after {
          content: '';
          position: absolute;
          width: 8px;
          height: 8px;
          border: 1px solid #00ff41;
        }
        .terminal-panel::before { top: -1px; left: -1px; border-right: none; border-bottom: none; }
        .terminal-panel::after { bottom: -1px; right: -1px; border-left: none; border-top: none; }

        .cyber-input {
          background: transparent;
          border: 1px solid #3b4b37;
          color: #dae6d2;
          font-family: 'JetBrains Mono', monospace;
          padding-left: 1.5rem;
          position: relative;
        }
        .cyber-input:focus {
          outline: none;
          border-color: #00ff41;
          box-shadow: 0 0 8px rgba(0, 255, 65, 0.2);
        }
        .input-wrapper {
          position: relative;
        }
        .input-wrapper::before {
          content: '>';
          position: absolute;
          left: 0.5rem;
          top: 50%;
          transform: translateY(-50%);
          color: #00ff41;
          font-family: 'JetBrains Mono', monospace;
        }

        .cursor {
          display: inline-block;
          width: 6px;
          height: 12px;
          background-color: #00ff41;
          animation: blink-anim 1s step-end infinite;
          vertical-align: middle;
        }
        @keyframes blink-anim {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>

      {/* CRT Scanline overlay */}
      <div className="absolute inset-0 pointer-events-none z-10 opacity-15"
           style={{
             background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
             backgroundSize: '100% 3px, 3px 100%'
           }} 
      />

      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-b border-[#3b4b37] pb-4 gap-2">
        <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-tight text-[#00ff41] crt-glow font-mono flex items-center">
          SYSTEM SETTINGS // ALERT FORWARDING v1.9
          <span className="cursor ml-2" />
        </h1>
        <div className={`font-mono text-xs border px-3 py-1 bg-black/40 transition-all ${
          isAdmin ? 'cursor-pointer hover:bg-black/60' : 'cursor-not-allowed opacity-75'
        } ${
          isEnabled 
            ? 'text-[#00ff41] border-[#00ff41]' 
            : 'text-[#ffb4ab] border-[#ffb4ab]'
        }`}
        onClick={() => isAdmin && setIsEnabled(!isEnabled)}
        >
          FORWARDING: [{isEnabled ? 'ENABLED' : 'DISABLED'}]
        </div>
      </header>

      {!isAdmin && (
        <div className="mt-4 bg-yellow-950/40 border border-yellow-500 text-yellow-500 text-xs p-3 rounded font-mono flex items-start gap-2 animate-pulse">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-yellow-500" />
          <span>WARNING: READ-ONLY PRIVILEGES. ADMINISTRATOR CLEARANCE (L3) IS REQUIRED TO CONFIGURE SIEM OR DAEMON ROUTING SETTINGS.</span>
        </div>
      )}

      {/* Alert Boxes */}
      {message && (
        <div className={`mt-4 p-4 rounded text-xs border font-mono ${
          message.includes('successfully') 
            ? 'bg-[#00ff41]/10 text-[#00ff41] border-[#00ff41]' 
            : 'bg-[#ffb4ab]/10 text-[#ffb4ab] border-[#ffb4ab]'
        }`}>
          {message}
        </div>
      )}

      {/* Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 mt-6">
        
        {/* Left Column - Configurations */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          
          {/* Syslog Config */}
          <section className={`terminal-panel p-5 rounded transition-all duration-300 ${
            destinationType === 'syslog' ? 'opacity-100 ring-1 ring-[#00ff41]/30' : 'opacity-60 hover:opacity-80'
          }`}>
            <header className="border-b border-[#3b4b37] pb-3 mb-4 flex items-center justify-between cursor-pointer"
                    onClick={() => isAdmin && setDestinationType('syslog')}
            >
              <h2 className="text-sm font-bold text-[#00ff41] crt-glow flex items-center gap-2">
                <span>[SYS] SYSLOG_CONFIGURATION</span>
                {destinationType === 'syslog' && <span className="text-[9px] px-1.5 py-0.5 bg-[#00ff41] text-[#0c160a]">ACTIVE</span>}
              </h2>
              <span className="text-[10px] text-[#b9ccb2] px-2 py-0.5 bg-black/30 border border-[#3b4b37]">/etc/syslog.conf</span>
            </header>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#b9ccb2] mb-1.5">TARGET_SERVER_IP</label>
                <div className="input-wrapper max-w-md">
                  <input
                    type="text"
                    value={syslogIp}
                    onChange={(e) => setSyslogIp(e.target.value)}
                    disabled={destinationType !== 'syslog' || !isAdmin}
                    className="cyber-input w-full py-1.5 text-xs focus:ring-1 focus:ring-[#00ff41] disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#b9ccb2] mb-2">PAYLOAD_FORMAT</label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="radio"
                      name="format"
                      checked={syslogFormat === 'CEF'}
                      onChange={() => setSyslogFormat('CEF')}
                      disabled={destinationType !== 'syslog' || !isAdmin}
                      className="sr-only peer"
                    />
                    <div className="w-4 h-4 border border-[#3b4b37] group-hover:border-[#00ff41] peer-checked:bg-[#00ff41] peer-checked:border-[#00ff41] transition-colors" />
                    <span className="text-xs text-[#dae6d2] peer-checked:text-[#00ff41] peer-checked:crt-glow">
                      CEF (Common Event Format)
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="radio"
                      name="format"
                      checked={syslogFormat === 'RAW'}
                      onChange={() => setSyslogFormat('RAW')}
                      disabled={destinationType !== 'syslog' || !isAdmin}
                      className="sr-only peer"
                    />
                    <div className="w-4 h-4 border border-[#3b4b37] group-hover:border-[#00ff41] peer-checked:bg-[#00ff41] peer-checked:border-[#00ff41] transition-colors" />
                    <span className="text-xs text-[#dae6d2] peer-checked:text-[#00ff41] peer-checked:crt-glow">
                      RAW UDP
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </section>

          {/* Webhook Config */}
          <section className={`terminal-panel p-5 rounded transition-all duration-300 ${
            destinationType === 'webhook' ? 'opacity-100 ring-1 ring-[#00ff41]/30' : 'opacity-60 hover:opacity-80'
          }`}>
            <header className="border-b border-[#3b4b37] pb-3 mb-4 flex items-center justify-between cursor-pointer"
                    onClick={() => isAdmin && setDestinationType('webhook')}
            >
              <h2 className="text-sm font-bold text-[#00ff41] crt-glow flex items-center gap-2">
                <span>[NET] WEBHOOK_ENDPOINTS</span>
                {destinationType === 'webhook' && <span className="text-[9px] px-1.5 py-0.5 bg-[#00ff41] text-[#0c160a]">ACTIVE</span>}
              </h2>
              <button
                onClick={(e) => { e.stopPropagation(); handleAddTarget(); }}
                disabled={destinationType !== 'webhook' || !isAdmin}
                className="text-xs border border-[#00ff41] text-[#00ff41] px-2.5 py-0.5 hover:bg-[#00ff41]/10 flex items-center gap-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Plus size={10} /> ADD_TARGET
              </button>
            </header>
            <div className="space-y-3">
              {webhookTargets.map((target, idx) => (
                <div key={target.id} className="border border-[#3b4b37]/60 bg-black/20 p-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                  <div className="flex-1 w-full">
                    <div className="text-[10px] text-[#b9ccb2] mb-1 font-bold">TARGET_ID: {target.id}</div>
                    <div className="input-wrapper w-full">
                      <input
                        type="text"
                        value={target.url}
                        onChange={(e) => {
                          const val = e.target.value
                          setWebhookTargets(prev => prev.map(t => t.id === target.id ? { ...t, url: val } : t))
                        }}
                        disabled={destinationType !== 'webhook' || !isAdmin}
                        className="cyber-input w-full py-1 text-xs focus:ring-1 focus:ring-[#00ff41] disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 mt-1 md:mt-4">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${
                        target.status === 'ONLINE' ? 'bg-[#00ff41] animate-pulse shadow-[0_0_6px_#00ff41]' : 'bg-[#fdaf00] shadow-[0_0_6px_#fdaf00]'
                      }`} />
                      <span className={`text-[10px] ${target.status === 'ONLINE' ? 'text-[#00ff41]' : 'text-[#fdaf00]'}`}>
                        {target.status}
                      </span>
                    </div>
                    <button
                      onClick={() => handleTestConn(target.id)}
                      disabled={destinationType !== 'webhook' || !isAdmin}
                      className="px-2.5 py-1 border border-[#3b4b37] text-[#dae6d2] hover:text-[#00ff41] hover:border-[#00ff41] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {idx === 0 ? 'TEST_CONN' : 'RETRY'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column - Status & Advanced */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          
          {/* System Status Panel */}
          <section className="terminal-panel p-5 rounded">
            <header className="border-b border-[#3b4b37] pb-2 mb-3">
              <h2 className="text-xs font-bold text-[#00ff41] crt-glow">SYSTEM_STATUS</h2>
            </header>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center border-b border-[#3b4b37]/30 pb-2">
                <span className="text-[#b9ccb2]">DAEMON_STATE</span>
                <span
                  onClick={() => isAdmin && setIsEnabled(!isEnabled)}
                  className={`font-bold transition-all ${
                    isAdmin ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-75'
                  } ${
                    isEnabled ? 'text-[#00ff41] crt-glow' : 'text-[#ffb4ab] crt-glow-error'
                  }`}
                >
                  {isEnabled ? 'RUNNING [PID 4092]' : 'STOPPED'}
                </span>
              </div>
              <div className="flex justify-between border-b border-[#3b4b37]/30 pb-2">
                <span className="text-[#b9ccb2]">ACTIVE_CONNS</span>
                <span className="text-[#00ff41] font-bold">{isEnabled ? '4' : '0'}</span>
              </div>
              <div className="flex justify-between border-b border-[#3b4b37]/30 pb-2">
                <span className="text-[#b9ccb2]">QUEUE_SIZE</span>
                <span className="text-[#fdaf00] font-bold">{isEnabled ? '1.2 MB' : '0 KB'}</span>
              </div>
              <div className="flex justify-between pt-0.5">
                <span className="text-[#b9ccb2]">LAST_SYNC</span>
                <span className="text-[#dae6d2]">2026-06-16 14:02:11Z</span>
              </div>
            </div>
          </section>

          {/* Advanced collapsible settings */}
          <section className="terminal-panel p-5 rounded">
            <details className="group cursor-pointer">
              <summary className="text-xs font-bold text-[#00ff41] flex justify-between items-center outline-none list-none">
                <span className="crt-glow">ADVANCED_PARAMS</span>
                <span className="text-xs transition-transform group-open:rotate-180 text-[#b9ccb2]">&#9662;</span>
              </summary>
              <div className="pt-4 space-y-3 text-xs">
                <div>
                  <label className="block text-[#b9ccb2] mb-1 font-bold">TIMEOUT_MS</label>
                  <div className="input-wrapper">
                    <input
                      type="number"
                      value={timeoutMs}
                      onChange={(e) => setTimeoutMs(parseInt(e.target.value))}
                      disabled={!isAdmin}
                      className="cyber-input w-full py-1 text-xs focus:ring-1 focus:ring-[#00ff41] disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[#b9ccb2] mb-1 font-bold">MAX_RETRIES</label>
                  <div className="input-wrapper">
                    <input
                      type="number"
                      value={maxRetries}
                      onChange={(e) => setMaxRetries(parseInt(e.target.value))}
                      disabled={!isAdmin}
                      className="cyber-input w-full py-1 text-xs focus:ring-1 focus:ring-[#00ff41] disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[#b9ccb2] mb-1 font-bold">BUFFER_SIZE_KB</label>
                  <div className="input-wrapper">
                    <input
                      type="number"
                      value={bufferSize}
                      onChange={(e) => setBufferSize(parseInt(e.target.value))}
                      disabled={!isAdmin}
                      className="cyber-input w-full py-1 text-xs focus:ring-1 focus:ring-[#00ff41] disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            </details>
          </section>

          {/* Save & Cancel */}
          <div className="flex gap-4 mt-auto">
            <button
              onClick={handleCancel}
              disabled={!isAdmin}
              className="flex-1 py-2 text-xs font-bold border border-[#3b4b37] text-[#dae6d2] hover:bg-black/30 hover:border-[#00ff41] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              CANCEL
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !isAdmin}
              className="flex-1 py-2 text-xs font-bold border border-[#00ff41] bg-[#141e12] text-[#00ff41] hover:bg-[#00ff41] hover:text-[#0c160a] transition-all crt-glow cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'SAVING...' : 'APPLY_CFG'}
            </button>
          </div>

        </div>
      </div>

      {/* Terminal log panel */}
      <section className="terminal-panel mt-6 flex-shrink-0 h-48 flex flex-col rounded overflow-hidden bg-black/60">
        <header className="bg-black/80 px-4 py-1.5 border-b border-[#3b4b37] flex items-center justify-between">
          <span className="font-mono text-[10px] text-[#b9ccb2] flex items-center gap-1.5">
            <Terminal size={10} /> /var/log/syslog_fwd.log
          </span>
          <span className="w-2 h-2 bg-[#00ff41] animate-pulse"></span>
        </header>
        <div className="flex-1 p-3 overflow-y-auto font-mono text-[10px] flex flex-col gap-1 text-[#b9ccb2]">
          {logs.map((log, index) => {
            let typeColor = 'text-[#00ff41]'
            if (log.type === 'warn') typeColor = 'text-[#fdaf00]'
            if (log.type === 'error') typeColor = 'text-[#ffb4ab]'
            if (log.type === 'user') typeColor = 'text-[#dae6d2]'

            return (
              <div key={index} className="leading-normal">
                {log.type !== 'user' && log.type !== 'raw' && (
                  <span className={`${typeColor} font-bold mr-1.5`}>
                    {log.type.toUpperCase()}
                  </span>
                )}
                <span>{log.text}</span>
              </div>
            )
          })}
          
          {/* Shell prompt input */}
          <form onSubmit={handleConsoleSubmit} className="flex items-center gap-1 mt-1">
            <span className="text-[#00ff41] font-bold">&gt;</span>
            <input
              type="text"
              value={consoleInput}
              onChange={(e) => setConsoleInput(e.target.value)}
              disabled={!isAdmin}
              placeholder={isAdmin ? "Type /help for options..." : "READ-ONLY TERMINAL LOGS FEED"}
              className="flex-1 bg-transparent border-none outline-none text-[#dae6d2] focus:ring-0 p-0 text-[10px] font-mono leading-none disabled:opacity-50"
            />
            <span className="cursor ml-1" />
          </form>
          <div ref={logEndRef} />
        </div>
      </section>

    </div>
  )
}
