import { useEffect, useState } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '../config'

const STAGE_COLORS = {
  "Reconnaissance":                    { bg: "bg-purple-900/40", border: "border-purple-600", text: "text-purple-300" },
  "Initial Access / Weaponization":    { bg: "bg-red-900/40",    border: "border-red-600",    text: "text-red-300"    },
  "Command & Control":                  { bg: "bg-orange-900/40", border: "border-orange-600", text: "text-orange-300" },
  "Exfiltration":                       { bg: "bg-yellow-900/40", border: "border-yellow-600", text: "text-yellow-300" },
  "Impact":                             { bg: "bg-pink-900/40",   border: "border-pink-600",   text: "text-pink-300"   },
}

export function AttackChain({ caseId }) {
  const [chain, setChain] = useState([])

  useEffect(() => {
    if (!caseId) return
    axios.get(`${API_BASE_URL}/api/cases/${caseId}/attack-chain`)
      .then(r => setChain(r.data.chain))
      .catch(err => console.error("Failed to load attack chain:", err))
  }, [caseId])

  if (chain.length === 0) return null

  return (
    <div className="mt-6 border-t border-gray-800 pt-6">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">
        Attack Kill Chain Reconstruction (MITRE ATT&CK Tactic Order)
      </h3>
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-700" />

        <div className="space-y-3">
          {chain.map((step, i) => {
            const cfg = STAGE_COLORS[step.stage_label] || STAGE_COLORS["Command & Control"]
            return (
              <div key={step.alert_id} className="relative flex gap-4 pl-12">
                {/* Step circle */}
                <div className="absolute left-3 w-5 h-5 rounded-full bg-gray-900 border-2 border-gray-600
                  flex items-center justify-center text-xs text-gray-400 font-bold z-10">
                  {i + 1}
                </div>

                <div className={`flex-1 ${cfg.bg} border ${cfg.border} rounded-lg p-3`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold ${cfg.text} uppercase tracking-wide`}>
                      {step.stage_label}
                    </span>
                    <span className="text-gray-500 text-xs font-mono">{step.mitre_id}</span>
                  </div>
                  <div className="text-white text-sm font-mono font-bold">{step.rule_name}</div>
                  <div className="text-gray-400 text-xs mt-1 line-clamp-2">{step.description}</div>
                  <div className="text-gray-600 text-xs mt-2">
                    {step.src_ip} → {step.dst_ip} · {new Date(step.fired_at).toLocaleString()}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
