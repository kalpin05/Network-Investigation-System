<<<<<<< HEAD
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db.postgres import get_pool
from typing import List, Optional

router = APIRouter()

class CaseCreate(BaseModel):
    title: str
    assigned_to: Optional[int] = None
    notes: Optional[str] = ""
    evidence_refs: Optional[List[str]] = []

class CaseUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    assigned_to: Optional[int] = None

@router.get("/api/cases")
async def list_cases():
    pool = await get_pool()
    async with pool.acquire() as conn:
        records = await conn.fetch("SELECT * FROM cases ORDER BY created_at DESC")
        return [dict(r) for r in records]

@router.post("/api/cases")
async def create_case(case: CaseCreate):
    pool = await get_pool()
    async with pool.acquire() as conn:
        case_id = await conn.fetchval("""
            INSERT INTO cases (title, assigned_to, notes, evidence_refs)
            VALUES ($1, $2, $3, $4)
            RETURNING case_id
        """, case.title, case.assigned_to, case.notes, case.evidence_refs)
        
        if case.evidence_refs:
            for ref in case.evidence_refs:
                try:
                    await conn.execute("UPDATE alerts SET case_id = $1 WHERE alert_id = $2::uuid", case_id, ref)
                except Exception:
                    pass
                    
        return {"case_id": case_id, "message": "Case created successfully"}

@router.patch("/api/cases/{case_id}")
async def update_case(case_id: str, updates: CaseUpdate):
    pool = await get_pool()
    async with pool.acquire() as conn:
        set_clauses = []
        values = []
        idx = 1
        
        if updates.status is not None:
            set_clauses.append(f"status = ${idx}")
            values.append(updates.status)
            idx += 1
        if updates.notes is not None:
            set_clauses.append(f"notes = ${idx}")
            values.append(updates.notes)
            idx += 1
        if updates.assigned_to is not None:
            set_clauses.append(f"assigned_to = ${idx}")
            values.append(updates.assigned_to)
            idx += 1
            
        if not set_clauses:
            return {"message": "No updates provided"}
            
        values.append(case_id)
        query = f"UPDATE cases SET {', '.join(set_clauses)} WHERE case_id = ${idx}::uuid"
        
        await conn.execute(query, *values)
        return {"message": "Case updated successfully"}
=======
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
>>>>>>> 9b5ac5b9c2cf63cd2e6f0449a34be50b7ca2fd62
