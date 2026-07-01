import json
import tempfile
import zipfile
import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Project, Snapshot
from ..schemas import SnapshotOut, UploadResult
from ..processors.registry import PROCESSORS, MULTI_FILE_PROCESSORS

router = APIRouter()

# Data types that accumulate across uploads (sentiment history)
ACCUMULATING_TYPES = {"perception"}


@router.get("/{project_id}/snapshots", response_model=list[SnapshotOut])
def list_snapshots(project_id: int, db: Session = Depends(get_db)):
    _require_project(project_id, db)
    return (
        db.query(Snapshot)
        .filter_by(project_id=project_id)
        .order_by(Snapshot.uploaded_at.desc())
        .all()
    )


@router.get("/{project_id}/data/{data_type}")
def get_data(project_id: int, data_type: str, db: Session = Depends(get_db)):
    _require_project(project_id, db)

    if data_type == "perception":
        return _merge_perception(project_id, db)

    snapshot = (
        db.query(Snapshot)
        .filter_by(project_id=project_id, data_type=data_type)
        .order_by(Snapshot.uploaded_at.desc())
        .first()
    )
    if not snapshot:
        raise HTTPException(404, f"No data of type '{data_type}' for this project")
    return json.loads(snapshot.payload)


@router.post("/{project_id}/upload/{data_type}", response_model=UploadResult)
async def upload_file(
    project_id: int,
    data_type: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    _require_project(project_id, db)

    if data_type not in PROCESSORS and data_type not in MULTI_FILE_PROCESSORS:
        raise HTTPException(400, f"Unknown data type '{data_type}'")

    content = await file.read()

    if data_type in MULTI_FILE_PROCESSORS:
        payload = _process_zip(data_type, content)
    else:
        payload = _process_single(data_type, content, file.filename or "upload.xlsx")

    snapshot = Snapshot(
        project_id=project_id,
        data_type=data_type,
        payload=json.dumps(payload, ensure_ascii=False),
        source_filename=file.filename,
        period=payload.get("generated"),
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)

    return UploadResult(
        status="ok",
        snapshot_id=snapshot.id,
        data_type=data_type,
        period=snapshot.period,
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _require_project(project_id: int, db: Session):
    if not db.get(Project, project_id):
        raise HTTPException(404, "Project not found")


def _process_single(data_type: str, content: bytes, filename: str) -> dict:
    processor = PROCESSORS[data_type]
    suffix = os.path.splitext(filename)[1] or ".xlsx"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    try:
        return processor(tmp_path)
    except Exception as e:
        raise HTTPException(422, f"Processing error: {e}")
    finally:
        os.unlink(tmp_path)


def _process_zip(data_type: str, content: bytes) -> dict:
    processor = MULTI_FILE_PROCESSORS[data_type]
    with tempfile.TemporaryDirectory() as tmpdir:
        zip_path = os.path.join(tmpdir, "upload.zip")
        with open(zip_path, "wb") as f:
            f.write(content)
        with zipfile.ZipFile(zip_path) as zf:
            zf.extractall(tmpdir)
        try:
            return processor(tmpdir)
        except Exception as e:
            raise HTTPException(422, f"Processing error: {e}")


def _merge_perception(project_id: int, db: Session) -> dict:
    snapshots = (
        db.query(Snapshot)
        .filter_by(project_id=project_id, data_type="perception")
        .order_by(Snapshot.uploaded_at.asc())
        .all()
    )
    if not snapshots:
        raise HTTPException(404, "No perception data for this project")

    # Use latest snapshot for everything except sentiment
    latest = json.loads(snapshots[-1].payload)

    # Merge sentiment arrays from all snapshots in chronological order
    seen_periods: set = set()
    merged_sentiment = []
    for snap in snapshots:
        data = json.loads(snap.payload)
        for point in data.get("sentiment", []):
            key = point.get("period", point.get("month", ""))
            if key not in seen_periods:
                seen_periods.add(key)
                merged_sentiment.append(point)

    latest["sentiment"] = merged_sentiment
    return latest
