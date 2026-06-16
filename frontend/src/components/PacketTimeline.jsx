import { useEffect, useState } from 'react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { Activity, Clock, AlertTriangle, Shield, TrendingUp, RefreshCw, Layers } from 'lucide-react'
import { api } from '../api/client'

const API = window.location.protocol + '//' + window.location.hostname + ':8000'

const CustomDot = (props) => {
  const { cx, cy, payload } = props
  if (payload && payload.hasAlert) {
    return (
      <g>
        {/* Pulsing ring */}
        <circle cx={cx} cy={cy} r={8} fill="#ef4444" opacity={0.4} className="animate-ping" />
        {/* Solid red indicator */}
        <circle cx={cx} cy={cy} r={5} fill="#ef4444" stroke="#ffffff" strokeWidth={1} />
      </g>
    )
  }
  return null
}

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-[#071106]/95 border border-[#00ff41]/40 rounded p-3.5 shadow-[0_0_20px_rgba(0,255,65,0.25)] text-xs space-y-2 max-w-sm font-mono backdrop-blur-md">
        <div className="text-[#00ff41] font-bold border-b border-[#3b4b37] pb-1 flex justify-between">
          <span>[DIAGNOSTIC_DATAPOINT]</span>
          <span className="text-gray-500">FLOW_VAL</span>
        </div>
        <div className="text-gray-400 text-[10px]">
          TIME: {new Date(data.time).toLocaleString()}
        </div>
        <div className="flex justify-between gap-6 border-b border-[#3b4b37]/30 pb-1">
          <span className="text-gray-400">Packets Intake:</span>
          <span className="text-white font-bold">{data.packet_count.toLocaleString()}</span>
        </div>
        <div className="flex justify-between gap-6 border-b border-[#3b4b37]/30 pb-1">
          <span className="text-gray-400">Bandwidth Vol:</span>
          <span className="text-white font-bold">{(data.total_bytes / 1024).toFixed(2)} KB</span>
        </div>
        {data.hasAlert && (
          <div className="pt-1 space-y-1">
            <div className="text-red-400 font-bold flex items-center gap-1 text-[10px] uppercase tracking-wider">
              <AlertTriangle size={11} className="animate-pulse" /> Alerts Logged ({data.alertCount})
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
              {data.alerts.map((alert, idx) => (
                <div key={idx} className="bg-red-950/40 border border-red-900/30 rounded p-1.5 flex flex-col">
                  <span className="text-red-300 font-bold text-[10px]">{alert.rule_name}</span>
                  <span className="text-gray-500 text-[8px] uppercase tracking-wider">
                    SEV: {alert.severity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }
  return null
}

export default function PacketTimeline({ sessionId }) {
  const [rawTimeline, setRawTimeline] = useState([])
  const [alertMarkers, setAlertMarkers] = useState([])
  const [loading, setLoading] = useState(false)
  
  // Custom Controls
  const [interval, setInterval] = useState('1m')
  const [viewType, setViewType] = useState('packets') // 'packets' or 'bytes'

  const fetchTimeline = async () => {
    setLoading(true)
    try {
      const params = { interval }
      if (sessionId) params.session_id = sessionId
      
      const response = await api.get(`${API}/api/timeline`, { params })
      setRawTimeline(response.data.timeline || [])
      setAlertMarkers(response.data.alert_markers || [])
    } catch (err) {
      console.error('Failed to load timeline data', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTimeline()
  }, [sessionId, interval])

  // Align alert markers into chronological timeline buckets
  const alignedData = rawTimeline.map(bucket => {
    const bucketTime = new Date(bucket.time).getTime()
    
    // Compute bucket window based on interval
    let intervalMs = 60000
    if (interval === '5m') intervalMs = 300000
    if (interval === '1h') intervalMs = 3600000

    const alertsInBucket = alertMarkers.filter(alert => {
      const alertTime = new Date(alert.time).getTime()
      return alertTime >= bucketTime && alertTime < bucketTime + intervalMs
    })

    return {
      ...bucket,
      alerts: alertsInBucket,
      hasAlert: alertsInBucket.length > 0,
      alertCount: alertsInBucket.length,
      formattedTime: new Date(bucket.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  })

  // Summary Metrics
  const totalAlertsInView = alertMarkers.length
  const peakPackets = rawTimeline.length > 0 ? Math.max(...rawTimeline.map(t => t.packet_count)) : 0
  const peakBytes = rawTimeline.length > 0 ? Math.max(...rawTimeline.map(t => t.total_bytes)) : 0

  return (
    <div className="p-5 flex flex-col justify-between h-full bg-[#0c160a]/10">
      {/* Title & Controls Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#3b4b37] pb-3 mb-4 font-mono">
        <div>
          <h3 className="text-sm font-bold text-[#00ff41] flex items-center gap-2">
            <Activity size={16} className="text-[#00ff41] animate-pulse" />
            [PACKET_TRAFFIC_TIMELINE]
          </h3>
          <p className="text-[10px] text-gray-500 mt-0.5">
            {sessionId ? `TIMELINE FOR EVIDENCE_ID: ${sessionId.slice(0, 8)}...` : 'GLOBAL PACKET FLOW AND INTEL ALERTS TIMELINE'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Toggle Packets vs Bytes */}
          <div className="flex bg-[#071106]/60 p-1 border border-[#3b4b37]/35 rounded text-[10px] font-bold">
            <button
              onClick={() => setViewType('packets')}
              className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                viewType === 'packets' 
                  ? 'bg-[#00ff41]/10 text-[#00ff41] border border-[#00ff41]/30' 
                  : 'text-gray-500 hover:text-[#00ff41]'
              }`}
            >
              PACKETS
            </button>
            <button
              onClick={() => setViewType('bytes')}
              className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                viewType === 'bytes' 
                  ? 'bg-[#00ff41]/10 text-[#00ff41] border border-[#00ff41]/30' 
                  : 'text-gray-500 hover:text-[#00ff41]'
              }`}
            >
              BYTES
            </button>
          </div>

          {/* Time intervals selector */}
          <div className="flex bg-[#071106]/60 p-1 border border-[#3b4b37]/35 rounded text-[10px] font-bold">
            {['1m', '5m', '1h'].map(i => (
              <button
                key={i}
                onClick={() => setInterval(i)}
                className={`px-2.5 py-1.5 rounded transition-all cursor-pointer ${
                  interval === i 
                    ? 'bg-[#00ff41]/10 text-[#00ff41] border border-[#00ff41]/30' 
                    : 'text-gray-500 hover:text-[#00ff41]'
                }`}
              >
                {i.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-[#071106]/10 border border-[#3b4b37]/35 rounded p-3.5 text-[10px] font-mono mb-4">
        <div className="space-y-0.5">
          <span className="text-gray-500 block uppercase tracking-wider">Timeline Period</span>
          <span className="text-[#00ff41] font-bold flex items-center gap-1.5">
            <Clock size={12} className="text-[#00ff41]" />
            Every {interval === '1m' ? '1 Minute' : interval === '5m' ? '5 Minutes' : '1 Hour'}
          </span>
        </div>
        <div className="space-y-0.5">
          <span className="text-gray-500 block uppercase tracking-wider">Overlayed Alerts</span>
          <span className={`font-bold flex items-center gap-1.5 ${totalAlertsInView > 0 ? 'text-[#ff0040]' : 'text-white'}`}>
            <AlertTriangle size={12} className={totalAlertsInView > 0 ? 'animate-pulse' : ''} />
            {totalAlertsInView} Events
          </span>
        </div>
        <div className="space-y-0.5">
          <span className="text-gray-500 block uppercase tracking-wider">Peak Packet Flow</span>
          <span className="text-yellow-500 font-bold flex items-center gap-1.5">
            <TrendingUp size={12} className="text-yellow-500" />
            {peakPackets.toLocaleString()} pkts
          </span>
        </div>
        <div className="space-y-0.5">
          <span className="text-gray-500 block uppercase tracking-wider">Peak Bandwidth</span>
          <span className="text-[#00ff41] font-bold flex items-center gap-1.5">
            <Layers size={12} className="text-[#00ff41]" />
            {(peakBytes / 1024).toFixed(1)} KB
          </span>
        </div>
      </div>

      {/* The Recharts Area Chart */}
      <div className="h-64 w-full relative">
        {loading && alignedData.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0c160a]/60 z-10 rounded">
            <RefreshCw size={24} className="animate-spin text-[#00ff41]" />
          </div>
        ) : alignedData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={alignedData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={viewType === 'packets' ? '#00ff41' : '#ffd393'} stopOpacity={0.25}/>
                  <stop offset="95%" stopColor={viewType === 'packets' ? '#00ff41' : '#ffd393'} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 255, 65, 0.05)" />
              <XAxis 
                dataKey="formattedTime" 
                stroke="rgba(0, 255, 65, 0.3)" 
                fontSize={9}
                fontFamily="monospace"
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="rgba(0, 255, 65, 0.3)" 
                fontSize={9}
                fontFamily="monospace"
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => viewType === 'bytes' ? `${(v/1024).toFixed(0)}K` : v}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey={viewType === 'packets' ? 'packet_count' : 'total_bytes'} 
                stroke={viewType === 'packets' ? '#00ff41' : '#ffd393'} 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorValue)" 
                dot={<CustomDot />}
                activeDot={{ r: 5, fill: '#00ff41', strokeWidth: 1.5, stroke: '#0c160a' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center border border-dashed border-[#3b4b37] rounded bg-[#071106]/20 text-center p-6 space-y-2 font-mono">
            <Shield size={32} className="text-[#3b4b37]" />
            <p className="text-xs font-bold text-[#00ff41]">[NO_TRAFFIC_LOGGED]</p>
            <p className="text-[10px] text-gray-500 max-w-xs">
              No packet index telemetry matches the query timeline bounds in Elasticsearch index.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
