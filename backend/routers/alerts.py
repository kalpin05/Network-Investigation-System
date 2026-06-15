from fastapi import APIRouter, Query, Depends, WebSocket, WebSocketDisconnect
from db.postgres import get_pool
from typing import Optional
from routers.auth import check_role
from aiokafka import AIOKafkaConsumer
from config import KAFKA_BOOTSTRAP_SERVERS
import json

router = APIRouter()

@router.get("/api/alerts")
async def list_alerts(
    severity: Optional[str] = None,
    rule_name: Optional[str] = None,
    session_id: Optional[str] = None,
    limit: int = Query(default=100, le=500),
    current_user: dict = Depends(check_role(["admin", "investigator", "viewer"]))
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
async def dashboard_stats(
    current_user: dict = Depends(check_role(["admin", "investigator", "viewer"]))
):
    pool = await get_pool()
    async with pool.acquire() as conn:
        total_sessions = await conn.fetchval("SELECT COUNT(*) FROM sessions")
        total_packets  = await conn.fetchval("SELECT COALESCE(SUM(packet_count),0) FROM sessions")
        total_alerts   = await conn.fetchval("SELECT COUNT(*) FROM alerts")
        critical_alerts= await conn.fetchval("SELECT COUNT(*) FROM alerts WHERE severity = 'critical'")

    # Top talkers from Elasticsearch
    top_query = {
        "size": 0,
        "aggs": {
            "top_src": {
                "terms": {"field": "src_ip", "size": 10},
                "aggs": {"total_bytes": {"sum": {"field": "packet_length"}}}
            },
            "top_protocols": {
                "terms": {"field": "protocol", "size": 8}
            },
            "top_dst_ports": {
                "terms": {"field": "dst_port", "size": 8}
            }
        }
    }

    try:
        from db.elastic import es, PACKET_INDEX
        result = es.search(index=PACKET_INDEX, body=top_query)
        top_talkers = [
            {
                "ip": b["key"],
                "bytes": int(b["total_bytes"]["value"]),
                "packets": b["doc_count"]
            }
            for b in result["aggregations"]["top_src"]["buckets"]
        ]
        top_protocols = [
            {"protocol": b["key"], "count": b["doc_count"]}
            for b in result["aggregations"]["top_protocols"]["buckets"]
        ]
        top_ports = [
            {"port": b["key"], "count": b["doc_count"]}
            for b in result["aggregations"]["top_dst_ports"]["buckets"]
        ]
    except Exception as e:
        print(f"[ES Aggregation Error] {e}")
        top_talkers = []
        top_protocols = []
        top_ports = []

    return {
        "sessions": total_sessions,
        "packets": total_packets,
        "alerts": total_alerts,
        "critical": critical_alerts,
        "top_talkers": top_talkers,
        "top_protocols": top_protocols,
        "top_ports": top_ports,
    }

@router.websocket("/ws/alerts")
async def alert_stream(websocket: WebSocket):
    """Streams new alerts in real-time to connected frontend clients."""
    await websocket.accept()
    consumer = AIOKafkaConsumer(
        "live-alerts",
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        value_deserializer=lambda x: json.loads(x.decode('utf-8')),
        auto_offset_reset="latest"
    )
    await consumer.start()
    try:
        async for msg in consumer:
            await websocket.send_json(msg.value)
    except WebSocketDisconnect:
        pass
    finally:
        await consumer.stop()

