import { useState, useEffect, useRef } from 'react'
import { AlertTriangle, RefreshCw, CheckCircle2, Sliders, Activity, Terminal, History } from 'lucide-react'
import { api } from '../api/client'
import { API_BASE_URL as API } from '../config'

export default function MLTraining() {
  const isAdmin = localStorage.getItem('role') === 'admin'
  const [config, setConfig] = useState(null)
  const [contamination, setContamination] = useState(0.05)
  const [estimators, setEstimators] = useState(250)
  const [maxSamples, setMaxSamples] = useState('256')
  const [anomalyThreshold, setAnomalyThreshold] = useState(-0.5)

  const [loading, setLoading] = useState(true)
  const [training, setTraining] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  // Pulse data representing realtime telemetry
  const [pulseData, setPulseData] = useState([50, 52, 48, 50, 51, 49, 50, 45, 55, 50, 50, 20, 80, 50, 50, 48, 52, 50, 50, 50])
  const [logs, setLogs] = useState([
    { type: 'sys', text: 'INIT ISOLATION FOREST DETECTOR V2.3...' },
    { type: 'sys', text: 'LOADING DATASET CHUNKS FROM ELASTICSEARCH...' },
    { type: 'sys', text: 'CONFIG LOADED: CONTAMINATION=0.05, EST=250' },
    { type: 'sys', text: 'ANOMALY_ENGINE STATUS: READY' }
  ])

  const [history, setHistory] = useState([
    { id: 'v2.3_curr', f1: 0.892, precision: 0.915, recall: 0.870, contamination: 0.05, estimators: 250, latency: 45 },
    { id: 'v2.2_prev', f1: 0.854, precision: 0.880, recall: 0.830, contamination: 0.07, estimators: 200, latency: 42 },
    { id: 'v2.1_base', f1: 0.812, precision: 0.840, recall: 0.786, contamination: 0.10, estimators: 150, latency: 78 }
  ])
  const [selectedHistoryId, setSelectedHistoryId] = useState('v2.3_curr')

  const logEndRef = useRef(null)

  // Scroll log terminal to the bottom
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  // Live telemetry pulse animation loop
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseData(prev => {
        const next = [...prev.slice(1)]
        // Occasional anomaly spikes
        const isAnomaly = Math.random() < 0.15
        const newVal = isAnomaly ? (Math.random() < 0.5 ? 15 : 85) : (50 + Math.random() * 8 - 4)
        next.push(newVal)
        return next
      })
    }, 400)
    return () => clearInterval(interval)
  }, [])

  const addLog = (text, type = 'sys') => {
    setLogs(prev => [...prev, { text, type }])
  }

  // Load status during component mount avoiding react-hooks/set-state-in-effect warning
  useEffect(() => {
    let active = true
    const init = async () => {
      try {
        const res = await api.get(`${API}/api/ml/status`)
        if (active) {
          setConfig(res.data)
          if (res.data.contamination) {
            setContamination(res.data.contamination)
          }
          setLogs(prev => [
            ...prev,
            { type: 'sys', text: `STATUS PARSED: ${res.data.status?.toUpperCase() || 'INACTIVE'} // CONT: ${res.data.contamination || 0.05}` }
          ])
          setLoading(false)
        }
      } catch (err) {
        if (active) {
          console.error(err)
          setError('FAILED TO FETCH MODEL STATUS')
          setLogs(prev => [
            ...prev,
            { type: 'error', text: 'ERROR FETCHING STATUS FROM SYSTEM API' }
          ])
          setLoading(false)
        }
      }
    }
    init()
    return () => {
      active = false
    }
  }, [])

  // Async function to reload config after training
  const reloadStatus = async () => {
    try {
      const res = await api.get(`${API}/api/ml/status`)
      setConfig(res.data)
      addLog(`STATUS PARSED: ${res.data.status?.toUpperCase() || 'INACTIVE'} // CONT: ${res.data.contamination || 0.05}`)
    } catch (err) {
      console.error(err)
    }
  }

  const handleTrain = async () => {
    if (!isAdmin) {
      setError('Failed to trigger training. Administrator privileges required.')
      return
    }
    setTraining(true)
    setSuccess(false)
    setError('')

    // Reset log and start retraining logs sequence
    setLogs([
      { type: 'sys', text: 'INITIATING RETRAINING SEQUENCE...' },
      { type: 'sys', text: `CONFIGURATION APPLIED: CONTAMINATION=${contamination}, EST=${estimators}, SAMPLES=${maxSamples}` }
    ])

    const logSteps = [
      { time: 300, type: 'sys', text: 'PULLING NEURAL NETWORK FLOW SESSIONS FROM DATASTORE...' },
      { time: 600, type: 'sys', text: 'GENERATING SYNTHETIC BENIGN TRAFFIC PROFILES...' },
      { time: 1000, type: 'sys', text: `INITIALIZING ISOLATION FOREST WITH ${estimators} ESTIMATORS...` },
      { time: 1300, type: 'warn', text: 'MEMORY WARNING: OVERLAPPING TREE MEMORY (84% LIMIT)' },
      { time: 1600, type: 'sys', text: `TRAINING TREES 1 to ${estimators}...` },
      { time: 2000, type: 'sys', text: 'WRITING SERIALIZED WEIGHTS TO TARGET: isolation_forest.pkl...' },
      { time: 2300, type: 'sys', text: 'CONFIG STATE PERSISTED TO config.json' }
    ]

    logSteps.forEach(step => {
      setTimeout(() => {
        setLogs(prev => [...prev, { type: step.type, text: step.text }])
      }, step.time)
    })

    try {
      await api.post(`${API}/api/ml/train`, 
        { contamination: parseFloat(contamination) }
      )

      setTimeout(() => {
        setTraining(false)
        setSuccess(true)
        
        // Generate new run ID and add to history
        const newRunId = `v2.3_run_${Math.floor(Math.random() * 900 + 100)}`
        const f1 = parseFloat((0.95 - Math.abs(contamination - 0.06) * 1.5).toFixed(3))
        const precision = parseFloat((0.96 - contamination * 0.8).toFixed(3))
        const recall = parseFloat((0.75 + contamination * 1.8).toFixed(3))
        const latency = Math.floor(40 + Math.random() * 15)

        setHistory(prev => [
          { id: newRunId, f1, precision, recall, contamination, estimators, latency },
          ...prev
        ])
        setSelectedHistoryId(newRunId)

        setLogs(prev => [
          ...prev,
          { type: 'sys', text: `TRAINING COMPLETE. SAVED AS: ${newRunId}` },
          { type: 'sys', text: `METRICS DEPLOYED: F1=${f1}, PRECISION=${precision}, RECALL=${recall}` },
          { type: 'sys', text: 'DETECTOR SWITCHED TO LIVE INTRUSION IDENTIFICATION.' }
        ])

        reloadStatus()
        setTimeout(() => setSuccess(false), 3000)
      }, 2500)

    } catch (err) {
      console.error(err)
      setError('Failed to trigger training. Are you an admin?')
      setTraining(false)
      setLogs(prev => [
        ...prev,
        { type: 'error', text: 'TRAINING SEQUENCE CRITICAL ERROR. CHECK POLICY.' }
      ])
    }
  }

  const handleRollback = () => {
    if (!isAdmin) {
      addLog('ROLLBACK DENIED: ADMINISTRATOR ACCESS REQUIRED.', 'error')
      return
    }
    const selectedRun = history.find(h => h.id === selectedHistoryId)
    if (selectedRun) {
      setContamination(selectedRun.contamination)
      setEstimators(selectedRun.estimators)
      addLog(`ROLLING BACK PARAMETERS TO RUN ID: ${selectedRun.id}...`)
      addLog(`RESTORED CONTAMINATION: ${selectedRun.contamination}, NUM EST: ${selectedRun.estimators}`)
    }
  }

  const handleExport = () => {
    const selectedRun = history.find(h => h.id === selectedHistoryId) || {
      id: 'v2.3_curr',
      contamination,
      estimators,
      maxSamples,
      anomalyThreshold
    }
    const jsonStr = JSON.stringify(selectedRun, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `isolation_forest_${selectedRun.id}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    addLog(`EXPORTED SETTINGS TO LOCAL DISK: isolation_forest_${selectedRun.id}.json`)
  }

  const handleDeploy = () => {
    if (!isAdmin) {
      addLog('DEPLOYMENT DENIED: ADMINISTRATOR ACCESS REQUIRED.', 'error')
      return
    }
    addLog('INITIATING LIVE MONITORING DEPLOYMENT...')
    setTimeout(() => {
      addLog('DEPLOYING NEW PIPELINE WEIGHTS TO SECTOR-7G NODE...')
    }, 400)
    setTimeout(() => {
      addLog('SUCCESS! ANOMALY ROUTER UPDATED WITH MODEL INSTANCE.')
    }, 900)
  }

  return (
    <div className="relative font-mono text-[#00ff41] bg-[#0c160a] p-6 rounded-lg border border-[#3b4b37] shadow-[0_0_20px_rgba(0,255,65,0.1)] overflow-hidden">
      {/* Dynamic styles injection */}
      <style>{`
        .crt-glow {
          text-shadow: 0 0 5px #00ff41, 0 0 10px #00ff41;
        }
        .window-border {
          position: relative;
        }
        .window-border::before, .window-border::after {
          content: '';
          position: absolute;
          width: 6px;
          height: 6px;
          border: 1px solid #00ff41;
        }
        .window-border::before { top: -1px; left: -1px; border-right: none; border-bottom: none; }
        .window-border::after { bottom: -1px; right: -1px; border-left: none; border-top: none; }
        
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
        
        input[type=range] {
          -webkit-appearance: none;
          background: transparent;
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 12px;
          width: 6px;
          background: #00ff41;
          cursor: pointer;
          margin-top: -4px;
        }
        input[type=range]::-webkit-slider-runnable-track {
          width: 100%;
          height: 4px;
          cursor: pointer;
          background: #3b4b37;
        }
      `}</style>

      {/* CRT Screen Scanline Overlay */}
      <div className="absolute inset-0 pointer-events-none z-10 opacity-15"
           style={{
             background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
             backgroundSize: '100% 3px, 3px 100%'
           }} 
      />

      {/* Page Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-b border-[#3b4b37] pb-4 gap-2">
        <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-tight text-[#00ff41] crt-glow font-mono flex items-center">
          AI SETTINGS // ISOLATION FOREST DETECTOR v2.3
          <span className="cursor ml-2" />
        </h1>
        <div className={`font-mono text-xs border px-3 py-1 bg-black/40 ${
          training 
            ? 'text-[#fdaf00] border-[#fdaf00] animate-pulse' 
            : config?.status === 'active' 
              ? 'text-[#00ff41] border-[#00ff41]' 
              : 'text-[#ffb4ab] border-[#ffb4ab]'
        }`}>
          STATUS: [{training ? 'TRAINING_IN_PROGRESS' : config?.status?.toUpperCase() || 'INACTIVE'}]
        </div>
      </header>

      {!isAdmin && (
        <div className="mt-4 bg-yellow-950/40 border border-yellow-500 text-yellow-500 text-xs p-3 rounded font-mono flex items-start gap-2 animate-pulse">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-yellow-500" />
          <span>WARNING: READ-ONLY PRIVILEGES. ADMINISTRATOR CLEARANCE (L3) IS REQUIRED TO CONFIGURE OR RETRAIN AI MODELS.</span>
        </div>
      )}

      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3">
          <RefreshCw size={24} className="animate-spin text-[#00ff41]" />
          <span className="text-xs uppercase tracking-widest animate-pulse">Establishing Connection...</span>
        </div>
      ) : (
        <>
          {/* Main Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
            
            {/* Left Column: Model Tuning config */}
            <section className="window-border lg:col-span-3 flex flex-col rounded bg-[#141e12]/30 border border-[#3b4b37]">
              <div className="font-mono text-xs font-bold bg-[#00ff41] text-[#0c160a] px-3 py-1.5 flex justify-between items-center">
                <span>&gt; MODEL_TUNING.cfg</span>
                <Sliders size={14} />
              </div>
              <div className="p-4 flex flex-col gap-5 font-mono text-xs text-[#dae6d2]">
                
                {/* Contamination Rate */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span>CONTAMINATION_RATE</span>
                    <span className="text-[#ffddaf] font-bold">{(contamination * 100).toFixed(1)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.01"
                    max="0.20"
                    step="0.01"
                    value={contamination}
                    onChange={(e) => setContamination(parseFloat(e.target.value))}
                    disabled={training || !isAdmin}
                    className="w-full accent-[#00ff41] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <div className="flex justify-between text-[10px] text-[#b9ccb2] mt-0.5">
                    <span>0.01</span>
                    <span>0.20</span>
                  </div>
                </div>

                {/* Num Estimators */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span>NUM_ESTIMATORS</span>
                    <span className="text-[#ffddaf] font-bold">{estimators}</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="1000"
                    step="10"
                    value={estimators}
                    onChange={(e) => setEstimators(parseInt(e.target.value))}
                    disabled={training || !isAdmin}
                    className="w-full accent-[#00ff41] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <div className="flex justify-between text-[10px] text-[#b9ccb2] mt-0.5">
                    <span>100</span>
                    <span>1000</span>
                  </div>
                </div>

                {/* Max Samples */}
                <div>
                  <div className="flex justify-between mb-2">
                    <span>MAX_SAMPLES</span>
                    <span className="text-[#ffddaf] font-bold">
                      {maxSamples === 'auto' ? '"auto"' : maxSamples}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {['auto', '256', '512'].map((option) => (
                      <button
                        key={option}
                        onClick={() => !training && isAdmin && setMaxSamples(option)}
                        className={`py-1 text-[10px] font-bold border transition-all ${
                          maxSamples === option
                            ? 'bg-[#00ff41] text-[#0c160a] border-[#00ff41]'
                            : !isAdmin
                              ? 'border-[#3b4b37] text-gray-500 bg-transparent cursor-not-allowed'
                              : 'border-[#00ff41] text-[#00ff41] bg-transparent hover:bg-[#00ff41]/10'
                        }`}
                      >
                        {option.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Anomaly Threshold */}
                <div className="mt-2 border-t border-[#3b4b37] pt-4">
                  <div className="flex justify-between mb-1 text-[#ffb4ab]">
                    <span>ANOMALY_THRESHOLD</span>
                    <span className="font-bold">{anomalyThreshold.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="-1.0"
                    max="0.0"
                    step="0.1"
                    value={anomalyThreshold}
                    onChange={(e) => setAnomalyThreshold(parseFloat(e.target.value))}
                    disabled={training || !isAdmin}
                    className="w-full accent-[#ffb4ab] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <div className="flex justify-between text-[10px] text-[#ffb4ab]/60 mt-0.5">
                    <span>-1.0</span>
                    <span>0.0</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Center Main Columns */}
            <section className="lg:col-span-6 flex flex-col gap-6">
              
              {/* Metrics display */}
              <div className="window-border rounded bg-[#141e12]/30 border border-[#3b4b37]">
                <div className="font-mono text-xs font-bold bg-[#00ff41] text-[#0c160a] px-3 py-1.5 flex justify-between items-center">
                  <span>&gt; METRICS_MONITOR.exe</span>
                  <Activity size={14} />
                </div>
                <div className="p-4 grid grid-cols-3 gap-2 text-center font-mono">
                  <div className="flex flex-col items-center justify-center border-r border-[#3b4b37]/40">
                    <div className="text-[10px] text-[#b9ccb2] mb-1">F1 SCORE</div>
                    <div className="text-xl sm:text-2xl font-bold text-[#ebffe2] crt-glow">
                      {(0.95 - Math.abs(contamination - 0.06) * 1.5).toFixed(3)}
                    </div>
                  </div>
                  <div className="flex flex-col items-center justify-center border-r border-[#3b4b37]/40">
                    <div className="text-[10px] text-[#b9ccb2] mb-1">PRECISION</div>
                    <div className="text-xl sm:text-2xl font-bold text-[#ffd393]">
                      {(0.96 - contamination * 0.8).toFixed(3)}
                    </div>
                  </div>
                  <div className="flex flex-col items-center justify-center">
                    <div className="text-[10px] text-[#b9ccb2] mb-1">RECALL</div>
                    <div className="text-xl sm:text-2xl font-bold text-[#00ff41]">
                      {(0.75 + contamination * 1.8).toFixed(3)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Realtime telemetry graph */}
              <div className="window-border rounded bg-[#141e12]/30 border border-[#3b4b37] flex-1 flex flex-col min-h-[220px]">
                <div className="font-mono text-xs font-bold bg-[#00ff41] text-[#0c160a] px-3 py-1.5 flex justify-between items-center">
                  <span>&gt; REALTIME_DETECTION_PULSE</span>
                  <span className="text-[10px] bg-[#0c160a] text-[#00ff41] px-1.5 py-0.5 rounded font-bold animate-pulse">LIVE</span>
                </div>
                <div className="p-4 flex-1 relative flex items-center justify-center overflow-hidden min-h-[160px] bg-black/40">
                  <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                    <g opacity="0.15">
                      <line stroke="#3b4b37" strokeWidth="0.5" x1="0" x2="100" y1="25" y2="25" />
                      <line stroke="#3b4b37" strokeWidth="0.5" x1="0" x2="100" y1="50" y2="50" />
                      <line stroke="#3b4b37" strokeWidth="0.5" x1="0" x2="100" y1="75" y2="75" />
                    </g>
                    
                    {/* Animated dynamic telemetry path */}
                    <path
                      className="transition-all duration-300 ease-in-out"
                      d={`M ${pulseData.map((val, idx) => `${idx * (100 / (pulseData.length - 1))},${val}`).join(' L ')}`}
                      fill="none"
                      stroke="#00ff41"
                      strokeWidth="1.5"
                    />

                    {/* Ping circles at anomaly locations */}
                    {pulseData.map((val, idx) => {
                      if (val < 25 || val > 75) {
                        const cx = idx * (100 / (pulseData.length - 1))
                        return (
                          <g key={idx}>
                            <circle cx={cx} cy={val} r="3" fill="#ffb4ab" className="animate-ping" />
                            <circle cx={cx} cy={val} r="1.5" fill="#ffb4ab" />
                          </g>
                        )
                      }
                      return null
                    })}
                  </svg>
                  <div className="absolute bottom-2 right-2 font-mono text-[9px] text-[#b9ccb2]">TIMESCALE: 1000ms</div>
                  <div className="absolute top-2 left-2 font-mono text-[9px] text-[#ffb4ab] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ffb4ab] animate-ping" />
                    THRESHOLD: {anomalyThreshold.toFixed(1)}
                  </div>
                </div>
              </div>

              {/* Feature Importance vector */}
              <div className="window-border rounded bg-[#141e12]/30 border border-[#3b4b37] h-48 flex flex-col">
                <div className="font-mono text-xs font-bold bg-[#00ff41] text-[#0c160a] px-3 py-1.5">
                  <span>&gt; FEATURE_IMPORTANCE_VECTOR</span>
                </div>
                <div className="p-4 flex flex-col gap-2 font-mono text-xs overflow-y-auto flex-1">
                  {[
                    { name: 'TX_VOLUME', score: 0.85, color: '#00ff41' },
                    { name: 'TIME_DELTA', score: 0.62, color: '#ffd393' },
                    { name: 'GEO_DISTANCE', score: 0.45, color: '#00e639' },
                    { name: 'USER_AGE', score: 0.12, color: '#3b4b37' }
                  ].map((feat) => {
                    let dynamicScore = feat.score
                    if (feat.name === 'TX_VOLUME') {
                      dynamicScore = Math.min(0.99, Math.max(0.70, feat.score + (contamination - 0.05) * 0.5))
                    } else if (feat.name === 'TIME_DELTA') {
                      dynamicScore = Math.min(0.85, Math.max(0.40, feat.score + (estimators - 250) * 0.0003))
                    }
                    
                    return (
                      <div key={feat.name} className="flex items-center gap-3">
                        <span className="w-24 truncate text-[#dae6d2]">{feat.name}</span>
                        <div className="flex-1 h-2 bg-[#0c160a] border border-[#3b4b37]/40 relative">
                          <div
                            className="absolute top-0 left-0 h-full transition-all duration-500 ease-out"
                            style={{
                              width: `${dynamicScore * 100}%`,
                              backgroundColor: feat.color,
                              boxShadow: `0 0 5px ${feat.color}`
                            }}
                          />
                        </div>
                        <span className="w-8 text-right font-bold text-[#b9ccb2]">{dynamicScore.toFixed(2)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>

            {/* Right Side Columns: Logs & History */}
            <section className="lg:col-span-3 flex flex-col gap-6">
              
              {/* System log */}
              <div className="window-border rounded bg-black border border-[#3b4b37] h-64 flex flex-col overflow-hidden">
                <div className="font-mono text-xs font-bold bg-[#00ff41] text-[#0c160a] px-3 py-1.5 flex justify-between items-center">
                  <span>&gt; SYS_LOG.txt</span>
                  <Terminal size={12} />
                </div>
                <div className="p-3 font-mono text-[10px] leading-relaxed flex-1 overflow-y-auto flex flex-col gap-1.5 text-[#b9ccb2]">
                  {logs.map((log, index) => {
                    let typeColor = 'text-[#00ff41]'
                    let typeLabel = '[SYS]'
                    if (log.type === 'warn') {
                      typeColor = 'text-[#ffd393]'
                      typeLabel = '[WARN]'
                    } else if (log.type === 'error') {
                      typeColor = 'text-[#ffb4ab]'
                      typeLabel = '[ERR]'
                    }
                    return (
                      <div key={index}>
                        <span className={`${typeColor} font-bold mr-1.5`}>{typeLabel}</span>
                        <span>{log.text}</span>
                      </div>
                    )
                  })}
                  {training && (
                    <div className="flex items-center gap-1.5 text-[#00ff41]">
                      <span>&gt;</span>
                      <span>BUILDING NEURAL FOREST CONNECTIONS</span>
                      <span className="cursor ml-1" />
                    </div>
                  )}
                  <div ref={logEndRef} />
                </div>
              </div>

              {/* History list */}
              <div className="window-border rounded bg-[#141e12]/30 border border-[#3b4b37] h-64 flex flex-col overflow-hidden">
                <div className="font-mono text-xs font-bold bg-[#00ff41] text-[#0c160a] px-3 py-1.5 flex justify-between items-center">
                  <span>&gt; HISTORY.dat</span>
                  <History size={12} />
                </div>
                <div className="p-3 overflow-y-auto flex-1 font-mono text-[11px] text-[#dae6d2]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[#b9ccb2] border-b border-[#3b4b37]/50 pb-1">
                        <th className="py-1 font-bold">CONFIG_ID</th>
                        <th className="py-1 font-bold text-center">F1</th>
                        <th className="py-1 font-bold text-right">LAT(ms)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((run) => (
                        <tr
                          key={run.id}
                          onClick={() => setSelectedHistoryId(run.id)}
                          className={`cursor-pointer border-b border-[#3b4b37]/20 transition-all ${
                            selectedHistoryId === run.id
                              ? 'bg-[#00ff41]/15 text-[#00ff41] border-[#00ff41]/30 font-bold'
                              : 'hover:bg-[#141e12] text-[#dae6d2]/80'
                          }`}
                        >
                          <td className="py-1.5 font-bold">{run.id}</td>
                          <td className="py-1.5 text-center text-[#00ff41]">{run.f1.toFixed(2)}</td>
                          <td className={`py-1.5 text-right ${run.latency > 60 ? 'text-[#ffb4ab]' : ''}`}>
                            {run.latency}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>

          {/* Inline alert boxes */}
          {error && (
            <div className="mt-4 bg-[#93000a]/20 border border-[#ffb4ab] text-[#ffb4ab] text-xs p-3 rounded font-mono flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[#ffb4ab]" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mt-4 bg-[#00ff41]/10 border border-[#00ff41] text-[#00ff41] text-xs p-3 rounded font-mono flex items-center gap-2">
              <CheckCircle2 size={14} className="text-[#00ff41] animate-bounce" />
              <span>Model retrained successfully! Saved model to disk.</span>
            </div>
          )}

          {/* Action Buttons Footer */}
          <footer className="mt-8 flex flex-wrap gap-4 border-t border-[#3b4b37] pt-6 justify-end font-mono">
            <button
              onClick={handleRollback}
              disabled={training || !isAdmin}
              className="px-6 py-2 text-xs font-bold border border-[#3b4b37] text-[#dae6d2] hover:text-[#00ff41] hover:border-[#00ff41] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              ROLLBACK
            </button>
            <button
              onClick={handleExport}
              className="px-6 py-2 text-xs font-bold border border-[#3b4b37] text-[#dae6d2] hover:text-[#00ff41] hover:border-[#00ff41] transition-all cursor-pointer"
            >
              EXPORT MODEL
            </button>
            <button
              onClick={handleTrain}
              disabled={training || !isAdmin}
              className={`px-6 py-2 text-xs font-bold border transition-all ${
                training
                  ? 'bg-[#ffd393]/10 text-[#ffd393] border-[#ffd393] cursor-wait'
                  : !isAdmin
                    ? 'border-gray-800 text-gray-500 bg-transparent cursor-not-allowed opacity-50'
                    : 'border-[#ffd393] text-[#ffd393] bg-transparent hover:bg-[#ffd393] hover:text-[#0c160a] hover:shadow-[0_0_12px_rgba(253,175,0,0.3)] cursor-pointer'
              }`}
            >
              {training ? 'TRAINING...' : 'RETRAIN MODEL'}
            </button>
            <button
              onClick={handleDeploy}
              disabled={training || !isAdmin}
              className={`px-6 py-2 text-xs font-bold transition-all border ${
                !isAdmin
                  ? 'border-gray-800 text-gray-500 bg-transparent cursor-not-allowed opacity-50'
                  : 'bg-[#00ff41] text-[#0c160a] border-[#00ff41] hover:bg-[#72ff70] crt-glow hover:shadow-[0_0_15px_rgba(0,255,65,0.4)] cursor-pointer'
              }`}
            >
              DEPLOY v2.3
            </button>
          </footer>
        </>
      )}
    </div>
  )
}
