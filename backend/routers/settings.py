from fastapi import APIRouter, Depends
from pydantic import BaseModel
from db.postgres import get_pool
from routers.auth import check_role

router = APIRouter()

class SIEMConfig(BaseModel):
    is_enabled: bool
    destination_url: str
    destination_type: str  # 'webhook' or 'syslog'

@router.get("/api/settings/siem")
async def get_siem_config(current_user: dict = Depends(check_role(["admin", "investigator"]))):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT is_enabled, destination_url, destination_type FROM siem_config ORDER BY id DESC LIMIT 1")
    
    if row:
        return dict(row)
    return {"is_enabled": False, "destination_url": "", "destination_type": "webhook"}

@router.post("/api/settings/siem")
async def update_siem_config(config: SIEMConfig, current_user: dict = Depends(check_role(["admin"]))):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO siem_config (is_enabled, destination_url, destination_type) VALUES ($1, $2, $3)",
            config.is_enabled, config.destination_url, config.destination_type
        )
    return {"status": "success"}
