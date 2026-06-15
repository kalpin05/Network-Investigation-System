from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from db.postgres import get_pool
from routers.auth import check_role
import uuid

router = APIRouter()

class CreateCaseRequest(BaseModel):
    title: str
    notes: Optional[str] = ""
    alert_ids: Optional[list[str]] = []

class UpdateCaseRequest(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    alert_ids: Optional[list[str]] = None

@router.post("/api/cases")
async def create_case(
    req: CreateCaseRequest,
    current_user: dict = Depends(check_role(["admin", "investigator"]))
):
    pool = await get_pool()
    case_id = str(uuid.uuid4())
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO cases (case_id, title, notes, status) VALUES ($1, $2, $3, 'open')",
            case_id, req.title, req.notes or ""
        )
        # Link alerts to this case
        if req.alert_ids:
            for alert_id in req.alert_ids:
                await conn.execute(
                    "UPDATE alerts SET case_id = $1 WHERE alert_id = $2",
                    case_id, alert_id
                )
    return {"case_id": case_id, "title": req.title, "status": "open"}

@router.get("/api/cases")
async def list_cases(
    current_user: dict = Depends(check_role(["admin", "investigator", "viewer"]))
):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT c.*, COUNT(a.alert_id) as alert_count
            FROM cases c
            LEFT JOIN alerts a ON a.case_id = c.case_id
            GROUP BY c.case_id
            ORDER BY c.created_at DESC
        """)
    return [dict(r) for r in rows]

@router.get("/api/cases/{case_id}")
async def get_case(
    case_id: str,
    current_user: dict = Depends(check_role(["admin", "investigator", "viewer"]))
):
    pool = await get_pool()
    async with pool.acquire() as conn:
        case = await conn.fetchrow("SELECT * FROM cases WHERE case_id = $1", case_id)
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        alerts = await conn.fetch(
            "SELECT * FROM alerts WHERE case_id = $1 ORDER BY fired_at DESC", case_id
        )
    return {
        **dict(case),
        "alerts": [dict(a) for a in alerts]
    }

@router.patch("/api/cases/{case_id}")
async def update_case(
    case_id: str,
    req: UpdateCaseRequest,
    current_user: dict = Depends(check_role(["admin", "investigator"]))
):
    pool = await get_pool()
    async with pool.acquire() as conn:
        if req.title:
            await conn.execute("UPDATE cases SET title = $1 WHERE case_id = $2", req.title, case_id)
        if req.notes is not None:
            await conn.execute("UPDATE cases SET notes = $1 WHERE case_id = $2", req.notes, case_id)
        if req.status:
            await conn.execute("UPDATE cases SET status = $1 WHERE case_id = $2", req.status, case_id)
        if req.alert_ids is not None:
            # Clear existing links then re-link
            await conn.execute("UPDATE alerts SET case_id = NULL WHERE case_id = $1", case_id)
            for alert_id in req.alert_ids:
                await conn.execute(
                    "UPDATE alerts SET case_id = $1 WHERE alert_id = $2", case_id, alert_id
                )
    return {"case_id": case_id, "updated": True}


@router.get("/api/cases/{case_id}/attack-chain")
async def get_attack_chain(
    case_id: str,
    current_user: dict = Depends(check_role(["admin", "investigator", "viewer"]))
):
    """
    Returns alerts sorted chronologically with MITRE tactic ordering
    to reconstruct the attack kill chain.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        alerts = await conn.fetch(
            "SELECT * FROM alerts WHERE case_id = $1 ORDER BY fired_at ASC",
            case_id
        )

    # MITRE kill chain ordering (lower = earlier in attack)
    TACTIC_ORDER = {
        "T1046":    1,  # Recon: Network Service Discovery
        "T1595":    1,  # Recon: Active Scanning
        "T1498.001":2,  # Initial: SYN Flood
        "T1071.004":3,  # C2: DNS Tunnel
        "T1071.001":3,  # C2: Web Protocols / TLS Fingerprint
        "T1071":    3,  # C2: Command and Control
        "T1095":    3,  # C2: ICMP Covert
        "T1571":    3,  # C2: Non-Standard Port
        "T1041":    4,  # Exfil: Over C2 Channel
        "T1562":    5,  # Impact: Impair Defenses
    }

    chain = []
    for i, alert in enumerate(alerts):
        # Dynamically extract MITRE ID if present in description
        desc = alert.get("description", "")
        mitre_id = ""
        if "MITRE " in desc:
            try:
                parts = desc.split("MITRE ")
                if len(parts) > 1:
                    mitre_id = parts[1].split(" ")[0].strip()
            except Exception:
                pass
        
        # Fallback based on rule_name
        if not mitre_id:
            rule_name = alert.get("rule_name", "")
            if rule_name == "PORT_SCAN":
                mitre_id = "T1046"
            elif rule_name == "SYN_FLOOD":
                mitre_id = "T1498.001"
            elif rule_name == "DNS_TUNNEL":
                mitre_id = "T1071.004"
            elif rule_name == "ICMP_COVERT":
                mitre_id = "T1095"
            elif rule_name == "MALWARE_PORT":
                mitre_id = "T1571"
            elif rule_name == "SUSPICIOUS_TLD_POST" or rule_name == "MALICIOUS_TLS_FINGERPRINT":
                mitre_id = "T1071.001"
            elif rule_name == "C2_BEACONING":
                mitre_id = "T1071"
            elif rule_name == "LARGE_EXFILTRATION":
                mitre_id = "T1041"
            elif rule_name == "ANOMALY":
                mitre_id = "T1562"

        tactic_stage = TACTIC_ORDER.get(mitre_id, 3)
        chain.append({
            **dict(alert),
            "step": i + 1,
            "mitre_id": mitre_id,
            "tactic_stage": tactic_stage,
            "stage_label": [
                "", "Reconnaissance", "Initial Access / Weaponization",
                "Command & Control", "Exfiltration", "Impact"
            ][min(tactic_stage, 5)],
        })

    # Sort by tactic stage first, then time
    chain.sort(key=lambda x: (x["tactic_stage"], str(x["fired_at"])))

    return {"case_id": case_id, "chain": chain, "total_steps": len(chain)}
