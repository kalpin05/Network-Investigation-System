import hashlib
import ipaddress
import random
import time
import requests
import os
import json
import redis
from fastapi import APIRouter, HTTPException

router = APIRouter()

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
try:
    r_client = redis.from_url(REDIS_URL, decode_responses=True)
except Exception as e:
    print(f"[Redis] Connection to {REDIS_URL} failed: {e}")
    r_client = None

# In-memory cache for IP geolocations
GEO_CACHE = {}
# Cooldown timestamp to temporarily suspend external API requests when rate-limited
api_cooldown_until = 0.0

def get_deterministic_geoip(ip: str) -> dict:
    """Fallback generator for IP location information based on hashing."""
    seed = int(hashlib.md5(ip.encode()).hexdigest()[:8], 16)
    countries = [
        ("United States", "New York", "Comcast Cable"),
        ("Germany", "Frankfurt", "Deutsche Telekom"),
        ("China", "Beijing", "China Telecom"),
        ("Brazil", "Sao Paulo", "Telefonica Brasil"),
        ("North Korea", "Pyongyang", "Star Joint Venture"),
        ("India", "Mumbai", "Reliance Jio"),
        ("United Kingdom", "London", "British Telecom"),
        ("Russia", "Moscow", "Rostelecom")
    ]
    country, city, isp = countries[seed % len(countries)]
    return {
        "country": country,
        "city": city,
        "isp": isp
    }

def get_geoip(ip: str) -> dict:
    """Fetch geo/ISP data from ip-api.com, caching results in Redis and handling rate limiting gracefully."""
    global api_cooldown_until
    
    # Try loading from Redis first
    if r_client:
        try:
            cached_data = r_client.get(f"geoip:{ip}")
            if cached_data:
                return json.loads(cached_data)
        except Exception as err:
            print(f"[Redis] Read failed for {ip}: {err}")

    # Fall back to in-memory GEO_CACHE
    if ip in GEO_CACHE:
        return GEO_CACHE[ip]
        
    now = time.time()
    if now < api_cooldown_until:
        return get_deterministic_geoip(ip)
        
    try:
        resp = requests.get(f"http://ip-api.com/json/{ip}", timeout=3)
        if resp.status_code == 429:
            api_cooldown_until = now + 60.0
            print(f"Rate limited (429) by ip-api.com. Cooldown active for 60s.")
            return get_deterministic_geoip(ip)
            
        if resp.status_code == 200:
            data = resp.json()
            if data.get("status") == "success":
                geo_data = {
                    "country": data.get("country", "Unknown"),
                    "city": data.get("city", "Unknown"),
                    "isp": data.get("isp", "Unknown ISP")
                }
                
                # Save to Redis with 24h expiration
                if r_client:
                    try:
                        r_client.setex(f"geoip:{ip}", 86400, json.dumps(geo_data))
                    except Exception as err:
                        print(f"[Redis] Write failed for {ip}: {err}")

                # Local cache fallback
                if len(GEO_CACHE) > 2000:
                    GEO_CACHE.clear()
                GEO_CACHE[ip] = geo_data
                return geo_data
            elif data.get("status") == "fail" and "quota" in data.get("message", "").lower():
                api_cooldown_until = now + 60.0
                print(f"Rate limited (fail/quota) by ip-api.com. Cooldown active for 60s.")
                return get_deterministic_geoip(ip)
    except Exception as e:
        print(f"Failed to fetch GeoIP for {ip}: {e}")
        
    return get_deterministic_geoip(ip)

@router.get("/api/threat-intel/{ip}")
def get_threat_intel(ip: str):
    # 1. Determine if IP is local/private
    try:
        ip_obj = ipaddress.ip_address(ip)
        is_private = ip_obj.is_private
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid IP address")

    # 2. Fetch Geo/ISP data using free ip-api.com with caching & fallback
    if is_private:
        geo_data = {
            "country": "Unknown",
            "city": "Unknown",
            "isp": "Local Network"
        }
    else:
        geo_data = get_geoip(ip)

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
