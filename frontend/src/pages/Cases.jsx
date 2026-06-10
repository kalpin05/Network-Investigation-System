import { useEffect, useState } from 'react'
import { FolderOpen } from 'lucide-react'
import axios from 'axios'

const API = 'http://localhost:8000'

export default function Cases() {
  const [cases, setCases] = useState([])

  useEffect(() => {
    axios.get(`${API}/api/cases`).then(r => setCases(r.data)).catch(() => {})
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Security Cases</h1>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center text-gray-500">
        <div className="flex justify-center mb-4"><FolderOpen size={48} className="text-gray-600" /></div>
        <p className="text-lg font-medium text-gray-400 mb-1">No Active Cases</p>
        <p className="text-sm">Fired alerts can be grouped into investigation cases here.</p>
      </div>
    </div>
  )
}
