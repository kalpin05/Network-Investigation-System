import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import FlowGraph from './pages/FlowGraph'
import Alerts from './pages/Alerts'
import Cases from './pages/Cases'
import MLTraining from './pages/MLTraining'
import Kibana from './pages/Kibana'
import Settings from './pages/Settings'
import CustodyLog from './pages/CustodyLog'
import Login from './pages/Login'
import axios from 'axios'
import AlertToast from './components/AlertToast'

export default function App() {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('token')
    const role = localStorage.getItem('role')
    const username = localStorage.getItem('username')
    return token ? { token, role, username } : null
  })

  const handleLogout = () => {
    localStorage.clear()
    setUser(null)
  }

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      response => response,
      error => {
        if (error.response && error.response.status === 401) {
          handleLogout()
        }
        return Promise.reject(error)
      }
    )
    return () => axios.interceptors.response.eject(interceptor)
  }, [])

  if (!user) return <Login onLogin={setUser} />

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950 text-gray-100 font-sans">
        <Navbar user={user} onLogout={handleLogout} />
        <main className="max-w-7xl mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/graph" element={<FlowGraph />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/cases" element={<Cases />} />
            <Route path="/custody" element={<CustodyLog />} />
            <Route path="/kibana" element={<Kibana />} />
            <Route path="/ml" element={<MLTraining />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
        <AlertToast />
      </div>
    </BrowserRouter>
  )
}

