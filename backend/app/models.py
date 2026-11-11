"""Pydantic models shared by the API.

All models serialise to camelCase so they line up one-to-one with the
TypeScript interfaces in ``frontend/src/api/types.ts``.
"""

from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# --------------------------------------------------------------------------
# Physical description of the unit. This is what the browser simulates.
# It deliberately carries *measurable properties only* - never a fault label.
# --------------------------------------------------------------------------


class ContactorParams(ApiModel):
    coil_ohms: float | None = Field(12.0, description="Coil DC resistance; None = open coil")
    pole1_ohms: float | None = Field(0.01, description="L1-T1 contact resistance when closed; None = will not make")
    pole2_ohms: float | None = Field(0.01, description="L2-T2 contact resistance when closed; None = will not make")


class CapacitorParams(ApiModel):
    rated_herm_uf: float = 45.0
    rated_fan_uf: float = 5.0
    herm_uf: float = 45.2
    fan_uf: float = 5.0


class CompressorParams(ApiModel):
    run_ohms: float | None = 0.9
    start_ohms: float | None = 2.4
    rla: float = 16.0
    lra: float = 75.0


class FanMotorParams(ApiModel):
    run_ohms: float | None = 38.0
    aux_ohms: float | None = 62.0
    seized: bool = False
    fla: float = 1.4


class UnitParams(ApiModel):
    fuse_l1_ok: bool = True
    fuse_l2_ok: bool = True
    contactor: ContactorParams = Field(default_factory=ContactorParams)
    capacitor: CapacitorParams = Field(default_factory=CapacitorParams)
    compressor: CompressorParams = Field(default_factory=CompressorParams)
    fan_motor: FanMotorParams = Field(default_factory=FanMotorParams)
    charge_fraction: float = Field(1.0, description="Refrigerant charge, 1.0 = factory charge")
    coil_fouling: float = Field(0.0, ge=0.0, le=1.0, description="0 = clean condenser coil")


class FurnaceParams(ApiModel):
    """80% single-stage natural gas furnace with hot-surface ignition."""

    fuse_ok: bool = Field(True, description="3 A low-voltage fuse on the control board")
    igniter_ohms: float | None = Field(55.0, description="Cold resistance; None = open / cracked")
    flame_sensor_dirt: float = Field(0.05, ge=0.0, le=1.0)
    pressure_switch_ok: bool = True
    inducer_ohms: float | None = 28.0
    flue_blockage: float = Field(0.0, ge=0.0, le=1.0)
    gas_valve_coil_ohms: float | None = 48.0
    gas_cock_open: bool = True
    gas_inlet_wc: float = 7.0
    blower_run_ohms: float | None = 3.2
    blower_aux_ohms: float | None = 9.5
    rated_blower_cap_uf: float = 7.5
    blower_cap_uf: float = 7.4
    filter_dirt: float = Field(0.1, ge=0.0, le=1.0)
    limit_ok: bool = True


UnitType = Literal["condenser", "furnace"]


class Environment(ApiModel):
    outdoor_f: float = 95.0
    indoor_f: float = 78.0
    setpoint_f: float = 72.0


# --------------------------------------------------------------------------
# Scenarios / sessions
# --------------------------------------------------------------------------


class Difficulty(str, Enum):
    intro = "intro"
    easy = "easy"
    medium = "medium"
    hard = "hard"


class ScenarioSummary(ApiModel):
    id: str
    unit_type: UnitType = "condenser"
    title: str
    difficulty: Difficulty
    complaint: str


class DiagnosisOption(ApiModel):
    id: str
    label: str
    unit_type: UnitType = "condenser"


class CatalogResponse(ApiModel):
    scenarios: list[ScenarioSummary]
    diagnoses: list[DiagnosisOption]


class StartSessionRequest(ApiModel):
    scenario_id: str


class SessionResponse(ApiModel):
    session_id: str
    scenario: ScenarioSummary
    unit_type: UnitType
    unit: UnitParams | None = None
    furnace: FurnaceParams | None = None
    environment: Environment


class HintResponse(ApiModel):
    hint: str
    hints_used: int
    hints_total: int


class RepairAction(str, Enum):
    replace_capacitor = "replace_capacitor"
    replace_contactor = "replace_contactor"
    replace_fan_motor = "replace_fan_motor"
    replace_fuses = "replace_fuses"
    add_refrigerant = "add_refrigerant"
    recover_refrigerant = "recover_refrigerant"
    clean_coil = "clean_coil"
    replace_igniter = "replace_igniter"
    clean_flame_sensor = "clean_flame_sensor"
    replace_flame_sensor = "replace_flame_sensor"
    replace_pressure_switch = "replace_pressure_switch"
    replace_inducer = "replace_inducer"
    replace_gas_valve = "replace_gas_valve"
    open_gas_cock = "open_gas_cock"
    replace_blower_capacitor = "replace_blower_capacitor"
    replace_filter = "replace_filter"
    replace_lv_fuse = "replace_lv_fuse"
    replace_control_board = "replace_control_board"
    replace_limit_switch = "replace_limit_switch"
    replace_filter_drier = "replace_filter_drier"


class FinalState(ApiModel):
    """Snapshot of the unit at the moment the learner closes the job."""

    calling_for_cooling: bool
    compressor_running: bool
    fan_running: bool
    suction_psig: float
    liquid_psig: float
    superheat_f: float
    subcool_f: float
    panels_installed: bool


class FurnaceFinalState(ApiModel):
    calling_for_heat: bool
    burners_lit: bool
    blower_running: bool
    temp_rise_f: float
    manifold_wc: float
    panels_installed: bool


class ServiceReport(ApiModel):
    """What the learner did with the recovery machine, nitrogen, vacuum pump and scale."""

    opened_system: bool = False
    opened_at_psig: float | None = Field(None, description="System pressure when it was opened")
    test_gas: str | None = None
    pressure_test_psig: float = 0.0
    deepest_microns: float = 760000.0
    held_microns: float | None = Field(None, description="Reading after the standing vacuum test")
    final_charge_lb: float = 0.0
    factory_charge_lb: float = 0.0


class SubmitRequest(ApiModel):
    diagnosis_id: str
    repairs: list[RepairAction] = Field(default_factory=list)
    safety_violations: list[str] = Field(default_factory=list)
    measurements_taken: int = 0
    elapsed_seconds: float = 0.0
    final_state: FinalState | None = None
    furnace_final: FurnaceFinalState | None = None
    service: ServiceReport | None = None


class ScoreLine(ApiModel):
    label: str
    points: int
    max_points: int
    note: str


class GradeResponse(ApiModel):
    score: int
    diagnosis_correct: bool
    correct_diagnosis: DiagnosisOption
    breakdown: list[ScoreLine]
    explanation: str
