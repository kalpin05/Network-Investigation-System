from fastapi import APIRouter, Query
from db.postgres import get_pool
from db.elastic import es, PACKET_INDEX
from typing import Optional
from collections import defaultdict

router = APIRouter()

@router.get("/api/graph")
async def get_graph(session_id: Optional[str] = None):
    """
    Returns nodes (IPs) and edges (connections) for React Flow.
    Suspicious nodes are flagged with alert_count > 0.
    """
    pool = await get_pool()

    # Get all alerts to flag suspicious IPs
    async with pool.acquire() as conn:
        alert_rows = await conn.fetch(
            "SELECT src_ip, dst_ip, COUNT(*) as cnt FROM alerts GROUP BY src_ip, dst_ip"
        )

    suspicious_ips = defaultdict(int)
    for row in alert_rows:
        suspicious_ips[row["src_ip"]] += row["cnt"]
        suspicious_ips[row["dst_ip"]] += row["cnt"]

    # Query packet flows from Elasticsearch
    query = {
        "size": 0,
        "query": {"match_all": {}},
        "aggs": {
            "flows": {
                "composite": {
                    "size": 200,
                    "sources": [
                        {"src": {"terms": {"field": "src_ip"}}},
                        {"dst": {"terms": {"field": "dst_ip"}}},
                    ]
                },
                "aggs": {
                    "total_bytes": {"sum": {"field": "packet_length"}},
                    "packet_count": {"value_count": {"field": "packet_length"}},
                }
            }
        }
    }

    if session_id:
        query["query"] = {"term": {"session_id": session_id}}

    try:
        result = es.search(index=PACKET_INDEX, body=query)
        buckets = result["aggregations"]["flows"]["buckets"]
    except Exception as e:
        print(f"[ES] Graph query failed: {e}")
        buckets = []

    # Build nodes and edges
    node_set = {}
    edges = []

    for bucket in buckets:
        src = bucket["key"]["src"]
        dst = bucket["key"]["dst"]
        count = bucket["packet_count"]["value"]
        bytes_ = int(bucket["total_bytes"]["value"])

        # Skip loopback
        if src == dst or src.startswith("127.") or dst.startswith("127."):
            continue

        # Add nodes
        for ip in [src, dst]:
            if ip not in node_set:
                node_set[ip] = {
                    "id": ip,
                    "ip": ip,
                    "alert_count": suspicious_ips.get(ip, 0),
                    "is_internal": ip.startswith(("10.", "192.168.", "172.")),
                }

        edges.append({
            "src": src,
            "dst": dst,
            "packet_count": count,
            "total_bytes": bytes_,
            "suspicious": suspicious_ips.get(src, 0) > 0 or suspicious_ips.get(dst, 0) > 0,
        })

    return {
        "nodes": list(node_set.values()),
        "edges": edges,
    }


@router.get("/api/graph/node/{ip}")
async def get_node_detail(ip: str):
    """Drill-down: get all connections and alerts for a specific IP."""
    pool = await get_pool()

    async with pool.acquire() as conn:
        alerts = await conn.fetch(
            "SELECT * FROM alerts WHERE src_ip = $1 OR dst_ip = $1 ORDER BY fired_at DESC LIMIT 20",
            ip
        )

    # Get top connections from ES
    query = {
        "size": 0,
        "query": {"bool": {"should": [
            {"term": {"src_ip": ip}},
            {"term": {"dst_ip": ip}},
        ]}},
        "aggs": {
            "top_peers": {
                "terms": {
                    "field": "dst_ip" if True else "src_ip",
                    "size": 10
                },
                "aggs": {"bytes": {"sum": {"field": "packet_length"}}}
            }
        }
    }

    try:
        result = es.search(index=PACKET_INDEX, body=query)
        peers = result["aggregations"]["top_peers"]["buckets"]
    except Exception:
        peers = []

    return {
        "ip": ip,
        "alerts": [dict(a) for a in alerts],
        "top_connections": [{"ip": b["key"], "bytes": int(b["bytes"]["value"])} for b in peers],
    }


@router.get("/api/timeline")
async def get_timeline(session_id: Optional[str] = None, interval: str = "1m"):
    """
    Returns packet volume per time interval + alert timestamps for overlay.
    interval: 1m, 5m, 1h
    """
    pool = await get_pool()

    # Packet volume over time from ES
    query = {
        "size": 0,
        "query": {"match_all": {}} if not session_id else {"term": {"session_id": session_id}},
        "aggs": {
            "over_time": {
                "date_histogram": {
                    "field": "timestamp",
                    "fixed_interval": interval,
                    "min_doc_count": 0,
                },
                "aggs": {
                    "total_bytes": {"sum": {"field": "packet_length"}}
                }
            }
        }
    }

    try:
        result = es.search(index=PACKET_INDEX, body=query)
        buckets = result["aggregations"]["over_time"]["buckets"]
        timeline = [
            {
                "time": b["key_as_string"],
                "packet_count": b["doc_count"],
                "total_bytes": int(b["total_bytes"]["value"]),
            }
            for b in buckets
        ]
    except Exception as e:
        print(f"[ES] Timeline query failed: {e}")
        timeline = []

    # Alert timestamps
    async with pool.acquire() as conn:
        if session_id:
            alert_rows = await conn.fetch(
                "SELECT fired_at, rule_name, severity FROM alerts WHERE session_id = $1 ORDER BY fired_at",
                session_id
            )
        else:
            alert_rows = await conn.fetch(
                "SELECT fired_at, rule_name, severity FROM alerts ORDER BY fired_at DESC LIMIT 100"
            )

    alert_markers = [
        {
            "time": str(row["fired_at"]),
            "rule_name": row["rule_name"],
            "severity": row["severity"],
        }
        for row in alert_rows
    ]

    return {"timeline": timeline, "alert_markers": alert_markers}


@router.get("/api/packets")
async def search_packets(
    src_ip: Optional[str] = None,
    dst_ip: Optional[str] = None,
    protocol: Optional[str] = None,
    session_id: Optional[str] = None,
    page: int = 1,
    size: int = Query(default=50, le=200)
):
    """Search packets in Elasticsearch with filters."""
    must = []
    if src_ip:
        must.append({"term": {"src_ip": src_ip}})
    if dst_ip:
        must.append({"term": {"dst_ip": dst_ip}})
    if protocol:
        must.append({"term": {"protocol": protocol.upper()}})
    if session_id:
        must.append({"term": {"session_id": session_id}})

    query = {
        "from": (page - 1) * size,
        "size": size,
        "query": {"bool": {"must": must}} if must else {"match_all": {}},
        "sort": [{"timestamp": {"order": "desc"}}],
    }

    try:
        result = es.search(index=PACKET_INDEX, body=query)
        hits = result["hits"]["hits"]
        total = result["hits"]["total"]["value"]
        packets = [h["_source"] for h in hits]
    except Exception as e:
        print(f"[ES] Packet search failed: {e}")
        packets = []
        total = 0

    return {
        "packets": packets,
        "total": total,
        "page": page,
        "pages": (total + size - 1) // size,
    }
