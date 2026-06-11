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
