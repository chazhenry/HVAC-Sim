import { useFrame } from '@react-three/fiber';
import { type ReactNode, type RefObject, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { TEST_POINTS, type TestPointId } from '../sim/testPoints';
import { useSim } from '../store/useSim';
import {
  BASE_Y,
  COMPRESSOR_POS,
  HALF,
  LIQUID_VALVE,
  MANIFOLD_POS,
  SUCTION_VALVE,
  TOP_Y,
  WIRES,
} from './layout';
import { interactive, LouverWall, makeFinTexture, makeTextTexture, Movable, named, smoothCurve, solid, TestPoint, Tube, Wire } from './parts';

const CABINET = '#c4c7c2';
const GALV = '#9aa1a5';
const COPPER = '#b87333';
const MID_Y = (BASE_Y + TOP_Y) / 2 + 0.005;
const WALL_H = 0.8;

const Metal = ({ color }: { color?: string }): ReactNode => {
  const cabinet = useSim((s) => s.context?.cabinetColor ?? CABINET);
  return <meshStandardMaterial color={color ?? cabinet} metalness={0.35} roughness={0.55} />;
};

const NAMEPLATE = [
  'HS-36 CONDENSING UNIT',
  '208/230 V   1 PH   60 Hz',
  'COMPRESSOR  RLA 16.0  LRA 75',
  'FAN MOTOR   FLA 1.4   1/5 HP',
  'RUN CAPACITOR  45/5 uF  440 V',
  'REFRIGERANT  R-410A',
  'FACTORY CHARGE  6 lb 8 oz',
  'TEST PRESSURE  250 psig',
  'DESIGN SUBCOOLING  10 F',
  'HPS 610 psig    LPS 50 psig',
] as const;

function Coil(): ReactNode {
  const fouling = useSim((s) => s.sim?.unit.coilFouling ?? 0);
  const frost = useSim((s) => s.sim?.heatPump?.frost ?? 0);
  const texture = useMemo(() => {
    const t = makeFinTexture();
    t.repeat.set(36, 1);
    return t;
  }, []);
  const color = useMemo(
    () => new THREE.Color('#aab4ba').lerp(new THREE.Color('#5c4a2f'), Math.min(1, fouling * 1.2)).lerp(new THREE.Color('#e9f5ff'), frost),
    [fouling, frost],
  );
  const handlers = interactive(
    fouling > 0.3 ? 'Condenser coil - matted with lint and cottonwood' : 'Condenser coil',
    () => useSim.getState().clickPart('coil'),
  );
  const slabs: Array<{ pos: THREE.Vector3Tuple; size: THREE.Vector3Tuple }> = [
    { pos: [-0.39, MID_Y, 0], size: [0.035, 0.76, 0.8] },
    { pos: [0, MID_Y, -0.39], size: [0.8, 0.76, 0.035] },
    { pos: [0.39, MID_Y, -0.17], size: [0.035, 0.76, 0.46] },
    { pos: [-0.13, MID_Y, 0.39], size: [0.52, 0.76, 0.035] },
  ];
  return (
    <group>
      {slabs.map((s) => (
        <mesh key={s.pos.join()} position={s.pos} {...handlers}>
          <boxGeometry args={s.size} />
          <meshStandardMaterial map={texture} color={color} metalness={0.4} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

/** Where the fan harness lands on top of the control box. */
const HARNESS_ANCHOR = new THREE.Vector3(0.37, 0.9, 0.268);

/**
 * Fan motor wiring. One end follows the motor as the top swings, the other
 * stays in the control box, so the harness is rebuilt while the lid moves.
 */
function FanHarness({ motorEnd }: { motorEnd: RefObject<THREE.Object3D | null> }): ReactNode {
  const mesh = useRef<THREE.Mesh>(null);
  const last = useRef(new THREE.Vector3(Infinity, 0, 0));
  const tip = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    if (!motorEnd.current || !mesh.current) return;
    motorEnd.current.getWorldPosition(tip);
    if (tip.distanceToSquared(last.current) < 1e-6) return;
    last.current.copy(tip);
    // Slack loop: leaves the motor sideways, droops, then drops into the box.
    const droop = tip.clone().lerp(HARNESS_ANCHOR, 0.5).add(new THREE.Vector3(0.05, -0.05, 0.02));
    const curve = smoothCurve([
      tip.clone(),
      tip.clone().add(new THREE.Vector3(0.06, -0.02, 0.02)),
      droop,
      HARNESS_ANCHOR.clone().add(new THREE.Vector3(0, 0.05, 0)),
      HARNESS_ANCHOR,
    ]);
    mesh.current.geometry.dispose();
    mesh.current.geometry = new THREE.TubeGeometry(curve, 72, 0.008, 12, false);
  });
  return (
    <mesh ref={mesh} castShadow {...named('Fan motor wiring harness')}>
      <bufferGeometry />
      <meshStandardMaterial color="#2c2c2e" roughness={0.7} />
    </mesh>
  );
}

function FanTop(): ReactNode {
  const fitted = useSim((s) => s.panels.top);
  const blades = useRef<THREE.Group>(null);
  const motorEnd = useRef<THREE.Object3D>(null);
  useFrame((_, delta) => {
    const speed = useSim.getState().sim?.fanSpeed ?? 0;
    if (blades.current) blades.current.rotation.y -= delta * speed * 30;
  });
  const plate = useMemo(() => {
    const shape = new THREE.Shape();
    const h = HALF + 0.01;
    shape.moveTo(-h, -h);
    shape.lineTo(h, -h);
    shape.lineTo(h, h);
    shape.lineTo(-h, h);
    shape.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, 0, 0.33, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.022, bevelEnabled: false, curveSegments: 48 });
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);

  const onTop = (): void => {
    const s = useSim.getState();
    if (s.tool === 'part_fanmotor') s.clickPart('fanMotor');
    else s.clickPanel('top');
  };
  const topHandlers = interactive('Fan top (grille, motor and blade) - hinges up', onTop);
  const motorHandlers = interactive('Condenser fan motor', () => {
    const s = useSim.getState();
    if (s.tool === 'nutdriver') s.clickPanel('top');
    else s.clickPart('fanMotor');
  });

  return (
    <>
    <FanHarness motorEnd={motorEnd} />
    {/* Hinged along the back edge: the top swings up and stays wired, as on a real unit. */}
    <Movable fitted={fitted} home={[0, TOP_Y, -HALF]} away={[0, TOP_Y, -HALF]} awayRotation={[-1.12, 0, 0]}>
     <group position={[0, 0, HALF]}>
      <object3D ref={motorEnd} position={[0.058, -0.06, 0]} />
      <mesh geometry={plate} castShadow receiveShadow {...topHandlers}>
        <Metal />
      </mesh>
      {/* Grille */}
      {[0.07, 0.135, 0.2, 0.265, 0.325].map((r) => (
        <mesh key={r} position={[0, 0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[r, 0.0035, 6, 48]} />
          <meshStandardMaterial color="#2b2d30" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[0, 0.03, 0]} rotation={[0, (i * Math.PI) / 8, Math.PI / 2]}>
          <cylinderGeometry args={[0.003, 0.003, 0.66, 6]} />
          <meshStandardMaterial color="#2b2d30" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 0.032, 0]} {...topHandlers}>
        <cylinderGeometry args={[0.33, 0.33, 0.012, 32]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* Motor, shaft and blade */}
      <mesh position={[0, -0.06, 0]} castShadow {...motorHandlers}>
        <cylinderGeometry args={[0.058, 0.058, 0.15, 24]} />
        <meshStandardMaterial color="#3a3d42" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.16, 0]}>
        <cylinderGeometry args={[0.007, 0.007, 0.08, 8]} />
        <meshStandardMaterial color="#c9ccd0" metalness={0.9} roughness={0.2} />
      </mesh>
      <group ref={blades} position={[0, -0.2, 0]}>
        <mesh>
          <cylinderGeometry args={[0.035, 0.035, 0.03, 16]} />
          <meshStandardMaterial color="#2b2d30" metalness={0.5} roughness={0.5} />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <group key={i} rotation={[0, (i * Math.PI) / 2, 0]}>
            <mesh position={[0.17, 0, 0]} rotation={[0.42, 0, 0]} castShadow>
              <boxGeometry args={[0.26, 0.004, 0.12]} />
              <meshStandardMaterial color="#b9bdc1" metalness={0.6} roughness={0.35} />
            </mesh>
          </group>
        ))}
      </group>
     </group>
    </Movable>
    </>
  );
}

function Compressor(): ReactNode {
  const [x, , z] = COMPRESSOR_POS;
  const shell = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const state = useSim.getState().sim?.compressor ?? 'off';
    if (!shell.current) return;
    const amp = state === 'running' ? 0.0006 : state === 'locked' ? 0.0016 : 0;
    shell.current.position.x = x + Math.sin(clock.elapsedTime * 95) * amp;
  });
  const hover = interactive('Scroll compressor - terminals C, S, R under the cover on top', () => undefined);
  return (
    <group>
      <group ref={shell} position={[x, 0, z]}>
        <mesh position={[0, 0.31, 0]} castShadow {...hover}>
          <cylinderGeometry args={[0.115, 0.115, 0.36, 28]} />
          <meshStandardMaterial color="#17181a" metalness={0.5} roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.49, 0]} scale={[1, 0.55, 1]}>
          <sphereGeometry args={[0.115, 28, 16]} />
          <meshStandardMaterial color="#17181a" metalness={0.5} roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.565, 0]}>
          <boxGeometry args={[0.1, 0.03, 0.085]} />
          <meshStandardMaterial color="#2d3035" roughness={0.7} />
        </mesh>
      </group>
      <Tube points={[[x, 0.59, z - 0.025], [0.02, 0.63, 0.02], [0.1, 0.42, 0.18], [0.16, 0.2, 0.245]]} radius={0.0045} color="#1b1b1d" />
      <Tube points={[[x - 0.027, 0.59, z + 0.02], [0, 0.62, 0.05], [0.09, 0.4, 0.19], [0.2, 0.2, 0.245]]} radius={0.0045} color="#d9b300" />
      <Tube points={[[x + 0.027, 0.59, z + 0.02], [0.03, 0.61, 0.06], [0.11, 0.38, 0.2], [0.24, 0.2, 0.245]]} radius={0.0045} color="#b3261e" />
      {/* Discharge to the coil, suction and liquid to the service valves */}
      <Tube points={[[x - 0.1, 0.45, z - 0.05], [-0.28, 0.6, -0.25], [-0.36, 0.82, -0.36]]} radius={0.008} color={COPPER} metalness={0.8} roughness={0.3} />
      <Tube points={[[x + 0.11, 0.4, z], [0.2, 0.34, 0.1], [0.34, SUCTION_VALVE[1], 0.15], [0.44, SUCTION_VALVE[1], 0.15]]} radius={0.011} color={COPPER} metalness={0.8} roughness={0.3} />
      <Tube points={[[0.36, 0.17, -0.3], [0.33, 0.18, 0], [0.36, LIQUID_VALVE[1], 0.14], [0.44, LIQUID_VALVE[1], 0.15]]} radius={0.006} color={COPPER} metalness={0.8} roughness={0.3} />
    </group>
  );
}

function ControlBox(): ReactNode {
  const heatPump = useSim((s) => s.context?.systemType === 'heat_pump');
  const contactorIn = useSim((s) => s.sim?.contactorIn ?? false);
  const contactor = interactive('Contactor - 2 pole, 24 V coil', () => useSim.getState().clickPart('contactor'));
  const capacitor = interactive('Dual run capacitor - 45/5 uF 440 V', () => useSim.getState().clickPart('capacitor'));
  const ids = (Object.keys(TEST_POINTS) as TestPointId[]).filter((id) => TEST_POINTS[id].enclosure === 'controlBox');
  return (
    <group>
      {/* Enclosure */}
      <mesh position={[0.2875, MID_Y, 0.25]} {...solid}>
        <boxGeometry args={[0.285, WALL_H, 0.008]} />
        <Metal color={GALV} />
      </mesh>
      <mesh position={[0.147, MID_Y, 0.34]} {...solid}>
        <boxGeometry args={[0.008, WALL_H, 0.18]} />
        <Metal color={GALV} />
      </mesh>
      <mesh position={[0.2875, 0.132, 0.34]}>
        <boxGeometry args={[0.285, 0.008, 0.18]} />
        <Metal color={GALV} />
      </mesh>
      <mesh position={[0.2875, 0.928, 0.34]}>
        <boxGeometry args={[0.285, 0.008, 0.18]} />
        <Metal color={GALV} />
      </mesh>

      {/* Contactor */}
      <mesh position={[0.235, 0.7, 0.285]} castShadow {...contactor}>
        <boxGeometry args={[0.1, 0.125, 0.065]} />
        <meshStandardMaterial color="#22252a" roughness={0.6} />
      </mesh>
      <mesh position={[0.235, 0.7, contactorIn ? 0.316 : 0.324]}>
        <boxGeometry args={[0.04, 0.032, 0.014]} />
        <meshStandardMaterial color={contactorIn ? '#e8dfc4' : '#b8b09a'} roughness={0.5} />
      </mesh>
      {(['CONT_L1', 'CONT_L2', 'CONT_T1', 'CONT_T2'] as const).map((id) => (
        <mesh key={id} position={[id.endsWith('1') ? 0.21 : 0.26, id.includes('_L') ? 0.745 : 0.655, 0.32]}>
          <boxGeometry args={[0.028, 0.024, 0.008]} />
          <meshStandardMaterial color="#c9ccd0" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      {[0.18, 0.29].map((cx) => (
        <mesh key={cx} position={[cx, 0.7, 0.298]}>
          <boxGeometry args={[0.012, 0.02, 0.012]} />
          <meshStandardMaterial color="#c8a04a" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}

      {/* Dual run capacitor */}
      <mesh position={[0.36, 0.365, 0.315]} castShadow {...capacitor}>
        <cylinderGeometry args={[0.042, 0.042, 0.13, 28]} />
        <meshStandardMaterial color="#d5d8db" metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh position={[0.36, 0.36, 0.276]}>
        <boxGeometry args={[0.1, 0.03, 0.006]} />
        <Metal color={GALV} />
      </mesh>
      {(['CAP_C', 'CAP_HERM', 'CAP_FAN'] as const).map((id, i) => (
        <mesh key={id} position={[[0.36, 0.335, 0.385][i] ?? 0.36, 0.434, i === 0 ? 0.335 : 0.3]}>
          <boxGeometry args={[0.014, 0.01, 0.014]} />
          <meshStandardMaterial color="#c8a04a" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}

      {/* Fan motor plug, low-voltage strip, ground lug */}
      <mesh position={[0.36, 0.6, 0.27]}>
        <boxGeometry args={[0.1, 0.032, 0.03]} />
        <meshStandardMaterial color="#e9e6dc" roughness={0.7} />
      </mesh>
      <mesh position={[0.185, 0.495, 0.26]}>
        <boxGeometry args={[0.032, 0.09, 0.018]} />
        <meshStandardMaterial color="#3a3d42" roughness={0.7} />
      </mesh>
      <mesh position={[0.395, 0.86, 0.257]}>
        <boxGeometry args={[0.032, 0.022, 0.012]} />
        <meshStandardMaterial color="#c8a04a" metalness={0.8} roughness={0.3} />
      </mesh>

      {WIRES.map((w) => (
        <Wire key={w.id} wire={w} />
      ))}
      {heatPump && <>
        <mesh position={[0.265, 0.835, 0.30]} {...named('Goodman time/temperature defrost board')}>
          <boxGeometry args={[0.21, 0.075, 0.015]} /><meshStandardMaterial color="#22643b" />
        </mesh>
      </>}
      {ids.filter((id) => heatPump || !id.startsWith('HP_')).map((id) => (
        <TestPoint key={id} id={id} />
      ))}
    </group>
  );
}

function ServiceValves(): ReactNode {
  const heatPump = useSim((s) => s.context?.systemType === 'heat_pump');
  const heating = useSim((s) => s.sim?.controls.mode === 'heat');
  const tool = useSim((s) => s.tool);
  const gauges = useSim((s) => s.gauges);
  const clamps = useSim((s) => s.tempClamps);
  const showManifold = tool === 'gauges' || tool === 'tempclamp' || gauges.low || gauges.high;

  const valve = (pos: readonly [number, number, number], side: 'low' | 'high'): ReactNode => {
    const [x, y, z] = pos;
    const name = side === 'low' ? (heatPump ? 'True suction access port (low side)' : 'Suction service port (low side)') : 'Liquid service port (high side)';
    return (
      <group key={side}>
        <mesh position={[x, y, z]} castShadow>
          <boxGeometry args={[0.055, 0.05, 0.05]} />
          <meshStandardMaterial color="#b08d3c" metalness={0.8} roughness={0.35} />
        </mesh>
        <mesh position={[x, y + 0.04, z]}>
          <cylinderGeometry args={[0.012, 0.012, 0.03, 12]} />
          <meshStandardMaterial color="#b08d3c" metalness={0.8} roughness={0.35} />
        </mesh>
        <mesh
          position={[x, y, z + 0.042]}
          rotation={[Math.PI / 2, 0, 0]}
          {...interactive(name, () => useSim.getState().clickPort(side))}
        >
          <cylinderGeometry args={[0.011, 0.011, 0.036, 12]} />
          <meshStandardMaterial
            color={tool === 'gauges' ? '#ffd35a' : '#8c6d1f'}
            emissive={tool === 'gauges' ? '#7a5a00' : '#000000'}
            metalness={0.8}
            roughness={0.3}
          />
        </mesh>
      </group>
    );
  };

  const pipeHover = tool === 'tempclamp' ? '#3a2a00' : '#000000';
  const [mx, my, mz] = MANIFOLD_POS;
  return (
    <group>
      {valve(heatPump ? [0.47, 0.26, 0.05] : SUCTION_VALVE, 'low')}
      {heatPump && <mesh position={[...SUCTION_VALVE]} {...named('Large vapor service valve · use separate true suction port for the low-side hose')}>
        <boxGeometry args={[0.055, 0.05, 0.05]} /><meshStandardMaterial color="#b08d3c" metalness={0.8} />
      </mesh>}
      {valve(LIQUID_VALVE, 'high')}
      {/* Line set running back to the house */}
      <Tube
        points={[[0.5, SUCTION_VALVE[1], 0.15], [0.74, SUCTION_VALVE[1], 0.15], [0.8, SUCTION_VALVE[1], 0.05], [0.8, SUCTION_VALVE[1], -0.7]]}
        radius={0.021}
        color="#141414"
        roughness={0.95}
        emissive={pipeHover}
        handlers={interactive(heatPump && heating ? 'Large vapor line (hot discharge gas in heating)' : 'Suction line (insulated)', () => useSim.getState().clickPipe('suction'))}
      />
      <Tube
        points={[[0.5, LIQUID_VALVE[1], 0.15], [0.7, LIQUID_VALVE[1], 0.15], [0.76, LIQUID_VALVE[1], 0.05], [0.76, LIQUID_VALVE[1], -0.7]]}
        radius={0.008}
        color={COPPER}
        metalness={0.8}
        roughness={0.3}
        emissive={pipeHover}
        handlers={interactive('Liquid line', () => useSim.getState().clickPipe('liquid'))}
      />
      {clamps.suction && (
        <mesh position={[0.62, SUCTION_VALVE[1], 0.15]} {...named('Temperature clamp on the suction line')}>
          <boxGeometry args={[0.035, 0.06, 0.06]} />
          <meshStandardMaterial color="#f2c200" roughness={0.5} />
        </mesh>
      )}
      {clamps.liquid && (
        <mesh position={[0.62, LIQUID_VALVE[1], 0.15]} {...named('Temperature clamp on the liquid line')}>
          <boxGeometry args={[0.035, 0.04, 0.04]} />
          <meshStandardMaterial color="#f2c200" roughness={0.5} />
        </mesh>
      )}
      {showManifold && (
        <group position={[mx, my, mz]} rotation={[-0.5, -0.5, 0]} {...named('Manifold gauge set - R-410A (blue = low side, red = high side)')}>
          <mesh castShadow>
            <boxGeometry args={[0.2, 0.05, 0.04]} />
            <meshStandardMaterial color="#8a8f95" metalness={0.7} roughness={0.35} />
          </mesh>
          {([[-0.055, '#1f5fbf'], [0.055, '#c62828']] as const).map(([dx, color]) => (
            <mesh key={color} position={[dx, 0.07, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.048, 0.048, 0.03, 28]} />
              <meshStandardMaterial color={color} roughness={0.4} />
            </mesh>
          ))}
        </group>
      )}
      {gauges.low && (
        <Tube
          points={[[SUCTION_VALVE[0], heatPump ? 0.26 : SUCTION_VALVE[1], heatPump ? 0.11 : 0.21], [0.55, 0.2, 0.42], [0.8, 0.04, 0.5], [mx - 0.06, my - 0.02, mz]]}
          radius={0.007}
          color="#1f5fbf"
          handlers={named('Blue hose - manifold low side to the suction service port')}
        />
      )}
      {gauges.high && (
        <Tube
          points={[[LIQUID_VALVE[0], LIQUID_VALVE[1], 0.21], [0.6, 0.1, 0.36], [0.86, 0.03, 0.44], [mx + 0.04, my - 0.02, mz]]}
          radius={0.007}
          color="#c62828"
          handlers={named('Red hose - manifold high side to the liquid service port')}
        />
      )}
      {/* Liquid line filter drier */}
      <mesh position={[0.56, LIQUID_VALVE[1], 0.15]} rotation={[0, 0, Math.PI / 2]} castShadow {...named('Liquid line filter drier')}>
        <cylinderGeometry args={[0.02, 0.02, 0.07, 16]} />
        <meshStandardMaterial color="#2f6fb0" metalness={0.6} roughness={0.4} />
      </mesh>
      <ServiceEquipment />
    </group>
  );
}

/** Whatever the manifold's yellow centre hose is connected to, set down beside the unit. */
function ServiceEquipment(): ReactNode {
  const hose = useSim((s) => s.sim?.service.hose ?? 'none');
  const running = useSim((s) => s.sim?.service.running ?? false);
  if (hose === 'none') return null;
  const [mx, my, mz] = MANIFOLD_POS;
  const glow = running ? '#1d4d1d' : '#000000';
  return (
    <group>
      <Tube points={[[mx, my - 0.02, mz], [1.1, 0.03, 0.62], [1.2, 0.05, 0.78], [1.28, 0.14, 0.86]]} radius={0.007} color="#e6c200" handlers={named('Yellow hose - manifold centre port to the service equipment')} />
      {hose === 'recovery' && (
        <group {...named('Recovery machine and recovery cylinder on a scale')}>
          <mesh position={[1.36, 0.12, 0.9]} castShadow>
            <boxGeometry args={[0.32, 0.24, 0.22]} />
            <meshStandardMaterial color="#35557a" emissive={glow} roughness={0.6} />
          </mesh>
          <mesh position={[1.72, 0.22, 0.9]} castShadow>
            <cylinderGeometry args={[0.1, 0.1, 0.4, 24]} />
            <meshStandardMaterial color="#8d9196" metalness={0.5} roughness={0.5} />
          </mesh>
          <mesh position={[1.72, 0.455, 0.9]}>
            <cylinderGeometry args={[0.08, 0.1, 0.07, 24]} />
            <meshStandardMaterial color="#f2c200" roughness={0.5} />
          </mesh>
          <mesh position={[1.72, 0.015, 0.9]}>
            <boxGeometry args={[0.26, 0.03, 0.26]} />
            <meshStandardMaterial color="#22252a" roughness={0.7} />
          </mesh>
        </group>
      )}
      {hose === 'nitrogen' && (
        <group {...named('Nitrogen cylinder with regulator')}>
          <mesh position={[1.36, 0.45, 0.9]} castShadow>
            <cylinderGeometry args={[0.09, 0.09, 0.9, 24]} />
            <meshStandardMaterial color="#2c3136" metalness={0.5} roughness={0.5} />
          </mesh>
          <mesh position={[1.36, 0.94, 0.9]}>
            <boxGeometry args={[0.1, 0.07, 0.06]} />
            <meshStandardMaterial color="#b08d3c" metalness={0.8} roughness={0.35} />
          </mesh>
        </group>
      )}
      {hose === 'vacuum' && (
        <group {...named('Vacuum pump with micron gauge')}>
          <mesh position={[1.36, 0.08, 0.9]} castShadow>
            <boxGeometry args={[0.16, 0.14, 0.14]} />
            <meshStandardMaterial color="#b3261e" emissive={glow} roughness={0.5} />
          </mesh>
          <mesh position={[1.5, 0.09, 0.9]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.06, 0.06, 0.16, 20]} />
            <meshStandardMaterial color="#2d3035" metalness={0.5} roughness={0.5} />
          </mesh>
        </group>
      )}
      {hose === 'cylinder' && (
        <group {...named('R-410A cylinder on a charging scale')}>
          <mesh position={[1.36, 0.015, 0.9]}>
            <boxGeometry args={[0.28, 0.03, 0.28]} />
            <meshStandardMaterial color="#22252a" roughness={0.7} />
          </mesh>
          <mesh position={[1.36, 0.2, 0.9]} castShadow>
            <cylinderGeometry args={[0.11, 0.11, 0.34, 24]} />
            <meshStandardMaterial color="#e39ab0" emissive={glow} roughness={0.5} />
          </mesh>
        </group>
      )}
    </group>
  );
}

export function Condenser(): ReactNode {
  const panels = useSim((s) => s.panels);
  const context = useSim((s) => s.context);
  const cabinet = context?.cabinetColor ?? CABINET;
  const nameplate = useMemo(() => makeTextTexture(context ? [
    `${context.manufacturer} ${context.outdoorModel}`, `${context.supplyVolts} V   1 PH   60 Hz`,
    `COMP RLA ${context.unit?.compressor.rla} LRA ${context.unit?.compressor.lra}`,
    `FAN FLA ${context.unit?.fanMotor.fla} · PSC`,
    `CAP ${context.unit?.capacitor.ratedHermUf}/${context.unit?.capacitor.ratedFanUf} uF`,
    `${context.refrigerant} · ${context.factoryChargeLb} LB`,
    context.systemType === 'heat_pump' ? 'SINGLE-STAGE HEAT PUMP · O = COOL' : 'SINGLE-STAGE A/C CONDENSER',
    'TRAINING MODEL · SEE EQUIPMENT NOTES',
  ] : NAMEPLATE, { width: 640, height: 420, size: 25 }), [context]);
  const brand = useMemo(() => makeTextTexture([context?.manufacturer ?? 'HVAC-SIM'], {
    width: 512, height: 128, size: 55, bg: '#a81c22', fg: '#ffffff',
  }), [context?.manufacturer]);
  const compressorPoints = (Object.keys(TEST_POINTS) as TestPointId[]).filter(
    (id) => TEST_POINTS[id].enclosure === 'compressor',
  );
  const posts: Array<[number, number]> = [
    [-0.413, 0.413],
    [-0.413, -0.413],
    [0.413, -0.413],
  ];

  return (
    <group>
      {context?.systemType === 'heat_pump' && <>
        <mesh position={[-0.14, 0.70, 0.448]} {...named('Goodman single-stage split heat pump')}>
          <planeGeometry args={[0.26, 0.065]} /><meshStandardMaterial map={brand} />
        </mesh>
        <mesh position={[-0.26, 0.32, -0.12]} {...named('Suction accumulator')}>
          <cylinderGeometry args={[0.065, 0.065, 0.3, 24]} /><meshStandardMaterial color="#26292b" metalness={0.35} />
        </mesh>
        <mesh position={[0.12, 0.45, -0.08]} rotation={[0, 0, Math.PI / 2]} {...named('Four-way reversing valve · O energized in cooling and defrost')}>
          <cylinderGeometry args={[0.026, 0.026, 0.20, 20]} /><meshStandardMaterial color={COPPER} metalness={0.75} roughness={0.3} />
        </mesh>
        {[0.05, 0.12, 0.19].map((x) => <Tube key={x} points={[[x, 0.45, -0.08], [x, 0.35, 0.02], [x - 0.1, 0.25, 0.1]]} radius={0.009} color={COPPER} />)}
      </>}
      {/* Pad and base pan */}
      <mesh position={[0, BASE_Y / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[1.12, BASE_Y, 1.12]} />
        <meshStandardMaterial color="#8f8f8a" roughness={0.95} />
      </mesh>
      <mesh position={[0, BASE_Y + 0.012, 0]} receiveShadow {...solid}>
        <boxGeometry args={[0.87, 0.024, 0.87]} />
        <Metal color="#6f7478" />
      </mesh>

      {posts.map(([px, pz]) => (
        <mesh key={`${px}${pz}`} position={[px, MID_Y, pz]} castShadow>
          <boxGeometry args={[0.035, 0.83, 0.035]} />
          <Metal />
        </mesh>
      ))}

      {/* Fixed louvered sides */}
      <group position={[-HALF, MID_Y, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <LouverWall width={0.8} height={WALL_H} color={cabinet} />
      </group>
      <group position={[0, MID_Y, -HALF]} rotation={[0, Math.PI, 0]}>
        <LouverWall width={0.8} height={WALL_H} color={cabinet} />
      </group>
      <group position={[HALF, MID_Y, -0.165]} rotation={[0, Math.PI / 2, 0]}>
        <LouverWall width={0.47} height={WALL_H} color={cabinet} />
      </group>
      {/* Solid corner panel carrying the service valves */}
      <mesh position={[0.431, MID_Y, 0.25]} castShadow {...solid}>
        <boxGeometry args={[0.012, 0.83, 0.365]} />
        <Metal />
      </mesh>

      <Coil />
      <Compressor />
      {compressorPoints.map((id) => (
        <TestPoint key={id} id={id} />
      ))}
      <ControlBox />
      <ServiceValves />

      {/* Removable: electrical access panel */}
      <Movable
        fitted={panels.access}
        home={[0.2875, MID_Y, 0.437]}
        away={[0.5, 0.012, 1.25]}
        awayRotation={[-Math.PI / 2, 0, 0.3]}
      >
        <mesh castShadow {...interactive('Electrical access panel', () => useSim.getState().clickPanel('access'))}>
          <boxGeometry args={[0.288, 0.84, 0.012]} />
          <Metal />
        </mesh>
        <mesh position={[0, 0.2, 0.0065]}>
          <planeGeometry args={[0.24, 0.158]} />
          <meshStandardMaterial map={nameplate} roughness={0.6} />
        </mesh>
        {[0.39, -0.39].map((y) => (
          <mesh key={y} position={[0, y, 0.008]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.007, 0.007, 0.006, 6]} />
            <meshStandardMaterial color="#6f7478" metalness={0.8} roughness={0.3} />
          </mesh>
        ))}
      </Movable>

      {/* Removable: front louver panel */}
      <Movable
        fitted={panels.louver}
        home={[-0.135, MID_Y, HALF]}
        away={[-0.55, 0.02, 1.3]}
        awayRotation={[-Math.PI / 2, 0, -0.2]}
      >
        <LouverWall width={0.55} height={WALL_H} color={cabinet} />
        <mesh {...interactive('Front louver panel', () => useSim.getState().clickPanel('louver'))}>
          <boxGeometry args={[0.55, WALL_H, 0.02]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </Movable>

      <FanTop />
    </group>
  );
}
