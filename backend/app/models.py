"""Pydantic models shared by the API.

All models serialise to camelCase so they line up one-to-one with the
TypeScript interfaces in ``frontend/src/api/types.ts``.
"""

from __future__ import annotations

from enum import Enum
import math
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator
from .equipment_registry import COMPONENTS
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


class CabinetDimensions(ApiModel):
    width: float = Field(0.86, ge=0.5, le=2)
    depth: float = Field(0.86, ge=0.4, le=2)
    height: float = Field(0.85, ge=0.5, le=2)


class HeatPumpConfig(ApiModel):
    defrost_interval_minutes: Literal[30, 60, 90] = 60
    smart_shift_seconds: float = Field(30, ge=0, le=60)
    max_defrost_seconds: float = Field(600, ge=60, le=900)
    sensor_close_f: float = Field(31, ge=-10, le=40)
    sensor_open_f: float = Field(75, ge=45, le=100)
    auxiliary_heat_kw: float = Field(5, ge=0, le=25)


class EquipmentContext(ApiModel):
    """Portable equipment definition, independent of faults and runtime state."""
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    schema_version: Literal[1] = 1
    id: str = Field(min_length=1, max_length=80, pattern=r"^[a-z0-9][a-z0-9_-]*$")
    name: str = Field(min_length=1, max_length=150)
    system_type: Literal["air_conditioner", "heat_pump", "gas_furnace"]
    unit_type: UnitType
    manufacturer: str = Field(default="Generic", max_length=80)
    outdoor_model: str = Field(default="HS-36", max_length=80)
    indoor_model: str = Field(default="Generic indoor coil", max_length=80)
    refrigerant: Literal["R-410A"] = "R-410A"
    capacity_btu_h: int = Field(default=36000, ge=12000, le=60000)
    seer2: float | None = Field(default=None, ge=10, le=30)
    hspf2: float | None = Field(default=None, ge=5, le=15)
    supply_volts: Literal[208, 230, 240] = 240
    contactor_poles: Literal[1, 2] = 2
    minimum_circuit_ampacity: float | None = Field(default=None, gt=0, le=100)
    max_overcurrent_amps: float | None = Field(default=None, gt=0, le=100)
    factory_charge_lb: float = Field(default=6.5, gt=0, le=30)
    dimensions_m: CabinetDimensions = Field(default_factory=CabinetDimensions)
    cabinet_color: str = Field(default="#c4c7c2", pattern=r"^#[0-9a-fA-F]{6}$")
    environment: Environment = Field(default_factory=Environment)
    unit: UnitParams | None = None
    furnace: FurnaceParams | None = None
    heat_pump: HeatPumpConfig | None = None
    sources: list[str] = Field(default_factory=list, max_length=10)
    notes: str = Field(default="", max_length=3000)

    @model_validator(mode="after")
    def compatible(self) -> EquipmentContext:
        def finite(value: object) -> None:
            if isinstance(value, float) and not math.isfinite(value):
                raise ValueError("Equipment values must be finite numbers")
            if isinstance(value, dict):
                for item in value.values():
                    finite(item)
            elif isinstance(value, list):
                for item in value:
                    finite(item)
        finite(self.model_dump())
        if self.unit_type == "furnace":
            if self.system_type != "gas_furnace" or self.furnace is None or self.unit is not None or self.heat_pump is not None:
                raise ValueError("A furnace context requires furnace parameters only")
        elif self.unit is None or self.furnace is not None or self.system_type == "gas_furnace":
            raise ValueError("An outdoor context requires condenser parameters only")
        if (self.system_type == "heat_pump") != (self.heat_pump is not None):
            raise ValueError("Heat pump contexts require heatPump controls")
        if self.unit and (self.unit.capacitor.rated_herm_uf <= 0 or self.unit.capacitor.rated_fan_uf <= 0
                          or self.unit.compressor.rla <= 0 or self.unit.compressor.lra <= 0 or self.unit.fan_motor.fla <= 0):
            raise ValueError("Electrical nameplate ratings must be positive")
        if self.unit:
            if not 0 <= self.unit.charge_fraction <= 1.4:
                raise ValueError("This refrigerant model supports charge fractions from 0 to 1.4")
            for resistance in (self.unit.contactor.coil_ohms, self.unit.contactor.pole1_ohms, self.unit.contactor.pole2_ohms,
                               self.unit.compressor.run_ohms, self.unit.compressor.start_ohms,
                               self.unit.fan_motor.run_ohms, self.unit.fan_motor.aux_ohms):
                if resistance is not None and resistance <= 0:
                    raise ValueError("Use positive winding/contact resistance, or null for an open circuit")
        return self


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
    contexts: list[EquipmentContext] = Field(default_factory=list)


class StartSessionRequest(ApiModel):
    scenario_id: str
    context: EquipmentContext | None = None


class SessionResponse(ApiModel):
    session_id: str
    scenario: ScenarioSummary
    unit_type: UnitType
    unit: UnitParams | None = None
    furnace: FurnaceParams | None = None
    environment: Environment
    context: EquipmentContext | None = None
    procedure_id: str | None = None


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
    operating_mode: Literal["cool", "heat"] = "cool"
    defrost_active: bool = False
    heat_delivered: bool = False
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


class EquipmentEvent(ApiModel):
    type: Literal["power.isolated", "power.restored", "measurement.voltage", "measurement.capacitance",
                  "measurement.resistance", "measurement.current", "measurement.pressure", "measurement.temperatureRise",
                  "capacitor.discharged", "component.replaced", "component.cleaned", "component.inspected",
                  "gas.closed", "gas.opened", "door.opened", "door.closed", "interlock.bypassed", "interlock.released"]
    component_id: str
    t: float = Field(ge=0, allow_inf_nan=False)
    safe: bool
    value: float | None = Field(default=None, allow_inf_nan=False)
    unit: Literal["V", "µF", "Ω", "µA", "A", "inH2O", "°F"] | None = None
    status: Literal["open"] | None = None
    channel: Literal["draft", "inlet", "manifold", "rise"] | None = None
    terminals: list[str] = Field(default_factory=list, max_length=2)

    @model_validator(mode="after")
    def valid_component(self) -> EquipmentEvent:
        if self.component_id not in COMPONENTS:
            raise ValueError("Unknown component")
        if self.type.startswith("measurement."):
            units = {"voltage": ("V",), "capacitance": ("µF",), "resistance": ("Ω",),
                     "current": ("µA", "A"), "pressure": ("inH2O",), "temperatureRise": ("°F",)}
            kind = self.type.removeprefix("measurement.")
            is_open = kind == "resistance" and self.status == "open" and self.value is None
            if self.unit not in units[kind] or (self.value is None and not is_open):
                raise ValueError("Measurement requires a value or open resistance, and correct unit")
            if self.status is not None and not is_open:
                raise ValueError("Only open resistance may omit a measured value")
            if kind not in ("pressure", "temperatureRise") and self.value is not None and self.value < 0:
                raise ValueError("Electrical readings cannot be negative")
            if kind in ("voltage", "capacitance", "resistance") or self.unit == "µA":
                component = COMPONENTS[self.component_id]
                pair = set(self.terminals)
                if len(pair) != 2 or not (pair.issubset(component["terminals"]) or any(pair == set(p) for p in component.get("measurementPairs", []))):
                    raise ValueError("Measurement requires two terminals associated with this component")
            if kind == "pressure" and (self.component_id, self.channel) not in {
                ("system.indoor.pressureSwitch", "draft"), ("system.indoor.gasValve", "inlet"), ("system.indoor.gasValve", "manifold")
            }:
                raise ValueError("Unknown pressure tap")
            if kind == "temperatureRise" and (self.component_id != "system.indoor.filter" or self.channel != "rise"):
                raise ValueError("Unknown temperature measurement")
        return self


class EquipmentJournal(ApiModel):
    schema_version: Literal[1] = 1
    events: list[EquipmentEvent] = Field(default_factory=list, max_length=2000)

    @model_validator(mode="after")
    def ordered(self) -> EquipmentJournal:
        if any(right.t < left.t for left, right in zip(self.events, self.events[1:])):
            raise ValueError("Equipment events must be chronological")
        return self


class SubmitRequest(ApiModel):
    diagnosis_id: str
    repairs: list[RepairAction] = Field(default_factory=list)
    safety_violations: list[str] = Field(default_factory=list)
    measurements_taken: int = 0
    elapsed_seconds: float = 0.0
    final_state: FinalState | None = None
    furnace_final: FurnaceFinalState | None = None
    service: ServiceReport | None = None
    equipment_journal: EquipmentJournal | None = None


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
