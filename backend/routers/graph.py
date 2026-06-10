from fastapi import APIRouter

router = APIRouter()

@router.get("/api/graph")
async def get_graph():
    return {"nodes": [], "edges": []}
