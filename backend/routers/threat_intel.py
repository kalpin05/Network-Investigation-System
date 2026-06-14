import hashlib
import ipaddress
import random
import requests
from fastapi import APIRouter, HTTPException

router = APIRouter()

@router.get("/api/threat-intel/{ip}")
def get_threat_intel(ip: str):
    # 1. Determine if IP is local/private
    try:
        ip_obj = ipaddress.ip_address(ip)
        is_private = ip_obj.is_private
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid IP address")

    # 2. Fetch Geo/ISP data using free ip-api.com
    geo_data = {
        "country": "Unknown",
        "city": "Unknown",
        "isp": "Local Network" if is_private else "Unknown ISP"
    }
    
    if not is_private:
        try:
            resp = requests.get(f"http://ip-api.com/json/{ip}", timeout=3)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("status") == "success":
                    geo_data["country"] = data.get("country", "Unknown")
                    geo_data["city"] = data.get("city", "Unknown")
                    geo_data["isp"] = data.get("isp", "Unknown ISP")
        except Exception as e:
            print(f"Failed to fetch GeoIP for {ip}: {e}")

    # 3. Simulate National Cyber Crime Database (NCCD)
    if is_private:
        return {
            "ip": ip,
            "geo": geo_data,
            "threat": {
                "risk_score": 0,
                "threat_level": "SAFE",
                "tags": ["Internal Network"],
                "reported_incidents": 0,
                "last_seen": "N/A"
            }
        }

    # Deterministic generation based on IP string
    seed = int(hashlib.md5(ip.encode()).hexdigest()[:8], 16)
    random.seed(seed)
    
    risk_score = random.randint(0, 100)
    
    if risk_score > 85:
        threat_level = "CRITICAL"
        tag_pool = ["C2 Server", "Ransomware Node", "Botnet", "Known APT"]
    elif risk_score > 60:
        threat_level = "HIGH"
        tag_pool = ["Malware Delivery", "Phishing Host", "Spam Relay"]
    elif risk_score > 30:
        threat_level = "MEDIUM"
        tag_pool = ["Suspicious", "Tor Exit Node", "Port Scanner"]
    else:
        threat_level = "LOW"
        tag_pool = ["Clean"]

    num_tags = random.randint(1, min(3, len(tag_pool)))
    tags = random.sample(tag_pool, num_tags)
    
    incidents = random.randint(0, 50) if risk_score > 30 else random.randint(0, 2)
    last_seen_days = random.randint(1, 30)
    
    return {
        "ip": ip,
        "geo": geo_data,
        "threat": {
            "risk_score": risk_score,
            "threat_level": threat_level,
            "tags": tags,
            "reported_incidents": incidents,
            "last_seen": f"{last_seen_days} days ago" if incidents > 0 else "Never"
        }
    }
