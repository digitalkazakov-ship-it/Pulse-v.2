from datetime import datetime
from pydantic import BaseModel


class ProjectCreate(BaseModel):
    name: str
    client_brand: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    client_brand: str | None = None


class ProjectOut(BaseModel):
    id: int
    name: str
    client_brand: str | None
    share_token: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SnapshotOut(BaseModel):
    id: int
    project_id: int
    data_type: str
    period: str | None
    uploaded_at: datetime
    source_filename: str | None

    model_config = {"from_attributes": True}


class UploadResult(BaseModel):
    status: str
    snapshot_id: int
    data_type: str
    period: str | None = None
