"""Scenario catalogue: the fault library and the server-side answer key."""

from __future__ import annotations

from dataclasses import dataclass, field

from .models import (
    CapacitorParams,
    ContactorParams,
    DiagnosisOption,
    Difficulty,
    Environment,
    FanMotorParams,
    FurnaceParams,
    RepairAction,
    ScenarioSummary,
    UnitParams,
    UnitType,
)


@dataclass(frozen=True)
class Scenario:
    id: str
    title: str
    difficulty: Difficulty
    complaint: str
    diagnosis_id: str
    required_repair: RepairAction | None
    explanation: str
    hints: tuple[str, ...]
    # Exactly one of these describes the equipment.
    unit: UnitParams | None = None
    furnace: FurnaceParams | None = None
    # Other repairs that genuinely fix the fault (e.g. replacing instead of cleaning).
    also_accepted: tuple[RepairAction, ...] = ()
    # A planned refrigerant-circuit repair graded on EPA 608 service practice.
    procedure: bool = False
    environment: Environment = field(default_factory=Environment)

    @property
    def unit_type(self) -> UnitType:
        return "furnace" if self.furnace is not None else "condenser"

    def summary(self) -> ScenarioSummary:
        return ScenarioSummary(
            id=self.id,
            unit_type=self.unit_type,
            title=self.title,
            difficulty=self.difficulty,
            complaint=self.complaint,
        )


DIAGNOSES: tuple[DiagnosisOption, ...] = (
    DiagnosisOption(id="no_fault", label="No fault found - unit operating normally"),
    DiagnosisOption(id="cap_herm", label="Run capacitor failed - compressor (HERM) side"),
    DiagnosisOption(id="cap_fan", label="Run capacitor failed - fan side"),
    DiagnosisOption(id="contactor_coil", label="Contactor coil open"),
    DiagnosisOption(id="contactor_contacts", label="Contactor contacts burnt / not making"),
    DiagnosisOption(id="fan_motor", label="Condenser fan motor failed"),
    DiagnosisOption(id="blown_fuse", label="Blown fuse in disconnect"),
    DiagnosisOption(id="low_charge", label="Low refrigerant charge"),
    DiagnosisOption(id="overcharge", label="Refrigerant overcharge"),
    DiagnosisOption(id="dirty_coil", label="Dirty condenser coil"),
    DiagnosisOption(id="compressor", label="Compressor failed (open winding)"),
    DiagnosisOption(id="no_call", label="No 24 V call from thermostat / indoor unit"),
    DiagnosisOption(id="planned_drier", label="Planned repair - liquid line filter drier replaced"),
)


SCENARIOS: tuple[Scenario, ...] = (
    Scenario(
        id="orientation",
        title="Orientation: healthy unit",
        difficulty=Difficulty.intro,
        complaint=(
            "Seasonal maintenance visit. No complaint - get familiar with the unit, take a full "
            "set of readings and confirm it is operating to spec."
        ),
        unit=UnitParams(),
        diagnosis_id="no_fault",
        required_repair=None,
        explanation=(
            "This unit is healthy. Typical readings on a 95 F day: 240 V at the contactor, 24 V at the "
            "coil, capacitor within 6 % of its 45/5 uF rating, about 118 psig suction and 380 psig "
            "liquid on R-410A, roughly 10 F superheat and 10 F subcooling."
        ),
        hints=(
            "Set the thermostat to call for cooling and watch the sequence: 24 V to the contactor coil, "
            "contactor pulls in, compressor and fan start together.",
            "Remove the access panel with the nut driver and measure L1-L2 and T1-T2 at the contactor.",
            "Connect the gauges and temperature clamps to read superheat and subcooling.",
        ),
    ),
    Scenario(
        id="hum-no-start",
        title="Outdoor unit hums, house not cooling",
        difficulty=Difficulty.easy,
        complaint=(
            "Customer says the outdoor fan is spinning but the air from the vents is warm. They hear a "
            "loud hum from the unit every minute or so, then a click."
        ),
        unit=UnitParams(capacitor=CapacitorParams(herm_uf=8.6)),
        diagnosis_id="cap_herm",
        required_repair=RepairAction.replace_capacitor,
        explanation=(
            "The HERM side of the dual run capacitor had fallen to about 9 uF against a 45 uF rating. "
            "Without the phase shift the compressor cannot start: it sits at locked-rotor amps, hums, "
            "and trips its internal overload (C-R and C-S read open until it cools, R-S still reads). "
            "The fan side was fine, which is why the fan ran. Replace the capacitor."
        ),
        hints=(
            "The fan runs, so the contactor is closing and 240 V is reaching the load side. Focus on "
            "the compressor circuit.",
            "Clamp the compressor common wire while it tries to start. Locked-rotor amps and a hum "
            "point at the start circuit.",
            "Kill power, discharge the capacitor and measure C-HERM in uF. Compare with the 45 uF rating.",
        ),
    ),
    Scenario(
        id="fan-not-spinning",
        title="Unit runs briefly, then shuts off",
        difficulty=Difficulty.easy,
        complaint=(
            "Customer reports the outdoor unit starts, runs for a short while and shuts itself down. "
            "They noticed the big fan on top is not turning."
        ),
        unit=UnitParams(capacitor=CapacitorParams(fan_uf=0.6)),
        diagnosis_id="cap_fan",
        required_repair=RepairAction.replace_capacitor,
        explanation=(
            "The FAN side of the dual run capacitor had failed (well under 1 uF against 5 uF). The "
            "condenser fan could not start, so head pressure climbed until the high-pressure switch "
            "opened the 24 V circuit. The fan motor windings measured fine - the capacitor was the "
            "fault. Replace the capacitor."
        ),
        hints=(
            "With the compressor running and no condenser airflow, watch the liquid (high side) gauge.",
            "Before condemning the motor, check its windings with power off and check what feeds it.",
            "Measure C-FAN on the capacitor in uF with power off and the capacitor discharged.",
        ),
    ),
    Scenario(
        id="dead-unit-coil",
        title="Outdoor unit completely dead",
        difficulty=Difficulty.medium,
        complaint=(
            "Indoor blower runs and the thermostat is calling, but nothing at all happens outside. "
            "No hum, no fan."
        ),
        unit=UnitParams(contactor=ContactorParams(coil_ohms=None)),
        diagnosis_id="contactor_coil",
        required_repair=RepairAction.replace_contactor,
        explanation=(
            "Line voltage was present at L1-L2 and 24 V was present across the contactor coil, yet the "
            "contactor never pulled in. With power off the coil measured open (OL) instead of roughly "
            "10-20 ohms. Voltage at a load that does nothing means the load is open. Replace the contactor."
        ),
        hints=(
            "Split the problem: is it the high-voltage side or the 24 V control side?",
            "Check for 240 V at L1-L2 on the contactor, then for 24 V across the coil terminals.",
            "24 V at the coil but no pull-in: turn power off and ohm the coil.",
        ),
    ),
    Scenario(
        id="dead-unit-contacts",
        title="Contactor clicks, nothing runs",
        difficulty=Difficulty.medium,
        complaint=(
            "Customer hears a click from the outdoor unit when the thermostat calls, but the "
            "compressor and fan never start."
        ),
        unit=UnitParams(contactor=ContactorParams(pole1_ohms=None)),
        diagnosis_id="contactor_contacts",
        required_repair=RepairAction.replace_contactor,
        explanation=(
            "The contactor pulled in, and L1-L2 read 240 V, but T1-T2 read 0 V. Measuring across the "
            "closed L1-T1 pole showed full line voltage dropped across it - that set of contacts was "
            "burnt open. A good closed contact drops close to 0 V. Replace the contactor."
        ),
        hints=(
            "The click tells you the 24 V side is doing its job. Follow the high voltage.",
            "Compare L1-L2 (line side) with T1-T2 (load side) while the contactor is pulled in.",
            "Measure across each pole (L1 to T1, L2 to T2) with the contactor energised. Any real "
            "voltage across a closed contact means it is not making.",
        ),
    ),
    Scenario(
        id="fan-motor",
        title="High-pressure trips, fan stopped",
        difficulty=Difficulty.medium,
        complaint=(
            "Unit keeps cutting out on a hot afternoon. A previous tech replaced the capacitor last "
            "week and the problem came back straight away."
        ),
        unit=UnitParams(fan_motor=FanMotorParams(run_ohms=None)),
        diagnosis_id="fan_motor",
        required_repair=RepairAction.replace_fan_motor,
        explanation=(
            "The capacitor tested good on both sides and 240 V was present at the fan leads, but the "
            "fan drew almost no current and never turned. With power off the black-to-purple run "
            "winding measured open. With no condenser airflow the head pressure ran away and tripped "
            "the high-pressure switch. Replace the condenser fan motor."
        ),
        hints=(
            "The capacitor is new - verify it rather than assume, then move on.",
            "Is 240 V reaching the fan motor leads? Clamp the fan's black lead to see what it draws.",
            "Power off: ohm the fan windings black-purple (run) and black-brown (start).",
        ),
    ),
    Scenario(
        id="blown-fuse",
        title="No cooling after a thunderstorm",
        difficulty=Difficulty.medium,
        complaint=(
            "The system stopped cooling after a storm last night. Thermostat is calling, indoor blower "
            "runs, the outdoor unit clicks but does not start."
        ),
        unit=UnitParams(fuse_l2_ok=False),
        diagnosis_id="blown_fuse",
        required_repair=RepairAction.replace_fuses,
        explanation=(
            "240 V was present on the line side of the disconnect but not on the load side. One leg "
            "read 120 V to ground on both sides, the other was dead on the load side: the L2 fuse was "
            "open. Note how the dead leg can show voltage to ground once the contactor closes - that is "
            "back-feed through the motor windings, not a good fuse. Replace the fuses."
        ),
        hints=(
            "The contactor clicks, so the control circuit is alive. Check incoming power.",
            "Measure L1-L2 at the contactor line side. If it is not 240 V, work back to the disconnect.",
            "At the disconnect compare line-side L1-L2 with load-side L1-L2, then cross-check each "
            "line lug to the opposite load lug.",
        ),
    ),
    Scenario(
        id="low-charge",
        title="Runs constantly, barely cools",
        difficulty=Difficulty.hard,
        complaint=(
            "Unit runs non-stop and the house never gets below 78 F. Customer mentions ice on the "
            "copper line at the outdoor unit earlier this week."
        ),
        unit=UnitParams(charge_fraction=0.72),
        diagnosis_id="low_charge",
        required_repair=RepairAction.add_refrigerant,
        explanation=(
            "Everything electrical checked out. Suction pressure was low, superheat was very high and "
            "subcooling was near zero - the evaporator is starved and there is no liquid seal in the "
            "condenser. That combination is a low charge. In the field you must find and repair the "
            "leak before weighing in refrigerant; here, charge until subcooling returns to about 10 F."
        ),
        hints=(
            "Both motors run and the amps are low. This one is not electrical - connect the gauges.",
            "Attach both temperature clamps so you can read superheat and subcooling.",
            "High superheat together with low subcooling means undercharge. Add refrigerant slowly "
            "and watch subcooling approach 10 F.",
        ),
    ),
    Scenario(
        id="dirty-coil",
        title="High electric bill, weak cooling",
        difficulty=Difficulty.hard,
        complaint=(
            "Cooling is weak in the afternoon and the electric bill jumped. The unit sits next to a "
            "cottonwood tree and a dryer vent."
        ),
        unit=UnitParams(coil_fouling=0.7),
        diagnosis_id="dirty_coil",
        required_repair=RepairAction.clean_coil,
        explanation=(
            "Head pressure and compressor amps were well above normal with both motors running, while "
            "superheat and subcooling were close to normal - so the charge was fine. The condenser "
            "simply could not reject heat through a matted coil. Power off and wash the coil, then "
            "re-check pressures."
        ),
        hints=(
            "Both motors run. Compare compressor amps with the nameplate RLA and connect the gauges.",
            "High head pressure with a running fan: the condenser is not rejecting heat. Look at the coil.",
            "Subcooling is normal, so it is not an overcharge. Pull the disconnect and clean the coil.",
        ),
    ),
)

SCENARIOS = SCENARIOS + (
    Scenario(
        id="c-608-drier",
        title="EPA 608 practical: open the system",
        difficulty=Difficulty.hard,
        complaint=(
            "Work order: replace the liquid line filter drier on this R-410A unit. Nothing to "
            "diagnose - this job is about refrigerant handling. Recover the charge, open the system "
            "and fit the drier, pressure test, evacuate, and weigh the factory charge back in."
        ),
        unit=UnitParams(),
        diagnosis_id="planned_drier",
        required_repair=RepairAction.replace_filter_drier,
        procedure=True,
        explanation=(
            "The legal and professional sequence: pull the disconnect; recover the charge to at least "
            "0 in. Hg (the EPA level for a high-pressure appliance under 200 lb) into a recovery "
            "cylinder kept under 80% full; open the system and make the repair; pressure test with dry "
            "nitrogen through a regulator, staying under the nameplate test pressure; release the "
            "nitrogen; pull a deep vacuum below 500 microns and prove it holds with the pump valved "
            "off; then weigh in the nameplate charge. Skipping the vacuum leaves air and moisture "
            "behind, which shows up as high head pressure."
        ),
        hints=(
            "Connect both gauge hoses, then use the service cart: the yellow centre hose goes to "
            "whichever machine you need next.",
            "Recover until the gauges read 0 psig before opening the system. After the repair, "
            "nitrogen first (check the nameplate test pressure), then the vacuum pump.",
            "Pull below 500 microns, valve the pump off and watch: it must stay under 500. Then weigh "
            "in the factory charge from the nameplate.",
        ),
    ),
)

# The furnace library lives in its own module; it needs Scenario from this one.
from .furnace_scenarios import FURNACE_DIAGNOSES, FURNACE_SCENARIOS  # noqa: E402

DIAGNOSES = DIAGNOSES + FURNACE_DIAGNOSES
SCENARIOS = SCENARIOS + FURNACE_SCENARIOS
SCENARIOS += (
    Scenario(id="hp-heating", title="Heat pump: winter heating sequence", difficulty=Difficulty.intro,
             complaint="Room is cool. Verify the heat call, indoor blower, outdoor compressor and reversing valve sequence.",
             diagnosis_id="no_fault", required_repair=None, unit=UnitParams(),
             environment=Environment(outdoor_f=35, indoor_f=68, setpoint_f=72),
             explanation="This heat pump is healthy. In HEAT the O circuit is de-energized; Y calls the compressor and G runs the indoor blower.",
             hints=("Set the thermostat to HEAT above room temperature.", "Compare Y-C and O-C on the defrost board.",
                    "Confirm the large vapor line is hot and the indoor air handler is delivering heat.")),
    Scenario(id="hp-defrost", title="Heat pump: observe a defrost cycle", difficulty=Difficulty.medium,
             complaint="The outdoor coil frosts on a cold day. Observe defrost and verify that heating resumes afterward.",
             diagnosis_id="no_fault", required_repair=None, unit=UnitParams(),
             environment=Environment(outdoor_f=28, indoor_f=68, setpoint_f=72),
             explanation="Defrost temporarily energizes O, stops the outdoor fan and enables auxiliary heat. Shift delays protect the compressor; heating resumes when defrost ends.",
             hints=("Call for HEAT and allow the outdoor coil to cool.", "With the cold-coil sensor closed, use the board TEST control to advance the timer.",
                    "Watch the shift delays, O output, outdoor fan and W2 output, then confirm normal heating returns.")),
)

DIAGNOSIS_BY_ID: dict[str, DiagnosisOption] = {d.id: d for d in DIAGNOSES}
SCENARIO_BY_ID: dict[str, Scenario] = {s.id: s for s in SCENARIOS}
