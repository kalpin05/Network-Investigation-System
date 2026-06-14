import json
import logging
import requests
import socket
from datetime import datetime

logger = logging.getLogger(__name__)

async def forward_to_siem(alerts: list[dict], session_id: str):
    if not alerts:
        return

    from db.postgres import get_pool
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM siem_config ORDER BY id DESC LIMIT 1")
    
    if not row or not row["is_enabled"]:
        return

    destination_url = row["destination_url"]
    destination_type = row["destination_type"]

    for alert in alerts:
        try:
            if destination_type == "webhook":
                send_webhook(alert, session_id, destination_url)
            elif destination_type == "syslog":
                send_syslog(alert, session_id, destination_url)
        except Exception as e:
            logger.error(f"Failed to forward alert to SIEM: {e}")

def send_webhook(alert: dict, session_id: str, url: str):
    payload = {
        "source": "KanadShield",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "session_id": session_id,
        "alert": alert
    }
    try:
        # Fire and forget request with short timeout
        requests.post(url, json=payload, timeout=2.0)
    except requests.exceptions.RequestException as e:
        logger.error(f"SIEM Webhook error: {e}")

def send_syslog(alert: dict, session_id: str, address: str):
    # Address format expected: ip:port (e.g. 192.168.1.100:514)
    try:
        parts = address.split(":")
        ip = parts[0]
        port = int(parts[1]) if len(parts) > 1 else 514
        
        # Format as CEF (Common Event Format)
        # CEF:Version|Device Vendor|Device Product|Device Version|Signature ID|Name|Severity|[Extension]
        severity_map = {"low": 3, "medium": 5, "high": 8, "critical": 10}
        sev_num = severity_map.get(alert.get("severity", "low").lower(), 3)
        rule = alert.get("rule_name", "UNKNOWN")
        desc = alert.get("description", "").replace("|", "\\|").replace("\n", " ")
        src = alert.get("src_ip", "")
        dst = alert.get("dst_ip", "")
        
        cef_msg = f"CEF:0|KanadCyber|KanadShield|1.0|{rule}|{desc}|{sev_num}|src={src} dst={dst} cs1={session_id} cs1Label=SessionID"
        
        syslog_msg = f"<14>{datetime.utcnow().strftime('%b %d %H:%M:%S')} kanadshield kanadshield: {cef_msg}"
        
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.sendto(syslog_msg.encode('utf-8'), (ip, port))
        sock.close()
    except Exception as e:
        logger.error(f"SIEM Syslog error: {e}")
