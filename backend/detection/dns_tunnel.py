import math

def shannon_entropy(s: str) -> float:
    if not s:
        return 0.0
    freq = {}
    for c in s:
        freq[c] = freq.get(c, 0) + 1
    probs = [f/len(s) for f in freq.values()]
    return -sum(p * math.log2(p) for p in probs if p > 0)

def detect_dns_tunnel(dns_query: str, min_length: int = 40, min_entropy: float = 3.5) -> dict | None:
    if not dns_query:
        return None
    
    subdomain = dns_query.split(".")[0] # Check leftmost label
    entropy = shannon_entropy(subdomain)
    length = len(subdomain)

    if length > min_length and entropy > min_entropy:
        return {
            "rule_name": "DNS_TUNNEL",
            "severity": "critical",
            "description": f"[MITRE T1071.004 - Application Layer Protocol: DNS] DNS query '{dns_query[:60]}...' has entropy {entropy:.2f} and length {length}. Likely encoded tunnel data."
        }
    return None
