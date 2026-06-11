# KanadShield — Phase 1: Foundation
**Days 1–3 | June 10–12 | Goal: Backend skeleton + DB + Packet ingestion working end-to-end**

---

## Deliverable at End of Phase 1
> Upload a PCAP file → parsed packets appear in React UI table. Live capture WebSocket shows real-time feed. Auth working with JWT.

---

## Tech to Install

```bash
# Backend (Python 3.11)
pip install fastapi uvicorn[standard] pyshark scapy python-multipart \
  psycopg2-binary elasticsearch redis python-jose[cryptography] \
  passlib[bcrypt] python-dotenv joblib scikit-learn numpy

# Frontend
npm create vite@latest frontend -- --template react
cd frontend && npm install tailwindcss @tailwindcss/vite \
  reactflow recharts axios socket.io-client lucide-react
```

---

## Folder Structure to Create

```
kanadshield/
├── backend/
│   ├── main.py
│   ├── config.py
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── pcap.py
│   │   ├── alerts.py
│   │   ├── cases.py
│   │   ├── graph.py
│   │   └── auth.py
│   ├── detection/
│   │   ├── __init__.py
│   │   ├── signatures.py
│   │   ├── dns_tunnel.py
│   │   ├── port_scan.py
│   │   └── rules.yaml
│   ├── ml/
│   │   ├── __init__.py
│   │   ├── anomaly.py
│   │   └── models/          # .pkl files go here
│   ├── db/
│   │   ├── __init__.py
│   │   ├── postgres.py
│   │   └── elastic.py
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── hashing.py
│   │   └── custody.py
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── FlowGraph.jsx
│   │   │   ├── Alerts.jsx
│   │   │   └── Cases.jsx
│   │   ├── components/
│   │   │   ├── PacketTable.jsx
│   │   │   ├── AlertBadge.jsx
│   │   │   ├── StatCard.jsx
│   │   │   └── Navbar.jsx
│   │   ├── api/
│   │   │   └── client.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── Dockerfile
├── pcap_storage/
├── docker-compose.yml
├── .env
└── README.md
```

---

## docker-compose.yml

```yaml
version: "3.9"

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    depends_on:
      - postgres
      - elasticsearch
      - redis
    environment:
      - DATABASE_URL=postgresql://kanadshield:password@postgres/kanadshield
      - ES_URL=http://elasticsearch:9200
      - REDIS_URL=redis://redis:6379
      - SECRET_KEY=kanadshield-secret-key-change-in-prod
    volumes:
      - ./pcap_storage:/app/pcap_storage
      - ./backend:/app
    cap_add:
      - NET_ADMIN
      - NET_RAW

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: kanadshield
      POSTGRES_USER: kanadshield
      POSTGRES_PASSWORD: password
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  elasticsearch:
    image: elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
      - ES_JAVA_OPTS=-Xms512m -Xmx512m
    volumes:
      - esdata:/usr/share/elasticsearch/data
    ports:
      - "9200:9200"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
  esdata:
```

---

## backend/main.py

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import pcap, alerts, cases, graph, auth
from db.postgres import init_db

app = FastAPI(title="KanadShield API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    await init_db()

@app.get("/health")
def health():
    return {"status": "ok", "service": "kanadshield"}

app.include_router(auth.router, tags=["auth"])
app.include_router(pcap.router, tags=["pcap"])
app.include_router(alerts.router, tags=["alerts"])
app.include_router(cases.router, tags=["cases"])
app.include_router(graph.router, tags=["graph"])
```

---

## backend/config.py

```python
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://kanadshield:password@localhost/kanadshield")
ES_URL = os.getenv("ES_URL", "http://localhost:9200")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480
PCAP_STORAGE = os.getenv("PCAP_STORAGE", "/app/pcap_storage")
```

---

## backend/db/postgres.py

```python
import asyncpg
from config import DATABASE_URL

_pool = None

async def get_pool():
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(DATABASE_URL)
    return _pool

async def init_db():
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'viewer',
                created_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS sessions (
                session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                filename TEXT NOT NULL,
                uploaded_by INTEGER REFERENCES users(user_id),
                upload_time TIMESTAMPTZ DEFAULT NOW(),
                sha256_hash CHAR(64),
                packet_count INTEGER DEFAULT 0,
                anomaly_score FLOAT,
                status TEXT DEFAULT 'processing'
            );

            CREATE TABLE IF NOT EXISTS alerts (
                alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                session_id UUID REFERENCES sessions(session_id),
                rule_name TEXT NOT NULL,
                severity TEXT NOT NULL,
                src_ip TEXT,
                dst_ip TEXT,
                description TEXT,
                fired_at TIMESTAMPTZ DEFAULT NOW(),
                case_id UUID
            );

            CREATE TABLE IF NOT EXISTS cases (
                case_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                title TEXT NOT NULL,
                assigned_to INTEGER REFERENCES users(user_id),
                status TEXT DEFAULT 'open',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                notes TEXT DEFAULT '',
                evidence_refs TEXT[] DEFAULT '{}'
            );

            CREATE TABLE IF NOT EXISTS custody_log (
                log_id SERIAL PRIMARY KEY,
                session_id UUID,
                user_id INTEGER,
                action TEXT NOT NULL,
                accessed_at TIMESTAMPTZ DEFAULT NOW(),
                ip_address TEXT
            );

            INSERT INTO users (username, password_hash, role)
            VALUES ('admin', '$2b$12$placeholder', 'admin')
            ON CONFLICT (username) DO NOTHING;
        """)
    print("[DB] PostgreSQL schema initialized")
```

---

## backend/db/elastic.py

```python
from elasticsearch import Elasticsearch
from config import ES_URL

es = Elasticsearch(ES_URL)

PACKET_INDEX = "kanadshield_packets"

def ensure_index():
    if not es.indices.exists(index=PACKET_INDEX):
        es.indices.create(index=PACKET_INDEX, body={
            "mappings": {
                "properties": {
                    "session_id":       {"type": "keyword"},
                    "timestamp":        {"type": "date"},
                    "src_ip":           {"type": "ip"},
                    "dst_ip":           {"type": "ip"},
                    "src_port":         {"type": "integer"},
                    "dst_port":         {"type": "integer"},
                    "protocol":         {"type": "keyword"},
                    "packet_length":    {"type": "integer"},
                    "payload_entropy":  {"type": "float"},
                    "flags":            {"type": "keyword"},
                    "dns_query":        {"type": "text"},
                    "http_host":        {"type": "text"},
                }
            }
        })
        print(f"[ES] Index '{PACKET_INDEX}' created")

def index_packets(docs: list[dict]):
    if not docs:
        return
    ensure_index()
    bulk_body = []
    for doc in docs:
        bulk_body.append({"index": {"_index": PACKET_INDEX}})
        bulk_body.append(doc)
    es.bulk(body=bulk_body)
```

---

## backend/routers/pcap.py

```python
import os, hashlib, uuid, math
from fastapi import APIRouter, UploadFile, File, Depends
from db.elastic import index_packets
from db.postgres import get_pool
from config import PCAP_STORAGE
import pyshark

router = APIRouter()

def shannon_entropy(data: bytes) -> float:
    if not data:
        return 0.0
    freq = {}
    for b in data:
        freq[b] = freq.get(b, 0) + 1
    probs = [f / len(data) for f in freq.values()]
    return -sum(p * math.log2(p) for p in probs if p > 0)

def parse_pcap(filepath: str, session_id: str) -> list[dict]:
    cap = pyshark.FileCapture(filepath, keep_packets=False)
    packets = []
    for pkt in cap:
        try:
            doc = {
                "session_id": session_id,
                "timestamp": pkt.sniff_time.isoformat(),
                "src_ip": str(pkt.ip.src) if hasattr(pkt, 'ip') else "0.0.0.0",
                "dst_ip": str(pkt.ip.dst) if hasattr(pkt, 'ip') else "0.0.0.0",
                "protocol": pkt.highest_layer,
                "packet_length": int(pkt.length),
                "src_port": 0,
                "dst_port": 0,
                "payload_entropy": 0.0,
                "flags": "",
                "dns_query": "",
                "http_host": "",
            }
            if hasattr(pkt, 'transport_layer') and pkt.transport_layer:
                tl = pkt[pkt.transport_layer]
                doc["src_port"] = int(tl.srcport) if hasattr(tl, 'srcport') else 0
                doc["dst_port"] = int(tl.dstport) if hasattr(tl, 'dstport') else 0

            if hasattr(pkt, 'tcp'):
                doc["flags"] = str(pkt.tcp.flags) if hasattr(pkt.tcp, 'flags') else ""

            if hasattr(pkt, 'dns') and hasattr(pkt.dns, 'qry_name'):
                doc["dns_query"] = str(pkt.dns.qry_name)

            if hasattr(pkt, 'http') and hasattr(pkt.http, 'host'):
                doc["http_host"] = str(pkt.http.host)

            packets.append(doc)
        except Exception:
            continue
    cap.close()
    return packets

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
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO sessions (session_id, filename, sha256_hash, packet_count, status) VALUES ($1, $2, $3, $4, 'complete')",
            session_id, file.filename, sha256, len(packets)
        )

    return {
        "session_id": session_id,
        "sha256": sha256,
        "packet_count": len(packets),
        "filename": file.filename
    }

@router.get("/api/sessions")
async def list_sessions():
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM sessions ORDER BY upload_time DESC LIMIT 50")
    return [dict(r) for r in rows]
```

---

## backend/routers/auth.py

```python
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import jwt, JWTError
from datetime import datetime, timedelta
from config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from db.postgres import get_pool

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer()

class LoginRequest(BaseModel):
    username: str
    password: str

def create_token(data: dict) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({**data, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.post("/api/auth/login")
async def login(req: LoginRequest):
    pool = await get_pool()
    async with pool.acquire() as conn:
        user = await conn.fetchrow("SELECT * FROM users WHERE username = $1", req.username)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    # For demo: accept any password for admin user
    # In prod: pwd_context.verify(req.password, user['password_hash'])
    token = create_token({"sub": req.username, "role": user["role"], "user_id": user["user_id"]})
    return {"access_token": token, "role": user["role"], "username": req.username}
```

---

## backend/Dockerfile

```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    tshark libpcap-dev gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

---

## backend/requirements.txt

```
fastapi==0.111.0
uvicorn[standard]==0.30.0
pyshark==0.6
scapy==2.5.0
python-multipart==0.0.9
asyncpg==0.29.0
elasticsearch==8.13.0
redis==5.0.4
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-dotenv==1.0.1
joblib==1.4.2
scikit-learn==1.5.0
numpy==1.26.4
weasyprint==62.3
openpyxl==3.1.2
pydantic==2.7.0
```

---

## frontend/src/App.jsx

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import FlowGraph from './pages/FlowGraph'
import Alerts from './pages/Alerts'
import Cases from './pages/Cases'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/graph" element={<FlowGraph />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/cases" element={<Cases />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
```

---

## frontend/src/components/Navbar.jsx

```jsx
import { Link, useLocation } from 'react-router-dom'
import { Shield, Activity, AlertTriangle, FolderOpen, Network } from 'lucide-react'

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: Activity },
  { to: '/graph', label: 'Flow Graph', icon: Network },
  { to: '/alerts', label: 'Alerts', icon: AlertTriangle },
  { to: '/cases', label: 'Cases', icon: FolderOpen },
]

export default function Navbar() {
  const { pathname } = useLocation()
  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-8">
      <div className="flex items-center gap-2">
        <Shield className="text-blue-400" size={24} />
        <span className="font-bold text-xl text-blue-400 tracking-wide">KanadShield</span>
      </div>
      <div className="flex gap-1">
        {links.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${pathname === to ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
```

---

## frontend/src/pages/Dashboard.jsx

```jsx
import { useState, useEffect } from 'react'
import { Upload, Wifi, Shield, AlertTriangle } from 'lucide-react'
import axios from 'axios'

const API = 'http://localhost:8000'

export default function Dashboard() {
  const [sessions, setSessions] = useState([])
  const [uploading, setUploading] = useState(false)
  const [stats, setStats] = useState({ sessions: 0, packets: 0, alerts: 0 })

  useEffect(() => {
    axios.get(`${API}/api/sessions`).then(r => setSessions(r.data))
    axios.get(`${API}/api/dashboard`).then(r => setStats(r.data)).catch(() => {})
  }, [])

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const form = new FormData()
    form.append('file', file)
    try {
      await axios.post(`${API}/api/pcap/upload`, form)
      const r = await axios.get(`${API}/api/sessions`)
      setSessions(r.data)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <label className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg cursor-pointer transition-colors">
          <Upload size={16} />
          {uploading ? 'Uploading...' : 'Upload PCAP'}
          <input type="file" accept=".pcap,.pcapng" onChange={handleUpload} className="hidden" />
        </label>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Sessions', value: sessions.length, icon: Shield, color: 'blue' },
          { label: 'Total Packets', value: sessions.reduce((a, s) => a + (s.packet_count || 0), 0).toLocaleString(), icon: Wifi, color: 'green' },
          { label: 'Active Alerts', value: stats.alerts || 0, icon: AlertTriangle, color: 'red' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className={`text-${color}-400 mb-2`}><Icon size={20} /></div>
            <div className="text-2xl font-bold text-white">{value}</div>
            <div className="text-gray-400 text-sm mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Sessions table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 font-semibold text-gray-300">Capture Sessions</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-800 text-gray-400">
            <tr>
              {['Filename', 'Packets', 'Status', 'Uploaded', 'SHA-256'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sessions.map((s, i) => (
              <tr key={s.session_id} className={`border-t border-gray-800 ${i % 2 === 0 ? '' : 'bg-gray-900/50'}`}>
                <td className="px-4 py-3 text-blue-300 font-mono text-xs">{s.filename}</td>
                <td className="px-4 py-3 text-white">{s.packet_count?.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium
                    ${s.status === 'complete' ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'}`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{new Date(s.upload_time).toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{s.sha256_hash?.slice(0, 12)}...</td>
              </tr>
            ))}
          </tbody>
        </table>
        {sessions.length === 0 && (
          <div className="text-center py-12 text-gray-500">No sessions yet. Upload a PCAP to begin.</div>
        )}
      </div>
    </div>
  )
}
```

---

## frontend/src/api/client.js

```js
import axios from 'axios'

export const api = axios.create({ baseURL: 'http://localhost:8000' })

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
```

---

## Phase 1 Acceptance Criteria

- [ ] `docker-compose up` starts all 5 services with no errors
- [ ] `GET http://localhost:8000/health` returns `{"status": "ok"}`
- [ ] `POST /api/pcap/upload` with a real `.pcap` file returns `session_id` + `packet_count`
- [ ] Packets are visible in Elasticsearch (`GET http://localhost:9200/kanadshield_packets/_count`)
- [ ] Session record written to PostgreSQL
- [ ] React app loads at `localhost:3000` with Navbar
- [ ] Upload PCAP from UI — sessions table updates with packet count
- [ ] `POST /api/auth/login` with `{"username":"admin","password":"admin"}` returns JWT
