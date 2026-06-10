import math

def shannon_entropy(s: str) -> float:
    if not s:
        return 0.0
    freq = {}
    for c in s:
        freq[c] = freq.get(c, 0) + 1
    probs = [f/len(s) for f in freq.values()]
    return -sum(p * math.log2(p) for p in probs if p > 0)

def detect_dns_tunnel(dns_query: str) -> dict | None:
    if not dns_query:
        return None
    
    subdomain = dns_query.split(".")[0] # Check leftmost label
    entropy = shannon_entropy(subdomain)
    length = len(subdomain)

    if length > 40 and entropy > 3.5:
        return {
            "rule_name": "DNS_TUNNEL",
            "severity": "critical",
            "description": f"DNS query '{dns_query[:60]}...' has entropy {entropy:.2f} and length {length}. Likely encoded tunnel data."
        }
    return None
