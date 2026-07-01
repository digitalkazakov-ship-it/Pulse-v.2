from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / '.env')

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from .database import engine, Base
import os
from .routers import projects, data, insights, conversations
from .routers.share import projects_router as share_projects_router, public_router as share_public_router

Base.metadata.create_all(bind=engine)

# Migrations
with engine.connect() as conn:
    for stmt in [
        "ALTER TABLE projects ADD COLUMN client_brand VARCHAR(255)",
        "ALTER TABLE projects ADD COLUMN share_token VARCHAR(64)",
    ]:
        try:
            conn.execute(text(stmt))
            conn.commit()
        except Exception:
            pass

app = FastAPI(title="Pulse API", version="2.0")

_origins_env = os.environ.get("ALLOWED_ORIGINS", "")
_origins = [o.strip() for o in _origins_env.split(",") if o.strip()] or [
    "http://localhost:5173", "http://localhost:8080", "http://localhost:8081"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"https://.*\.(up\.railway|netlify)\.app",
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router,        prefix="/api/projects", tags=["projects"])
app.include_router(data.router,            prefix="/api/projects", tags=["data"])
app.include_router(insights.router,        prefix="/api/projects", tags=["insights"])
app.include_router(conversations.router,   prefix="/api/projects", tags=["conversations"])
app.include_router(share_projects_router,  prefix="/api/projects", tags=["share"])
app.include_router(share_public_router,    prefix="/api",          tags=["public"])


@app.get("/api/health")
def health():
    return {"status": "ok"}
