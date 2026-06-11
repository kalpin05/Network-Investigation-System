from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import pcap, alerts, cases, graph, auth, forensics
from db.postgres import init_db

app = FastAPI(title="KanadShield API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    await init_db()

@app.get("/health")
def health():
    return {"status": "ok", "service": "kanadshield"}

app.include_router(auth.router, tags=["auth"])
app.include_router(pcap.router, tags=["pcap"])
app.include_router(alerts.router, tags=["alerts"])
app.include_router(cases.router, tags=["cases"])
app.include_router(graph.router, tags=["graph"])
app.include_router(forensics.router, tags=["forensics"])
