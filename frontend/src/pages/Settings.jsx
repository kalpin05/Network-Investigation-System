import React, { useState, useEffect } from 'react'

export default function Settings() {
  const [config, setConfig] = useState({
    is_enabled: false,
    destination_url: '',
    destination_type: 'webhook'
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/settings/siem', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
      if (res.ok) {
        const data = await res.json()
        setConfig(data)
      }
    } catch (err) {
      console.error("Failed to fetch SIEM config", err)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      const res = await fetch('http://localhost:8000/api/settings/siem', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(config)
      })
      if (res.ok) {
        setMessage('SIEM Configuration saved successfully!')
      } else {
        setMessage('Failed to save configuration.')
      }
    } catch (err) {
      console.error("Failed to save SIEM config", err)
      setMessage('Error saving configuration.')
    }
    setLoading(false)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white mb-6">System Settings</h1>
      
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-slate-700 bg-slate-800/50">
          <h2 className="text-lg font-semibold text-white">SIEM Integration & Alert Forwarding</h2>
          <p className="text-slate-400 text-sm mt-1">Configure automated forwarding of security alerts to an external SIEM system.</p>
        </div>
        
        <form onSubmit={handleSave} className="p-6 space-y-6">
          {message && (
            <div className={`p-4 rounded-lg text-sm ${message.includes('successfully') ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-red-500/20 text-red-400 border border-red-500/50'}`}>
              {message}
            </div>
          )}

          <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700">
            <div>
              <h3 className="text-white font-medium">Enable Alert Forwarding</h3>
              <p className="text-slate-400 text-sm">Send high-fidelity alerts to Splunk, QRadar, or Webhooks instantly.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer"
                checked={config.is_enabled}
                onChange={(e) => setConfig({...config, is_enabled: e.target.checked})}
              />
              <div className="w-14 h-7 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-500"></div>
            </label>
          </div>

          <div className={`space-y-4 transition-opacity ${config.is_enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Integration Type</label>
              <select 
                value={config.destination_type}
                onChange={(e) => setConfig({...config, destination_type: e.target.value})}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="webhook">REST Webhook (JSON)</option>
                <option value="syslog">Syslog Server (UDP/CEF)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                {config.destination_type === 'syslog' ? 'Syslog Server Address (IP:Port)' : 'Webhook URL'}
              </label>
              <input 
                type="text" 
                value={config.destination_url}
                onChange={(e) => setConfig({...config, destination_url: e.target.value})}
                placeholder={config.destination_type === 'syslog' ? '192.168.1.100:514' : 'https://webhook.site/your-id'}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono"
              />
              <p className="text-slate-500 text-xs mt-2">
                {config.destination_type === 'syslog' 
                  ? 'Format: CEF:0|KanadCyber|KanadShield|1.0|...' 
                  : 'JSON Payload containing session details and alert metadata.'}
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-700">
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-lg transition-colors flex items-center gap-2"
            >
              {loading ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
