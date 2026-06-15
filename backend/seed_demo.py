#!/usr/bin/env python3
"""
KanadShield Demo Seed Script
Run: docker-compose exec backend python seed_demo.py
Seeds: 3 users + 2 sessions + 6 alerts + 1 case

Demo Login Credentials:
  admin        / demo123
  investigator / demo123
  viewer       / demo123
"""
import asyncio
import asyncpg
import os
import shutil
from datetime import datetime, timedelta
import uuid

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://kanadshield:password@postgres/kanadshield")

# Real bcrypt hashes for password 'demo123'
# Generated inside the container with: python -c "import bcrypt; print(bcrypt.hashpw(b'demo123', bcrypt.gensalt()).decode())"
DEMO_PASSWORD_HASH = "$2b$12$IpiccGuHw21hBEZQJVh6vONlnjxtMNcHAiQhQ19gona3pGTw0DdNK"

async def seed():
    conn = await asyncpg.connect(DATABASE_URL)

    print("[SEED] Inserting demo users (password: demo123)...")
    users = [
        ("admin",       DEMO_PASSWORD_HASH, "admin"),
        ("investigator",DEMO_PASSWORD_HASH, "investigator"),
        ("viewer",      DEMO_PASSWORD_HASH, "viewer"),
    ]
    for username, pw_hash, role in users:
        await conn.execute("""
            INSERT INTO users (username, password_hash, role)
            VALUES ($1, $2, $3)
            ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role
        """, username, pw_hash, role)

    print("[SEED] Inserting demo sessions...")
    session_normal = str(uuid.uuid4())
    session_malicious = str(uuid.uuid4())

    await conn.execute("""
        INSERT INTO sessions (session_id, filename, sha256_hash, packet_count, anomaly_score, status)
        VALUES
          ($1, 'normal_traffic.pcap', 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', 4821, 0.12, 'complete'),
          ($2, 'malicious_traffic.pcap', 'f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5', 1337, -0.41, 'complete')
        ON CONFLICT (session_id) DO NOTHING
    """, session_normal, session_malicious)

    print("[SEED] Inserting demo alerts...")
    alert_data = [
        (session_malicious, "DNS_TUNNEL",       "critical", "10.0.0.100", "8.8.8.8",
         "[MITRE T1071.004 - Application Layer Protocol: DNS] DNS tunnelling suspected: query 'aGVsbG93b3JsZGhlbGxvd29ybGRoZWxsb3dvcmxk.evil-tunnel.com' has subdomain length 48 and entropy 4.12 bits/char."),
        (session_malicious, "PORT_SCAN",        "high",     "10.0.0.100", "192.168.1.1",
         "[MITRE T1046 - Network Service Discovery] Port scan detected: 10.0.0.100 touched 187 unique ports in session. Ports: [21, 22, 23, 25, 53, 80, 110, 143, 443, 445]..."),
        (session_malicious, "MALWARE_PORT",     "high",     "10.0.0.100", "203.0.113.10",
         "[MITRE T1571 - Non-Standard Port] Connection to known malware/C2 port 4444 from 10.0.0.100 → 203.0.113.10 (Metasploit default listener)."),
        (session_malicious, "ICMP_COVERT_CHANNEL","medium", "10.0.0.100", "203.0.113.10",
         "[MITRE T1095 - Non-Application Layer Protocol] ICMP covert channel suspected: packet length 132 bytes (standard ICMP echo ≤ 28 bytes). Tools: ptunnel, ICMPShell."),
        (session_malicious, "AI_ANOMALY",       "medium",   "session-level", "session-level",
         "[MITRE T1562 - Impair Defenses / Anomalous Behavior] AI anomaly detected: Isolation Forest score -0.41 (threshold -0.20). Session statistical profile deviates significantly from baseline."),
        (session_malicious, "DATA_EXFILTRATION","critical", "10.0.0.100", "203.0.113.10",
         "[MITRE T1041 - Exfiltration Over C2 Channel] Potential data exfiltration: 12.3MB sent to non-web ports within session window."),
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
    # Find the investigator user id (username is 'investigator')
    investigator_id = await conn.fetchval("SELECT user_id FROM users WHERE username = 'investigator'")
    await conn.execute("""
        INSERT INTO cases (case_id, title, assigned_to, status, notes)
        VALUES ($1, $2, $3, 'investigating', $4)
    """,
        case_id,
        "Suspected C2 Exfiltration + DNS Tunnel — June 2026 Demo",
        investigator_id or 2,
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
    admin_id = await conn.fetchval("SELECT user_id FROM users WHERE username = 'admin'")
    await conn.execute("""
        INSERT INTO custody_log (session_id, user_id, action, ip_address)
        VALUES
          ($1, $2, 'upload', '127.0.0.1'),
          ($1, $3, 'view',   '127.0.0.1'),
          ($1, $3, 'export', '127.0.0.1')
    """, session_malicious, admin_id or 1, investigator_id or 2)

    await conn.close()

    # ── Auto-create PCAP evidence files for demo sessions ──────────────────
    # Find any real PCAP in storage to use as demo evidence
    print("[SEED] Creating demo PCAP evidence files...")
    PCAP_DIR = '/app/pcap_storage'
    real_pcaps = [f for f in os.listdir(PCAP_DIR) if f.endswith('.pcap')] if os.path.isdir(PCAP_DIR) else []
    source_pcap = os.path.join(PCAP_DIR, real_pcaps[0]) if real_pcaps else None
    for sid in [session_normal, session_malicious]:
        target = os.path.join(PCAP_DIR, f'{sid}.pcap')
        if not os.path.exists(target):
            if source_pcap:
                shutil.copy2(source_pcap, target)
                print(f"[SEED]    Created evidence file: {sid[:8]}...pcap")
            else:
                # Create a minimal placeholder file (empty PCAP global header)
                with open(target, 'wb') as f:
                    # PCAP global header: magic, version, timezone, accuracy, snaplen, link type
                    f.write(bytes.fromhex('d4c3b2a1020004000000000000000000ffff00000100000'))
                print(f"[SEED]    Created placeholder PCAP: {sid[:8]}...pcap")
        else:
            print(f"[SEED]    Evidence exists: {sid[:8]}...pcap")

    print("[SEED] ✅ Demo data seeded successfully.")
    print(f"[SEED]    Malicious session: {session_malicious}")
    print(f"[SEED]    Demo case: {case_id}")
    print("[SEED]    Login: admin / investigator / viewer  |  Password: demo123")

if __name__ == "__main__":
    asyncio.run(seed())
