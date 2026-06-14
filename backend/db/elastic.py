from elasticsearch import Elasticsearch
from config import ES_URL

es = Elasticsearch(ES_URL)

PACKET_INDEX = "kanadshield_packets"
ALERTS_INDEX = "kanadshield_alerts"

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
        
    if not es.indices.exists(index=ALERTS_INDEX):
        es.indices.create(index=ALERTS_INDEX, body={
            "mappings": {
                "properties": {
                    "session_id":   {"type": "keyword"},
                    "rule_name":    {"type": "keyword"},
                    "severity":     {"type": "keyword"},
                    "src_ip":       {"type": "keyword"},
                    "dst_ip":       {"type": "keyword"},
                    "description":  {"type": "text"},
                    "fired_at":     {"type": "date"}
                }
            }
        })
        print(f"[ES] Index '{ALERTS_INDEX}' created")

def index_packets(docs: list[dict]):
    if not docs:
        return
    ensure_index()
    bulk_body = []
    for doc in docs:
        bulk_body.append({"index": {"_index": PACKET_INDEX}})
        bulk_body.append(doc)
    es.bulk(body=bulk_body)

def index_alerts(alerts: list[dict], session_id: str):
    if not alerts:
        return
    ensure_index()
    from datetime import datetime
    bulk_body = []
    now = datetime.utcnow().isoformat() + "Z"
    for alert in alerts:
        doc = dict(alert)
        doc["session_id"] = session_id
        doc["fired_at"] = now
        bulk_body.append({"index": {"_index": ALERTS_INDEX}})
        bulk_body.append(doc)
    es.bulk(body=bulk_body)
