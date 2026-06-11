from db.postgres import get_pool
from typing import Optional

async def log_custody(session_id: Optional[str], user_id: Optional[int], action: str, ip_address: Optional[str] = "127.0.0.1"):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO custody_log (session_id, user_id, action, ip_address) VALUES ($1, $2, $3, $4)",
            session_id, user_id, action, ip_address or "127.0.0.1"
        )
