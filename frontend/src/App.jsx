import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import FlowGraph from './pages/FlowGraph'
import Alerts from './pages/Alerts'
import Cases from './pages/Cases'
import MLTraining from './pages/MLTraining'
import Login from './pages/Login'

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
            <Route path="/ml" element={<MLTraining />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

