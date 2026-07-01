import json
import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Project, Snapshot

projects_router = APIRouter()
public_router = APIRouter()


@projects_router.post("/{project_id}/share")
def create_share_token(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    if not project.share_token:
        project.share_token = secrets.token_urlsafe(16)
        db.commit()
        db.refresh(project)
    return {"share_token": project.share_token}


@projects_router.delete("/{project_id}/share")
def revoke_share_token(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    project.share_token = None
    db.commit()
    return {"status": "revoked"}


@public_router.get("/public/{token}")
def get_public_project(token: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.share_token == token).first()
    if not project:
        raise HTTPException(404, "Not found")
    return {"id": project.id, "name": project.name}


@public_router.get("/public/{token}/data/{data_type}")
def get_public_data(token: str, data_type: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.share_token == token).first()
    if not project:
        raise HTTPException(404, "Not found")
    snap = (
        db.query(Snapshot)
        .filter(Snapshot.project_id == project.id, Snapshot.data_type == data_type)
        .order_by(Snapshot.uploaded_at.desc())
        .first()
    )
    if not snap:
        raise HTTPException(404, f"No data for type '{data_type}'")
    return json.loads(snap.payload)
