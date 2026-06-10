from .dns_tunnel import detect_dns_tunnel

def run_all_signatures(packets: list[dict], session_id: str) -> list[dict]:
    alerts = []
    
    # Trackers for aggregate rules
    src_ports = {} # src_ip -> set of dst_port
    src_syn_count = {} # src_ip -> count of SYN flags
    src_bytes = {} # src_ip -> total outbound bytes

    for pkt in packets:
        src_ip = pkt.get("src_ip", "0.0.0.0")
        dst_ip = pkt.get("dst_ip", "0.0.0.0")
        dst_port = pkt.get("dst_port", 0)
        src_port = pkt.get("src_port", 0)
        protocol = pkt.get("protocol", "")
        packet_length = pkt.get("packet_length", 0)
        flags = pkt.get("flags", "")
        dns_query = pkt.get("dns_query", "")

        # 1. DNS Tunnel
        if dns_query:
            dns_alert = detect_dns_tunnel(dns_query)
            if dns_alert:
                alerts.append({
                    "rule_name": dns_alert["rule_name"],
                    "severity": dns_alert["severity"],
                    "src_ip": src_ip,
                    "dst_ip": dst_ip,
                    "description": dns_alert["description"]
                })

        # 2. ICMP Covert Channel
        # Assuming Ethernet (14) + IP (20) + ICMP Header (8) = 42 bytes. Anything larger has a payload.
        if protocol == "ICMP" and packet_length > 42:
            alerts.append({
                "rule_name": "ICMP_COVERT",
                "severity": "medium",
                "src_ip": src_ip,
                "dst_ip": dst_ip,
                "description": f"Abnormal ICMP packet length {packet_length} bytes. Possible covert channel payload."
            })

        # 3. Known Malware Ports
        if dst_port in [4444, 31337, 6667, 1080, 9001] or src_port in [4444, 31337, 6667, 1080, 9001]:
            mal_port = dst_port if dst_port in [4444, 31337, 6667, 1080, 9001] else src_port
            alerts.append({
                "rule_name": "MALWARE_PORT",
                "severity": "high",
                "src_ip": src_ip,
                "dst_ip": dst_ip,
                "description": f"Connection on known malware/C2 port {mal_port} detected."
            })

        # Track for aggregate logic
        if src_ip not in src_ports:
            src_ports[src_ip] = set()
            src_syn_count[src_ip] = 0
            src_bytes[src_ip] = 0

        src_ports[src_ip].add(dst_port)
        src_bytes[src_ip] += packet_length
        # Scapy / Pyshark TCP flags representation can vary, 'S' or '0x002' for SYN
        # We will do a generic check if S is in the flags string and A is not
        flags_str = str(flags).upper()
        if protocol == "TCP" and "S" in flags_str and "A" not in flags_str:
            src_syn_count[src_ip] += 1

    # Aggregate evaluation
    for src_ip, ports in src_ports.items():
        if len(ports) > 20:
            alerts.append({
                "rule_name": "PORT_SCAN",
                "severity": "high",
                "src_ip": src_ip,
                "dst_ip": "Multiple",
                "description": f"Port scan detected: {len(ports)} unique ports targeted."
            })

    for src_ip, syns in src_syn_count.items():
        if syns > 500:
            alerts.append({
                "rule_name": "SYN_FLOOD",
                "severity": "critical",
                "src_ip": src_ip,
                "dst_ip": "Multiple",
                "description": f"SYN flood detected: {syns} SYN packets sent without ACKs."
            })

    for src_ip, bytes_sent in src_bytes.items():
        if bytes_sent > 50_000_000: # 50MB
            alerts.append({
                "rule_name": "LARGE_EXFILTRATION",
                "severity": "high",
                "src_ip": src_ip,
                "dst_ip": "Multiple",
                "description": f"Large outbound transfer detected: {bytes_sent} bytes sent."
            })

    # Return unique alerts to prevent spam (e.g. DNS tunnel firing on every packet)
    # Using a dictionary to deduplicate based on rule_name + src_ip
    unique_alerts = {}
    for a in alerts:
        key = f"{a['rule_name']}_{a['src_ip']}_{a['dst_ip']}"
        if key not in unique_alerts:
            unique_alerts[key] = a
            
    return list(unique_alerts.values())
