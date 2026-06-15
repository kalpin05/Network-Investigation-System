import hashlib
import json

# Subset of known malicious JA3 hashes (from abuse.ch JA3 feeds)
MALICIOUS_JA3 = {
    "a0e9f5d64349fb13191bc781f81f42e1": "Cobalt Strike Beacon",
    "72a589da586844d7f0818ce684948eea": "Metasploit Meterpreter",
    "a10612e64c71e9d1c5c4db5f16e29e23": "Emotet C2",
    "4d7a28d6f2263ed61de88ca66eb011e3": "TrickBot",
    "1aa7bf8b40a7e5e4d6bd561e4b5f6c8c": "Dridex",
    "b386946a5a44d1ddcc843bc75336dfce": "AsyncRAT",
}

def extract_ja3_fields(packet: dict) -> dict | None:
    """
    Extract JA3 fields from TLS ClientHello packet metadata.
    Requires tls_* fields populated by PyShark during DPI.
    """
    if packet.get("protocol") not in ("TLS", "SSL"):
        return None

    cipher_suites  = packet.get("tls_cipher_suites", "")
    extensions     = packet.get("tls_extensions", "")
    elliptic_curves= packet.get("tls_elliptic_curves", "")
    ec_point_fmt   = packet.get("tls_ec_point_formats", "")
    tls_version    = packet.get("tls_version", "")

    if not cipher_suites:
        return None

    # JA3 string format: Version,Ciphers,Extensions,EllipticCurves,EllipticCurvePointFormats
    ja3_str = f"{tls_version},{cipher_suites},{extensions},{elliptic_curves},{ec_point_fmt}"
    ja3_hash = hashlib.md5(ja3_str.encode()).hexdigest()

    return {"ja3_hash": ja3_hash, "ja3_string": ja3_str}


def check_ja3(packet: dict) -> dict | None:
    """
    Check packet JA3 hash against known malicious fingerprints.
    Returns alert dict or None.
    """
    fields = extract_ja3_fields(packet)
    if not fields:
        return None

    ja3_hash = fields["ja3_hash"]
    if ja3_hash in MALICIOUS_JA3:
        malware = MALICIOUS_JA3[ja3_hash]
        return {
            "rule_name": "MALICIOUS_TLS_FINGERPRINT",
            "severity": "critical",
            "mitre_id": "T1071.001",
            "mitre_tactic": "Command and Control: Application Layer Protocol",
            "src_ip": packet.get("src_ip", ""),
            "dst_ip": packet.get("dst_ip", ""),
            "description": (
                f"[MITRE T1071.001 - Web Protocols] Known malicious TLS fingerprint detected: {malware}. "
                f"JA3 hash {ja3_hash} matches threat intelligence database. "
                f"Encrypted C2 channel suspected without decryption."
            ),
            "evidence": {"ja3_hash": ja3_hash, "malware_family": malware},
        }
    return None
