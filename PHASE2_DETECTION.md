# KanadShield — Phase 2: Detection Engine
**Days 4–6 | June 13–15 | Goal: Threats detected, alerts firing, AI model integrated**

---

## Deliverable at End of Phase 2
> Upload `malicious_traffic.pcap` → 3+ alerts fire automatically (DNS_TUNNEL, PORT_SCAN, MALWARE_PORT) → alert panel in UI shows severity badges → AI anomaly score attached to session.

---

## Prerequisites
- Phase 1 fully complete
- `POST /api/pcap/upload` working and writing to Elasticsearch + PostgreSQL
- React Dashboard showing sessions table

---

## Day 4 — Signature Engine + Basic Rules

### backend/detection/rules.yaml

```yaml
rules:
  - name: MALWARE_PORT
    description: "Connection to known malware/C2 port"
    severity: high
    condition: dst_port
    ports: [4444, 31337, 6667, 1080, 9001, 8080, 4899]
    message: "Traffic to known malware port {dst_port} from {src_ip} to {dst_ip}"

  - name: CLEARTEXT_CREDENTIALS
    description: "HTTP POST to login/auth endpoint (no TLS)"
    severity: medium
    condition: http_post_login
    message: "Cleartext credential submission detected from {src_ip}"

  - name: SUSPICIOUS_OUTBOUND
    description: "Connection to non-standard high port outbound"
    severity: low
    condition: high_port_outbound
    port_range: [1024, 65535]
    message: "Suspicious outbound connection to port {dst_port}"
```

---

### backend/detection/signatures.py

```python
import yaml
import os
from typing import Optional

def load_rules() -> list[dict]:
    rules_path = os.path.join(os.path.dirname(__file__), "rules.yaml")
    with open(rules_path) as f:
        return yaml.safe_load(f)["rules"]

MALWARE_PORTS = {4444, 31337, 6667, 1080, 9001, 8080, 4899}

def check_packet_rules(packet: dict) -> Optional[dict]:
    """
    Run signature rules against a single packet.
    Returns alert dict or None.
    """
    dst_port = packet.get("dst_port", 0)
    src_ip = packet.get("src_ip", "")
    dst_ip = packet.get("dst_ip", "")

    # Rule: Known malware port
    if dst_port in MALWARE_PORTS:
        return {
            "rule_name": "MALWARE_PORT",
            "severity": "high",
            "src_ip": src_ip,
            "dst_ip": dst_ip,
            "description": f"Connection to known malware/C2 port {dst_port} from {src_ip} → {dst_ip}",
        }

    return None


def check_session_rules(packets: list[dict]) -> list[dict]:
    """
    Run session-level rules against all packets in a session.
    Returns list of alert dicts.
    """
    alerts = []

    # Rule: Port scan — >20 unique dst_ports from same src_ip in session
    from collections import defaultdict
    src_ports = defaultdict(set)
    for p in packets:
        src_ip = p.get("src_ip", "")
        dst_port = p.get("dst_port", 0)
        if dst_port > 0:
            src_ports[src_ip].add(dst_port)

    for src_ip, ports in src_ports.items():
        if len(ports) > 20:
            alerts.append({
                "rule_name": "PORT_SCAN",
                "severity": "high",
                "src_ip": src_ip,
                "dst_ip": "multiple",
                "description": f"Port scan detected: {src_ip} touched {len(ports)} unique ports. Ports: {sorted(ports)[:10]}...",
            })

    # Rule: SYN flood — check for high SYN packet ratio
    syn_count = sum(1 for p in packets if "0x002" in p.get("flags", "") or "SYN" in p.get("flags", "").upper())
    ack_count = sum(1 for p in packets if "ACK" in p.get("flags", "").upper())
    if syn_count > 200 and ack_count > 0 and (syn_count / max(ack_count, 1)) > 5:
        alerts.append({
            "rule_name": "SYN_FLOOD",
            "severity": "critical",
            "src_ip": "multiple",
            "dst_ip": "multiple",
            "description": f"Possible SYN flood: {syn_count} SYN packets vs {ack_count} ACK packets (ratio {syn_count/max(ack_count,1):.1f}:1)",
        })

    # Rule: Large data exfiltration — total outbound bytes
    outbound_bytes = sum(p.get("packet_length", 0) for p in packets if p.get("dst_port", 0) not in [80, 443])
    if outbound_bytes > 10_000_000:  # 10MB
        alerts.append({
            "rule_name": "DATA_EXFILTRATION",
            "severity": "critical",
            "src_ip": "internal",
            "dst_ip": "external",
            "description": f"Potential data exfiltration: {outbound_bytes / 1_000_000:.1f}MB sent to non-web ports",
        })

    return alerts
```

---

### backend/detection/dns_tunnel.py

```python
import math
from typing import Optional

def shannon_entropy(s: str) -> float:
    if not s:
        return 0.0
    freq = {}
    for c in s.lower():
        freq[c] = freq.get(c, 0) + 1
    probs = [f / len(s) for f in freq.values()]
    return -sum(p * math.log2(p) for p in probs if p > 0)

def detect_dns_tunnel(packet: dict) -> Optional[dict]:
    dns_query = packet.get("dns_query", "")
    if not dns_query:
        return None

    # Get the leftmost label (the encoded part in DNS tunnels)
    parts = dns_query.split(".")
    subdomain = parts[0] if parts else ""

    entropy = shannon_entropy(subdomain)
    length = len(subdomain)

    # High entropy + long subdomain = encoded data (Iodine, dnscat2, etc.)
    if length > 40 and entropy > 3.5:
        return {
            "rule_name": "DNS_TUNNEL",
            "severity": "critical",
            "src_ip": packet.get("src_ip", ""),
            "dst_ip": packet.get("dst_ip", ""),
            "description": (
                f"DNS tunnelling suspected: query '{dns_query[:80]}' "
                f"has subdomain length {length} and entropy {entropy:.2f} bits/char. "
                f"Tools: Iodine, dnscat2, dns2tcp."
            ),
        }

    # Also flag unusually frequent DNS to one domain (beaconing)
    return None


def detect_icmp_covert(packet: dict) -> Optional[dict]:
    """
    Standard ICMP echo has no payload beyond 8-byte header.
    Extra payload = data hidden in ICMP (ptunnel, ICMPShell).
    """
    if packet.get("protocol") != "ICMP":
        return None

    pkt_len = packet.get("packet_length", 0)
    # IP header (20) + ICMP header (8) = 28 bytes minimum
    # Anything significantly more = payload
    if pkt_len > 100:
        return {
            "rule_name": "ICMP_COVERT_CHANNEL",
            "severity": "medium",
            "src_ip": packet.get("src_ip", ""),
            "dst_ip": packet.get("dst_ip", ""),
            "description": (
                f"ICMP covert channel suspected: packet length {pkt_len} bytes "
                f"(standard ICMP echo ≤ 28 bytes). Tools: ptunnel, ICMPShell."
            ),
        }
    return None
```

---

### backend/detection/port_scan.py

```python
from collections import defaultdict
from typing import Optional
import time

# In-memory state for live capture detection
_scan_tracker: dict[str, dict] = {}  # src_ip -> {ports: set, first_seen: float}

SCAN_WINDOW_SECONDS = 10
SCAN_THRESHOLD_PORTS = 20

def update_live_tracker(packet: dict) -> Optional[dict]:
    """
    Track port scan attempts in real-time during live capture.
    Resets window every SCAN_WINDOW_SECONDS.
    """
    src_ip = packet.get("src_ip", "")
    dst_port = packet.get("dst_port", 0)
    if not src_ip or dst_port == 0:
        return None

    now = time.time()
    if src_ip not in _scan_tracker:
        _scan_tracker[src_ip] = {"ports": set(), "first_seen": now}

    tracker = _scan_tracker[src_ip]

    # Reset window if expired
    if now - tracker["first_seen"] > SCAN_WINDOW_SECONDS:
        tracker["ports"] = set()
        tracker["first_seen"] = now

    tracker["ports"].add(dst_port)

    if len(tracker["ports"]) > SCAN_THRESHOLD_PORTS:
        alert = {
            "rule_name": "PORT_SCAN_LIVE",
            "severity": "high",
            "src_ip": src_ip,
            "dst_ip": packet.get("dst_ip", ""),
            "description": (
                f"Live port scan: {src_ip} hit {len(tracker['ports'])} unique ports "
                f"in {SCAN_WINDOW_SECONDS}s window."
            ),
        }
        # Reset to avoid flooding
        tracker["ports"] = set()
        return alert

    return None
```

---

## Day 5 — Wire Detection into Upload Pipeline

Update `backend/routers/pcap.py` to run all detectors after parsing:

```python
# Add to existing pcap.py — update upload_pcap function
# After: packets = parse_pcap(filepath, session_id)

from detection.signatures import check_packet_rules, check_session_rules
from detection.dns_tunnel import detect_dns_tunnel, detect_icmp_covert

async def run_detection_and_store(packets: list[dict], session_id: str, pool):
    """Run all detectors and store alerts to PostgreSQL."""
    alerts = []

    # Per-packet rules
    for pkt in packets:
        for detector in [check_packet_rules, detect_dns_tunnel, detect_icmp_covert]:
            result = detector(pkt)
            if result:
                result["session_id"] = session_id
                alerts.append(result)
                break  # one alert per packet max

    # Session-level rules
    session_alerts = check_session_rules(packets)
    for a in session_alerts:
        a["session_id"] = session_id
        alerts.append(a)

    # Deduplicate by rule_name (keep first occurrence)
    seen = set()
    unique_alerts = []
    for a in alerts:
        key = (a["rule_name"], a.get("src_ip"))
        if key not in seen:
            seen.add(key)
            unique_alerts.append(a)

    # Write to PostgreSQL
    async with pool.acquire() as conn:
        for alert in unique_alerts:
            await conn.execute("""
                INSERT INTO alerts (session_id, rule_name, severity, src_ip, dst_ip, description)
                VALUES ($1, $2, $3, $4, $5, $6)
            """,
                alert["session_id"], alert["rule_name"], alert["severity"],
                alert.get("src_ip", ""), alert.get("dst_ip", ""), alert["description"]
            )

    return unique_alerts
```

### Updated upload endpoint (full replacement):

```python
@router.post("/api/pcap/upload")
async def upload_pcap(file: UploadFile = File(...)):
    data = await file.read()
    sha256 = hashlib.sha256(data).hexdigest()
    session_id = str(uuid.uuid4())

    os.makedirs(PCAP_STORAGE, exist_ok=True)
    filepath = os.path.join(PCAP_STORAGE, f"{session_id}.pcap")
    with open(filepath, "wb") as f:
        f.write(data)

    packets = parse_pcap(filepath, session_id)
    index_packets(packets)

    pool = await get_pool()

    # Run detection
    alerts = await run_detection_and_store(packets, session_id, pool)

    # Score with AI (Phase 2 Day 6 - add anomaly_score here)
    anomaly_score = None
    try:
        from ml.anomaly import score_session
        anomaly_score = score_session(packets)
        if anomaly_score is not None and anomaly_score < -0.2:
            async with pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO alerts (session_id, rule_name, severity, src_ip, dst_ip, description)
                    VALUES ($1, $2, $3, $4, $5, $6)
                """,
                    session_id, "AI_ANOMALY", "medium", "session-level", "session-level",
                    f"AI anomaly detected: Isolation Forest score {anomaly_score:.3f} (threshold -0.2)"
                )
            alerts.append({"rule_name": "AI_ANOMALY", "severity": "medium"})
    except Exception as e:
        print(f"[AI] Scoring skipped: {e}")

    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO sessions (session_id, filename, sha256_hash, packet_count, anomaly_score, status) VALUES ($1, $2, $3, $4, $5, 'complete')",
            session_id, file.filename, sha256, len(packets), anomaly_score
        )

    return {
        "session_id": session_id,
        "sha256": sha256,
        "packet_count": len(packets),
        "alert_count": len(alerts),
        "alerts": alerts[:5],  # preview
        "filename": file.filename
    }
```

---

### backend/routers/alerts.py

```python
from fastapi import APIRouter, Query
from db.postgres import get_pool
from typing import Optional

router = APIRouter()

@router.get("/api/alerts")
async def list_alerts(
    severity: Optional[str] = None,
    rule_name: Optional[str] = None,
    session_id: Optional[str] = None,
    limit: int = Query(default=100, le=500)
):
    pool = await get_pool()
    query = "SELECT * FROM alerts WHERE 1=1"
    params = []

    if severity:
        params.append(severity)
        query += f" AND severity = ${len(params)}"
    if rule_name:
        params.append(rule_name)
        query += f" AND rule_name = ${len(params)}"
    if session_id:
        params.append(session_id)
        query += f" AND session_id = ${len(params)}"

    query += " ORDER BY fired_at DESC"
    params.append(limit)
    query += f" LIMIT ${len(params)}"

    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *params)

    return [dict(r) for r in rows]

@router.get("/api/dashboard")
async def dashboard_stats():
    pool = await get_pool()
    async with pool.acquire() as conn:
        total_sessions = await conn.fetchval("SELECT COUNT(*) FROM sessions")
        total_packets = await conn.fetchval("SELECT COALESCE(SUM(packet_count),0) FROM sessions")
        total_alerts = await conn.fetchval("SELECT COUNT(*) FROM alerts")
        critical_alerts = await conn.fetchval("SELECT COUNT(*) FROM alerts WHERE severity = 'critical'")
    return {
        "sessions": total_sessions,
        "packets": total_packets,
        "alerts": total_alerts,
        "critical": critical_alerts
    }
```

---

## Day 6 — AI Anomaly Detection Module

### backend/ml/anomaly.py

```python
from sklearn.ensemble import IsolationForest
import numpy as np
import joblib
import os
from typing import Optional

MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "isolation_forest.pkl")

def extract_features(packets: list[dict]) -> np.ndarray:
    """Extract 6 statistical features from a session's packets."""
    if not packets:
        return np.array([[0, 0, 0, 0, 0, 0]])

    sizes = [p.get("packet_length", 0) for p in packets]
    ports = set(p.get("dst_port", 0) for p in packets if p.get("dst_port", 0) > 0)
    entropies = [p.get("payload_entropy", 0.0) for p in packets]

    # Calculate inter-arrival time variance (beaconing indicator)
    timestamps = sorted([p.get("timestamp", "") for p in packets if p.get("timestamp")])
    iat_variance = 0.0
    if len(timestamps) > 2:
        from datetime import datetime
        times = []
        for t in timestamps[:50]:
            try:
                times.append(datetime.fromisoformat(t).timestamp())
            except Exception:
                pass
        if len(times) > 2:
            iats = [times[i+1] - times[i] for i in range(len(times)-1)]
            iat_variance = float(np.var(iats))

    features = np.array([[
        float(np.mean(sizes)),          # avg packet size
        float(np.std(sizes)),           # size variance
        float(len(packets)),            # session volume
        float(len(ports)),              # unique dst ports
        float(np.mean(entropies)),      # avg payload entropy
        iat_variance,                   # inter-arrival time variance
    ]])
    return features

def score_session(packets: list[dict]) -> Optional[float]:
    """Score a session. Returns anomaly score (more negative = more anomalous)."""
    if not os.path.exists(MODEL_PATH):
        print("[AI] No model found. Training on current session as baseline.")
        train_baseline([packets])
        return None  # Don't score what we just trained on

    model = joblib.load(MODEL_PATH)
    features = extract_features(packets)
    score = float(model.score_samples(features)[0])
    return score

def train_baseline(sessions: list[list[dict]]):
    """Train Isolation Forest on a list of sessions. Call with benign traffic."""
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    X = np.vstack([extract_features(s) for s in sessions if s])
    model = IsolationForest(
        n_estimators=100,
        contamination=0.05,
        random_state=42,
        max_samples='auto'
    )
    model.fit(X)
    joblib.dump(model, MODEL_PATH)
    print(f"[AI] Model trained on {len(sessions)} sessions, saved to {MODEL_PATH}")
    return model
```

### Train baseline script (run once with normal traffic):

```python
# backend/ml/train_baseline.py
# Run: python train_baseline.py
import sys
sys.path.insert(0, '..')

from routers.pcap import parse_pcap
from anomaly import train_baseline
import os

BENIGN_PCAP_DIR = "../../pcap_storage/benign"

def main():
    if not os.path.exists(BENIGN_PCAP_DIR):
        print("No benign PCAPs found. Using synthetic baseline.")
        # Generate synthetic normal traffic features
        import numpy as np
        from sklearn.ensemble import IsolationForest
        import joblib

        # Synthetic normal: small packets, low entropy, few ports
        X = np.random.normal(
            loc=[512, 100, 1000, 5, 2.0, 0.5],
            scale=[200, 50, 500, 3, 0.5, 0.2],
            size=(500, 6)
        )
        X = np.abs(X)  # no negative values

        model = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
        model.fit(X)

        os.makedirs("models", exist_ok=True)
        joblib.dump(model, "models/isolation_forest.pkl")
        print("Synthetic baseline model saved.")
        return

    sessions = []
    for f in os.listdir(BENIGN_PCAP_DIR):
        if f.endswith(".pcap"):
            packets = parse_pcap(os.path.join(BENIGN_PCAP_DIR, f), "baseline")
            if packets:
                sessions.append(packets)

    train_baseline(sessions)
    print(f"Trained on {len(sessions)} sessions.")

if __name__ == "__main__":
    main()
```

---

## frontend/src/pages/Alerts.jsx

```jsx
import { useEffect, useState } from 'react'
import { AlertTriangle, AlertCircle, Info, RefreshCw } from 'lucide-react'
import axios from 'axios'

const API = 'http://localhost:8000'

const SEVERITY_CONFIG = {
  critical: { color: 'red',    bg: 'bg-red-900/50',    text: 'text-red-300',    border: 'border-red-700',    icon: AlertCircle },
  high:     { color: 'orange', bg: 'bg-orange-900/50', text: 'text-orange-300', border: 'border-orange-700', icon: AlertTriangle },
  medium:   { color: 'yellow', bg: 'bg-yellow-900/50', text: 'text-yellow-300', border: 'border-yellow-700', icon: AlertTriangle },
  low:      { color: 'blue',   bg: 'bg-blue-900/50',   text: 'text-blue-300',   border: 'border-blue-700',   icon: Info },
}

export default function Alerts() {
  const [alerts, setAlerts] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    const params = filter !== 'all' ? { severity: filter } : {}
    const r = await axios.get(`${API}/api/alerts`, { params })
    setAlerts(r.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [filter])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Alerts</h1>
        <div className="flex gap-2 items-center">
          {['all', 'critical', 'high', 'medium', 'low'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded text-sm font-medium capitalize transition-colors
                ${filter === s ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >
              {s}
            </button>
          ))}
          <button onClick={load} className="p-2 bg-gray-800 rounded hover:bg-gray-700">
            <RefreshCw size={16} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {alerts.map(alert => {
          const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.low
          const Icon = cfg.icon
          return (
            <div key={alert.alert_id} className={`${cfg.bg} border ${cfg.border} rounded-xl p-4`}>
              <div className="flex items-start gap-3">
                <Icon size={20} className={`${cfg.text} mt-0.5 flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`font-mono font-bold text-sm ${cfg.text}`}>{alert.rule_name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium uppercase
                      ${cfg.text} border ${cfg.border}`}>
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-gray-300 text-sm">{alert.description}</p>
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    <span>SRC: <span className="text-gray-400 font-mono">{alert.src_ip}</span></span>
                    <span>DST: <span className="text-gray-400 font-mono">{alert.dst_ip}</span></span>
                    <span>{new Date(alert.fired_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        {alerts.length === 0 && !loading && (
          <div className="text-center py-16 text-gray-500">No alerts. Upload a malicious PCAP to test detection.</div>
        )}
      </div>
    </div>
  )
}
```

---

## Malicious PCAP Generation Script (for demo)

If you don't have a real malicious PCAP, generate one with Scapy:

```python
# generate_malicious_pcap.py
# Run: python generate_malicious_pcap.py
from scapy.all import *
import random

packets = []

# Port scan: src 10.0.0.100 hitting many ports
for port in range(1, 200):
    pkt = IP(src="10.0.0.100", dst="192.168.1.1") / TCP(sport=54321, dport=port, flags="S")
    packets.append(pkt)

# Metasploit default port (4444)
for _ in range(5):
    pkt = IP(src="10.0.0.100", dst="203.0.113.10") / TCP(sport=54321, dport=4444, flags="S")
    packets.append(pkt)

# DNS tunnel: long high-entropy subdomain
import base64, os
for _ in range(10):
    encoded = base64.b64encode(os.urandom(40)).decode().replace("=","").replace("+","x").replace("/","y")
    pkt = IP(src="10.0.0.100", dst="8.8.8.8") / UDP(dport=53) / DNS(
        rd=1, qd=DNSQR(qname=f"{encoded}.evil-tunnel.com")
    )
    packets.append(pkt)

# ICMP with payload (covert channel)
for _ in range(5):
    payload = b"hidden data " * 10
    pkt = IP(src="10.0.0.100", dst="203.0.113.10") / ICMP() / Raw(load=payload)
    packets.append(pkt)

wrpcap("malicious_traffic.pcap", packets)
print(f"Generated malicious_traffic.pcap with {len(packets)} packets")
```

---

## Phase 2 Acceptance Criteria

- [ ] Upload `malicious_traffic.pcap` → at least 3 alert types fire
- [ ] `GET /api/alerts` returns alerts with correct `rule_name`, `severity`, `src_ip`, `dst_ip`
- [ ] `PORT_SCAN` alert fires when >20 unique ports detected
- [ ] `DNS_TUNNEL` alert fires for long high-entropy DNS queries
- [ ] `MALWARE_PORT` alert fires for connections to port 4444, 31337, 6667
- [ ] Alerts page in React shows colored severity badges
- [ ] AI model trains on first upload, scores subsequent uploads
- [ ] `anomaly_score` stored in sessions table
- [ ] `AI_ANOMALY` alert fires when score < -0.2
