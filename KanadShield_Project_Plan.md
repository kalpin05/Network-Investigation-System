**KANADSHIELD**

**Network & Packet Forensics Platform**

*Hackathon Project Plan & Technical Blueprint*

**Submission Deadline: 20 June 2026**

Duration: 10 Days (10 June – 20 June 2026)

**Prepared by: Ro & Team**

B.Tech CSE (AI & ML) • Adani University, Ahmedabad

# **Scope: What to Build vs. What to Skip**

## **Build This (MVP — 10 Days)**

* Packet ingestion (PCAP upload + live capture)
* Deep packet inspection metadata extraction (protocol, ports, entropy)
* 6 detection rules (port scan, DNS tunnel, ICMP covert, SYN flood, malware ports, exfiltration)
* Isolation Forest AI anomaly detection
* React Flow network graph with suspicious node highlighting
* D3 timeline with alert overlays
* Case management (create, assign alerts, notes, status)
* Evidence export (PCAP + SHA-256 + PDF report)
* Chain of custody logging
* JWT auth with 3 roles (admin, investigator, viewer)
* Docker Compose single-command deploy
* Real-time live capture via WebSocket

## **Explicitly Skip This**

These are in the spec but NOT worth building in 10 days. Mention in docs as 'future work'.

* Integration with actual Cyber Crime Branch databases (no access, no time)
* Full session reconstruction (TCP stream reassembly) — too complex for 10 days
* HTTPS/TLS decryption — legally complex, technically hard
* Kafka streaming — Redis does the job for demo scale
* Multi-language report support (bonus, skip)
* Cloud deployment — Docker is enough for judges
* Kibana dashboards — custom D3 looks better for demo
* Full SIEM integration (bonus, skip)
* Custom ML model training UI — hardcode the parameters

**Key insight:** Judges evaluate the DEMO, not the spec. A clean 6-minute demo that shows detection → alert → graph → case → export beats a half-built attempt at every requirement.

# **Quick Reference: Final Tech Stack**

Everything below is locked. No scope creep. Build only this.

| **Layer** | **Technology** | **Notes** |
| --- | --- | --- |
| **Backend API** | FastAPI (Python 3.11) |  |
| **Packet Processing** | PyShark + Scapy |  |
| **Message Queue** | Redis Pub/Sub (replaces Kafka) |  |
| **Primary DB** | PostgreSQL 15 |  |
| **Search / Analytics** | Elasticsearch 8 |  |
| **AI / ML** | Scikit-learn (Isolation Forest + Autoencoder) |  |
| **Frontend** | React 18 + Vite + TailwindCSS |  |
| **Graph Viz** | React Flow + D3.js |  |
| **Charts** | Recharts |  |
| **Auth** | JWT + FastAPI middleware (RBAC) |  |
| **Containerization** | Docker + Docker Compose |  |
| **PCAP Samples** | Malware Traffic Analysis (malware-traffic-analysis.net) |  |
| **Report Export** | WeasyPrint (PDF) + openpyxl (Excel) |  |
| **Evidence Hashing** | SHA-256 on ingest (chain of custody) |  |

Why NOT Kafka? Kafka needs ZooKeeper, complex setup, 2GB RAM minimum. Redis does the same pub/sub for a hackathon demo. Swap to Kafka post-hackathon if needed.

# **System Architecture**

## **High-Level Flow**

|  |
| --- |
| **TRAFFIC SOURCES**  Live NIC Capture | PCAP File Upload | Simulated Replay  ↓  **INGESTION LAYER**  PyShark / Scapy → FastAPI → Redis Queue  ↓  **PROCESSING LAYER**  DPI Workers | Signature Engine | AI Anomaly Detector  ↓  **STORAGE LAYER**  PostgreSQL (cases, alerts, metadata) | Elasticsearch (packet index)  ↓  **PRESENTATION LAYER**  React Dashboard | D3 Flow Graph | Case Management | Report Export |

## **Module Map (6 Core Modules)**

| **#** | **Module** | **What It Does** | **Priority** |
| --- | --- | --- | --- |
| **1** | **Packet Ingestion** | Upload PCAP or tap live interface. PyShark parses packets. Store metadata in ES + PG. | **MUST HAVE** |
| **2** | **Threat Detection** | Signature rules (YAML) + DNS tunnel entropy + port scan heuristics. Fire alerts. | **MUST HAVE** |
| **3** | **AI Anomaly Engine** | Isolation Forest on packet features. Flags statistical outliers. Reuse your existing model. | **MUST HAVE** |
| **4** | **Flow Visualization** | React Flow graph: nodes = IPs, edges = connections. D3 timeline. Suspicious nodes red. | **MUST HAVE** |
| **5** | **Forensics & Cases** | Link packets to case. Search history. Attack timeline reconstruction. | **HIGH** |
| **6** | **Evidence Export** | SHA-256 hash on ingest. Export PCAP + PDF report. Chain of custody log. | **HIGH** |

# **10-Day Execution Roadmap**

**PHASE 1 — Foundation**  Days 1–3 (10–12 June)

*Goal: Backend skeleton, DB, packet ingestion working end-to-end.*

| **When** | **Task** |
| --- | --- |
| **Day 1** | Project setup. Git repo, Docker Compose skeleton (FastAPI + PG + ES + Redis). DB schema. React Vite shell. |
| **Day 1** | Install: pyshark, scapy, fastapi, uvicorn, psycopg2, elasticsearch-py, redis-py, scikit-learn, python-jose. |
| **Day 2** | PCAP upload endpoint (POST /api/pcap/upload). Parse with PyShark, extract: src\_ip, dst\_ip, protocol, port, length, timestamp, payload\_entropy. |
| **Day 2** | Store packet metadata to Elasticsearch index. Store session summary to PostgreSQL. |
| **Day 3** | Live capture endpoint (WebSocket /ws/capture). Read from interface with Scapy AsyncSniffer. Push packet JSON to Redis. Frontend socket listener. |
| **Day 3** | Basic React dashboard: upload button, live packet feed table, connection stats card. |

**Phase Deliverable:** Can upload a PCAP and see parsed packets in the UI table. Live capture shows real-time feed.

**PHASE 2 — Detection Engine**  Days 4–6 (13–15 June)

*Goal: Threats detected, alerts firing, AI model integrated.*

| **When** | **Task** |
| --- | --- |
| **Day 4** | Signature engine: YAML rule loader. Rules: port scan (>20 unique ports in 10s), SYN flood (>500 SYN/s from one IP), known malware ports (4444, 31337, 6667), HTTP POST to suspicious TLD. |
| **Day 4** | Alert schema in PostgreSQL: alert\_id, rule\_name, severity, src\_ip, dst\_ip, timestamp, packet\_ref. FastAPI endpoint POST /api/alerts. |
| **Day 5** | DNS tunnelling detector: extract DNS query length + entropy. Flag queries >40 chars with entropy >3.5 bits. Mark as COVERT\_CHANNEL. |
| **Day 5** | ICMP covert channel: flag ICMP packets with payload >8 bytes (standard ICMP has no payload). Store as alert. |
| **Day 6** | AI module: train Isolation Forest on packet features (packet\_size, inter\_arrival\_time, entropy, dst\_port\_diversity). Fit on benign traffic baseline. Predict anomaly score on each session. |
| **Day 6** | Plug AI model into ingestion pipeline. Score each session on upload/live. If score < -0.2 = ANOMALY alert. |

**Phase Deliverable:** Upload malicious PCAP, see alerts fire with severity levels. AI flags anomalous sessions.

**PHASE 3 — Visualization & Forensics**  Days 7–8 (16–17 June)

*Goal: Judges see the most impressive part — graph + timeline + case workflow.*

| **When** | **Task** |
| --- | --- |
| **Day 7** | React Flow graph: GET /api/graph returns {nodes: [{id, ip, alert\_count}], edges: [{src, dst, packet\_count}]}. Suspicious nodes red, normal nodes blue, edge thickness = traffic volume. |
| **Day 7** | D3 timeline: x=time, y=packet\_count per minute. Overlay alert events as vertical red lines. |
| **Day 8** | Case management: create case, assign alert IDs to case, add investigator notes, set status (open/investigating/closed). |
| **Day 8** | Packet search: Elasticsearch query by src\_ip, dst\_ip, protocol, time range. Pagination. Result shows raw packet summary. |

**Phase Deliverable:** Click on a node in graph, see all connections and alerts. Create a case from alerts.

**PHASE 4 — Export, Auth & Polish**  Days 9–10 (18–20 June)

*Goal: Legal-grade export, auth, Docker deploy, demo rehearsal.*

| **When** | **Task** |
| --- | --- |
| **Day 9** | Evidence export: SHA-256 hash of PCAP on ingest, store in DB. Export button triggers download of original PCAP + hash file. Chain of custody table shows who accessed what when. |
| **Day 9** | PDF report: WeasyPrint renders HTML template with case summary, alert table, top talkers, timeline screenshot. One click export. |
| **Day 9** | RBAC: 3 roles: admin (full), investigator (view + case mgmt), viewer (dashboard only). JWT middleware on all API routes. |
| **Day 10** | docker-compose up: all 5 services start in one command. Health checks. Seed demo data script. |
| **Day 10** | Demo rehearsal: 2 PCAP files ready (1 normal, 1 malicious with DNS tunnel + port scan). Record demo video as backup. |

**Phase Deliverable:** Full demo flow runs cleanly. docker-compose up works first try.

# **Daily Checklist — Track Progress Here**

Tick each item as done. If you miss a Day N item, do it before Day N+1 tasks.

**Day 1 — Jun 10**

* Git repo created, docker-compose.yml written (5 services)
* FastAPI app boots with /health endpoint
* PostgreSQL schema applied (5 tables)
* React Vite project created, TailwindCSS installed
* react-flow and recharts installed

**Day 2 — Jun 11**

* POST /api/pcap/upload works, returns session\_id
* PyShark parses PCAP, extracts 8 packet fields
* Packets indexed to Elasticsearch
* Session record saved to PostgreSQL
* Frontend packet table shows parsed results

**Day 3 — Jun 12**

* WebSocket live capture endpoint works
* Frontend live feed updates in real-time
* Dashboard stats card (total packets, sessions, alerts)
* JWT auth working with 3 roles
* Phase 1 demo: upload PCAP, see table

**Day 4 — Jun 13**

* YAML signature rule loader built
* Port scan rule: fires on >20 ports/10s
* Known malware port rule: 4444, 31337, 6667
* Alerts saved to PostgreSQL alerts table
* GET /api/alerts returns alert list

**Day 5 — Jun 14**

* DNS tunnel detector: entropy + length check
* ICMP covert channel detector
* SYN flood detector
* Alert panel in React UI with severity badges
* Alerts linked back to src/dst IP display

**Day 6 — Jun 15**

* Isolation Forest model trained on benign baseline
* Feature extraction function complete
* AI scorer runs on every upload
* ANOMALY alert fires for score < -0.2
* Phase 2 demo: malicious PCAP fires 3+ alerts

**Day 7 — Jun 16**

* GET /api/graph returns nodes + edges JSON
* React Flow graph renders with color coding
* Suspicious nodes turn red when alerts present
* Click node shows connected IPs + alert count
* D3 timeline chart with alert overlays

**Day 8 — Jun 17**

* POST /api/cases creates new case
* Assign alerts to case from UI
* Case notes text editor
* GET /api/packets search with filters
* Phase 3 demo: full flow graph + case creation

**Day 9 — Jun 18**

* SHA-256 hash stored on PCAP ingest
* Chain of custody log writing on all accesses
* PDF report generation with WeasyPrint
* Export PCAP + hash file as ZIP
* Record 6-minute backup demo video

**Day 10 — Jun 19-20**

* docker-compose up runs clean first try
* Seed script loads demo data + demo PCAPs
* README.md with setup instructions
* Full demo rehearsal x3 — under 6 minutes
* Architecture diagram screenshot ready

# **Detection Engine — Rules & Logic**

Each rule below is a concrete, implementable detector. Build these in order — each one is a demo highlight.

**1. Port Scan Detection Severity: HIGH**

|  |  |
| --- | --- |
| **Trigger Condition** | >20 unique dst\_ports from same src\_ip within 10 seconds |
| **Detection Logic** | Group packets by src\_ip in 10s windows. Count distinct dst\_port. If count > 20, fire alert. |
| **Evidence Captured** | src\_ip, list of ports, timestamps |
| **Real-World Attack** | Nmap default scan, Masscan, Shodan probes |

**2. DNS Tunnelling Severity: CRITICAL**

|  |  |
| --- | --- |
| **Trigger Condition** | DNS query length > 40 chars AND entropy > 3.5 bits/char |
| **Detection Logic** | Extract DNS query string. Calculate Shannon entropy. Long high-entropy subdomains = encoded data (Iodine, dnscat2). |
| **Evidence Captured** | Full DNS query, entropy value, frequency |
| **Real-World Attack** | Iodine tunnel, dnscat2, DNS data exfiltration |

**3. ICMP Covert Channel Severity: MEDIUM**

|  |  |
| --- | --- |
| **Trigger Condition** | ICMP packet payload length > 8 bytes |
| **Detection Logic** | Standard ICMP echo has 8-byte header, no payload. Payload presence indicates data hiding (ptunnel, ICMPShell). |
| **Evidence Captured** | Packet hex dump, payload size, frequency |
| **Real-World Attack** | ptunnel, ICMPShell, covert C2 over ICMP |

**4. SYN Flood Severity: CRITICAL**

|  |  |
| --- | --- |
| **Trigger Condition** | >500 SYN packets/second from single src\_ip, no corresponding ACK |
| **Detection Logic** | Track SYN:ACK ratio per src\_ip per second. Ratio > 10:1 with volume > 500/s = flood. |
| **Evidence Captured** | src\_ip, packet count, time window |
| **Real-World Attack** | DDoS, stress test, SYN flood tools |

**5. Known Malware Ports Severity: HIGH**

|  |  |
| --- | --- |
| **Trigger Condition** | Connection to ports: 4444, 31337, 6667, 1080, 9001 |
| **Detection Logic** | Exact match against blocklist. 4444 = Metasploit default. 31337 = Back Orifice. 6667 = IRC botnet C2. 9001 = Tor relay. |
| **Evidence Captured** | src\_ip, dst\_ip, port, timestamp |
| **Real-World Attack** | Metasploit shells, botnet IRC, Tor exit nodes |

**6. Large Upload / Exfiltration Severity: HIGH**

|  |  |
| --- | --- |
| **Trigger Condition** | Outbound TCP session > 50MB to external IP in <60 seconds |
| **Detection Logic** | Track cumulative bytes per flow (src\_ip:dst\_ip:dst\_port). If outbound bytes exceed threshold in window, flag. |
| **Evidence Captured** | Flow summary, total bytes, dst\_ip, timeline |
| **Real-World Attack** | Data exfiltration, ransomware C2 upload, insider threat |

**7. AI Anomaly (Isolation Forest) Severity: MEDIUM-HIGH**

|  |  |
| --- | --- |
| **Trigger Condition** | Session anomaly score < -0.20 (Isolation Forest threshold) |
| **Detection Logic** | Features: avg\_packet\_size, session\_duration, unique\_dst\_ports, payload\_entropy\_avg, bytes\_per\_second. Isolation Forest trained on benign baseline. Score < -0.2 = statistical outlier. |
| **Evidence Captured** | Feature vector, anomaly score, session summary |
| **Real-World Attack** | Zero-day, unknown attack, novel protocol abuse |

# **API Reference**

| **Method** | **Endpoint** | **Description** | **Auth Level** |
| --- | --- | --- | --- |
| **POST** | /api/pcap/upload | Upload PCAP file. Returns session\_id. | Investigator+ |
| **WS** | /ws/capture | Live capture stream. Sends packet JSON via WebSocket. | Admin |
| **GET** | /api/packets | Search packets. Query: src\_ip, dst\_ip, proto, from, to, page. | Investigator+ |
| **GET** | /api/alerts | List alerts. Filter: severity, rule, from, to. | Viewer+ |
| **GET** | /api/graph | Network graph data. Nodes + edges with alert counts. | Viewer+ |
| **GET** | /api/timeline | Packet volume per minute + alert overlay. | Viewer+ |
| **POST** | /api/cases | Create forensic case. | Investigator+ |
| **PATCH** | /api/cases/:id | Update case (add alerts, notes, status). | Investigator+ |
| **GET** | /api/cases/:id/export | Export PDF report for case. | Investigator+ |
| **GET** | /api/evidence/:session\_id | Download PCAP + SHA-256 hash file. | Investigator+ |
| **POST** | /api/auth/login | Login. Returns JWT. | Public |
| **GET** | /api/dashboard | Summary stats: total packets, alerts, active sessions. | Viewer+ |

# **Database Schema**

**packets (Elasticsearch Index)**

| **Column** | **Type** | **Description** |
| --- | --- | --- |
| session\_id | keyword | Groups packets in one capture session |
| timestamp | date | Packet capture time (UTC) |
| src\_ip | ip | Source IP address |
| dst\_ip | ip | Destination IP address |
| src\_port | integer | Source port |
| dst\_port | integer | Destination port |
| protocol | keyword | TCP / UDP / ICMP / DNS etc. |
| packet\_length | integer | Bytes in packet |
| payload\_entropy | float | Shannon entropy of payload (0–8) |
| flags | keyword | TCP flags (SYN, ACK, RST, FIN) |
| dns\_query | text | DNS query string if DNS packet |
| http\_host | text | HTTP Host header if present |

**sessions (PostgreSQL)**

| **Column** | **Type** | **Description** |
| --- | --- | --- |
| session\_id | UUID PK | Unique capture session ID |
| filename | TEXT | Original PCAP filename |
| uploaded\_by | INTEGER FK | User who uploaded |
| upload\_time | TIMESTAMPTZ | Upload timestamp |
| sha256\_hash | CHAR(64) | SHA-256 of original PCAP |
| packet\_count | INTEGER | Total packets in session |
| anomaly\_score | FLOAT | Isolation Forest session score |
| status | ENUM | processing | complete | error |

**alerts (PostgreSQL)**

| **Column** | **Type** | **Description** |
| --- | --- | --- |
| alert\_id | UUID PK | Unique alert ID |
| session\_id | UUID FK | Parent capture session |
| rule\_name | TEXT | e.g. DNS\_TUNNEL, PORT\_SCAN |
| severity | ENUM | low | medium | high | critical |
| src\_ip | INET | Source of suspicious traffic |
| dst\_ip | INET | Destination of suspicious traffic |
| description | TEXT | Human-readable alert description |
| fired\_at | TIMESTAMPTZ | When alert was generated |
| case\_id | UUID FK NULL | Linked case (if assigned) |

**cases (PostgreSQL)**

| **Column** | **Type** | **Description** |
| --- | --- | --- |
| case\_id | UUID PK | Unique case ID |
| title | TEXT | Case title |
| assigned\_to | INTEGER FK | Investigator user ID |
| status | ENUM | open | investigating | closed |
| created\_at | TIMESTAMPTZ | Creation timestamp |
| notes | TEXT | Investigator notes |
| evidence\_refs | TEXT[] | Array of session\_ids linked |

**users (PostgreSQL)**

| **Column** | **Type** | **Description** |
| --- | --- | --- |
| user\_id | SERIAL PK | Auto-increment user ID |
| username | TEXT UNIQUE | Login username |
| password\_hash | TEXT | bcrypt hash |
| role | ENUM | admin | investigator | viewer |
| created\_at | TIMESTAMPTZ | Account creation time |

**custody\_log (PostgreSQL)**

| **Column** | **Type** | **Description** |
| --- | --- | --- |
| log\_id | SERIAL PK | Log entry ID |
| session\_id | UUID FK | Evidence session |
| user\_id | INTEGER FK | Who accessed |
| action | TEXT | view | export | upload | delete |
| accessed\_at | TIMESTAMPTZ | When action occurred |
| ip\_address | INET | User's IP (for audit) |

# **Key Code Snippets — Start Here**

Copy these directly. They are production-ready for hackathon scale.

**FastAPI: PCAP Upload + Parse (backend/routers/pcap.py)**

|  |
| --- |
| from fastapi import APIRouter, UploadFile, File  import pyshark, hashlib, uuid  from elasticsearch import Elasticsearch    router = APIRouter()  es = Elasticsearch("http://localhost:9200")    @router.post("/api/pcap/upload")  async def upload\_pcap(file: UploadFile = File(...)):  data = await file.read()  sha256 = hashlib.sha256(data).hexdigest()  session\_id = str(uuid.uuid4())    # Save to disk temporarily  path = f"/tmp/{session\_id}.pcap"  with open(path, "wb") as f:  f.write(data)    # Parse with PyShark  cap = pyshark.FileCapture(path, keep\_packets=False)  packets = []  for pkt in cap:  try:  doc = {  "session\_id": session\_id,  "timestamp": pkt.sniff\_time.isoformat(),  "src\_ip": str(pkt.ip.src),  "dst\_ip": str(pkt.ip.dst),  "protocol": pkt.highest\_layer,  "packet\_length": int(pkt.length),  "dst\_port": int(pkt[pkt.transport\_layer].dstport) if hasattr(pkt, 'transport\_layer') else 0,  }  packets.append({"index": {"\_index": "packets"}})  packets.append(doc)  except AttributeError:  continue  cap.close()    if packets:  es.bulk(body=packets)    return {"session\_id": session\_id, "sha256": sha256, "packet\_count": len(packets)//2} |

**DNS Tunnelling Detector (backend/detection/dns\_tunnel.py)**

|  |
| --- |
| import math    def shannon\_entropy(s: str) -> float:  if not s:  return 0.0  freq = {}  for c in s:  freq[c] = freq.get(c, 0) + 1  probs = [f/len(s) for f in freq.values()]  return -sum(p \* math.log2(p) for p in probs if p > 0)    def detect\_dns\_tunnel(dns\_query: str) -> dict | None:  if not dns\_query:  return None    subdomain = dns\_query.split(".")[0] # Check leftmost label  entropy = shannon\_entropy(subdomain)  length = len(subdomain)    if length > 40 and entropy > 3.5:  return {  "rule\_name": "DNS\_TUNNEL",  "severity": "critical",  "description": f"DNS query '{dns\_query[:60]}...' has entropy {entropy:.2f} and length {length}. Likely encoded tunnel data.",  "evidence": {"query": dns\_query, "entropy": entropy, "length": length}  }  return None |

**AI Anomaly Detector (backend/ml/anomaly.py)**

|  |
| --- |
| from sklearn.ensemble import IsolationForest  import numpy as np  import joblib, os    MODEL\_PATH = "models/isolation\_forest.pkl"    def extract\_session\_features(packets: list[dict]) -> np.ndarray:  sizes = [p.get("packet\_length", 0) for p in packets]  ports = set(p.get("dst\_port", 0) for p in packets)  entropies = [p.get("payload\_entropy", 0) for p in packets]    return np.array([[  np.mean(sizes), # avg packet size  np.std(sizes), # size variance  len(packets), # session volume  len(ports), # unique dst ports (scan indicator)  np.mean(entropies), # avg payload entropy  ]])    def score\_session(packets: list[dict]) -> float:  if not os.path.exists(MODEL\_PATH):  return 0.0 # No model yet  model = joblib.load(MODEL\_PATH)  features = extract\_session\_features(packets)  return float(model.score\_samples(features)[0])    def train\_baseline(all\_sessions: list[list[dict]]):  X = np.vstack([extract\_session\_features(s) for s in all\_sessions])  model = IsolationForest(contamination=0.05, random\_state=42)  model.fit(X)  os.makedirs("models", exist\_ok=True)  joblib.dump(model, MODEL\_PATH)  return model |

**React: Network Flow Graph (frontend/src/components/FlowGraph.jsx)**

|  |
| --- |
| import ReactFlow, { Background, Controls } from 'reactflow';  import 'reactflow/dist/style.css';  import { useEffect, useState } from 'react';    export default function FlowGraph() {  const [nodes, setNodes] = useState([]);  const [edges, setEdges] = useState([]);    useEffect(() => {  fetch('/api/graph')  .then(r => r.json())  .then(data => {  const rfNodes = data.nodes.map((n, i) => ({  id: n.ip,  data: { label: n.ip },  position: { x: (i % 5) \* 200, y: Math.floor(i / 5) \* 150 },  style: {  background: n.alert\_count > 0 ? '#C0392B' : '#2471A3',  color: 'white', border: 'none', borderRadius: 8,  padding: '8px 12px', fontWeight: 'bold'  }  }));  const rfEdges = data.edges.map(e => ({  id: `${e.src}-${e.dst}`,  source: e.src, target: e.dst,  style: { strokeWidth: Math.min(e.packet\_count / 100, 8) + 1 },  animated: e.suspicious  }));  setNodes(rfNodes);  setEdges(rfEdges);  });  }, []);    return (  <div style={{ height: '600px', background: '#0F172A', borderRadius: 12 }}>  <ReactFlow nodes={nodes} edges={edges} fitView>  <Background color="#1E293B" />  <Controls />  </ReactFlow>  </div>  );  } |

# **Docker Compose — Full Stack**

One command deploys everything. Run from project root:

|  |
| --- |
| version: "3.9"  services:  backend:  build: ./backend  ports: ["8000:8000"]  depends\_on: [postgres, elasticsearch, redis]  environment:  - DATABASE\_URL=postgresql://kanadshield:password@postgres/kanadshield  - ES\_URL=http://elasticsearch:9200  - REDIS\_URL=redis://redis:6379  volumes:  - ./pcap\_storage:/app/pcap\_storage  cap\_add: [NET\_ADMIN, NET\_RAW] # for live capture    frontend:  build: ./frontend  ports: ["3000:3000"]  depends\_on: [backend]    postgres:  image: postgres:15-alpine  environment:  POSTGRES\_DB: kanadshield  POSTGRES\_USER: kanadshield  POSTGRES\_PASSWORD: password  volumes: [pgdata:/var/lib/postgresql/data]    elasticsearch:  image: elasticsearch:8.11.0  environment:  - discovery.type=single-node  - xpack.security.enabled=false  - ES\_JAVA\_OPTS=-Xms512m -Xmx512m  volumes: [esdata:/usr/share/elasticsearch/data]    redis:  image: redis:7-alpine  ports: ["6379:6379"]    volumes:  pgdata:  esdata: |

## **Project Directory Structure**

|  |
| --- |
| kanadshield/  ├── backend/  │ ├── main.py # FastAPI app entry  │ ├── routers/  │ │ ├── pcap.py # Upload + parse  │ │ ├── alerts.py # Alert CRUD  │ │ ├── cases.py # Case management  │ │ ├── graph.py # Network graph data  │ │ └── auth.py # JWT auth  │ ├── detection/  │ │ ├── signatures.py # Rule engine  │ │ ├── dns\_tunnel.py # DNS entropy check  │ │ └── port\_scan.py # Scan detector  │ ├── ml/  │ │ ├── anomaly.py # Isolation Forest  │ │ └── models/ # Saved .pkl files  │ ├── db/  │ │ ├── postgres.py # PG connection + schema  │ │ └── elastic.py # ES client + mappings  │ └── Dockerfile  ├── frontend/  │ ├── src/  │ │ ├── pages/  │ │ │ ├── Dashboard.jsx  │ │ │ ├── FlowGraph.jsx  │ │ │ ├── Alerts.jsx  │ │ │ └── Cases.jsx  │ │ └── components/  │ └── Dockerfile  ├── pcap\_storage/ # Uploaded PCAP files  ├── docker-compose.yml  └── README.md |

# **Demo Script — 6-Minute Walkthrough**

Practice this until it runs in under 6 minutes. Record a backup video on Day 9.

| **Time** | **Action** | **What It Proves** |
| --- | --- | --- |
| **0:00** | Open browser to localhost:3000. Show live dashboard — empty state. | **Judge sees clean UI** |
| **0:30** | Click 'Upload PCAP'. Upload normal\_traffic.pcap. Watch packet table populate. | **Ingestion works** |
| **1:00** | Switch to Flow Graph tab. Show node graph of normal traffic — all blue nodes. | **Visualization works** |
| **1:30** | Upload malicious\_traffic.pcap (has DNS tunnel + port scan + malware port). | **Detection demo starts** |
| **2:00** | ALERT PANEL lights up: DNS\_TUNNEL (Critical), PORT\_SCAN (High), MALWARE\_PORT (High). | **Detection works** |
| **2:30** | Flow Graph: 2 nodes turn RED. Edge to external IP thickens. Click node for drill-down. | **Vis + alerts linked** |
| **3:00** | Timeline view: show spike in packet volume + red alert lines at exact seconds. | **Timeline works** |
| **3:30** | Create case: select alerts, name it 'Suspect Exfiltration - Demo', assign to investigator. | **Forensics works** |
| **4:00** | Open case. Add note: 'DNS tunnel detected to external C2. Recommend block.' | **Case mgmt works** |
| **4:30** | Click 'Export PDF Report'. Download opens — shows alert table, timeline, SHA-256 hash. | **Export works** |
| **5:00** | Show Chain of Custody log: upload event, view events, export event all timestamped. | **Legal compliance** |
| **5:30** | Show docker-compose.yml. Run 'docker-compose up' live. All services start. | **Deployment works** |

## **Demo PCAP Files Needed**

Prepare these 2 files before Day 9. Download from malware-traffic-analysis.net or generate with Scapy.

| **File** | **Contents** | **Where to Get** |
| --- | --- | --- |
| normal\_traffic.pcap | HTTP browsing, DNS lookups, HTTPS sessions — no threats | Generate with Scapy script or download from Wireshark sample captures |
| malicious\_traffic.pcap | DNS tunnel queries + port scan + Metasploit port 4444 connection | malware-traffic-analysis.net or Scapy script (provided below) |