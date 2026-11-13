// Mirrors backend/app/models.py (camelCase aliases). Keep the two in sync.
import type { EquipmentJournal } from '../sim/equipment/types';

export interface AuthUser {
  id: number;
  email: string;
  fname: string;
  lname: string;
  ipaddress: string;
  loginCount: number;
}
export interface AuthResponse { user: AuthUser; token: string; expiresAt: number }

export interface ContactorParams {
  /** Coil DC resistance in ohms; null = open coil. */
  coilOhms: number | null;
  /** Contact resistance when closed; null = contact will not make. */
  pole1Ohms: number | null;
  pole2Ohms: number | null;
}

export interface CapacitorParams {
  ratedHermUf: number;
  ratedFanUf: number;
  hermUf: number;
  fanUf: number;
}

export interface CompressorParams {
  runOhms: number | null;
  startOhms: number | null;
  rla: number;
  lra: number;
}

export interface FanMotorParams {
  runOhms: number | null;
  auxOhms: number | null;
  seized: boolean;
  fla: number;
}

export interface UnitParams {
  fuseL1Ok: boolean;
  fuseL2Ok: boolean;
  contactor: ContactorParams;
  capacitor: CapacitorParams;
  compressor: CompressorParams;
  fanMotor: FanMotorParams;
  /** Refrigerant charge, 1.0 = factory charge. */
  chargeFraction: number;
  /** 0 = clean condenser coil, 1 = fully matted. */
  coilFouling: number;
}

/** 80% single-stage natural gas furnace with hot-surface ignition. */
export interface FurnaceParams {
  fuseOk: boolean;
  /** Cold resistance; null = open / cracked. */
  igniterOhms: number | null;
  flameSensorDirt: number;
  pressureSwitchOk: boolean;
  inducerOhms: number | null;
  flueBlockage: number;
  gasValveCoilOhms: number | null;
  gasCockOpen: boolean;
  gasInletWc: number;
  blowerRunOhms: number | null;
  blowerAuxOhms: number | null;
  ratedBlowerCapUf: number;
  blowerCapUf: number;
  filterDirt: number;
  limitOk: boolean;
}

export type UnitType = 'condenser' | 'furnace';

export interface Environment {
  outdoorF: number;
  indoorF: number;
  setpointF: number;
}

export interface HeatPumpConfig {
  defrostIntervalMinutes: 30 | 60 | 90;
  smartShiftSeconds: number;
  maxDefrostSeconds: number;
  sensorCloseF: number;
  sensorOpenF: number;
  auxiliaryHeatKw: number;
}

export interface EquipmentContext {
  schemaVersion: 1;
  id: string;
  name: string;
  systemType: 'air_conditioner' | 'heat_pump' | 'gas_furnace';
  unitType: UnitType;
  manufacturer: string;
  outdoorModel: string;
  indoorModel: string;
  refrigerant: 'R-410A';
  capacityBtuH: number;
  seer2: number | null;
  hspf2: number | null;
  supplyVolts: 208 | 230 | 240;
  contactorPoles: 1 | 2;
  minimumCircuitAmpacity: number | null;
  maxOvercurrentAmps: number | null;
  factoryChargeLb: number;
  dimensionsM: { width: number; depth: number; height: number };
  cabinetColor: string;
  environment: Environment;
  unit: UnitParams | null;
  furnace: FurnaceParams | null;
  heatPump: HeatPumpConfig | null;
  sources: string[];
  notes: string;
}

export type Difficulty = 'intro' | 'easy' | 'medium' | 'hard';

export interface ScenarioSummary {
  id: string;
  unitType: UnitType;
  title: string;
  difficulty: Difficulty;
  complaint: string;
}

export interface DiagnosisOption {
  id: string;
  label: string;
  unitType: UnitType;
}

export interface CatalogResponse {
  scenarios: ScenarioSummary[];
  diagnoses: DiagnosisOption[];
  contexts: EquipmentContext[];
}

interface SessionBase {
  sessionId: string;
  scenario: ScenarioSummary;
  environment: Environment;
  context: EquipmentContext | null;
  procedureId: string | null;
}

export type SessionResponse = SessionBase &
  ({ unitType: 'condenser'; unit: UnitParams } | { unitType: 'furnace'; furnace: FurnaceParams });

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message: string;
  history: ChatTurn[];
  /** What the learner can see and has measured right now. */
  state: Record<string, unknown>;
}

export interface ChatResponse {
  reply: string;
  provider: string;
  replyId?: string;
}

export interface HintResponse {
  hint: string;
  hintsUsed: number;
  hintsTotal: number;
}

export type RepairAction =
  | 'replace_capacitor'
  | 'replace_contactor'
  | 'replace_fan_motor'
  | 'replace_fuses'
  | 'add_refrigerant'
  | 'recover_refrigerant'
  | 'clean_coil'
  | 'replace_igniter'
  | 'clean_flame_sensor'
  | 'replace_flame_sensor'
  | 'replace_pressure_switch'
  | 'replace_inducer'
  | 'replace_gas_valve'
  | 'open_gas_cock'
  | 'replace_blower_capacitor'
  | 'replace_filter'
  | 'replace_lv_fuse'
  | 'replace_control_board'
  | 'replace_limit_switch'
  | 'replace_filter_drier';

export interface FinalState {
  callingForCooling: boolean;
  operatingMode?: 'cool' | 'heat';
  defrostActive?: boolean;
  heatDelivered?: boolean;
  compressorRunning: boolean;
  fanRunning: boolean;
  suctionPsig: number;
  liquidPsig: number;
  superheatF: number;
  subcoolF: number;
  panelsInstalled: boolean;
}

export interface FurnaceFinalState {
  callingForHeat: boolean;
  burnersLit: boolean;
  blowerRunning: boolean;
  tempRiseF: number;
  manifoldWc: number;
  panelsInstalled: boolean;
}

/** What was done with the recovery machine, nitrogen, vacuum pump and scale. */
export interface ServiceReport {
  openedSystem: boolean;
  openedAtPsig: number | null;
  testGas: string | null;
  pressureTestPsig: number;
  deepestMicrons: number;
  heldMicrons: number | null;
  finalChargeLb: number;
  factoryChargeLb: number;
}

export type ExamSection = 'core' | 'type1' | 'type2' | 'type3';

export interface ExamSectionInfo {
  id: ExamSection;
  title: string;
  covers: string;
  questionCount: number;
}

export interface ExamQuestion {
  id: string;
  prompt: string;
  choices: string[];
}

export interface ExamPaper {
  section: ExamSectionInfo;
  passPercent: number;
  questions: ExamQuestion[];
}

export interface ExamQuestionResult {
  id: string;
  chosen: number | null;
  correctIndex: number;
  correct: boolean;
  explanation: string;
}

export interface ExamResult {
  correct: number;
  total: number;
  percent: number;
  passed: boolean;
  results: ExamQuestionResult[];
}

export interface SubmitRequest {
  equipmentJournal?: EquipmentJournal;
  diagnosisId: string;
  repairs: RepairAction[];
  safetyViolations: string[];
  measurementsTaken: number;
  elapsedSeconds: number;
  /** Exactly one of these, matching the unit type. */
  finalState?: FinalState;
  furnaceFinal?: FurnaceFinalState;
  service?: ServiceReport;
}

export interface ScoreLine {
  label: string;
  points: number;
  maxPoints: number;
  note: string;
}

export interface GradeResponse {
  score: number;
  diagnosisCorrect: boolean;
  correctDiagnosis: DiagnosisOption;
  breakdown: ScoreLine[];
  explanation: string;
}

export interface VisitEntry {
  id: string;
  visitedAt: string;
  ip: string;
  city: string | null;
  state: string | null;
  country: string | null;
  appVersion: string;
  event: string;
  user: string | null;
}

export interface VisitsPage {
  items: VisitEntry[];
  total: number;
  offset: number;
  limit: number;
}
