import { useEffect, useState } from 'react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { Activity, Clock, AlertTriangle, Shield, TrendingUp } from 'lucide-react'
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
        <circle cx={cx} cy={cy} r={5.5} fill="#ef4444" stroke="#ffffff" strokeWidth={1.5} />
      </g>
    )
  }
  return null
}

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-gray-950 border border-gray-800 rounded-xl p-3.5 shadow-2xl text-xs space-y-2 max-w-sm">
        <div className="text-gray-400 font-mono font-semibold">
          {new Date(data.time).toLocaleString()}
        </div>
        <div className="flex justify-between gap-6 border-b border-gray-900 pb-1.5">
          <span className="text-gray-400 font-medium">Packets Fired:</span>
          <span className="text-white font-bold font-mono">{data.packet_count.toLocaleString()}</span>
        </div>
        <div className="flex justify-between gap-6 border-b border-gray-900 pb-1.5">
          <span className="text-gray-400 font-medium">Bytes Transferred:</span>
          <span className="text-white font-bold font-mono">{(data.total_bytes / 1024).toFixed(2)} KB</span>
        </div>
        {data.hasAlert && (
          <div className="pt-1.5 space-y-1.5">
            <div className="text-red-400 font-bold flex items-center gap-1 text-[11px] uppercase tracking-wider">
              <AlertTriangle size={12} /> Alerts Flagged ({data.alertCount})
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {data.alerts.map((alert, idx) => (
                <div key={idx} className="bg-red-950/40 border border-red-900/30 rounded-lg p-2 flex flex-col gap-0.5">
                  <span className="text-red-300 font-bold text-[11px]">{alert.rule_name}</span>
                  <span className="text-gray-500 text-[9px] uppercase tracking-wider font-semibold">
                    Severity: {alert.severity}
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
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
      {/* Title & Controls Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <Activity size={16} className="text-blue-400" />
            Packet Traffic & Alert Timeline
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {sessionId ? `Timeline statistics for session ${sessionId.slice(0, 8)}` : 'Global packet intake volume and alert events timeline'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Toggle Packets vs Bytes */}
          <div className="flex bg-gray-950 p-1 border border-gray-800 rounded-lg text-xs">
            <button
              onClick={() => setViewType('packets')}
              className={`px-3 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                viewType === 'packets' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Packets
            </button>
            <button
              onClick={() => setViewType('bytes')}
              className={`px-3 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                viewType === 'bytes' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Bytes
            </button>
          </div>

          {/* Time intervals selector */}
          <div className="flex bg-gray-950 p-1 border border-gray-800 rounded-lg text-xs">
            {['1m', '5m', '1h'].map(i => (
              <button
                key={i}
                onClick={() => setInterval(i)}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer uppercase transition-colors ${
                  interval === i ? 'bg-gray-850 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {i}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-gray-950/60 border border-gray-800/80 rounded-xl p-3.5 text-xs">
        <div className="space-y-1">
          <span className="text-gray-500 block uppercase tracking-wider">Timeline Period</span>
          <span className="text-white font-semibold flex items-center gap-1">
            <Clock size={12} className="text-gray-400" />
            Every {interval === '1m' ? '1 Minute' : interval === '5m' ? '5 Minutes' : '1 Hour'}
          </span>
        </div>
        <div className="space-y-1">
          <span className="text-gray-500 block uppercase tracking-wider">Overlayed Alerts</span>
          <span className={`font-semibold flex items-center gap-1 ${totalAlertsInView > 0 ? 'text-red-400' : 'text-white'}`}>
            <AlertTriangle size={12} />
            {totalAlertsInView} Events
          </span>
        </div>
        <div className="space-y-1">
          <span className="text-gray-500 block uppercase tracking-wider">Peak Packet Flow</span>
          <span className="text-white font-semibold flex items-center gap-1">
            <TrendingUp size={12} className="text-blue-400" />
            {peakPackets.toLocaleString()} pkts
          </span>
        </div>
        <div className="space-y-1">
          <span className="text-gray-500 block uppercase tracking-wider">Peak Bandwidth</span>
          <span className="text-white font-semibold flex items-center gap-1">
            <TrendingUp size={12} className="text-green-400" />
            {(peakBytes / 1024).toFixed(1)} KB
          </span>
        </div>
      </div>

      {/* The Recharts Area Chart */}
      <div className="h-64 w-full relative">
        {loading && alignedData.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/60 z-10">
            <RefreshCw size={24} className="animate-spin text-blue-500" />
          </div>
        ) : alignedData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={alignedData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={viewType === 'packets' ? '#3b82f6' : '#10b981'} stopOpacity={0.25}/>
                  <stop offset="95%" stopColor={viewType === 'packets' ? '#3b82f6' : '#10b981'} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" opacity={0.5} />
              <XAxis 
                dataKey="formattedTime" 
                stroke="#9ca3af" 
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="#9ca3af" 
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => viewType === 'bytes' ? `${(v/1024).toFixed(0)}K` : v}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey={viewType === 'packets' ? 'packet_count' : 'total_bytes'} 
                stroke={viewType === 'packets' ? '#3b82f6' : '#10b981'} 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorValue)" 
                dot={<CustomDot />}
                activeDot={{ r: 6 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center border border-dashed border-gray-800 rounded-xl bg-gray-950/20 text-center p-6 space-y-2">
            <Shield size={32} className="text-gray-700" />
            <p className="text-sm font-medium text-gray-400">No Traffic Logged</p>
            <p className="text-xs text-gray-500 max-w-xs">
              There is currently no packet metadata index for this timeframe in Elasticsearch.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
