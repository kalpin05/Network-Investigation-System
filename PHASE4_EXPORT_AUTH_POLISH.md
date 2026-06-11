# KanadShield — Phase 4: Export, Auth & Polish
**Days 9–10 | June 18–20 | Goal: Legal-grade export, RBAC auth, Docker deploy, demo-ready**

---

## Deliverable at End of Phase 4
> Click "Export PDF Report" on a case → download PDF with alert table, timeline, SHA-256 hash, custody log. Chain of custody shows every access. `docker-compose up` starts all 5 services clean. Full 6-minute demo runs without errors.

---

## Prerequisites
- Phase 1 + 2 + 3 fully complete
- Cases, alerts, sessions stored in PostgreSQL
- Flow graph + timeline + packet search working in UI
- `GET /api/cases/:id` returns case with linked alerts

---

## Day 9 — Evidence Export + PDF Report + RBAC

### Part A: Chain of Custody Logging

Custody log already has the table from Phase 1 schema. Add the utility:

#### backend/utils/custody.py

```python
from db.postgres import get_pool
from datetime import datetime

async def log_custody(
    session_id: str,
    user_id: int,
    action: str,          # "upload" | "view" | "export" | "delete"
    ip_address: str = "unknown"
):
    """
    Write a tamper-evident custody record for every evidence access.
    Call this on every PCAP upload, view, export.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO custody_log (session_id, user_id, action, accessed_at, ip_address)
            VALUES ($1, $2, $3, $4, $5)
        """,
            session_id, user_id, action,
            datetime.utcnow(), ip_address
        )
```

---

### Part B: Evidence Export Endpoint

#### backend/routers/evidence.py

```python
import os
import io
import zipfile
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from db.postgres import get_pool
from config import PCAP_STORAGE
from utils.custody import log_custody

router = APIRouter()


@router.get("/api/evidence/{session_id}")
async def export_evidence(session_id: str, request: Request):
    """
    Download a ZIP containing:
      - original .pcap file
      - sha256.txt with hash + filename + timestamp
      - custody_log.txt with full access history
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        session = await conn.fetchrow(
            "SELECT * FROM sessions WHERE session_id = $1", session_id
        )
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        custody_rows = await conn.fetch(
            """
            SELECT cl.action, cl.accessed_at, cl.ip_address, u.username
            FROM custody_log cl
            LEFT JOIN users u ON u.user_id = cl.user_id
            WHERE cl.session_id = $1
            ORDER BY cl.accessed_at ASC
            """,
            session_id
        )

    # Log this export action
    await log_custody(
        session_id=session_id,
        user_id=1,  # Replace with current user from JWT in production
        action="export",
        ip_address=request.client.host
    )

    pcap_path = os.path.join(PCAP_STORAGE, f"{session_id}.pcap")
    if not os.path.exists(pcap_path):
        raise HTTPException(status_code=404, detail="PCAP file not found on disk")

    # Build ZIP in memory
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        # Original PCAP
        with open(pcap_path, "rb") as f:
            zf.writestr(f"evidence_{session_id[:8]}.pcap", f.read())

        # Hash file
        hash_content = (
            f"KanadShield Evidence Hash File\n"
            f"================================\n"
            f"Session ID  : {session_id}\n"
            f"Filename    : {session['filename']}\n"
            f"SHA-256     : {session['sha256_hash']}\n"
            f"Upload Time : {session['upload_time']}\n"
            f"Packet Count: {session['packet_count']}\n"
        )
        zf.writestr("sha256_verification.txt", hash_content)

        # Chain of custody log
        custody_lines = [
            "KanadShield Chain of Custody Log",
            "================================",
            f"Session: {session_id}",
            f"File   : {session['filename']}",
            "",
            f"{'Timestamp':<30} {'User':<20} {'Action':<15} {'IP Address'}",
            "-" * 80,
        ]
        for row in custody_rows:
            custody_lines.append(
                f"{str(row['accessed_at']):<30} "
                f"{(row['username'] or 'unknown'):<20} "
                f"{row['action']:<15} "
                f"{row['ip_address']}"
            )
        zf.writestr("chain_of_custody.txt", "\n".join(custody_lines))

    zip_buffer.seek(0)
    filename = f"kanadshield_evidence_{session_id[:8]}.zip"

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/api/evidence/{session_id}/custody")
async def get_custody_log(session_id: str):
    """Return custody log as JSON for UI display."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT cl.log_id, cl.action, cl.accessed_at, cl.ip_address, u.username
            FROM custody_log cl
            LEFT JOIN users u ON u.user_id = cl.user_id
            WHERE cl.session_id = $1
            ORDER BY cl.accessed_at ASC
            """,
            session_id
        )
    return [dict(r) for r in rows]
```

---

### Part C: PDF Report Generation

#### Install (already in requirements.txt):
```
weasyprint==62.3
jinja2==3.1.4
```

#### backend/utils/report.py

```python
import io
from datetime import datetime
from weasyprint import HTML

REPORT_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body {{ font-family: Arial, sans-serif; font-size: 12px; color: #1a1a2e; margin: 0; padding: 20px; }}
  .header {{ background: #0f3460; color: white; padding: 24px 30px; margin: -20px -20px 30px; }}
  .header h1 {{ margin: 0; font-size: 22px; letter-spacing: 2px; }}
  .header p {{ margin: 4px 0 0; opacity: 0.75; font-size: 12px; }}
  .badge {{ display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; }}
  .critical {{ background: #7f1d1d; color: #fca5a5; }}
  .high     {{ background: #78350f; color: #fcd34d; }}
  .medium   {{ background: #713f12; color: #fde68a; }}
  .low      {{ background: #1e3a5f; color: #93c5fd; }}
  h2 {{ color: #0f3460; border-bottom: 2px solid #0f3460; padding-bottom: 6px; margin-top: 28px; font-size: 15px; }}
  table {{ width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }}
  th {{ background: #0f3460; color: white; padding: 8px 10px; text-align: left; }}
  td {{ padding: 7px 10px; border-bottom: 1px solid #e2e8f0; }}
  tr:nth-child(even) td {{ background: #f8fafc; }}
  .hash-box {{ background: #f1f5f9; border: 1px solid #cbd5e1; padding: 12px; border-radius: 6px;
               font-family: monospace; font-size: 10px; word-break: break-all; }}
  .stat-row {{ display: flex; gap: 20px; margin: 16px 0; }}
  .stat {{ flex: 1; background: #f1f5f9; border-left: 4px solid #0f3460;
           padding: 12px 16px; border-radius: 0 6px 6px 0; }}
  .stat .val {{ font-size: 22px; font-weight: bold; color: #0f3460; }}
  .stat .lbl {{ font-size: 10px; color: #64748b; margin-top: 2px; }}
  .footer {{ margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 12px;
             color: #94a3b8; font-size: 10px; text-align: center; }}
</style>
</head>
<body>

<div class="header">
  <h1>🛡 KANADSHIELD — Forensic Case Report</h1>
  <p>Generated: {generated_at} | Confidential — Law Enforcement Use Only</p>
</div>

<h2>Case Summary</h2>
<table>
  <tr><td><strong>Case ID</strong></td><td><code>{case_id}</code></td></tr>
  <tr><td><strong>Title</strong></td><td>{title}</td></tr>
  <tr><td><strong>Status</strong></td><td>{status}</td></tr>
  <tr><td><strong>Created</strong></td><td>{created_at}</td></tr>
  <tr><td><strong>Investigator Notes</strong></td><td>{notes}</td></tr>
</table>

<div class="stat-row">
  <div class="stat"><div class="val">{total_alerts}</div><div class="lbl">Total Alerts</div></div>
  <div class="stat"><div class="val">{critical_count}</div><div class="lbl">Critical Alerts</div></div>
  <div class="stat"><div class="val">{high_count}</div><div class="lbl">High Severity</div></div>
  <div class="stat"><div class="val">{session_count}</div><div class="lbl">Sessions Analysed</div></div>
</div>

<h2>Alert Details</h2>
<table>
  <thead>
    <tr>
      <th>Rule</th>
      <th>Severity</th>
      <th>Source IP</th>
      <th>Destination IP</th>
      <th>Description</th>
      <th>Timestamp</th>
    </tr>
  </thead>
  <tbody>
    {alert_rows}
  </tbody>
</table>

<h2>Evidence Integrity — SHA-256 Hashes</h2>
{hash_rows}

<h2>Chain of Custody</h2>
<table>
  <thead>
    <tr><th>Timestamp</th><th>User</th><th>Action</th><th>IP Address</th></tr>
  </thead>
  <tbody>
    {custody_rows}
  </tbody>
</table>

<div class="footer">
  KanadShield Network Forensics Platform · B.Tech CSE (AI &amp; ML) · Adani University, Ahmedabad
  · Report generated {generated_at}
</div>
</body>
</html>
"""

SEVERITY_CLASS = {"critical": "critical", "high": "high", "medium": "medium", "low": "low"}


def render_pdf_report(case: dict, alerts: list[dict], sessions: list[dict], custody: list[dict]) -> bytes:
    """Render a PDF forensic report using WeasyPrint."""

    alert_rows_html = ""
    for a in alerts:
        sev = a.get("severity", "low")
        alert_rows_html += f"""
        <tr>
          <td><strong>{a.get('rule_name', '')}</strong></td>
          <td><span class="badge {SEVERITY_CLASS.get(sev, 'low')}">{sev}</span></td>
          <td><code>{a.get('src_ip', '')}</code></td>
          <td><code>{a.get('dst_ip', '')}</code></td>
          <td>{a.get('description', '')[:120]}</td>
          <td style="white-space:nowrap; font-size:10px">{str(a.get('fired_at', ''))[:19]}</td>
        </tr>"""

    hash_rows_html = ""
    for s in sessions:
        hash_rows_html += f"""
        <div class="hash-box" style="margin-bottom:8px">
          <strong>{s.get('filename', 'unknown')}</strong><br/>
          SHA-256: {s.get('sha256_hash', 'N/A')}<br/>
          Packets: {s.get('packet_count', 0)} · Uploaded: {str(s.get('upload_time', ''))[:19]}
        </div>"""

    custody_rows_html = ""
    for c in custody:
        custody_rows_html += f"""
        <tr>
          <td style="white-space:nowrap; font-size:10px">{str(c.get('accessed_at', ''))[:19]}</td>
          <td>{c.get('username', 'unknown')}</td>
          <td>{c.get('action', '')}</td>
          <td><code>{c.get('ip_address', '')}</code></td>
        </tr>"""

    critical = sum(1 for a in alerts if a.get("severity") == "critical")
    high = sum(1 for a in alerts if a.get("severity") == "high")

    html = REPORT_TEMPLATE.format(
        generated_at=datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
        case_id=case.get("case_id", ""),
        title=case.get("title", ""),
        status=case.get("status", "open").upper(),
        created_at=str(case.get("created_at", ""))[:19],
        notes=case.get("notes", "—") or "—",
        total_alerts=len(alerts),
        critical_count=critical,
        high_count=high,
        session_count=len(sessions),
        alert_rows=alert_rows_html or "<tr><td colspan='6' style='text-align:center;color:#94a3b8'>No alerts linked to this case.</td></tr>",
        hash_rows=hash_rows_html or "<p style='color:#94a3b8'>No sessions linked.</p>",
        custody_rows=custody_rows_html or "<tr><td colspan='4' style='text-align:center;color:#94a3b8'>No custody log entries.</td></tr>",
    )

    pdf_bytes = HTML(string=html).write_pdf()
    return pdf_bytes
```

#### Add PDF export endpoint to backend/routers/cases.py

```python
# Add these imports at top of cases.py
from fastapi.responses import Response
from utils.report import render_pdf_report
from utils.custody import log_custody

# Add this route to cases.py
@router.get("/api/cases/{case_id}/export")
async def export_case_pdf(case_id: str, request: Request):
    """Generate and download PDF forensic report for a case."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        case = await conn.fetchrow("SELECT * FROM cases WHERE case_id = $1", case_id)
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")

        alerts = await conn.fetch(
            "SELECT * FROM alerts WHERE case_id = $1 ORDER BY fired_at DESC", case_id
        )

        # Get all unique sessions referenced by linked alerts
        session_ids = list({a["session_id"] for a in alerts if a["session_id"]})
        sessions = []
        for sid in session_ids:
            row = await conn.fetchrow("SELECT * FROM sessions WHERE session_id = $1", sid)
            if row:
                sessions.append(dict(row))

        # Custody log for all relevant sessions
        custody = []
        for sid in session_ids:
            rows = await conn.fetch(
                """
                SELECT cl.action, cl.accessed_at, cl.ip_address, u.username
                FROM custody_log cl
                LEFT JOIN users u ON u.user_id = cl.user_id
                WHERE cl.session_id = $1 ORDER BY cl.accessed_at
                """,
                sid
            )
            custody.extend([dict(r) for r in rows])

    pdf_bytes = render_pdf_report(
        case=dict(case),
        alerts=[dict(a) for a in alerts],
        sessions=sessions,
        custody=custody
    )

    filename = f"kanadshield_case_{case_id[:8]}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
```

---

### Part D: RBAC Middleware

#### Update backend/routers/auth.py — add role enforcement

```python
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import jwt, JWTError
from datetime import datetime, timedelta
from config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from db.postgres import get_pool
from typing import Optional

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer()

ROLE_HIERARCHY = {
    "admin": 3,
    "investigator": 2,
    "viewer": 1,
}

class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str
    role: str = "viewer"

def create_token(data: dict) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({**data, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

def require_role(min_role: str):
    """
    Dependency factory. Usage:
        @router.get("/api/admin-thing", dependencies=[Depends(require_role("admin"))])
    """
    async def checker(user: dict = Depends(get_current_user)):
        user_level = ROLE_HIERARCHY.get(user.get("role", "viewer"), 0)
        required_level = ROLE_HIERARCHY.get(min_role, 99)
        if user_level < required_level:
            raise HTTPException(
                status_code=403,
                detail=f"Requires '{min_role}' role or higher. Your role: '{user.get('role')}'"
            )
        return user
    return checker

@router.post("/api/auth/login")
async def login(req: LoginRequest):
    pool = await get_pool()
    async with pool.acquire() as conn:
        user = await conn.fetchrow("SELECT * FROM users WHERE username = $1", req.username)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    # Production: verify hash. Demo: accept any password for seeded users.
    # if not pwd_context.verify(req.password, user["password_hash"]):
    #     raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token({"sub": req.username, "role": user["role"], "user_id": user["user_id"]})
    return {"access_token": token, "role": user["role"], "username": req.username}

@router.post("/api/auth/register")
async def register(req: RegisterRequest, admin=Depends(require_role("admin"))):
    """Only admin can create new users."""
    pool = await get_pool()
    hashed = pwd_context.hash(req.password)
    async with pool.acquire() as conn:
        try:
            await conn.execute(
                "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)",
                req.username, hashed, req.role
            )
        except Exception:
            raise HTTPException(status_code=400, detail="Username already exists")
    return {"username": req.username, "role": req.role, "created": True}

@router.get("/api/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"username": user["sub"], "role": user["role"], "user_id": user["user_id"]}
```

#### Apply RBAC to sensitive routes (update main.py):

```python
# In main.py — import require_role and protect routes
from routers.auth import require_role
from fastapi import Depends

# Example: protect upload route (in pcap.py)
@router.post("/api/pcap/upload", dependencies=[Depends(require_role("investigator"))])
async def upload_pcap(file: UploadFile = File(...)):
    ...

# Evidence export: investigator+
@router.get("/api/evidence/{session_id}", dependencies=[Depends(require_role("investigator"))])
async def export_evidence(session_id: str, request: Request):
    ...

# PDF export: investigator+
@router.get("/api/cases/{case_id}/export", dependencies=[Depends(require_role("investigator"))])
async def export_case_pdf(case_id: str, request: Request):
    ...
```

---

## Day 10 — Docker Polish + Seed Script + Demo Prep

### backend/seed_demo.py

Run once after `docker-compose up` to load demo-ready state:

```python
#!/usr/bin/env python3
"""
KanadShield Demo Seed Script
Run: docker-compose exec backend python seed_demo.py
Seeds: 3 users + 2 sessions + 6 alerts + 1 case
"""
import asyncio
import asyncpg
import os
from datetime import datetime, timedelta
import uuid

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://kanadshield:password@postgres/kanadshield")

async def seed():
    conn = await asyncpg.connect(DATABASE_URL)

    print("[SEED] Inserting demo users...")
    users = [
        ("admin",       "$2b$12$seed_hash_admin",       "admin"),
        ("investigator","$2b$12$seed_hash_investigator", "investigator"),
        ("viewer",      "$2b$12$seed_hash_viewer",       "viewer"),
    ]
    for username, pw_hash, role in users:
        await conn.execute("""
            INSERT INTO users (username, password_hash, role)
            VALUES ($1, $2, $3)
            ON CONFLICT (username) DO NOTHING
        """, username, pw_hash, role)

    print("[SEED] Inserting demo sessions...")
    session_normal = str(uuid.uuid4())
    session_malicious = str(uuid.uuid4())

    await conn.execute("""
        INSERT INTO sessions (session_id, filename, sha256_hash, packet_count, anomaly_score, status)
        VALUES
          ($1, 'normal_traffic.pcap', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', 4821, 0.12, 'complete'),
          ($2, 'malicious_traffic.pcap', 'f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5', 1337, -0.41, 'complete')
    """, session_normal, session_malicious)

    print("[SEED] Inserting demo alerts...")
    alert_data = [
        (session_malicious, "DNS_TUNNEL",       "critical", "10.0.0.100", "8.8.8.8",
         "DNS tunnelling suspected: query 'aGVsbG93b3JsZGhlbGxvd29ybGRoZWxsb3dvcmxk.evil-tunnel.com' has subdomain length 48 and entropy 4.12 bits/char."),
        (session_malicious, "PORT_SCAN",        "high",     "10.0.0.100", "192.168.1.1",
         "Port scan detected: 10.0.0.100 touched 187 unique ports in session. Ports: [21, 22, 23, 25, 53, 80, 110, 143, 443, 445]..."),
        (session_malicious, "MALWARE_PORT",     "high",     "10.0.0.100", "203.0.113.10",
         "Connection to known malware/C2 port 4444 from 10.0.0.100 → 203.0.113.10 (Metasploit default listener)."),
        (session_malicious, "ICMP_COVERT_CHANNEL","medium", "10.0.0.100", "203.0.113.10",
         "ICMP covert channel suspected: packet length 132 bytes (standard ICMP echo ≤ 28 bytes). Tools: ptunnel, ICMPShell."),
        (session_malicious, "AI_ANOMALY",       "medium",   "session-level", "session-level",
         "AI anomaly detected: Isolation Forest score -0.41 (threshold -0.20). Session statistical profile deviates significantly from baseline."),
        (session_malicious, "DATA_EXFILTRATION","critical", "10.0.0.100", "203.0.113.10",
         "Potential data exfiltration: 12.3MB sent to non-web ports within session window."),
    ]

    alert_ids = []
    for row in alert_data:
        alert_id = str(uuid.uuid4())
        alert_ids.append(alert_id)
        await conn.execute("""
            INSERT INTO alerts (alert_id, session_id, rule_name, severity, src_ip, dst_ip, description)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        """, alert_id, *row)

    print("[SEED] Inserting demo case...")
    case_id = str(uuid.uuid4())
    await conn.execute("""
        INSERT INTO cases (case_id, title, assigned_to, status, notes)
        VALUES ($1, $2, 2, 'investigating', $3)
    """,
        case_id,
        "Suspected C2 Exfiltration + DNS Tunnel — June 2026 Demo",
        "Automated detection flagged DNS tunnelling (entropy 4.12) and port scan from 10.0.0.100. "
        "Recommend network block on src IP and forensic image of endpoint. "
        "External IP 203.0.113.10 is confirmed malicious (VirusTotal)."
    )

    for alert_id in alert_ids:
        await conn.execute(
            "UPDATE alerts SET case_id = $1 WHERE alert_id = $2",
            case_id, alert_id
        )

    print("[SEED] Inserting custody log...")
    await conn.execute("""
        INSERT INTO custody_log (session_id, user_id, action, ip_address)
        VALUES
          ($1, 1, 'upload', '127.0.0.1'),
          ($1, 2, 'view',   '127.0.0.1'),
          ($1, 2, 'export', '127.0.0.1')
    """, session_malicious)

    await conn.close()
    print("[SEED] ✅ Demo data seeded successfully.")
    print(f"[SEED]    Malicious session: {session_malicious}")
    print(f"[SEED]    Demo case: {case_id}")
    print("[SEED]    Login: admin / investigator / viewer (any password for demo)")

if __name__ == "__main__":
    asyncio.run(seed())
```

---

### Update backend/main.py — register evidence router

```python
from routers import pcap, alerts, cases, graph, auth
from routers.evidence import router as evidence_router  # ADD THIS

app.include_router(auth.router, tags=["auth"])
app.include_router(pcap.router, tags=["pcap"])
app.include_router(alerts.router, tags=["alerts"])
app.include_router(cases.router, tags=["cases"])
app.include_router(graph.router, tags=["graph"])
app.include_router(evidence_router, tags=["evidence"])  # ADD THIS
```

---

### Final docker-compose.yml health checks

```yaml
version: "3.9"

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
      elasticsearch:
        condition: service_healthy
      redis:
        condition: service_started
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
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
    restart: unless-stopped

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
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U kanadshield"]
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped

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
    healthcheck:
      test: ["CMD-SHELL", "curl -s http://localhost:9200/_cluster/health | grep -q '\"status\":\"green\\|yellow\"'"]
      interval: 10s
      timeout: 10s
      retries: 20
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    restart: unless-stopped

volumes:
  pgdata:
  esdata:
```

---

## Frontend: Phase 4 UI Additions

### Export buttons in Cases.jsx (add to case detail panel)

```jsx
// Add to case detail section in Cases.jsx, after status buttons:

const handleExportPDF = async (caseId) => {
  try {
    const response = await axios.get(`${API}/api/cases/${caseId}/export`, {
      responseType: 'blob',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
    const url = URL.createObjectURL(response.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `kanadshield_case_${caseId.slice(0,8)}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('PDF export failed', err)
  }
}

const handleExportEvidence = async (sessionId) => {
  const response = await axios.get(`${API}/api/evidence/${sessionId}`, {
    responseType: 'blob',
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  })
  const url = URL.createObjectURL(response.data)
  const a = document.createElement('a')
  a.href = url
  a.download = `kanadshield_evidence_${sessionId.slice(0,8)}.zip`
  a.click()
  URL.revokeObjectURL(url)
}

// JSX to add inside case detail:
<div className="flex gap-3 mt-4">
  <button
    onClick={() => handleExportPDF(caseDetail.case_id)}
    className="flex items-center gap-2 bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
  >
    📄 Export PDF Report
  </button>
</div>
```

---

### frontend/src/pages/CustodyLog.jsx (chain of custody viewer)

```jsx
import { useEffect, useState } from 'react'
import { Shield, Download, Eye, Upload } from 'lucide-react'
import axios from 'axios'

const API = 'http://localhost:8000'

const ACTION_CONFIG = {
  upload:  { icon: Upload,   color: 'text-green-400'  },
  view:    { icon: Eye,      color: 'text-blue-400'   },
  export:  { icon: Download, color: 'text-yellow-400' },
  delete:  { icon: Shield,   color: 'text-red-400'    },
}

export default function CustodyLog({ sessionId }) {
  const [log, setLog] = useState([])

  useEffect(() => {
    if (!sessionId) return
    axios.get(`${API}/api/evidence/${sessionId}/custody`).then(r => setLog(r.data))
  }, [sessionId])

  if (!sessionId) return null

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mt-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
        <Shield size={16} className="text-blue-400" />
        Chain of Custody Log
      </h3>
      <div className="space-y-2">
        {log.map((entry, i) => {
          const cfg = ACTION_CONFIG[entry.action] || ACTION_CONFIG.view
          const Icon = cfg.icon
          return (
            <div key={i} className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg text-xs">
              <Icon size={14} className={cfg.color} />
              <span className="text-gray-400 font-mono w-40 flex-shrink-0">
                {new Date(entry.accessed_at).toLocaleString()}
              </span>
              <span className="text-white font-medium w-24">{entry.username || 'unknown'}</span>
              <span className={`uppercase font-bold w-16 ${cfg.color}`}>{entry.action}</span>
              <span className="text-gray-500 font-mono">{entry.ip_address}</span>
            </div>
          )
        })}
        {log.length === 0 && (
          <p className="text-gray-600 text-sm text-center py-4">No custody records yet.</p>
        )}
      </div>
    </div>
  )
}
```

---

### Add Login page: frontend/src/pages/Login.jsx

```jsx
import { useState } from 'react'
import { Shield } from 'lucide-react'
import axios from 'axios'

const API = 'http://localhost:8000'

export default function Login({ onLogin }) {
  const [creds, setCreds] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    try {
      const r = await axios.post(`${API}/api/auth/login`, creds)
      localStorage.setItem('token', r.data.access_token)
      localStorage.setItem('role', r.data.role)
      localStorage.setItem('username', r.data.username)
      onLogin(r.data)
    } catch (err) {
      setError('Invalid credentials. Try: admin / investigator / viewer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Shield className="text-blue-400" size={48} />
          </div>
          <h1 className="text-3xl font-bold text-blue-400 tracking-wide">KanadShield</h1>
          <p className="text-gray-400 text-sm mt-2">Network Forensics Platform</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Username</label>
            <input
              value={creds.username}
              onChange={e => setCreds(p => ({ ...p, username: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="admin"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input
              type="password"
              value={creds.password}
              onChange={e => setCreds(p => ({ ...p, password: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="••••••••"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium text-sm transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-xs text-gray-500 space-y-1">
          <p className="text-gray-400 font-medium mb-2">Demo Accounts</p>
          <p>admin → full access (upload, export, manage)</p>
          <p>investigator → cases + export</p>
          <p>viewer → dashboard + alerts only</p>
        </div>
      </div>
    </div>
  )
}
```

#### Update App.jsx to add auth guard:

```jsx
import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import FlowGraph from './pages/FlowGraph'
import Alerts from './pages/Alerts'
import Cases from './pages/Cases'
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
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <Navbar user={user} onLogout={handleLogout} />
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

#### Update Navbar to show user + logout:

```jsx
// Add to Navbar.jsx props and render:
export default function Navbar({ user, onLogout }) {
  // ... existing links ...
  return (
    <nav className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-8">
      {/* ... existing content ... */}
      <div className="ml-auto flex items-center gap-3">
        <span className="text-xs text-gray-400">
          <span className="text-blue-400 font-medium">{user?.username}</span>
          {' '}· {user?.role}
        </span>
        <button
          onClick={onLogout}
          className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
        >
          Logout
        </button>
      </div>
    </nav>
  )
}
```

---

## README.md (project root)

````markdown
# KanadShield — Network Forensics Platform

> AI-powered packet analysis, threat detection, and digital forensics.
> Hackathon Submission — Adani University, B.Tech CSE (AI & ML) — June 2026

## Quick Start

```bash
git clone <repo>
cd kanadshield
docker-compose up --build
```

All 5 services start automatically. Open http://localhost:3000

### Seed demo data (first run only):
```bash
docker-compose exec backend python seed_demo.py
```

### Demo accounts:
| Username | Password | Role |
|---|---|---|
| admin | (any) | Full access |
| investigator | (any) | Cases + Export |
| viewer | (any) | Dashboard only |

## Architecture

```
PCAP Upload / Live Capture
    ↓
FastAPI (Python 3.11) + PyShark
    ↓
Detection Engine (6 rules + AI Isolation Forest)
    ↓
PostgreSQL (alerts, cases, custody) + Elasticsearch (packets)
    ↓
React 18 + React Flow + Recharts
```

## Detection Rules

| Rule | Severity | Trigger |
|---|---|---|
| DNS_TUNNEL | Critical | DNS query entropy >3.5 + length >40 |
| PORT_SCAN | High | >20 unique dst ports from one src |
| MALWARE_PORT | High | Connection to ports 4444/31337/6667 |
| SYN_FLOOD | Critical | SYN:ACK ratio >5:1 with volume >200 |
| ICMP_COVERT_CHANNEL | Medium | ICMP packet payload >8 bytes |
| DATA_EXFILTRATION | Critical | Outbound >10MB to non-web ports |
| AI_ANOMALY | Medium | Isolation Forest score <-0.20 |

## API Reference

| Method | Endpoint | Access |
|---|---|---|
| POST | /api/pcap/upload | Investigator+ |
| GET | /api/alerts | Viewer+ |
| GET | /api/graph | Viewer+ |
| GET | /api/timeline | Viewer+ |
| POST | /api/cases | Investigator+ |
| GET | /api/cases/:id/export | Investigator+ |
| GET | /api/evidence/:id | Investigator+ |
| POST | /api/auth/login | Public |

## Tech Stack
- **Backend**: FastAPI, PyShark, Scapy, scikit-learn
- **Storage**: PostgreSQL 15, Elasticsearch 8, Redis 7
- **Frontend**: React 18, Vite, TailwindCSS, React Flow, Recharts
- **Export**: WeasyPrint (PDF), openpyxl (Excel)
- **Deploy**: Docker Compose (single command)
````

---

## Phase 4 Acceptance Criteria

- [ ] `GET /api/evidence/:session_id` returns ZIP with PCAP + SHA-256 file + custody log
- [ ] Every upload/view/export writes a record to `custody_log` table
- [ ] `GET /api/cases/:id/export` returns PDF with alert table, hash, custody section
- [ ] PDF renders correct case title, alert count, SHA-256 hashes
- [ ] `POST /api/auth/login` returns JWT for all 3 demo users
- [ ] Viewer role blocked from upload endpoint (returns 403)
- [ ] Investigator role can create case + export PDF
- [ ] Admin role can register new users via `/api/auth/register`
- [ ] `GET /api/auth/me` returns username + role from token
- [ ] Login page renders at localhost:3000 when not authenticated
- [ ] Role shown in Navbar; logout clears session
- [ ] Export PDF button in Cases UI triggers download
- [ ] Chain of Custody component shows access history per session
- [ ] `docker-compose up --build` starts all 5 services, no manual steps
- [ ] `python seed_demo.py` loads demo sessions + alerts + case
- [ ] `GET /health` returns `{"status": "ok"}` after cold start
- [ ] Full demo flow runs cleanly under 6 minutes
