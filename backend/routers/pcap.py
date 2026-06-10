import os, hashlib, uuid, math, asyncio
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

    packets = await asyncio.to_thread(parse_pcap, filepath, session_id)
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

@router.get("/api/sessions/{session_id}/packets")
async def get_session_packets(session_id: str, limit: int = 100):
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
