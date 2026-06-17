import { useState, useEffect } from 'react'
import { X, Loader2, FileText, Download } from 'lucide-react'
import axios from 'axios'
import { API_BASE_URL as API } from '../config'

export default function StreamModal({ packet, sessionId, onClose }) {
  const [streamData, setStreamData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!packet || !sessionId) return
    let active = true
    Promise.resolve().then(() => {
      if (active) setLoading(true)
    })
    
    const params = {
      src_ip: packet.src_ip,
      src_port: packet.src_port,
      dst_ip: packet.dst_ip,
      dst_port: packet.dst_port
    }

    axios.get(`${API}/api/sessions/${sessionId}/stream`, { params })
      .then(r => {
        if (!active) return
        if (r.data.error) {
          setError(r.data.error)
        } else {
          setStreamData(r.data.stream || "No ascii stream payload found.")
        }
      })
      .catch(err => {
        if (active) setError(err.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [packet, sessionId])

  // Colorization simple heuristic: 
  // We can't perfectly colorize without knowing the exact bytes direction from tshark output if it's mixed,
  // but we can just display the raw ascii. 
  // For now, display as unified text.
  
  const downloadStream = () => {
    if (!streamData) return
    const blob = new Blob([streamData], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `tcp_stream_${packet.src_ip}_${packet.dst_ip}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 shadow-2xl rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-800/50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">TCP Stream Reassembly</h2>
              <p className="text-xs text-gray-400 font-mono mt-0.5">
                {packet.src_ip}:{packet.src_port} ↔ {packet.dst_ip}:{packet.dst_port}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={downloadStream}
              disabled={loading || error || !streamData}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={14} /> Download
            </button>
            <button 
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 bg-[#0d1117]">
          {loading && (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-3">
              <Loader2 className="animate-spin text-blue-500" size={32} />
              <p>Reassembling TCP stream using tshark...</p>
            </div>
          )}

          {error && (
            <div className="h-full flex flex-col items-center justify-center text-red-400 gap-2">
              <p className="font-bold">Error Reconstructing Stream</p>
              <p className="text-sm text-red-500/80 font-mono">{error}</p>
            </div>
          )}

          {!loading && !error && streamData && (
            <pre className="text-[13px] leading-relaxed text-gray-300 font-mono whitespace-pre-wrap word-break">
              {streamData}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}
