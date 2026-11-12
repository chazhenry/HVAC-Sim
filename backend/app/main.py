"""HVAC-Sim API.

The browser runs the live electrical / refrigerant simulation. This service
owns the scenario library, hands out the unit's physical parameters (never the
fault label), reveals hints, and grades the finished job against the answer key.
"""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, HTTPException, Query, Request, Response
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
from . import llm
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
from .tutor import ChatRequest, ChatResponse, UsageLimiter, build_messages
from .visits import VISITS_ADMIN_IPS, VisitEntry, VisitRequest, VisitsPage, locate_visit

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
    llm.load_env_file()
    app = FastAPI(title="HVAC-Sim API", version="0.1.0")
    limiter = UsageLimiter()
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

    @app.post("/api/visits", status_code=202)
    def track_visit(body: VisitRequest, request: Request, tasks: BackgroundTasks) -> dict[str, str]:
        # Uvicorn resolves forwarding only from trusted proxies. Never accept an IP in the body.
        ip = request.client.host if request.client else "unknown"
        # Exclude administrators from all analytics events, including future activity events.
        if ip in VISITS_ADMIN_IPS:
            return {"status": "excluded"}
        visit_id = str(body.visit_id)
        if store.record_visit(visit_id, ip, body.app_version, body.event, body.user):
            tasks.add_task(locate_visit, store, visit_id, ip)
        return {"status": "accepted"}

    def can_browse_visits(request: Request) -> bool:
        return request.client is not None and request.client.host in VISITS_ADMIN_IPS

    @app.get("/api/visits/access")
    def visits_access(request: Request, response: Response) -> dict[str, bool]:
        response.headers["Cache-Control"] = "no-store"
        return {"allowed": can_browse_visits(request)}

    @app.get("/api/visits", response_model=VisitsPage)
    def browse_visits(
        request: Request,
        response: Response,
        search: str = Query(default="", max_length=200),
        limit: int = Query(default=50, ge=1, le=200),
        offset: int = Query(default=0, ge=0),
    ) -> VisitsPage:
        if not can_browse_visits(request):
            raise HTTPException(status_code=403, detail="Visit log access denied")
        response.headers["Cache-Control"] = "no-store"
        items, total = store.browse_visits(search.strip(), limit, offset)
        return VisitsPage(items=[VisitEntry(**item) for item in items], total=total, offset=offset, limit=limit)

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

    @app.post("/api/sessions/{session_id}/chat", response_model=ChatResponse)
    async def chat(session_id: str, body: ChatRequest) -> ChatResponse:
        _, scenario = load(session_id)
        if (refusal := limiter.check(session_id)) is not None:
            raise HTTPException(status_code=429, detail=refusal)
        try:
            reply, provider = await llm.complete(build_messages(scenario, body))
        except llm.LlmNotConfigured as e:
            raise HTTPException(status_code=503, detail=str(e)) from e
        except llm.LlmError as e:
            raise HTTPException(status_code=502, detail="The tutor could not be reached. Try again.") from e
        return ChatResponse(reply=reply, provider=provider)

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
