import os
import yaml
from datetime import datetime
from .dns_tunnel import detect_dns_tunnel

def load_rules():
    yaml_path = os.path.join(os.path.dirname(__file__), "rules.yaml")
    if not os.path.exists(yaml_path):
        return {}
    with open(yaml_path, "r") as f:
        data = yaml.safe_load(f)
        rules = {}
        for r in data.get("rules", []):
            rules[r["name"]] = r
        return rules

RULES = load_rules()

def run_all_signatures(packets: list[dict], session_id: str) -> list[dict]:
    alerts = []
    
    # Trackers for aggregate rules
    src_ports = {} # src_ip -> { bucket_10s -> set of dst_port }
    src_syn_count = {} # src_ip -> { bucket_1s -> count of SYN flags }
    src_bytes = {} # src_ip -> total outbound bytes

    dns_rule = RULES.get("DNS_TUNNEL", {})
    icmp_rule = RULES.get("ICMP_COVERT", {})
    malware_rule = RULES.get("MALWARE_PORT", {})
    port_scan_rule = RULES.get("PORT_SCAN", {})
    syn_flood_rule = RULES.get("SYN_FLOOD", {})
    large_exfil_rule = RULES.get("LARGE_EXFILTRATION", {})
    suspicious_tld_rule = RULES.get("SUSPICIOUS_TLD_POST", {})

    for pkt in packets:
        src_ip = pkt.get("src_ip", "0.0.0.0")
        dst_ip = pkt.get("dst_ip", "0.0.0.0")
        dst_port = pkt.get("dst_port", 0)
        src_port = pkt.get("src_port", 0)
        protocol = pkt.get("protocol", "")
        packet_length = pkt.get("packet_length", 0)
        flags = pkt.get("flags", "")
        dns_query = pkt.get("dns_query", "")
        http_host = pkt.get("http_host", "")
        http_method = pkt.get("http_method", "")

        # 1. DNS Tunnel
        if dns_query and dns_rule.get("enabled"):
            dns_alert = detect_dns_tunnel(
                dns_query, 
                min_length=dns_rule.get("thresholds", {}).get("min_length", 40),
                min_entropy=dns_rule.get("thresholds", {}).get("min_entropy", 3.5)
            )
            if dns_alert:
                dns_alert["severity"] = dns_rule.get("severity", "critical")
                dns_alert["src_ip"] = src_ip
                dns_alert["dst_ip"] = dst_ip
                alerts.append(dns_alert)

        # 2. ICMP Covert Channel
        if protocol == "ICMP" and icmp_rule.get("enabled"):
            min_len = icmp_rule.get("thresholds", {}).get("min_packet_length", 42)
            if packet_length > min_len:
                alerts.append({
                    "rule_name": "ICMP_COVERT",
                    "severity": icmp_rule.get("severity", "medium"),
                    "src_ip": src_ip,
                    "dst_ip": dst_ip,
                    "description": f"[MITRE T1095 - Non-Application Layer Protocol] Abnormal ICMP packet length {packet_length} bytes. Possible covert channel payload."
                })

        # 3. Known Malware Ports
        if malware_rule.get("enabled"):
            malware_ports = malware_rule.get("ports", [])
            if dst_port in malware_ports or src_port in malware_ports:
                mal_port = dst_port if dst_port in malware_ports else src_port
                alerts.append({
                    "rule_name": "MALWARE_PORT",
                    "severity": malware_rule.get("severity", "high"),
                    "src_ip": src_ip,
                    "dst_ip": dst_ip,
                    "description": f"[MITRE T1571 - Non-Standard Port] Connection on known malware/C2 port {mal_port} detected."
                })

        # 4. HTTP POST to Suspicious TLD
        if suspicious_tld_rule.get("enabled") and http_method.upper() == "POST" and http_host:
            suspicious_tlds = suspicious_tld_rule.get("tlds", [])
            if any(http_host.endswith(tld) for tld in suspicious_tlds):
                alerts.append({
                    "rule_name": "SUSPICIOUS_TLD_POST",
                    "severity": suspicious_tld_rule.get("severity", "high"),
                    "src_ip": src_ip,
                    "dst_ip": dst_ip,
                    "description": f"[MITRE T1071.001 - Web Protocols] HTTP POST detected to suspicious TLD on host {http_host}."
                })

        # Track for aggregate logic
        timestamp_str = pkt.get("timestamp")
        try:
            # Replace Z with +00:00 for python 3.10 and earlier if needed, but 3.11 supports Z
            ts = int(datetime.fromisoformat(timestamp_str.replace('Z', '+00:00')).timestamp())
        except Exception:
            ts = 0

        bucket_10s = ts // 10
        bucket_1s = ts

        if src_ip not in src_ports:
            src_ports[src_ip] = {}
        if bucket_10s not in src_ports[src_ip]:
            src_ports[src_ip][bucket_10s] = set()
        src_ports[src_ip][bucket_10s].add(dst_port)

        if src_ip not in src_syn_count:
            src_syn_count[src_ip] = {}
        if bucket_1s not in src_syn_count[src_ip]:
            src_syn_count[src_ip][bucket_1s] = 0

        if src_ip not in src_bytes:
            src_bytes[src_ip] = 0
        src_bytes[src_ip] += packet_length

        flags_str = str(flags).upper()
        if protocol == "TCP" and "S" in flags_str and "A" not in flags_str:
            src_syn_count[src_ip][bucket_1s] += 1

    # Aggregate evaluation
    if port_scan_rule.get("enabled"):
        max_ports = port_scan_rule.get("thresholds", {}).get("max_unique_ports", 20)
        for src_ip, buckets in src_ports.items():
            for bkt, ports in buckets.items():
                if len(ports) > max_ports:
                    alerts.append({
                        "rule_name": "PORT_SCAN",
                        "severity": port_scan_rule.get("severity", "high"),
                        "src_ip": src_ip,
                        "dst_ip": "Multiple",
                        "description": f"[MITRE T1046 - Network Service Discovery] Port scan detected: {len(ports)} unique ports targeted in 10s."
                    })
                    break

    if syn_flood_rule.get("enabled"):
        max_syn = syn_flood_rule.get("thresholds", {}).get("max_syn_count", 500)
        for src_ip, buckets in src_syn_count.items():
            for bkt, syns in buckets.items():
                if syns > max_syn:
                    alerts.append({
                        "rule_name": "SYN_FLOOD",
                        "severity": syn_flood_rule.get("severity", "critical"),
                        "src_ip": src_ip,
                        "dst_ip": "Multiple",
                        "description": f"[MITRE T1498.001 - Direct Network Flood] SYN flood detected: {syns} SYN packets sent in 1s without ACKs."
                    })
                    break

    if large_exfil_rule.get("enabled"):
        max_bytes = large_exfil_rule.get("thresholds", {}).get("max_bytes", 50000000)
        for src_ip, bytes_sent in src_bytes.items():
            if bytes_sent > max_bytes:
                alerts.append({
                    "rule_name": "LARGE_EXFILTRATION",
                    "severity": large_exfil_rule.get("severity", "high"),
                    "src_ip": src_ip,
                    "dst_ip": "Multiple",
                    "description": f"[MITRE T1041 - Exfiltration Over C2 Channel] Large outbound transfer detected: {bytes_sent} bytes sent."
                })

    unique_alerts = {}
    for a in alerts:
        key = f"{a['rule_name']}_{a['src_ip']}_{a['dst_ip']}"
        if key not in unique_alerts:
            unique_alerts[key] = a
            
    return list(unique_alerts.values())
