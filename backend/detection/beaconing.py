import math
import statistics
from collections import defaultdict
from datetime import datetime

def detect_beaconing(packets: list[dict]) -> list[dict]:
    """
    Detect C2 beaconing: regular periodic connections from src→dst.
    Low inter-arrival time variance = likely automated/malware beacon.
    
    Threshold: coefficient of variation < 0.3 with >= 6 connections.
    """
    alerts = []

    # Group connection timestamps by (src_ip, dst_ip, dst_port)
    flows = defaultdict(list)
    for p in packets:
        key = (p.get("src_ip"), p.get("dst_ip"), p.get("dst_port", 0))
        ts = p.get("timestamp", "")
        if ts and key[0] and key[1]:
            try:
                flows[key].append(datetime.fromisoformat(ts.replace('Z', '+00:00')).timestamp())
            except Exception:
                continue

    for (src, dst, port), timestamps in flows.items():
        if len(timestamps) < 6:
            continue

        timestamps.sort()
        # Inter-arrival times
        iats = [timestamps[i+1] - timestamps[i] for i in range(len(timestamps)-1)]

        if not iats or statistics.mean(iats) == 0:
            continue

        mean_iat = statistics.mean(iats)
        std_iat  = statistics.stdev(iats) if len(iats) > 1 else 0

        # Coefficient of variation: low = very regular = suspicious
        cv = std_iat / mean_iat if mean_iat > 0 else 1.0

        # Ignore very fast connections (< 5s avg) — likely streaming/HTTP
        if mean_iat < 5:
            continue

        if cv < 0.3:
            period_minutes = round(mean_iat / 60, 1)
            alerts.append({
                "rule_name": "C2_BEACONING",
                "severity": "high",
                "mitre_id": "T1071",
                "mitre_tactic": "Command and Control: Application Layer Protocol",
                "src_ip": src,
                "dst_ip": dst,
                "description": (
                    f"[MITRE T1071 - Command and Control] C2 beaconing pattern detected: {src} → {dst}:{port} "
                    f"contacted {len(timestamps)} times with {period_minutes}min avg interval "
                    f"(regularity CV={cv:.3f}, threshold <0.3). "
                    f"Consistent with malware heartbeat / RAT check-in."
                ),
            })

    return alerts
