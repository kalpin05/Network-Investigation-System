import os, hashlib, uuid, math, asyncio
from fastapi import APIRouter, UploadFile, File, Depends, WebSocket, WebSocketDisconnect, Request
from db.elastic import index_packets
from db.postgres import get_pool
from config import PCAP_STORAGE
import pyshark
from ml.anomaly import score_session
from detection.signatures import run_all_signatures
from routers.auth import get_current_user, check_role
from utils.custody import log_custody

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
                "http_method": "",
            }
            if hasattr(pkt, 'transport_layer') and pkt.transport_layer:
                tl = pkt[pkt.transport_layer]
                doc["src_port"] = int(tl.srcport) if hasattr(tl, 'srcport') else 0
                doc["dst_port"] = int(tl.dstport) if hasattr(tl, 'dstport') else 0

            if hasattr(pkt, 'tcp'):
                doc["flags"] = str(pkt.tcp.flags) if hasattr(pkt.tcp, 'flags') else ""

            if hasattr(pkt, 'dns') and hasattr(pkt.dns, 'qry_name'):
                doc["dns_query"] = str(pkt.dns.qry_name)

            if hasattr(pkt, 'http'):
                if hasattr(pkt.http, 'host'):
                    doc["http_host"] = str(pkt.http.host)
                if hasattr(pkt.http, 'request_method'):
                    doc["http_method"] = str(pkt.http.request_method)

            packets.append(doc)
        except Exception:
            continue
    cap.close()
    return packets

@router.post("/api/pcap/upload")
async def upload_pcap(
    request: Request,
    file: UploadFile = File(...),
    current_user: dict = Depends(check_role(["admin", "investigator"]))
):
    data = await file.read()
    sha256 = hashlib.sha256(data).hexdigest()
    session_id = str(uuid.uuid4())

    os.makedirs(PCAP_STORAGE, exist_ok=True)
    filepath = os.path.join(PCAP_STORAGE, f"{session_id}.pcap")
    with open(filepath, "wb") as f:
        f.write(data)

    packets = await asyncio.to_thread(parse_pcap, filepath, session_id)
    index_packets(packets)

    # Run detection
    alerts = run_all_signatures(packets, session_id)
    anomaly_score = score_session(packets)
    if anomaly_score < -0.2:
        alerts.append({
            "rule_name": "ANOMALY",
            "severity": "medium",
            "src_ip": "Session",
            "dst_ip": "Session",
            "description": f"[MITRE T1562 - Impair Defenses / Anomalous Behavior] Isolation Forest anomaly detected. Score: {anomaly_score:.2f}"
        })

    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO sessions (session_id, filename, uploaded_by, sha256_hash, packet_count, anomaly_score, status) VALUES ($1, $2, $3, $4, $5, $6, 'complete')",
            session_id, file.filename, current_user.get("user_id"), sha256, len(packets), anomaly_score
        )
        
        for a in alerts:
            await conn.execute(
                "INSERT INTO alerts (session_id, rule_name, severity, src_ip, dst_ip, description) VALUES ($1, $2, $3, $4, $5, $6)",
                session_id, a["rule_name"], a["severity"], a["src_ip"], a["dst_ip"], a["description"]
            )

        # Log to Chain of Custody
        await log_custody(
            session_id=session_id,
            user_id=current_user.get("user_id"),
            action="upload",
            ip_address=request.client.host if request.client else "127.0.0.1"
        )

    return {
        "session_id": session_id,
        "sha256": sha256,
        "packet_count": len(packets),
        "filename": file.filename
    }

@router.get("/api/sessions")
async def list_sessions(
    current_user: dict = Depends(check_role(["admin", "investigator", "viewer"]))
):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM sessions ORDER BY upload_time DESC LIMIT 50")
    return [dict(r) for r in rows]

@router.get("/api/sessions/{session_id}/packets")
async def get_session_packets(
    session_id: str,
    limit: int = 100,
    current_user: dict = Depends(check_role(["admin", "investigator", "viewer"]))
):
    from db.elastic import es, PACKET_INDEX
    try:
        res = es.search(
            index=PACKET_INDEX,
            query={"match": {"session_id": session_id}},
            size=limit
        )
        packets = []
        for hit in res["hits"]["hits"]:
            pkt = hit["_source"]
            pkt["id"] = hit["_id"]
            packets.append(pkt)
        return packets
    except Exception as e:
        return {"error": str(e)}

@router.get("/api/packets")
async def search_packets(
    src_ip: str = None,
    dst_ip: str = None,
    protocol: str = None,
    limit: int = 100,
    current_user: dict = Depends(check_role(["admin", "investigator", "viewer"]))
):
    from db.elastic import es, PACKET_INDEX
    
    must_clauses = []
    if src_ip:
        must_clauses.append({"match": {"src_ip": src_ip}})
    if dst_ip:
        must_clauses.append({"match": {"dst_ip": dst_ip}})
    if protocol:
        must_clauses.append({"match": {"protocol": protocol}})
        
    query = {"match_all": {}} if not must_clauses else {"bool": {"must": must_clauses}}
    
    try:
        res = es.search(
            index=PACKET_INDEX,
            query=query,
            size=limit,
            sort=[{"timestamp": {"order": "desc"}}]
        )
        packets = []
        for hit in res["hits"]["hits"]:
            pkt = hit["_source"]
            pkt["id"] = hit["_id"]
            packets.append(pkt)
        total = res["hits"]["total"]["value"]
        return {"packets": packets, "total": total}
    except Exception as e:
        return {"error": str(e)}

@router.websocket("/ws/capture")
async def websocket_capture(websocket: WebSocket):
    await websocket.accept()
    from scapy.all import AsyncSniffer, IP, TCP, UDP
    import time
    
    loop = asyncio.get_running_loop()
    queue = asyncio.Queue()

    def packet_callback(pkt):
        if IP in pkt:
            packet_data = {
                "src_ip": pkt[IP].src,
                "dst_ip": pkt[IP].dst,
                "protocol": "TCP" if TCP in pkt else ("UDP" if UDP in pkt else "Other"),
                "packet_length": len(pkt),
                "timestamp": time.time()
            }
            loop.call_soon_threadsafe(queue.put_nowait, packet_data)

    sniffer = AsyncSniffer(prn=packet_callback, store=False)
    sniffer.start()

    try:
        while True:
            packet_data = await queue.get()
            await websocket.send_json(packet_data)
    except WebSocketDisconnect:
        sniffer.stop()
