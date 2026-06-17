import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { WS_BASE_URL } from '../config'

const SEVERITY_COLOR = {
  critical: 'border-red-500 bg-red-950/80 text-white',
  high:     'border-orange-500 bg-orange-950/80 text-white',
  medium:   'border-yellow-500 bg-yellow-950/80 text-white',
  low:      'border-blue-500 bg-blue-950/80 text-white',
}

export default function AlertToast() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    let ws
    let active = true
    let reconnectTimeout

    const connect = () => {
      if (!active) return
      const wsUrl = `${WS_BASE_URL}/ws/alerts`
      ws = new WebSocket(wsUrl)

      ws.onmessage = (e) => {
        try {
          const alert = JSON.parse(e.data)
          const id = Date.now()
          setToasts(prev => [...prev.slice(-4), { ...alert, id }]) // max 5 toasts
          // Auto-dismiss after 6 seconds
          setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 6000)
        } catch (err) {
          console.error("Failed to parse alert payload:", err)
        }
      }

      ws.onclose = () => {
        if (active) {
          console.log("WebSocket disconnected. Reconnecting in 3 seconds...")
          reconnectTimeout = setTimeout(connect, 3000)
        }
      }

      ws.onerror = (err) => {
        console.error("WebSocket error:", err)
        ws.close()
      }
    }

    connect()

    return () => {
      active = false
      if (ws) ws.close()
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
    }
  }, [])

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`border rounded-xl p-4 backdrop-blur-sm shadow-xl
            animate-slide-in ${SEVERITY_COLOR[toast.severity] || SEVERITY_COLOR.low}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-mono font-bold text-sm text-white">{toast.rule_name}</div>
                <div className="text-gray-300 text-xs mt-0.5 line-clamp-2">{toast.description}</div>
                {toast.mitre_id && (
                  <div className="text-gray-500 text-xs mt-1 font-mono">{toast.mitre_id}</div>
                )}
              </div>
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="text-gray-500 hover:text-white flex-shrink-0 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
