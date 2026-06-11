from fastapi import APIRouter
from db.elastic import es, PACKET_INDEX
from db.postgres import get_pool

router = APIRouter()

@router.get("/api/graph")
async def get_graph():
    # 1. Query Elasticsearch for connections (edges)
    query = {
        "size": 0,
        "aggs": {
            "sources": {
                "terms": {"field": "src_ip", "size": 100},
                "aggs": {
                    "destinations": {
                        "terms": {"field": "dst_ip", "size": 100}
                    }
                }
            }
        }
    }
    
    edges = []
    nodes_dict = {} # IP -> alert_count
    
    try:
        res = es.search(index=PACKET_INDEX, body=query)
        for src_bucket in res.get("aggregations", {}).get("sources", {}).get("buckets", []):
            src_ip = src_bucket["key"]
            if src_ip not in nodes_dict:
                nodes_dict[src_ip] = 0
                
            for dst_bucket in src_bucket.get("destinations", {}).get("buckets", []):
                dst_ip = dst_bucket["key"]
                pkt_count = dst_bucket["doc_count"]
                
                if dst_ip not in nodes_dict:
                    nodes_dict[dst_ip] = 0
                    
                edges.append({
                    "src": src_ip,
                    "dst": dst_ip,
                    "packet_count": pkt_count,
                    "suspicious": False  # Will update later
                })
    except Exception as e:
        print(f"[ES] Error querying graph data: {e}")

    # 2. Query Postgres for alert counts per IP
    pool = await get_pool()
    async with pool.acquire() as conn:
        records = await conn.fetch("SELECT src_ip, dst_ip FROM alerts")
        
        for r in records:
            sip = r["src_ip"]
            dip = r["dst_ip"]
            if sip in nodes_dict:
                nodes_dict[sip] += 1
            if dip in nodes_dict:
                nodes_dict[dip] += 1
                
            # Mark edges as suspicious if an alert fired between them
            for e in edges:
                if e["src"] == sip and e["dst"] == dip:
                    e["suspicious"] = True
                
    nodes = [{"id": ip, "ip": ip, "alert_count": count} for ip, count in nodes_dict.items()]
    
    return {"nodes": nodes, "edges": edges}
