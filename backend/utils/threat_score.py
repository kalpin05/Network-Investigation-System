from db.postgres import get_pool

SEVERITY_WEIGHTS = {
    "critical": 30,
    "high":     15,
    "medium":   8,
    "low":      3,
}

RULE_BONUSES = {
    "DNS_TUNNEL":                 20,
    "C2_BEACONING":               25,
    "MALICIOUS_TLS_FINGERPRINT":  30,
    "DATA_EXFILTRATION":          20,
    "ICMP_COVERT_CHANNEL":        15,
}

async def compute_threat_score(session_id: str) -> dict:
    """
    Compute 0–100 threat score for a session based on alerts fired.
    Higher = more dangerous.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        alerts = await conn.fetch(
            "SELECT rule_name, severity FROM alerts WHERE session_id = $1",
            session_id
        )
        anomaly_score = await conn.fetchval(
            "SELECT anomaly_score FROM sessions WHERE session_id = $1",
            session_id
        )

    score = 0

    for alert in alerts:
        # Base score from severity
        score += SEVERITY_WEIGHTS.get(alert["severity"], 3)
        # Bonus for high-value rules
        score += RULE_BONUSES.get(alert["rule_name"], 0)

    # AI anomaly contribution
    if anomaly_score is not None and anomaly_score < -0.2:
        score += int(abs(anomaly_score) * 20)

    score = min(score, 100)

    # Threat level label
    if score >= 70:
        level = "CRITICAL"
        color = "red"
    elif score >= 40:
        level = "HIGH"
        color = "orange"
    elif score >= 20:
        level = "MEDIUM"
        color = "yellow"
    else:
        level = "LOW"
        color = "green"

    # Update session in DB
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE sessions SET threat_score = $1 WHERE session_id = $2",
            score, session_id
        )

    return {"session_id": session_id, "score": score, "level": level, "color": color}
