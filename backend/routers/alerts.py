from fastapi import APIRouter, Query, Depends
from db.postgres import get_pool
from typing import Optional
from routers.auth import check_role

router = APIRouter()

@router.get("/api/alerts")
async def list_alerts(
    severity: Optional[str] = None,
    rule_name: Optional[str] = None,
    session_id: Optional[str] = None,
    limit: int = Query(default=100, le=500),
    current_user: dict = Depends(check_role(["admin", "investigator", "viewer"]))
):
    pool = await get_pool()
    query = "SELECT * FROM alerts WHERE 1=1"
    params = []

    if severity:
        params.append(severity)
        query += f" AND severity = ${len(params)}"
    if rule_name:
        params.append(rule_name)
        query += f" AND rule_name = ${len(params)}"
    if session_id:
        params.append(session_id)
        query += f" AND session_id = ${len(params)}"

    query += " ORDER BY fired_at DESC"
    params.append(limit)
    query += f" LIMIT ${len(params)}"

    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *params)

    return [dict(r) for r in rows]

@router.get("/api/dashboard")
async def dashboard_stats(
    current_user: dict = Depends(check_role(["admin", "investigator", "viewer"]))
):
    pool = await get_pool()
    async with pool.acquire() as conn:
        total_sessions = await conn.fetchval("SELECT COUNT(*) FROM sessions")
        total_packets = await conn.fetchval("SELECT COALESCE(SUM(packet_count),0) FROM sessions")
        total_alerts = await conn.fetchval("SELECT COUNT(*) FROM alerts")
        critical_alerts = await conn.fetchval("SELECT COUNT(*) FROM alerts WHERE severity = 'critical'")
    return {
        "sessions": total_sessions,
        "packets": total_packets,
        "alerts": total_alerts,
        "critical": critical_alerts
    }

