"""Gas furnace fault library and answer key."""

from __future__ import annotations

from .models import DiagnosisOption, Difficulty, Environment, FurnaceParams, RepairAction
from .scenarios import Scenario

WINTER = Environment(outdoor_f=28.0, indoor_f=64.0, setpoint_f=70.0)

FURNACE_DIAGNOSES: tuple[DiagnosisOption, ...] = tuple(
    DiagnosisOption(id=i, label=label, unit_type="furnace")
    for i, label in (
        ("f_no_fault", "No fault found - furnace operating normally"),
        ("f_flame_sensor", "Dirty flame sensor"),
        ("f_igniter", "Hot-surface igniter failed (open)"),
        ("f_inducer", "Inducer motor failed"),
        ("f_pressure_switch", "Pressure switch failed"),
        ("f_blocked_flue", "Blocked flue / vent"),
        ("f_gas_valve", "Gas valve failed (open coil)"),
        ("f_gas_off", "Gas supply shut off"),
        ("f_filter", "Dirty air filter"),
        ("f_blower_cap", "Blower capacitor failed"),
        ("f_blower_motor", "Blower motor failed"),
        ("f_lv_fuse", "Blown low-voltage fuse on the board"),
        ("f_limit", "High-limit switch failed open"),
        ("f_board", "Control board failed"),
    )
)

FURNACE_SCENARIOS: tuple[Scenario, ...] = (
    Scenario(
        id="f-orientation",
        procedure_id="f-orientation-diagnosis",
        title="Orientation: healthy furnace",
        difficulty=Difficulty.intro,
        complaint=(
            "Pre-season tune-up. No complaint - watch a full heating cycle, learn the sequence of "
            "operation and take a baseline set of readings."
        ),
        furnace=FurnaceParams(),
        environment=WINTER,
        diagnosis_id="f_no_fault",
        required_repair=None,
        explanation=(
            "This furnace is healthy. Sequence: W call, inducer starts, pressure switch closes, "
            "igniter warms up, gas valve opens, flame is proven by the flame sensor (about 3.5 uA), "
            "blower starts after a delay. Typical readings: 3.5 in. w.c. manifold pressure, 7 in. w.c. "
            "inlet, about 55 F temperature rise."
        ),
        hints=(
            "Set the thermostat to HEAT and watch the order things happen in the job log.",
            "Lift both doors off. Tape the door switch so the furnace runs with the blower door off.",
            "Put the meter on uA with one lead on the flame sensor and one on the board FS terminal.",
        ),
    ),
    Scenario(
        id="f-flame-sensor",
        procedure_id="f-flame-sensor-diagnosis",
        title="Lights, then shuts off in seconds",
        difficulty=Difficulty.easy,
        complaint=(
            "Furnace fires up, the burners run for a few seconds and go out. It tries a few times "
            "and then gives up. House is getting cold."
        ),
        furnace=FurnaceParams(),
        fault_ids=('furnace.f_flame_sensor',),
        environment=WINTER,
        diagnosis_id="f_flame_sensor",
        required_repair=RepairAction.clean_flame_sensor,
        also_accepted=(RepairAction.replace_flame_sensor,),
        explanation=(
            "The burners lit every time, so gas and ignition were fine - the board simply could not "
            "prove flame. Flame current measured about 0.4 uA against a healthy 2-6 uA because the "
            "sensor rod was coated in oxide. After three failed trials the board locked out (1 flash). "
            "Clean the rod with fine abrasive and re-check the microamps."
        ),
        hints=(
            "Watch the burners: do they light? If they do, ignition and gas are not the problem.",
            "Something has to tell the board the flame is there. Read the board LED code.",
            "Measure flame current in uA between the flame sensor and the board FS terminal.",
        ),
    ),
    Scenario(
        id="f-igniter",
        procedure_id="f-igniter-diagnosis",
        title="Inducer runs, never lights",
        difficulty=Difficulty.easy,
        complaint=(
            "Customer hears the small fan start and a click after a while, but there is never any "
            "heat. After a few minutes everything stops."
        ),
        furnace=FurnaceParams(),
        fault_ids=('furnace.f_igniter',),
        environment=WINTER,
        diagnosis_id="f_igniter",
        required_repair=RepairAction.replace_igniter,
        explanation=(
            "The inducer ran and the pressure switch closed, and the board sent 120 V to the igniter "
            "- but it never glowed and drew no current. With power off the igniter measured open "
            "instead of roughly 40-90 ohms: the element was cracked. Gas opened on schedule but had "
            "nothing to light it, so the board locked out (1 flash). Replace the igniter."
        ),
        hints=(
            "Look into the burner compartment during warm-up. Does the igniter glow?",
            "During warm-up, check for 120 V across the igniter plug.",
            "Voltage present but no glow: turn the power off and ohm the igniter.",
        ),
    ),
    Scenario(
        id="f-inducer",
        procedure_id="f-inducer-diagnosis",
        title="Nothing happens, LED flashing",
        difficulty=Difficulty.medium,
        complaint=(
            "Thermostat is calling for heat but the furnace just sits there. The customer noticed a "
            "light blinking behind the lower door."
        ),
        furnace=FurnaceParams(),
        fault_ids=('furnace.f_inducer',),
        environment=WINTER,
        diagnosis_id="f_inducer",
        required_repair=RepairAction.replace_inducer,
        explanation=(
            "On a call for heat the board energised the inducer - 120 V was present at the motor "
            "leads - but the motor never turned and drew no current. With power off the winding "
            "measured open. No draft means the pressure switch never closed, so the board flagged "
            "'pressure switch stuck open' (2 flashes). The switch was only reporting the truth. "
            "Replace the inducer motor."
        ),
        hints=(
            "Count the LED flashes and look them up. Then ask why the pressure switch is open.",
            "Is the inducer actually running? Check for 120 V at its leads during the call.",
            "Voltage but no rotation and no amps: power off and ohm the inducer winding.",
        ),
    ),
    Scenario(
        id="f-pressure-switch",
        procedure_id="f-pressure-switch-diagnosis",
        title="Inducer runs forever, no ignition",
        difficulty=Difficulty.medium,
        complaint=(
            "The small exhaust fan runs and runs but the furnace never tries to light. Blinking "
            "light on the board."
        ),
        furnace=FurnaceParams(),
        fault_ids=('furnace.f_pressure_switch',),
        environment=WINTER,
        diagnosis_id="f_pressure_switch",
        required_repair=RepairAction.replace_pressure_switch,
        explanation=(
            "The inducer ran normally and the manometer showed a healthy draft of about -1.1 in. w.c. "
            "at the pressure tap - well past the switch's -0.65 set point - yet 24 V never came back "
            "through the switch to the board. Good draft with an open switch means the switch itself "
            "has failed. Had the draft been low, the cause would be the vent or inducer instead. "
            "Replace the pressure switch."
        ),
        hints=(
            "Two flashes means the board never saw the pressure switch close. That is a symptom.",
            "Before blaming the switch, measure the draft it sees: manometer on the pressure tap.",
            "Draft is good. Check for 24 V on both sides of the switch with the inducer running.",
        ),
    ),
    Scenario(
        id="f-gas-off",
        procedure_id="f-gas-off-diagnosis",
        title="Igniter glows, no flame",
        difficulty=Difficulty.medium,
        complaint=(
            "No heat since the gas company changed the meter yesterday. Customer can see an orange "
            "glow through the door for a few seconds, then nothing."
        ),
        furnace=FurnaceParams(),
        fault_ids=('furnace.f_gas_off',),
        environment=WINTER,
        diagnosis_id="f_gas_off",
        required_repair=RepairAction.open_gas_cock,
        explanation=(
            "The igniter glowed and the board sent 24 V to the gas valve, but the manometer read "
            "0 in. w.c. at the valve inlet: no gas was reaching the furnace. The manual shut-off on "
            "the supply pipe had been left closed (handle across the pipe). The valve and board "
            "were fine. Open the gas cock and confirm about 7 in. w.c. inlet, 3.5 manifold."
        ),
        hints=(
            "Igniter glows, valve clicks, no flame. Is the valve being told to open? Is there gas?",
            "Check for 24 V at the gas valve terminals during the trial for ignition.",
            "The valve has 24 V. Put the manometer on the inlet tap, then look at the shut-off handle.",
        ),
    ),
    Scenario(
        id="f-gas-valve",
        procedure_id="f-gas-valve-diagnosis",
        title="Glows and clicks, will not light",
        difficulty=Difficulty.hard,
        complaint=(
            "Furnace goes through the motions - fan, glow - but never lights. Another company "
            "already replaced the igniter last week."
        ),
        furnace=FurnaceParams(),
        fault_ids=('furnace.f_gas_valve',),
        environment=WINTER,
        diagnosis_id="f_gas_valve",
        required_repair=RepairAction.replace_gas_valve,
        explanation=(
            "Inlet pressure was a healthy 7 in. w.c. and the board delivered 24 V to the gas valve "
            "during every trial, but manifold pressure stayed at zero and the valve drew no current. "
            "With power off the valve coil measured open. Voltage at a load that does nothing means "
            "the load is open. Shut off the gas and power, then replace the gas valve."
        ),
        hints=(
            "The igniter is new and glows. Follow the gas: inlet pressure, then manifold pressure.",
            "Gas is at the inlet but not the manifold. Is the valve getting 24 V during the trial?",
            "24 V present, no gas out: power off and ohm the valve coil across MV and C.",
        ),
    ),
    Scenario(
        id="f-filter",
        procedure_id="f-filter-diagnosis",
        title="Short-cycling, weak airflow",
        difficulty=Difficulty.medium,
        complaint=(
            "Furnace runs for a minute, the burners shut off, the fan keeps blowing, then it starts "
            "over. Weak airflow from the registers."
        ),
        furnace=FurnaceParams(),
        fault_ids=('furnace.f_filter',),
        environment=WINTER,
        diagnosis_id="f_filter",
        required_repair=RepairAction.replace_filter,
        explanation=(
            "The burners were being shut down by the high-limit switch (4 flashes). The blower was "
            "running and drawing normal current, but temperature rise climbed past 90 F against a "
            "nameplate 35-65 F: not enough air was moving across the heat exchanger. The filter was "
            "plugged solid. Replace the filter and confirm the rise is back in range."
        ),
        hints=(
            "Read the LED code when the burners drop out. What does that switch protect against?",
            "Put probes in the supply and return and compare the temperature rise with the nameplate.",
            "The blower runs but the rise is far too high: airflow is restricted. Check the filter.",
        ),
    ),
    Scenario(
        id="f-blower-cap",
        procedure_id="f-blower-cap-diagnosis",
        title="Burners cut out, no air from vents",
        difficulty=Difficulty.hard,
        complaint=(
            "Furnace lights and burns but no air ever comes out of the registers. After a while the "
            "burners shut off. There is a humming noise from the bottom."
        ),
        furnace=FurnaceParams(),
        fault_ids=('furnace.f_blower_cap',),
        environment=WINTER,
        diagnosis_id="f_blower_cap",
        required_repair=RepairAction.replace_blower_capacitor,
        explanation=(
            "The board sent 120 V to the blower on schedule but the motor only hummed and drew "
            "locked-rotor current. The windings measured fine; the 7.5 uF run capacitor measured "
            "about 1 uF. With no airflow the heat exchanger overheated and the limit opened "
            "(4 flashes). Power off, discharge and replace the blower capacitor."
        ),
        hints=(
            "The limit is tripping. Is the blower actually moving air when the board calls for it?",
            "Check for 120 V at the blower leads and clamp the blower lead for amps.",
            "Voltage, high amps and a hum: check the windings, then the run capacitor in uF.",
        ),
    ),
    Scenario(
        id="f-fuse",
        procedure_id="f-fuse-diagnosis",
        title="Thermostat calls, furnace ignores it",
        difficulty=Difficulty.medium,
        complaint=(
            "No heat after the customer installed a new thermostat themselves. The furnace has "
            "power but does nothing at all."
        ),
        furnace=FurnaceParams(),
        fault_ids=('furnace.f_lv_fuse',),
        environment=WINTER,
        diagnosis_id="f_lv_fuse",
        required_repair=RepairAction.replace_lv_fuse,
        explanation=(
            "120 V was at the board and the transformer was delivering 24 V, but there was 0 V "
            "between R and C: the 3 A fuse on the board was open, most likely from R touching C "
            "during the thermostat install. With no R there is no W, so the board never saw a call. "
            "Replace the fuse."
        ),
        hints=(
            "The board LED is on, so it has power. Does it know the thermostat is calling?",
            "Measure W to C at the board, then R to C.",
            "24 V at the transformer but nothing on R: what sits between them?",
        ),
    ),
)
