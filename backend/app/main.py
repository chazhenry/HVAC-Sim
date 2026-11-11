"""HVAC-Sim API.

The browser runs the live electrical / refrigerant simulation. This service
owns the scenario library, hands out the unit's physical parameters (never the
fault label), reveals hints, and grades the finished job against the answer key.
"""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .exam import (
    SECTION_META,
    ExamPaper,
    ExamResult,
    GradeExamRequest,
    Section,
    SectionInfo,
    grade_exam,
    paper,
    section_info,
)
from .grading import grade
from .models import (
    ApiModel,
    CatalogResponse,
    GradeResponse,
    HintResponse,
    SessionResponse,
    StartSessionRequest,
    SubmitRequest,
)
from .scenarios import DIAGNOSES, DIAGNOSIS_BY_ID, SCENARIO_BY_ID, SCENARIOS, Scenario
from .store import SessionRow, SessionStore

DEFAULT_DB = Path(__file__).resolve().parent.parent / "hvac_sim.db"
DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]


def allowed_origins() -> list[str]:
    """Browser origins allowed to call the API: local dev plus HVAC_SIM_CORS_ORIGINS (comma separated)."""
    extra = os.environ.get("HVAC_SIM_CORS_ORIGINS", "")
    return DEV_ORIGINS + [o.strip().rstrip("/") for o in extra.split(",") if o.strip()]


class HistoryEntry(ApiModel):
    session_id: str
    scenario_id: str
    scenario_title: str
    finished_at: str
    score: int


def create_app(db_path: Path | str | None = None) -> FastAPI:
    app = FastAPI(title="HVAC-Sim API", version="0.1.0")
    store = SessionStore(db_path or os.environ.get("HVAC_SIM_DB", DEFAULT_DB))

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins(),
        allow_methods=["*"],
        allow_headers=["*"],
    )

    def load(session_id: str) -> tuple[SessionRow, Scenario]:
        row = store.get(session_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Unknown session")
        return row, SCENARIO_BY_ID[row.scenario_id]

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/catalog", response_model=CatalogResponse)
    def catalog() -> CatalogResponse:
        return CatalogResponse(
            scenarios=[s.summary() for s in SCENARIOS], diagnoses=list(DIAGNOSES)
        )

    @app.post("/api/sessions", response_model=SessionResponse)
    def start_session(body: StartSessionRequest) -> SessionResponse:
        scenario = SCENARIO_BY_ID.get(body.scenario_id)
        if scenario is None:
            raise HTTPException(status_code=404, detail="Unknown scenario")
        row = store.create(scenario.id)
        return SessionResponse(
            session_id=row.id,
            scenario=scenario.summary(),
            unit_type=scenario.unit_type,
            unit=scenario.unit,
            furnace=scenario.furnace,
            environment=scenario.environment,
        )

    @app.post("/api/sessions/{session_id}/hint", response_model=HintResponse)
    def next_hint(session_id: str) -> HintResponse:
        _, scenario = load(session_id)
        used = store.use_hint(session_id, len(scenario.hints))
        return HintResponse(
            hint=scenario.hints[used - 1], hints_used=used, hints_total=len(scenario.hints)
        )

    @app.post("/api/sessions/{session_id}/submit", response_model=GradeResponse)
    def submit(session_id: str, body: SubmitRequest) -> GradeResponse:
        row, scenario = load(session_id)
        if row.finished_at is not None:
            raise HTTPException(status_code=409, detail="Session already graded")
        if body.diagnosis_id not in DIAGNOSIS_BY_ID:
            raise HTTPException(status_code=422, detail="Unknown diagnosis")
        final = body.furnace_final if scenario.unit_type == "furnace" else body.final_state
        if final is None:
            raise HTTPException(status_code=422, detail="Final readings for this unit are missing")
        result = grade(scenario, body, row.hints_used)
        store.finish(session_id, result.score, result.model_dump_json(by_alias=True))
        return result

    @app.get("/api/exam", response_model=list[SectionInfo])
    def exam_sections() -> list[SectionInfo]:
        return [section_info(s) for s in SECTION_META]

    @app.get("/api/exam/{section}", response_model=ExamPaper)
    def exam_paper(section: Section) -> ExamPaper:
        return paper(section)

    @app.post("/api/exam/{section}/grade", response_model=ExamResult)
    def exam_grade(section: Section, body: GradeExamRequest) -> ExamResult:
        return grade_exam(section, body.answers)

    @app.get("/api/history", response_model=list[HistoryEntry])
    def history() -> list[HistoryEntry]:
        return [
            HistoryEntry(
                session_id=r.id,
                scenario_id=r.scenario_id,
                scenario_title=SCENARIO_BY_ID[r.scenario_id].title,
                finished_at=r.finished_at or "",
                score=r.score or 0,
            )
            for r in store.history()
            if r.scenario_id in SCENARIO_BY_ID
        ]

    return app


app = create_app()
