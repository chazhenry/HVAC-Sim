import { suctionPsig, liquidPsig } from '../sim/engine';
import { boardPowered, draftWc, FAULT_CODES, inletWc, manifoldWc } from '../sim/furnace/engine';
import type { MeterReading } from '../sim/instruments';
import { clampLabel, pointInfo } from '../sim/points';
import { satTempF } from '../sim/refrigerant';
import { cylinderFill, inchesHg } from '../sim/service';
import { activeClamp, activeHot, activeReading, activeTime, type AppState } from '../store/useSim';

/** What a technician standing at the unit can see and hear, as label/value pairs. */
export function observationRows(s: AppState): Array<[string, string]> {
  const { sim, furnace } = s;
  if (furnace) {
    return [
      ['Board LED', boardPowered(furnace) ? FAULT_CODES[furnace.board.code] : 'off - no power at the board'],
      ['Inducer', furnace.inducerSpeed > 0.4 ? 'running' : 'stopped'],
      ['Igniter', furnace.igniterTemp > 0.6 ? 'glowing orange' : 'dark'],
      ['Burners', furnace.flame ? 'lit, blue flame' : 'no flame'],
      ['Blower', furnace.blowerSpeed > 0.4 ? 'moving air' : furnace.blower === 'locked' ? 'humming, not turning' : 'stopped'],
    ];
  }
  if (sim) {
    return [
      ...(sim.heatPump ? [
        ['Reversing valve O', sim.heatPump.reversingValveEnergized ? 'energized · cooling/defrost' : 'de-energized · heat'],
        ['Defrost', sim.heatPump.stage.replaceAll('_', ' ')],
      ] as Array<[string, string]> : []),
      ['Disconnect', sim.controls.disconnectIn ? 'in' : 'pulled'],
      ['Condenser fan', sim.fanSpeed > 0.4 ? 'spinning' : sim.fan === 'locked' ? 'buzzing, not turning' : 'stopped'],
      ['Compressor', sim.compressor === 'running' ? 'running' : sim.compressor === 'locked' ? 'loud hum, not running' : 'silent'],
      [sim.heatPump && sim.controls.mode === 'heat' ? 'Large vapor line' : 'Suction line',
        sim.thermo.suctionLineF > 100 ? 'hot to the touch' : sim.thermo.suctionLineF < 62 ? 'cold to the touch' : 'not cold'],
    ];
  }
  return [];
}

const clock = (t: number): string => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const round = (x: number, digits = 1): number => Number(x.toFixed(digits));

function readingText(r: MeterReading): string {
  switch (r.kind) {
    case 'idle':
      return 'both leads not placed yet';
    case 'ol':
      return `OL (open circuit)${r.note ? ` - ${r.note}` : ''}`;
    case 'live':
      return `meter on ohms/capacitance but ${r.volts.toFixed(0)} V is present`;
    case 'na':
      return r.note;
    case 'value':
      return `${round(r.value, 2)} ${r.unit}${r.note ? ` - ${r.note}` : ''}`;
  }
}

/**
 * Snapshot of the unit and the job sent with every chat prompt. It holds only
 * what the learner can observe or has measured - never the unit's hidden
 * parameters - so the tutor cannot be made to read out the fault.
 */
export function chatState(s: AppState): Record<string, unknown> {
  const { sim, furnace } = s;
  const unit = sim ?? furnace;
  if (!unit) return {};

  const instruments: Record<string, unknown> = {};
  if (s.leads.red !== null || s.leads.black !== null) {
    instruments.multimeter = {
      mode: s.meterMode,
      redLead: s.leads.red ? pointInfo(s.leads.red).label : 'not placed',
      blackLead: s.leads.black ? pointInfo(s.leads.black).label : 'not placed',
      reading: readingText(activeReading(s)),
    };
  }
  if (s.clampAt !== null) {
    instruments.clampMeter = { around: clampLabel(s.clampAt), amps: round(activeClamp(s, s.clampAt), 2) };
  }
  if (s.ncvAt !== null) {
    instruments.voltageTester = { at: pointInfo(s.ncvAt).label, result: activeHot(s, s.ncvAt) ? 'HOT' : 'no voltage detected' };
  }

  const out: Record<string, unknown> = {
    unitType: s.unitType,
    ...(s.context ? { equipment: { name: s.context.name, outdoorModel: s.context.outdoorModel,
      indoorModel: s.context.indoorModel, refrigerant: s.context.refrigerant, supplyVolts: s.context.supplyVolts } } : {}),
    ...(sim?.heatPump ? { heatPump: { stage: sim.heatPump.stage, O_energized: sim.heatPump.reversingValveEnergized,
      W2_auxiliaryHeat: sim.heatPump.auxiliaryHeat, indoorBlower: sim.heatPump.indoorBlower,
      coilSensorClosed: sim.heatPump.sensorClosed, coilF: round(sim.heatPump.coilF) } } : {}),
    simulatorClock: clock(activeTime(s)),
    thermostat: {
      mode: s.tstat.mode,
      setpointF: s.tstat.setpointF,
      roomF: unit.env.indoorF,
      outdoorF: unit.env.outdoorF,
      calling: unit.controls.calling,
    },
    whatYouSeeAndHear: Object.fromEntries(observationRows(s)),
    toolInHand: s.tool,
  };

  if (sim) {
    out.access = {
      disconnectCover: s.doorOpen ? 'open' : 'closed',
      disconnectPullout: sim.controls.disconnectIn ? 'in (power on)' : 'pulled (power off)',
      electricalAccessPanel: s.panels.access ? 'fitted' : 'removed',
      louverPanel: s.panels.louver ? 'fitted' : 'removed',
      fanTop: s.panels.top ? 'down' : 'swung up',
    };
    const svc = sim.service;
    if (s.gauges.low || s.gauges.high) {
      const saturated = svc.staticPsig === null;
      const pressure = (psig: number): string =>
        psig < -0.05 ? `${inchesHg(psig).toFixed(1)} in. Hg vacuum` : `${psig.toFixed(0)} psig`;
      const low = suctionPsig(sim);
      const high = liquidPsig(sim);
      const suctionLine = s.tempClamps.suction ? sim.thermo.suctionLineF : null;
      const liquidLine = s.tempClamps.liquid ? sim.thermo.liquidLineF : null;
      instruments.manifoldGauges = {
        lowSide: s.gauges.low ? pressure(low) : 'hose not connected',
        highSide: s.gauges.high ? pressure(high) : 'hose not connected',
        ...(s.gauges.low && saturated ? { lowSaturationF: round(satTempF(low), 0) } : {}),
        ...(s.gauges.high && saturated ? { highSaturationF: round(satTempF(high), 0) } : {}),
        ...(suctionLine !== null ? { suctionLineF: round(suctionLine) } : {}),
        ...(liquidLine !== null ? { liquidLineF: round(liquidLine) } : {}),
        ...(s.gauges.low && saturated && suctionLine !== null && !(sim.heatPump && sim.controls.mode === 'heat') ? { superheatF: round(suctionLine - satTempF(low)) } : {}),
        ...(s.gauges.high && saturated && liquidLine !== null ? { subcoolingF: round(satTempF(high) - liquidLine) } : {}),
      };
      instruments.serviceCart = {
        yellowHoseTo: svc.hose,
        equipmentRunning: svc.running,
        systemOpened: svc.opened,
        ...(svc.hose === 'vacuum' || svc.microns < 700000 ? { micronGauge: Math.round(svc.microns) } : {}),
        ...(svc.heldMicrons !== null ? { standingVacuumTestMicrons: Math.round(svc.heldMicrons) } : {}),
        ...(svc.recoveredLb > 0 ? { recoveredLb: round(svc.recoveredLb, 2), recoveryCylinderFillPercent: Math.round(cylinderFill(svc) * 100) } : {}),
        ...(svc.addedLb > 0 ? { refrigerantAddedLb: round(svc.addedLb, 2) } : {}),
        ...(svc.hose === 'nitrogen' ? { testGas: svc.testGas, regulatorPsig: svc.regulatorPsig } : {}),
      };
    }
  }

  if (furnace) {
    out.access = {
      serviceSwitch: furnace.controls.powerOn ? 'on' : 'off',
      burnerDoor: s.fdoors.burner ? 'fitted' : 'removed',
      blowerDoor: s.fdoors.blower ? 'fitted' : 'removed',
      doorSwitch: s.doorSwitchTaped ? 'taped down' : furnace.controls.doorClosed ? 'closed' : 'open',
    };
    if (s.manoAt !== null) {
      const wc = s.manoAt === 'draft' ? draftWc(furnace) : s.manoAt === 'inlet' ? inletWc(furnace) : manifoldWc(furnace);
      instruments.manometer = { tap: s.manoAt, inchesWaterColumn: round(wc, 2) };
    }
    if (s.probes.supply || s.probes.return) {
      const supply = s.probes.supply ? furnace.hxF : null;
      const ret = s.probes.return ? furnace.env.indoorF : null;
      instruments.temperatureProbes = {
        ...(supply !== null ? { supplyAirF: round(supply) } : {}),
        ...(ret !== null ? { returnAirF: round(ret) } : {}),
        ...(supply !== null && ret !== null ? { temperatureRiseF: round(supply - ret) } : {}),
      };
    }
  }

  out.instrumentsConnected = Object.keys(instruments).length > 0 ? instruments : 'none';
  out.job = {
    repairsMade: s.repairs,
    safetyViolations: s.violations,
    hintsUsed: s.hints.length,
    measurementsTaken: s.measurements,
  };
  out.recentJobLog = s.log.slice(-12).map((e) => `${clock(e.t)} ${e.text}`);
  return out;
}
