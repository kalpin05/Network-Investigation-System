import { useState, useEffect } from 'react'
import { ExternalLink, AlertTriangle, X, Globe, Activity, Info, ChevronDown } from 'lucide-react'

const styleSheet = `
.scanlines {
    background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.15));
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
.brutal-border {
    border: 1px solid #00e639;
    position: relative;
    background-color: rgba(7, 17, 6, 0.85);
}
.brutal-border::before, .brutal-border::after {
    content: '';
    position: absolute;
    width: 8px;
    height: 8px;
    border: 2px solid #00e639;
}
.brutal-border::before { top: -1px; left: -1px; border-right: none; border-bottom: none; }
.brutal-border::after { bottom: -1px; right: -1px; border-left: none; border-top: none; }

.terminal-glow {
    text-shadow: 0 0 5px rgba(0, 230, 57, 0.5);
}

.custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
.custom-scrollbar::-webkit-scrollbar-track { background: #0c160a; border-left: 1px solid #3b4b37; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #00e639; }
`

export default function Kibana() {
  const [activeTab, setActiveTab] = useState('geospatial') // 'geospatial' or 'live_kibana'
  const [kqlQuery, setKqlQuery] = useState('event.dataset: "network_traffic" AND threat.indicator.type: "ipv4-addr" AND geo.dest.region_name: "SUSPICIOUS"')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showSetupHelp, setShowSetupHelp] = useState(false)
  const [timeRange, setTimeRange] = useState('1h')
  const [vectorCategory, setVectorCategory] = useState('ALL')
  const [terminalLogs, setTerminalLogs] = useState([
    '[SYS] Loading workspace modules... OK',
    '[SYS] Establishing secure connection to cluster... OK',
    '[INFO] Query parsed successfully. Executing across 4 nodes.',
    '[SYS] Fetching geospatial indices (145ms)',
    '[WARN] High volume anomalous traffic detected on port 443 (Source IP: 192.168.1.105)'
  ])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Simulates executing a query via KQL console
  const handleQuerySubmit = (e) => {
    e.preventDefault()
    setTerminalLogs(prev => [
      ...prev,
      `[USER_QUERY] Executing KQL: "${kqlQuery}"`,
      `[SYS] Scanning database shards using index: kanadshield_packets*...`,
      `[INFO] Query returned 14 active matches (time_range=${timeRange}, vector=${vectorCategory})`
    ])
  }

  return (
    <div className="text-[#ebffe2] font-mono select-none relative pb-12 crt-flicker space-y-6">
      <style dangerouslySetInnerHTML={{ __html: styleSheet }} />
      <div className="scanlines fixed inset-0 pointer-events-none" />

      {/* Header Info Banner */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 gap-4 border-b border-[#3b4b37] pb-4">
        <div>
          <h1 className="text-xl font-bold text-[#00e639] uppercase tracking-widest blinking-cursor terminal-glow">
            &gt; ANALYTICS // KIBANA THREAT DISCOVERY v4.1
          </h1>
          <p className="text-[10px] text-[#84967e] mt-1">
            &gt; ELASTICSEARCH_CLUSTER: CONNECTED // TIME: [{currentTime.toLocaleTimeString('en-US', { hour12: false })}]
          </p>
        </div>
        <div className="flex gap-2 text-xs font-bold uppercase">
          <button
            onClick={() => setShowSetupHelp(true)}
            className="border border-yellow-500 hover:bg-yellow-500/10 text-yellow-500 py-1.5 px-3 cursor-pointer rounded-sm bg-transparent flex items-center gap-1.5"
          >
            <Info size={12} /> [ SETUP_INSTRUCTIONS ]
          </button>
          <a
            href="http://localhost:5601"
            target="_blank"
            rel="noopener noreferrer"
            className="border border-[#00e639] hover:bg-[#00e639]/10 text-[#00e639] py-1.5 px-4 cursor-pointer rounded-sm flex items-center gap-1.5 bg-transparent"
          >
            <ExternalLink size={12} /> [ OPEN_FULL_TAB ]
          </a>
        </div>
      </header>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-12 gap-4">
        
        {/* Left Column Sidebar (3 cols) */}
        <div className="col-span-12 md:col-span-3 flex flex-col gap-4">
          <div className="brutal-border p-4 h-[584px] overflow-y-auto custom-scrollbar flex flex-col justify-between">
            
            {/* Tabs and Directories */}
            <div className="space-y-4">
              <div>
                <h2 className="text-xs font-bold text-[#00e639] uppercase tracking-wider">// DIRECTORY</h2>
                <p className="text-[10px] text-[#84967e] mt-0.5">/root/threat_intel</p>
              </div>

              <nav className="flex flex-col gap-1.5 text-xs font-bold">
                <button
                  onClick={() => setActiveTab('geospatial')}
                  className={`w-full text-left p-2.5 border transition-all cursor-pointer rounded-sm flex items-center gap-2
                    ${activeTab === 'geospatial'
                      ? 'border-[#00e639] bg-[#00e639]/5 text-[#00e639] terminal-glow'
                      : 'border-[#3b4b37] hover:border-[#84967e] bg-transparent text-[#84967e]'
                    }`}
                >
                  <Globe size={13} />
                  GEOSPATIAL_MAP
                </button>

                <button
                  onClick={() => setActiveTab('live_kibana')}
                  className={`w-full text-left p-2.5 border transition-all cursor-pointer rounded-sm flex items-center gap-2
                    ${activeTab === 'live_kibana'
                      ? 'border-[#00e639] bg-[#00e639]/5 text-[#00e639] terminal-glow'
                      : 'border-[#3b4b37] hover:border-[#84967e] bg-transparent text-[#84967e]'
                    }`}
                >
                  <Activity size={13} />
                  LIVE_KIBANA_IFRAME
                </button>
              </nav>

              {/* Filters Block */}
              <div className="border-t border-[#3b4b37]/50 pt-4 space-y-4">
                <h3 className="text-[11px] font-bold text-yellow-500 uppercase tracking-widest">FILTERS</h3>
                
                {/* Category select */}
                <div className="space-y-1.5">
                  <label className="text-[9px] text-[#84967e] uppercase font-bold block">CATEGORY VECTOR</label>
                  <div className="relative">
                    <select
                      value={vectorCategory}
                      onChange={(e) => setVectorCategory(e.target.value)}
                      className="w-full bg-[#141414] border border-[#3b4b37] text-white px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-[#00e639] cursor-pointer rounded-sm appearance-none"
                    >
                      <option value="ALL">ALL VECTORS</option>
                      <option value="Malware">MALWARE</option>
                      <option value="Phishing">PHISHING</option>
                      <option value="Brute Force">BRUTE FORCE</option>
                      <option value="Exfiltration">EXFILTRATION</option>
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-2.5 text-[#84967e] pointer-events-none" />
                  </div>
                </div>

                {/* Time Range Selector */}
                <div className="space-y-1.5">
                  <label className="text-[9px] text-[#84967e] uppercase font-bold block">TIME RANGE</label>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    {['15m', '1h', '24h', '7d'].map((range) => (
                      <button
                        key={range}
                        onClick={() => setTimeRange(range)}
                        className={`border py-1 font-bold uppercase transition-all cursor-pointer rounded-sm
                          ${timeRange === range
                            ? 'border-[#00e639] bg-[#00e639]/10 text-[#00e639]'
                            : 'border-[#3b4b37] text-[#84967e] bg-transparent hover:border-[#84967e]'}`}
                      >
                        {range}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar Footer help link */}
            <div className="border-t border-[#3b4b37]/50 pt-4 flex justify-between text-[10px] text-[#84967e] font-bold uppercase">
              <button onClick={() => setShowSetupHelp(true)} className="hover:text-white underline">DOCS</button>
              <span>V4.1_STABLE</span>
            </div>
          </div>
        </div>

        {/* Right Column Work Area (9 cols) */}
        <div className="col-span-12 md:col-span-9 flex flex-col gap-4">
          
          {/* KQL Console */}
          <div className="brutal-border p-4 shrink-0">
            <div className="flex justify-between items-center mb-2 text-xs font-bold text-[#00e639]">
              <span className="uppercase tracking-widest bg-[#00e639]/10 px-2 py-0.5 border border-[#00e639]/20 rounded-sm">KQL_CONSOLE</span>
              <span className="text-[10px] text-gray-500">PRESS ENTER TO RUN_QUERY</span>
            </div>
            
            <form onSubmit={handleQuerySubmit} className="relative flex items-center bg-[#071106] border border-[#3b4b37] p-2.5 rounded-sm">
              <span className="text-[#00e639] text-xs font-bold mr-2">&gt;</span>
              <input
                type="text"
                value={kqlQuery}
                onChange={(e) => setKqlQuery(e.target.value)}
                placeholder="event.dataset: 'network_traffic' AND threat.indicator.type: 'ipv4-addr'..."
                className="bg-transparent border-none text-[#ebffe2] text-xs focus:ring-0 focus:outline-none w-full font-mono"
              />
              <div className="absolute bottom-1 right-2 text-[8px] text-gray-500 font-bold">Press Tab to auto-complete</div>
            </form>
          </div>

          {/* Visualization Grid (Map panel on left, vectors/velocity on right) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            
            {/* Visualizer Panel (8 cols) */}
            <div className="col-span-12 md:col-span-8 brutal-border bg-[#0a1008] flex flex-col h-[320px] overflow-hidden">
              <div className="p-2 border-b border-[#3b4b37] flex justify-between items-center bg-[#182216]/60 text-xs">
                <span className="font-bold text-yellow-500 tracking-widest uppercase flex items-center gap-1.5">
                  <Globe size={12} />
                  {activeTab === 'geospatial' ? 'GEOSPATIAL_DISTRIBUTION' : 'LIVE_KIBANA_IFRAME'}
                </span>
                <span className="text-[9px] text-[#84967e] font-mono">RENDER: ACTIVE</span>
              </div>
              
              <div className="flex-1 relative flex items-center justify-center bg-[#050904]">
                {activeTab === 'geospatial' ? (
                  // Dot matrix geospatial visualizer
                  <div className="w-full h-full p-4 relative" style={{ backgroundImage: "radial-gradient(#3b4b37 1px, transparent 1px)", backgroundSize: "16px 16px" }}>
                    {/* Pulsing Hotspots */}
                    <div className="absolute top-1/4 left-1/3 w-6 h-6 bg-red-500/20 rounded-full flex items-center justify-center animate-ping"></div>
                    <div className="absolute top-1/4 left-1/3 w-1.5 h-1.5 bg-red-500 rounded-full shadow-[0_0_8px_#ef4444]"></div>

                    <div className="absolute top-1/2 left-2/3 w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center animate-[ping_2s_infinite]"></div>
                    <div className="absolute top-1/2 left-2/3 w-1.5 h-1.5 bg-yellow-500 rounded-full shadow-[0_0_8px_#f59e0b]"></div>

                    <div className="absolute bottom-1/3 right-1/4 w-5 h-5 bg-red-500/20 rounded-full flex items-center justify-center animate-[ping_1.5s_infinite]"></div>
                    <div className="absolute bottom-1/3 right-1/4 w-1.5 h-1.5 bg-red-500 rounded-full shadow-[0_0_8px_#ef4444]"></div>

                    <div className="absolute inset-0 flex items-center justify-center opacity-25 pointer-events-none">
                      <span className="text-xs font-bold text-[#00e639] uppercase tracking-wider terminal-glow">MAP_RENDER_ENGINE_STANDBY</span>
                    </div>
                  </div>
                ) : (
                  // Live Kibana iframe
                  <iframe
                    src="http://localhost:5601"
                    title="Live Kibana Dashboard"
                    className="w-full h-full border-0 bg-white"
                  />
                )}
              </div>
            </div>

            {/* Widgets Panel (4 cols) */}
            <div className="col-span-12 md:col-span-4 flex flex-col gap-4">
              
              {/* Top Vectors */}
              <div className="flex-1 brutal-border flex flex-col h-[152px]">
                <div className="p-2 border-b border-[#3b4b37] bg-[#182216]/60 text-xs font-bold text-yellow-500 tracking-widest uppercase">
                  // TOP_VECTORS
                </div>
                <div className="flex-grow p-3 text-[10px] flex flex-col justify-center gap-2">
                  <div className="space-y-1">
                    <div className="flex justify-between font-bold"><span>DDoS</span> <span className="text-red-500">45%</span></div>
                    <div className="w-full bg-[#141414] h-1 border border-[#3b4b37]"><div className="bg-red-500 h-full" style={{ width: '45%' }}></div></div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between font-bold"><span>SQLi</span> <span className="text-yellow-500">28%</span></div>
                    <div className="w-full bg-[#141414] h-1 border border-[#3b4b37]"><div className="bg-yellow-500 h-full" style={{ width: '28%' }}></div></div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between font-bold"><span>Malware</span> <span className="text-[#00e639]">15%</span></div>
                    <div className="w-full bg-[#141414] h-1 border border-[#3b4b37]"><div className="bg-[#00e639] h-full" style={{ width: '15%' }}></div></div>
                  </div>
                </div>
              </div>

              {/* Event Velocity sparkline */}
              <div className="flex-1 brutal-border flex flex-col h-[152px]">
                <div className="p-2 border-b border-[#3b4b37] bg-[#182216]/60 text-xs font-bold text-yellow-500 tracking-widest uppercase">
                  // EVENT_VELOCITY
                </div>
                <div className="flex-1 p-2 flex items-end justify-between gap-1.5 h-16 bg-[#071106] border border-[#3b4b37]/45 m-2.5 rounded-sm">
                  {/* CSS simulated sparkline velocity bars */}
                  <div className="w-full bg-[#00e639]/20 border-t border-[#00e639] h-[25%]" />
                  <div className="w-full bg-[#00e639]/20 border-t border-[#00e639] h-[40%]" />
                  <div className="w-full bg-yellow-500/20 border-t border-yellow-500 h-[60%]" />
                  <div className="w-full bg-[#00e639]/20 border-t border-[#00e639] h-[30%]" />
                  <div className="w-full bg-red-500/35 border-t border-red-500 h-[85%] relative animate-pulse">
                    <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></span>
                  </div>
                  <div className="w-full bg-yellow-500/20 border-t border-yellow-500 h-[70%]" />
                  <div className="w-full bg-[#00e639]/20 border-t border-[#00e639] h-[45%]" />
                  <div className="w-full bg-[#00e639]/20 border-t border-[#00e639] h-[20%]" />
                </div>
              </div>

            </div>
          </div>

          {/* Terminal System logs (120px height) */}
          <div className="brutal-border bg-[#050804] h-[100px] overflow-y-auto p-3 text-[10px] text-gray-500 leading-normal custom-scrollbar">
            <div className="space-y-1">
              {terminalLogs.map((log, idx) => {
                let color = 'text-gray-500'
                if (log.includes('[WARN]')) color = 'text-red-500 terminal-glow'
                else if (log.includes('[INFO]')) color = 'text-[#00e639]'
                else if (log.includes('[USER_QUERY]')) color = 'text-yellow-500'
                
                return (
                  <div key={idx} className={color}>
                    {log}
                  </div>
                )
              })}
              <div className="text-[#00e639] blinking-cursor">&gt; SYSTEM IDLE. AWAITING INPUT. </div>
            </div>
          </div>

        </div>
      </div>

      {/* Footer bar */}
      <footer className="bg-[#071106] border border-[#3b4b37] py-2 px-4 flex flex-col sm:flex-row justify-between items-start sm:items-end text-xs shrink-0 rounded-sm gap-2">
        <div className="flex items-center gap-4 text-xs font-bold uppercase text-yellow-500">
          <span className="w-2 h-2 rounded-full bg-[#00e639] animate-pulse"></span>
          SYS_STATUS: CONNECTED // LATENCY: 24MS
        </div>
        <div className="flex gap-4 uppercase font-bold text-[10px]">
          <button className="hover:text-yellow-500 underline transition-all text-[#00e639] bg-transparent">
            EXPORT_JSON
          </button>
          <button className="hover:text-yellow-500 underline transition-all text-[#00e639] bg-transparent">
            EXPORT_CSV
          </button>
          <button onClick={() => setTerminalLogs(prev => [...prev, `[SYS] Flushing indices cache...`, `[SYS] Diagnostics clean.`])} className="hover:text-yellow-500 underline transition-all text-[#00e639] bg-transparent">
            REFRESH_LOGS
          </button>
        </div>
      </footer>

      {/* Kibana First-Time Setup Instructions Modal */}
      {showSetupHelp && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4">
          <div className="relative overflow-hidden bg-gray-950 border border-[#00e639]/30 rounded-2xl w-full max-w-lg p-6 shadow-[0_0_45px_rgba(0,255,65,0.2)]">
            <div className="absolute top-0 right-0 w-12 h-12 border-r-2 border-t-2 border-[#00e639]/20 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-12 h-12 border-l-2 border-b-2 border-[#00e639]/20 pointer-events-none" />
            
            <button
              onClick={() => setShowSetupHelp(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 border-b border-[#3b4b37] pb-3 mb-4">
              <AlertTriangle className="text-yellow-500 shrink-0" size={18} />
              <h2 className="text-md font-bold text-white uppercase tracking-wider">
                &gt; Kibana Setup Instructions
              </h2>
            </div>

            <div className="space-y-3.5 text-xs leading-relaxed text-[#a4cc9c]">
              <p className="font-bold text-white uppercase">First-Time Index Configuration:</p>
              <ul className="list-decimal pl-4 space-y-2 font-sans text-gray-300">
                <li>
                  Kibana may take 2-3 minutes to initialize. If it shows <strong>"Kibana server is not ready"</strong>, please wait and refresh.
                </li>
                <li>
                  Once loaded, navigate to <strong>Stack Management &rarr; Data Views</strong> in the Kibana sidebar.
                </li>
                <li>
                  Click the <strong>Create data view</strong> button.
                </li>
                <li>
                  Set the Data view name to <code>Packets</code> and the Index pattern to <code>kanadshield_packets*</code>.
                </li>
                <li>
                  Select <code>timestamp</code> (or <code>@timestamp</code>) as the primary Time field, then save.
                </li>
                <li>
                  You can now inspect all traffic logs inside Kibana's <strong>Discover</strong> and <strong>Dashboard</strong> modules!
                </li>
              </ul>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowSetupHelp(false)}
                className="bg-[#00e639] hover:brightness-125 text-black font-bold py-2 px-6 rounded-sm text-xs uppercase tracking-wider cursor-pointer"
              >
                DISMISS_DOCS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
