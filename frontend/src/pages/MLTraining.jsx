import { useState, useEffect } from 'react'
import { Brain, Settings, AlertTriangle, RefreshCw, CheckCircle2, ShieldAlert } from 'lucide-react'
import axios from 'axios'

const API = 'http://localhost:8000'

export default function MLTraining() {
  const [config, setConfig] = useState(null)
  const [contamination, setContamination] = useState(0.05)
  const [loading, setLoading] = useState(false)
  const [training, setTraining] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const loadStatus = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${API}/api/ml/status`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
      setConfig(res.data)
      setContamination(res.data.contamination || 0.05)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  const handleTrain = async () => {
    setTraining(true)
    setSuccess(false)
    setError('')
    try {
      await axios.post(`${API}/api/ml/train`, 
        { contamination: parseFloat(contamination) },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      )
      
      // Simulate training wait for UX
      setTimeout(() => {
        setTraining(false)
        setSuccess(true)
        loadStatus()
        setTimeout(() => setSuccess(false), 3000)
      }, 2500)
      
    } catch (err) {
      setError('Failed to trigger training. Are you an admin?')
      setTraining(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <Brain className="text-purple-500" size={32} />
        <div>
          <h1 className="text-2xl font-bold text-white">AI Anomaly Engine</h1>
          <p className="text-gray-400 text-sm">Manage and retrain the Isolation Forest machine learning model.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Status Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-6 border-b border-gray-800 pb-4">
            <ShieldAlert className="text-blue-400" size={20} />
            <h2 className="text-lg font-semibold text-white">Model Status</h2>
          </div>
          
          {loading ? (
            <div className="animate-pulse flex space-x-4">
              <div className="flex-1 space-y-4 py-1">
                <div className="h-4 bg-gray-800 rounded w-3/4"></div>
                <div className="h-4 bg-gray-800 rounded w-1/2"></div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Status</span>
                {config?.status === 'active' ? (
                  <span className="px-3 py-1 bg-green-900/40 text-green-400 border border-green-800 rounded-full text-xs font-bold flex items-center gap-1.5">
                    <CheckCircle2 size={14} /> ACTIVE
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-red-900/40 text-red-400 border border-red-800 rounded-full text-xs font-bold">
                    INACTIVE
                  </span>
                )}
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Current Contamination</span>
                <span className="text-white font-mono font-bold bg-gray-800 px-2 py-1 rounded">
                  {config?.contamination ? (config.contamination * 100).toFixed(1) + '%' : 'N/A'}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Last Trained</span>
                <span className="text-gray-300 text-sm">
                  {config?.last_trained ? new Date(config.last_trained).toLocaleString() : 'Never'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Retrain Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-6 border-b border-gray-800 pb-4">
            <Settings className="text-yellow-400" size={20} />
            <h2 className="text-lg font-semibold text-white">Retrain Parameters</h2>
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-gray-300 font-medium text-sm">Contamination Rate</label>
                <span className="text-purple-400 font-bold">{(contamination * 100).toFixed(1)}%</span>
              </div>
              <input 
                type="range" 
                min="0.01" 
                max="0.20" 
                step="0.01" 
                value={contamination} 
                onChange={(e) => setContamination(e.target.value)}
                className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                disabled={training}
              />
              <p className="text-gray-500 text-xs mt-2">
                The proportion of outliers in the data set. Higher = more sensitive to anomalies (more false positives).
              </p>
            </div>

            {error && (
              <div className="bg-red-950/40 border border-red-800 text-red-400 text-sm p-3 rounded flex items-start gap-2">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="bg-green-950/40 border border-green-800 text-green-400 text-sm p-3 rounded flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>Model retrained successfully!</span>
              </div>
            )}

            <button
              onClick={handleTrain}
              disabled={training}
              className={`w-full py-3 rounded-lg font-bold text-white shadow-lg transition-all flex justify-center items-center gap-2 ${
                training 
                  ? 'bg-purple-600/50 cursor-not-allowed' 
                  : 'bg-purple-600 hover:bg-purple-700 hover:shadow-purple-500/20'
              }`}
            >
              {training ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Training Model...
                </>
              ) : (
                'Trigger Retrain'
              )}
            </button>
            
            {training && (
              <div className="w-full bg-gray-800 rounded-full h-1.5 mt-4 overflow-hidden">
                <div className="bg-purple-500 h-1.5 rounded-full animate-pulse" style={{ width: '100%', animationDuration: '1s' }}></div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
