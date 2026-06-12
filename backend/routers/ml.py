from fastapi import APIRouter, Depends, BackgroundTasks
from routers.auth import check_role
from ml.anomaly import train_baseline, generate_synthetic_benign_sessions, CONFIG_PATH
from pydantic import BaseModel
import json
import os
import asyncio

router = APIRouter()

class TrainRequest(BaseModel):
    contamination: float

@router.get("/api/ml/status")
async def get_ml_status(current_user: dict = Depends(check_role(["admin", "investigator", "viewer"]))):
    """Returns the current ML model configuration and status."""
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r") as f:
                config = json.load(f)
            return config
        except Exception:
            pass
    
    # Default if no config exists
    return {
        "status": "inactive",
        "contamination": 0.05,
        "last_trained": None
    }

async def async_train_model(contamination: float):
    """Background task to simulate training duration and train the model."""
    # Simulate processing time for demo impact
    await asyncio.sleep(2.0)
    sessions = generate_synthetic_benign_sessions(num_sessions=200)
    train_baseline(sessions, contamination=contamination)

@router.post("/api/ml/train")
async def train_ml_model(
    req: TrainRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(check_role(["admin"]))
):
    """Triggers retraining of the Isolation Forest model."""
    if not (0.01 <= req.contamination <= 0.20):
        return {"error": "Contamination must be between 0.01 and 0.20"}
        
    background_tasks.add_task(async_train_model, req.contamination)
    
    return {"message": "Training started in background", "contamination": req.contamination}
