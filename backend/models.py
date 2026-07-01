from datetime import datetime
from sqlalchemy import Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base


class Project(Base):
    __tablename__ = "projects"

    id:           Mapped[int]      = mapped_column(Integer, primary_key=True, index=True)
    name:         Mapped[str]      = mapped_column(String(255), nullable=False)
    client_brand: Mapped[str | None] = mapped_column(String(255), nullable=True)
    share_token:  Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True, index=True)
    created_at:   Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    snapshots: Mapped[list["Snapshot"]] = relationship(back_populates="project", cascade="all, delete-orphan")


class Snapshot(Base):
    __tablename__ = "snapshots"

    id:              Mapped[int]           = mapped_column(Integer, primary_key=True, index=True)
    project_id:      Mapped[int]           = mapped_column(Integer, ForeignKey("projects.id"), nullable=False)
    data_type:       Mapped[str]           = mapped_column(String(64), nullable=False)
    period:          Mapped[str | None]    = mapped_column(String(32), nullable=True)
    payload:         Mapped[str]           = mapped_column(Text, nullable=False)
    uploaded_at:     Mapped[datetime]      = mapped_column(DateTime, default=datetime.utcnow)
    source_filename: Mapped[str | None]    = mapped_column(String(512), nullable=True)

    project: Mapped["Project"] = relationship(back_populates="snapshots")
