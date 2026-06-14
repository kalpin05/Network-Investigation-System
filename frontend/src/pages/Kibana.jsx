import { ExternalLink, AlertTriangle } from 'lucide-react'

export default function Kibana() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          Advanced Analytics (Kibana)
        </h1>
        <a 
          href="http://localhost:5601" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <ExternalLink size={16} /> Open in Full Tab
        </a>
      </div>

      <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-4 flex gap-3 text-yellow-200">
        <AlertTriangle size={20} className="flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold mb-1">First Time Setup Instructions:</p>
          <ul className="list-disc pl-4 space-y-1 text-yellow-300/80">
            <li>Kibana may take 2-3 minutes to start up. If it says "Kibana server is not ready", just wait and refresh.</li>
            <li>Once loaded, go to <strong>Stack Management &rarr; Data Views</strong>.</li>
            <li>Click <strong>Create data view</strong>.</li>
            <li>Name it <code>Packets</code> and set the Index pattern to <code>kanadshield_packets*</code>.</li>
            <li>Select <code>timestamp</code> or <code>@timestamp</code> as the Time field, and save.</li>
            <li>You can now explore all network traffic in the <strong>Discover</strong> and <strong>Dashboard</strong> tabs!</li>
          </ul>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl h-[800px] flex flex-col">
        {/* We use an iframe to load kibana. Fallback if iframe is blocked by X-Frame-Options */}
        <iframe 
          src="http://localhost:5601" 
          title="Kibana Dashboard"
          className="w-full h-full border-0 bg-white"
        />
      </div>
    </div>
  )
}
