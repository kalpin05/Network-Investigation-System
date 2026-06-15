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

def parse_pcap(filepath: str, session_id: str, keylog_filepath: str = None) -> list[dict]:
    override_prefs = {}
    if keylog_filepath:
        override_prefs['tls.keylog_file'] = keylog_filepath
        
    cap = pyshark.FileCapture(filepath, keep_packets=False, override_prefs=override_prefs)
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
                "tls_version": "",
                "tls_cipher_suites": "",
                "tls_extensions": "",
                "tls_elliptic_curves": "",
                "tls_ec_point_formats": "",
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

            if hasattr(pkt, 'tls'):
                try:
                    doc["tls_version"] = str(pkt.tls.record_version) if hasattr(pkt.tls, 'record_version') else ""
                    doc["tls_cipher_suites"] = str(pkt.tls.handshake_ciphersuite) if hasattr(pkt.tls, 'handshake_ciphersuite') else ""
                    doc["tls_extensions"] = str(pkt.tls.handshake_extension_type) if hasattr(pkt.tls, 'handshake_extension_type') else ""
                    doc["tls_elliptic_curves"] = str(pkt.tls.handshake_elliptic_curve) if hasattr(pkt.tls, 'handshake_elliptic_curve') else ""
                    doc["tls_ec_point_formats"] = str(pkt.tls.handshake_ec_point_format) if hasattr(pkt.tls, 'handshake_ec_point_format') else ""
                except Exception:
                    pass

            packets.append(doc)
        except Exception:
            continue
    cap.close()
    return packets

@router.post("/api/pcap/upload")
async def upload_pcap(
    request: Request,
    file: UploadFile = File(...),
    keylog_file: UploadFile = File(None),
    current_user: dict = Depends(check_role(["admin", "investigator"]))
):
    data = await file.read()
    sha256 = hashlib.sha256(data).hexdigest()
    session_id = str(uuid.uuid4())

    os.makedirs(PCAP_STORAGE, exist_ok=True)
    filepath = os.path.join(PCAP_STORAGE, f"{session_id}.pcap")
    with open(filepath, "wb") as f:
        f.write(data)
        
    keylog_filepath = None
    if keylog_file and keylog_file.filename:
        keylog_data = await keylog_file.read()
        keylog_filepath = os.path.join(PCAP_STORAGE, f"{session_id}.keylog")
        with open(keylog_filepath, "wb") as f:
            f.write(keylog_data)

    packets = await asyncio.to_thread(parse_pcap, filepath, session_id, keylog_filepath)
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

    # Forward to SIEM and Kibana
    if alerts:
        from db.elastic import index_alerts
        from utils.siem import forward_to_siem
        index_alerts(alerts, session_id)
        # We can fire and forget the SIEM webhook
        asyncio.create_task(forward_to_siem(alerts, session_id))

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

        # Publish alerts to live-alerts topic in Kafka for real-time WebSocket push
        if alerts:
            from aiokafka import AIOKafkaProducer
            from config import KAFKA_BOOTSTRAP_SERVERS
            from datetime import datetime
            import json
            
            producer = AIOKafkaProducer(
                bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
                value_serializer=lambda v: json.dumps(v).encode('utf-8')
            )
            try:
                await producer.start()
                for a in alerts:
                    mitre_id = ""
                    if "MITRE " in a["description"]:
                        try:
                            parts = a["description"].split("MITRE ")
                            if len(parts) > 1:
                                mitre_id = parts[1].split(" ")[0].strip()
                        except Exception:
                            pass
                    
                    alert_payload = {
                        "session_id": session_id,
                        "rule_name": a["rule_name"],
                        "severity": a["severity"],
                        "src_ip": a["src_ip"],
                        "dst_ip": a["dst_ip"],
                        "description": a["description"],
                        "mitre_id": mitre_id,
                        "fired_at": datetime.utcnow().isoformat() + "Z"
                    }
                    await producer.send_and_wait("live-alerts", alert_payload)
            except Exception as e:
                print(f"[Kafka] Failed to publish alert: {e}")
            finally:
                await producer.stop()

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

@router.get("/api/sessions/{session_id}/stream")
async def get_tcp_stream(
    session_id: str,
    src_ip: str,
    src_port: int,
    dst_ip: str,
    dst_port: int,
    current_user: dict = Depends(check_role(["admin", "investigator", "viewer"]))
):
    filepath = os.path.join(PCAP_STORAGE, f"{session_id}.pcap")
    if not os.path.exists(filepath):
        return {"error": "PCAP file not found"}

    keylog_filepath = os.path.join(PCAP_STORAGE, f"{session_id}.keylog")

    try:
        cmd = ["tshark", "-r", filepath, "-q"]
        if os.path.exists(keylog_filepath):
            cmd.extend(["-o", f"tls.keylog_file:{keylog_filepath}"])
            cmd.extend(["-z", f"follow,tls,ascii,{src_ip}:{src_port},{dst_ip}:{dst_port}"])
        else:
            cmd.extend(["-z", f"follow,tcp,ascii,{src_ip}:{src_port},{dst_ip}:{dst_port}"])
            
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        output = stdout.decode('utf-8', errors='replace')
        
        # Parse out just the payload text, removing tshark banners
        # Example output:
        # ===================================================================
        # Follow: tcp,ascii
        # Filter: ...
        # Node 0: ...
        # Node 1: ...
        # <PAYLOAD>
        # ===================================================================
        
        lines = output.split('\n')
        payload_lines = []
        in_payload = False
        
        for line in lines:
            if line.startswith("Node 1:"):
                in_payload = True
                continue
            if in_payload:
                if line.startswith("==================================================================="):
                    break
                payload_lines.append(line)
                
        # If payload is empty but output is not, return the whole output as fallback
        if not payload_lines and output.strip():
            return {"stream": output.strip()}
            
        return {"stream": "\n".join(payload_lines).strip()}
        
    except Exception as e:
        return {"error": f"Failed to reconstruct stream: {str(e)}"}

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
    import time, json
    from aiokafka import AIOKafkaProducer, AIOKafkaConsumer
    from config import KAFKA_BOOTSTRAP_SERVERS
    
    loop = asyncio.get_running_loop()

    producer = AIOKafkaProducer(
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        value_serializer=lambda v: json.dumps(v).encode('utf-8')
    )
    await producer.start()

    consumer = AIOKafkaConsumer(
        "live-packets",
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        value_deserializer=lambda x: json.loads(x.decode('utf-8')),
        auto_offset_reset="latest"
    )
    await consumer.start()

    def packet_callback(pkt):
        if IP in pkt:
            packet_data = {
                "src_ip": pkt[IP].src,
                "dst_ip": pkt[IP].dst,
                "protocol": "TCP" if TCP in pkt else ("UDP" if UDP in pkt else "Other"),
                "packet_length": len(pkt),
                "timestamp": time.time()
            }
            # Schedule the async send on the main loop
            asyncio.run_coroutine_threadsafe(producer.send_and_wait("live-packets", packet_data), loop)

    sniffer = AsyncSniffer(prn=packet_callback, store=False)
    sniffer.start()

    try:
        async for msg in consumer:
            await websocket.send_json(msg.value)
    except WebSocketDisconnect:
        pass
    finally:
        sniffer.stop()
        await producer.stop()
        await consumer.stop()
