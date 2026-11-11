"""Scores a finished job against the scenario's answer key."""

from __future__ import annotations

from .models import (
    FinalState,
    FurnaceFinalState,
    GradeResponse,
    RepairAction,
    ServiceReport,
    ScoreLine,
    SubmitRequest,
)
from .scenarios import DIAGNOSIS_BY_ID, Scenario

DIAGNOSIS_POINTS = 45
REPAIR_POINTS = 20
VERIFY_POINTS = 15
SAFETY_POINTS = 15
WORKMANSHIP_POINTS = 5
HINT_PENALTY = 5
UNNEEDED_PART_PENALTY = 8

PART_SWAPS: frozenset[RepairAction] = frozenset(
    {
        RepairAction.replace_capacitor,
        RepairAction.replace_contactor,
        RepairAction.replace_fan_motor,
        RepairAction.replace_fuses,
        RepairAction.replace_igniter,
        RepairAction.replace_flame_sensor,
        RepairAction.replace_pressure_switch,
        RepairAction.replace_inducer,
        RepairAction.replace_gas_valve,
        RepairAction.replace_blower_capacitor,
        RepairAction.replace_lv_fuse,
        RepairAction.replace_control_board,
        RepairAction.replace_limit_switch,
    }
)


def operating_normally(state: FinalState) -> tuple[bool, str]:
    """Judge the learner's final snapshot against normal R-410A operating windows."""
    if not state.calling_for_cooling:
        return False, "Thermostat was not calling, so operation was never verified."
    if not state.compressor_running:
        return False, "Compressor was not running when the job was closed."
    if not state.fan_running:
        return False, "Condenser fan was not running when the job was closed."
    if not 100 <= state.suction_psig <= 140:
        return False, f"Suction pressure {state.suction_psig:.0f} psig is outside 100-140 psig."
    if not 320 <= state.liquid_psig <= 440:
        return False, f"Liquid pressure {state.liquid_psig:.0f} psig is outside 320-440 psig."
    if not 5 <= state.superheat_f <= 18:
        return False, f"Superheat {state.superheat_f:.0f} F is outside 5-18 F."
    if not 6 <= state.subcool_f <= 15:
        return False, f"Subcooling {state.subcool_f:.0f} F is outside 6-15 F."
    return True, "Unit left running with pressures, superheat and subcooling in range."


def furnace_operating_normally(state: FurnaceFinalState) -> tuple[bool, str]:
    if not state.calling_for_heat:
        return False, "Thermostat was not calling, so operation was never verified."
    if not state.burners_lit:
        return False, "Burners were not lit when the job was closed."
    if not state.blower_running:
        return False, "Blower was not running when the job was closed."
    if not 3.2 <= state.manifold_wc <= 3.8:
        return False, f"Manifold pressure {state.manifold_wc:.1f} in. w.c. is outside 3.2-3.8."
    if not 35 <= state.temp_rise_f <= 65:
        return False, f"Temperature rise {state.temp_rise_f:.0f} F is outside the 35-65 F nameplate range."
    return True, "Furnace left firing with the blower on and temperature rise in range."


NAMEPLATE_TEST_PSIG = 250
VACUUM_TARGET_MICRONS = 500


def procedure_line(report: ServiceReport | None) -> ScoreLine:
    """Grade refrigerant handling: four points for each of five service practices."""
    r = report or ServiceReport()
    checks: list[tuple[bool, str]] = [
        (
            r.opened_system and r.opened_at_psig is not None and r.opened_at_psig <= 0.5,
            "recover to 0 in. Hg before opening the system",
        ),
        (
            r.test_gas == "nitrogen" and 100 <= r.pressure_test_psig <= NAMEPLATE_TEST_PSIG,
            "pressure test with dry nitrogen at 100-250 psig",
        ),
        (r.deepest_microns <= VACUUM_TARGET_MICRONS, "evacuate below 500 microns"),
        (
            r.held_microns is not None and r.held_microns <= VACUUM_TARGET_MICRONS,
            "prove the vacuum holds under 500 microns with the pump valved off",
        ),
        (
            r.factory_charge_lb > 0 and abs(r.final_charge_lb - r.factory_charge_lb) <= 0.25,
            "weigh in the nameplate charge (within 4 oz)",
        ),
    ]
    missed = [text for ok, text in checks if not ok]
    points = REPAIR_POINTS * (len(checks) - len(missed)) // len(checks)
    note = (
        "Every step of the service procedure was done correctly."
        if not missed
        else "Missed: " + "; ".join(missed) + "."
    )
    return ScoreLine(label="Service procedure", points=points, max_points=REPAIR_POINTS, note=note)


def grade(scenario: Scenario, submission: SubmitRequest, hints_used: int) -> GradeResponse:
    lines: list[ScoreLine] = []

    correct = submission.diagnosis_id == scenario.diagnosis_id
    lines.append(
        ScoreLine(
            label="Diagnosis",
            points=DIAGNOSIS_POINTS if correct else 0,
            max_points=DIAGNOSIS_POINTS,
            note="Correct root cause identified." if correct else "Root cause was not identified.",
        )
    )

    done = set(submission.repairs)
    required = scenario.required_repair
    fixes = {required, *scenario.also_accepted}
    repair_ok = required is None or bool(done & fixes)
    unneeded = sorted(r.value for r in done & PART_SWAPS if r not in fixes)
    repair_points = REPAIR_POINTS if repair_ok else 0
    repair_points = max(0, repair_points - UNNEEDED_PART_PENALTY * len(unneeded))
    if required is None:
        note = "No repair was needed."
    elif repair_ok:
        note = "Required repair completed."
    else:
        note = "The required repair was not carried out."
    if unneeded:
        note += f" Unnecessary parts fitted: {', '.join(u.replace('_', ' ') for u in unneeded)}."
    if scenario.procedure:
        lines.append(procedure_line(submission.service))
    else:
        lines.append(ScoreLine(label="Repair", points=repair_points, max_points=REPAIR_POINTS, note=note))

    if scenario.unit_type == "furnace" and submission.furnace_final is not None:
        verified, verify_note = furnace_operating_normally(submission.furnace_final)
        panels = submission.furnace_final.panels_installed
    elif scenario.unit_type == "condenser" and submission.final_state is not None:
        verified, verify_note = operating_normally(submission.final_state)
        panels = submission.final_state.panels_installed
    else:
        verified, verify_note, panels = False, "No final readings were submitted.", False
    lines.append(
        ScoreLine(
            label="Verified operation",
            points=VERIFY_POINTS if verified else 0,
            max_points=VERIFY_POINTS,
            note=verify_note,
        )
    )

    violations = submission.safety_violations
    safety_points = max(0, SAFETY_POINTS - 5 * len(violations))
    lines.append(
        ScoreLine(
            label="Safety",
            points=safety_points,
            max_points=SAFETY_POINTS,
            note="No unsafe acts recorded." if not violations else "; ".join(sorted(set(violations))),
        )
    )

    lines.append(
        ScoreLine(
            label="Workmanship",
            points=WORKMANSHIP_POINTS if panels else 0,
            max_points=WORKMANSHIP_POINTS,
            note="All panels refitted." if panels else "Panels were left off the unit.",
        )
    )

    if hints_used:
        lines.append(
            ScoreLine(
                label="Hints",
                points=-HINT_PENALTY * hints_used,
                max_points=0,
                note=f"{hints_used} hint(s) used.",
            )
        )

    score = max(0, min(100, sum(line.points for line in lines)))
    return GradeResponse(
        score=score,
        diagnosis_correct=correct,
        correct_diagnosis=DIAGNOSIS_BY_ID[scenario.diagnosis_id],
        breakdown=lines,
        explanation=scenario.explanation,
    )
