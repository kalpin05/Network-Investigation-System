import { useState } from 'react'
import { Shield } from 'lucide-react'
import axios from 'axios'

const API = window.location.protocol + '//' + window.location.hostname + ':8000'

export default function Login({ onLogin }) {
  const [creds, setCreds] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    try {
      const r = await axios.post(`${API}/api/auth/login`, creds)
      localStorage.setItem('token', r.data.access_token)
      localStorage.setItem('role', r.data.role)
      localStorage.setItem('username', r.data.username)
      onLogin(r.data)
    } catch (err) {
      setError('Invalid credentials. Try: admin / investigator / viewer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Shield className="text-blue-400" size={48} />
          </div>
          <h1 className="text-3xl font-bold text-blue-400 tracking-wide">KanadShield</h1>
          <p className="text-gray-400 text-sm mt-2">Network Forensics Platform</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Username</label>
            <input
              value={creds.username}
              onChange={e => setCreds(p => ({ ...p, username: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="admin"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input
              type="password"
              value={creds.password}
              onChange={e => setCreds(p => ({ ...p, password: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="••••••••"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium text-sm transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-xs text-gray-500 space-y-1">
          <p className="text-gray-400 font-medium mb-2">Demo Accounts</p>
          <p>admin → full access (upload, export, manage)</p>
          <p>investigator → cases + export</p>
          <p>viewer → dashboard + alerts only</p>
        </div>
      </div>
    </div>
  )
}
