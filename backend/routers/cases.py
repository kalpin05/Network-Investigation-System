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
