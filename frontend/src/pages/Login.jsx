import { useState, useEffect } from 'react'
import { Terminal, X, AlertTriangle, User, Key, ShieldAlert, ChevronDown, LogIn, Cpu } from 'lucide-react'
import axios from 'axios'

const API = window.location.protocol + '//' + window.location.hostname + ':8000'

const styleSheet = `
/* CRT Scanline Effect */
.scanlines {
    position: fixed;
    top: 0; left: 0;
    width: 100vw; height: 100vh;
    background: linear-gradient(
        to bottom,
        rgba(255, 255, 255, 0),
        rgba(255, 255, 255, 0) 50%,
        rgba(0, 0, 0, 0.2) 50%,
        rgba(0, 0, 0, 0.2)
    );
    background-size: 100% 4px;
    pointer-events: none;
    z-index: 9999;
}

/* Hexadecimal Background Pattern */
.hex-bg {
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    opacity: 0.05;
    background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Ctext x='10' y='20' fill='%2300e639' font-family='monospace' font-size='10'%3E0A%3C/text%3E%3Ctext x='40' y='20' fill='%2300e639' font-family='monospace' font-size='10'%3E1B%3C/text%3E%3Ctext x='25' y='40' fill='%2300e639' font-family='monospace' font-size='10'%3EF3%3C/text%3E%3Ctext x='10' y='60' fill='%2300e639' font-family='monospace' font-size='10'%3E7C%3C/text%3E%3Ctext x='40' y='60' fill='%2300e639' font-family='monospace' font-size='10'%3E9D%3C/text%3E%3C/svg%3E");
    pointer-events: none;
    z-index: -1;
}

/* Glitch Animation for Authenticate Button */
@keyframes glitch {
    0% { transform: translate(0) }
    20% { transform: translate(-2px, 1px) }
    40% { transform: translate(-1px, -1px) }
    60% { transform: translate(2px, 1px) }
    80% { transform: translate(1px, -1px) }
    100% { transform: translate(0) }
}
.glitch-hover:hover {
    animation: glitch 0.2s cubic-bezier(.25, .46, .45, .94) both infinite;
    color: #071106 !important;
    text-shadow: 2px 0 red, -2px 0 cyan;
}

/* Blinking Cursor */
.cursor-blink {
    animation: blink 1s step-end infinite;
}
@keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
}

/* Terminal Window Border Glow */
.terminal-window {
    box-shadow: 0 0 25px rgba(0, 230, 57, 0.15), inset 0 0 10px rgba(0, 230, 57, 0.05);
    border: 1px solid #00e639;
    background-color: #141414;
}

/* Input fields */
.terminal-input {
    background-color: transparent;
    border: 1px solid rgba(0, 230, 57, 0.3);
    color: #00e639;
    transition: all 0.3s ease;
}
.terminal-input:focus {
    outline: none;
    border-color: #00e639;
    box-shadow: 0 0 10px rgba(0, 230, 57, 0.4);
    background-color: rgba(0, 230, 57, 0.03);
}

/* Select dropdown */
.terminal-select {
    appearance: none;
    background-color: transparent;
    border: 1px solid rgba(0, 230, 57, 0.3);
    color: #00e639;
    cursor: pointer;
}
.terminal-select:focus {
     outline: none;
     border-color: #00e639;
     box-shadow: 0 0 10px rgba(0, 230, 57, 0.4);
}
.terminal-select option {
    background-color: #141414;
    color: #00e639;
}
`;

export default function Login({ onLogin }) {
  const [creds, setCreds] = useState({ username: '', password: '' })
  const [role, setRole] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [timestamp, setTimestamp] = useState('')

  // Update dynamic timestamp
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const timeString = now.toISOString().replace('T', ' ').substring(0, 19);
      setTimestamp(`[${timeString}]`);
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // Preset demo account username/passcode on clearance selector change
  const handleClearanceChange = (e) => {
    const selectedRole = e.target.value;
    setRole(selectedRole);
    if (selectedRole) {
      setCreds({ username: selectedRole, password: 'demo123' });
    }
  }

  const handleLogin = async () => {
    if (!creds.username || !creds.password) {
      setError('Operative credentials cannot be empty.');
      return;
    }
    setLoading(true)
    setError('')
    try {
      const r = await axios.post(`${API}/api/auth/login`, creds)
      localStorage.setItem('token', r.data.access_token)
      localStorage.setItem('role', r.data.role)
      localStorage.setItem('username', r.data.username)
      onLogin(r.data)
    } catch (err) {
      console.error("Authentication failed:", err)
      setError('Authentication Rejected. Verification Failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#00e639] flex items-center justify-center p-4 sm:p-8 relative overflow-hidden font-mono selection:bg-[#00e639]/30 selection:text-white">
      <style dangerouslySetInnerHTML={{ __html: styleSheet }} />
      
      {/* Ambient Effects */}
      <div className="scanlines" />
      <div className="hex-bg" />
      <div className="fixed inset-0 pointer-events-none shadow-[inset_0_0_150px_rgba(0,0,0,0.95)] z-10" />

      {/* Main Container */}
      <div className="w-full max-w-lg relative z-20">
        
        {/* Top Status Indicators */}
        <div className="flex justify-between items-end mb-2 px-1 text-[#00e639]/60 text-xs uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <Cpu size={12} className="animate-pulse" />
            NODE_CONNECTION: ESTABLISHED
          </span>
          <span className="text-yellow-500 animate-pulse">
            ENC_KEY: REQ
          </span>
        </div>

        {/* Terminal Window */}
        <main className="terminal-window rounded-sm flex flex-col overflow-hidden">
          
          {/* Window Header */}
          <header className="border-b border-[#00e639]/40 bg-[#2d382a]/50 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal size={16} className="text-[#00e639]" />
              <h1 className="text-sm font-bold text-[#00e639] m-0 flex items-center gap-1.5">
                root@cyberspace_node 
                <span className="text-[#00e639]/70 text-xs">{timestamp}</span>
                <span className="cursor-blink bg-[#00e639] text-[#0c160a] px-1 font-bold">_</span>
              </h1>
            </div>
            
            {/* Emulated Window Chrome controls */}
            <div className="flex gap-1">
              <div className="w-3 h-3 border border-[#00e639]/50 flex items-center justify-center hover:bg-[#00e639]/20 cursor-pointer">
                <span className="block w-1.5 h-[1px] bg-[#00e639]" />
              </div>
              <div className="w-3 h-3 border border-[#00e639]/50 flex items-center justify-center hover:bg-[#00e639]/20 cursor-pointer">
                <span className="block w-1.5 h-1.5 border border-[#00e639]" />
              </div>
              <div className="w-3 h-3 border border-[#00e639]/50 flex items-center justify-center hover:bg-red-500/20 hover:border-red-500 cursor-pointer group">
                <X size={8} className="text-[#00e639] group-hover:text-red-500" />
              </div>
            </div>
          </header>

          {/* Window Content */}
          <div className="p-6 md:p-8 flex flex-col gap-6 relative">
            
            {/* System Warning Banner */}
            <div className="border border-red-500 text-red-500 bg-red-950/10 p-3.5 flex items-start gap-3 rounded-sm">
              <AlertTriangle className="mt-0.5 shrink-0" size={16} />
              <div>
                <p className="text-xs font-bold uppercase mb-1 tracking-wider">UNAUTHORIZED ACCESS PROHIBITED</p>
                <p className="text-[11px] text-red-400/80 m-0 leading-relaxed">
                  All activities are monitored and logged. Disconnect immediately if you are not an authorized operative.
                </p>
              </div>
            </div>

            {/* Login Form */}
            <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="flex flex-col gap-5">
              
              {/* Clearance Level Selector (prefetch credentials helper) */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase text-[#00e639]/80 flex items-center gap-1.5" htmlFor="role">
                  <ShieldAlert size={12} />
                  CLEARANCE_LEVEL
                </label>
                <div className="relative">
                  <select 
                    value={role}
                    onChange={handleClearanceChange}
                    className="terminal-select w-full pl-3 pr-10 py-2 text-xs rounded-sm focus:ring-0" 
                    id="role" 
                    name="role"
                  >
                    <option value="">[ SELECT OPERATIVE ACCESS LEVEL ]</option>
                    <option value="viewer">L1: VIEWER</option>
                    <option value="investigator">L2: INVESTIGATOR</option>
                    <option value="admin">L3: ADMINISTRATOR</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#00e639]" size={14} />
                </div>
              </div>

              {/* Username Input */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase text-[#00e639]/80 flex items-center gap-1.5" htmlFor="username">
                  <User size={12} />
                  OPERATIVE_ID
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-[#00e639]/80 text-xs font-bold">&gt;</span>
                  <input 
                    value={creds.username}
                    onChange={e => setCreds(p => ({ ...p, username: e.target.value }))}
                    className="terminal-input w-full pl-8 pr-4 py-2 text-xs rounded-sm focus:ring-0" 
                    id="username" 
                    name="username" 
                    placeholder="Enter ID..." 
                    type="text"
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase text-[#00e639]/80 flex items-center gap-1.5" htmlFor="password">
                  <Key size={12} />
                  PASSCODE
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-[#00e639]/80 text-xs font-bold">&gt;</span>
                  <input 
                    value={creds.password}
                    onChange={e => setCreds(p => ({ ...p, password: e.target.value }))}
                    className="terminal-input w-full pl-8 pr-4 py-2 text-xs rounded-sm focus:ring-0" 
                    id="password" 
                    name="password" 
                    placeholder="••••••••" 
                    type="password"
                  />
                </div>
              </div>

              {/* Error log output */}
              {error && (
                <p className="text-red-500 text-xs font-bold bg-red-950/20 border border-red-500/50 p-2 rounded-sm uppercase tracking-wide">
                  Error: {error}
                </p>
              )}

              {/* Submit Action */}
              <div className="mt-2 flex flex-col gap-3">
                <button 
                  disabled={loading}
                  className="w-full border border-[#00e639] text-[#00e639] bg-transparent py-3 uppercase text-sm font-bold tracking-widest hover:text-black hover:bg-[#00e639] transition-all duration-200 relative group overflow-hidden glitch-hover cursor-pointer" 
                  type="submit"
                >
                  <span className="relative z-10 flex justify-center items-center gap-2">
                    {loading ? 'AUTHENTICATING...' : 'AUTHENTICATE'}
                    <LogIn size={14} className="group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>
                <div className="text-center text-[10px] text-[#00e639]/50 uppercase tracking-wider">
                  {loading ? 'Establishing connection link...' : 'Awaiting credentials input...'}
                </div>
              </div>

            </form>
          </div>

          {/* Bottom Status Bar */}
          <footer className="border-t border-[#00e639]/40 bg-[#2d382a]/30 px-4 py-2 flex justify-between items-center text-xs uppercase text-[#00e639]/70">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00e639] shadow-[0_0_5px_#00e639] animate-pulse" />
              DATA_LINK: SECURE
            </div>
            <div className="flex gap-4">
              <span>SYS_LOAD: 12%</span>
              <span>MEM: OK</span>
            </div>
          </footer>

        </main>
      </div>
    </div>
  )
}
