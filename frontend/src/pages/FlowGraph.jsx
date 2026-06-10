import { useEffect, useState } from 'react'
import ReactFlow, { Background, Controls } from 'reactflow'
import 'reactflow/dist/style.css'
import axios from 'axios'

const API = 'http://localhost:8000'

export default function FlowGraph() {
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])

  useEffect(() => {
    axios.get(`${API}/api/graph`).then(r => {
      const data = r.data
      // In Phase 1 we might get empty nodes/edges
      setNodes(data.nodes || [])
      setEdges(data.edges || [])
    }).catch(() => {})
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Network Flow Graph</h1>
      <div className="h-[600px] bg-gray-900 border border-gray-800 rounded-xl overflow-hidden relative">
        {nodes.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500">
            No network flow data available. Upload a PCAP first.
          </div>
        ) : (
          <ReactFlow nodes={nodes} edges={edges} fitView>
            <Background color="#333" gap={16} />
            <Controls />
          </ReactFlow>
        )}
      </div>
    </div>
  )
}
