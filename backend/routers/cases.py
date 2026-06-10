from fastapi import APIRouter

router = APIRouter()

@router.get("/api/cases")
async def list_cases():
    return []
