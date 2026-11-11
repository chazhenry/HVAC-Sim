import { useFrame } from '@react-three/fiber';
import { type ReactNode, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { boardPowered } from '../sim/furnace/engine';
import { F_TEST_POINTS, type FTestPointId } from '../sim/furnace/testPoints';
import { type FurnaceTarget, useSim } from '../store/useSim';
import {
  BLOWER,
  BLOWER_CAP,
  BOARD,
  BURNER_X,
  BURNER_Y,
  DOOR_SWITCH,
  F_DECK_Y,
  F_HALF_D,
  F_HALF_W,
  F_HEIGHT,
  F_HX_Z,
  GAS_COCK,
  GAS_VALVE,
  INDUCER,
  LIMIT_SWITCH,
  PRESSURE_SWITCH,
  SWITCH_BOX,
} from './furnaceLayout';
import type { WireDef } from './layout';
import { interactive, makeTextTexture, Movable, solid, TestPoint, Tube, Wire } from './parts';

const CABINET = '#b4bac1';
const DOOR = '#c7ccd2';
const GALV = '#9aa1a5';
const DUCT = '#a9b0b6';
const BRASS = '#b08d3c';
const X_AXIS: THREE.EulerTuple = [0, 0, Math.PI / 2];
const Z_AXIS: THREE.EulerTuple = [Math.PI / 2, 0, 0];

const click = (label: string, target: FurnaceTarget): ReturnType<typeof interactive> =>
  interactive(label, () => useSim.getState().clickFurnace(target));

const Sheet = ({ color = CABINET }: { color?: string }): ReactNode => (
  <meshStandardMaterial color={color} metalness={0.35} roughness={0.55} />
);

const DOOR_LABEL = [
  'GF-80 GAS FURNACE',
  '80,000 BTU/h   NATURAL GAS',
  'MANIFOLD 3.5 in. w.c.',
  'INLET 5 - 10.5 in. w.c.',
  'TEMP RISE 35 - 65 F',
  'LED  ON: normal',
  '1: lockout   2: PS open',
  '3: PS closed 4: limit',
] as const;

const F_WIRES: readonly WireDef[] = [
  { id: 'f-l1', color: '#1b1b1d', radius: 0.0045, clamp: 'F_W_L1', points: [[0.208, 0.39, 0.312], [0.1, 0.432, 0.27], [-0.1, 0.425, 0.24], [-0.17, 0.39, 0.214]] },
  { id: 'f-blw', color: '#1b1b1d', radius: 0.0045, clamp: 'F_W_BLW', points: [[0.05, 0.3, 0.205], [0.03, 0.25, 0.18], [0.02, 0.2, 0.1]] },
  { id: 'f-ind', color: '#1b1b1d', radius: 0.0045, clamp: 'F_W_IND', points: [[0.02, 0.855, 0.245], [-0.02, 0.93, 0.26], [-0.09, 0.975, 0.25]] },
  { id: 'f-ign', color: '#e8e4d8', radius: 0.004, clamp: 'F_W_IGN', points: [[-0.195, 0.575, 0.11], [-0.212, 0.6, 0.125], [-0.19, 0.628, 0.128]] },
  { id: 'f-gv', color: '#2a5db0', radius: 0.003, clamp: 'F_W_GV', points: [[0.15, 0.6, 0.29], [0.1, 0.665, 0.3], [-0.02, 0.69, 0.3], [-0.1, 0.97, 0.27]] },
  { id: 'f-fs', color: '#d9d9d9', radius: 0.0025, points: [[0.085, 0.6, 0.112], [0.1, 0.66, 0.2], [0.21, 0.64, 0.3], [0.21, 0.46, 0.3]] },
  { id: 'f-ps', color: '#d9b300', radius: 0.0025, points: [[-0.15, 0.87, 0.095], [-0.19, 0.92, 0.15], [-0.11, 0.975, 0.26]] },
];

function Burners(): ReactNode {
  const flames = useRef<THREE.Group>(null);
  const igniter = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    const f = useSim.getState().furnace;
    if (flames.current) {
      flames.current.visible = f?.flame ?? false;
      flames.current.scale.z = 1 + 0.12 * Math.sin(clock.elapsedTime * 31);
    }
    if (igniter.current) {
      const t = f?.igniterTemp ?? 0;
      igniter.current.emissiveIntensity = t * 3;
      igniter.current.color.setRGB(0.25 + 0.75 * t, 0.25 + 0.3 * t, 0.25);
    }
  });
  return (
    <group>
      <mesh position={[-0.03, BURNER_Y, 0.27]} rotation={X_AXIS}>
        <cylinderGeometry args={[0.012, 0.012, 0.29, 12]} />
        <meshStandardMaterial color="#3d4147" metalness={0.6} roughness={0.5} />
      </mesh>
      {BURNER_X.map((x) => (
        <group key={x}>
          <mesh position={[x, BURNER_Y, 0.18]} rotation={Z_AXIS} castShadow>
            <cylinderGeometry args={[0.018, 0.018, 0.17, 14]} />
            <meshStandardMaterial color="#6a6f76" metalness={0.6} roughness={0.45} />
          </mesh>
          <mesh position={[x, BURNER_Y, F_HX_Z + 0.006]} rotation={Z_AXIS}>
            <cylinderGeometry args={[0.027, 0.027, 0.004, 20]} />
            <meshStandardMaterial color="#0b0b0c" roughness={1} />
          </mesh>
        </group>
      ))}
      <group ref={flames} visible={false}>
        {BURNER_X.map((x) => (
          <mesh key={x} position={[x, BURNER_Y, 0.065]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.019, 0.07, 14]} />
            <meshStandardMaterial color="#58b4ff" emissive="#2a7dff" emissiveIntensity={2.5} transparent opacity={0.85} />
          </mesh>
        ))}
        <pointLight position={[-0.06, BURNER_Y, 0.12]} color="#5aa8ff" intensity={0.5} distance={0.6} />
      </group>

      {/* Hot-surface igniter at the first burner */}
      <mesh position={[-0.195, 0.56, 0.11]} {...click('Hot-surface igniter', 'igniter')}>
        <boxGeometry args={[0.03, 0.03, 0.03]} />
        <meshStandardMaterial color="#efe9da" roughness={0.8} />
      </mesh>
      <mesh position={[-0.168, 0.542, 0.088]} {...click('Hot-surface igniter', 'igniter')}>
        <boxGeometry args={[0.04, 0.009, 0.012]} />
        <meshStandardMaterial ref={igniter} color="#404040" emissive="#ff6a00" emissiveIntensity={0} roughness={0.9} />
      </mesh>
      <mesh position={[-0.186, 0.63, 0.122]}>
        <boxGeometry args={[0.052, 0.022, 0.022]} />
        <meshStandardMaterial color="#e9e6dc" roughness={0.7} />
      </mesh>

      {/* Flame sensor at the last burner */}
      <mesh position={[0.08, 0.578, 0.1]} {...click('Flame sensor', 'flameSensor')}>
        <boxGeometry args={[0.022, 0.05, 0.022]} />
        <meshStandardMaterial color="#efe9da" roughness={0.8} />
      </mesh>
      <FlameRod />
    </group>
  );
}

function FlameRod(): ReactNode {
  const dirt = useSim((s) => s.furnace?.unit.flameSensorDirt ?? 0);
  return (
    <Tube
      points={[[0.078, 0.555, 0.095], [0.06, 0.538, 0.082], [0.04, 0.532, 0.078]]}
      radius={0.0035}
      color={dirt > 0.5 ? '#4a4038' : '#cfd3d6'}
      metalness={dirt > 0.5 ? 0.1 : 0.9}
      roughness={dirt > 0.5 ? 0.95 : 0.25}
      hitPadding={0.008}
      handlers={click(dirt > 0.5 ? 'Flame sensor rod - dull grey oxide coating' : 'Flame sensor rod - bright metal', 'flameSensor')}
    />
  );
}

function GasTrain(): ReactNode {
  const tool = useSim((s) => s.tool);
  const open = useSim((s) => s.furnace?.unit.gasCockOpen ?? true);
  const manoAt = useSim((s) => s.manoAt);
  const [vx, vy, vz] = GAS_VALVE;
  const tap = (x: number, name: string, target: FurnaceTarget, on: boolean): ReactNode => (
    <mesh position={[x, vy - 0.015, vz + 0.048]} rotation={Z_AXIS} {...click(name, target)}>
      <cylinderGeometry args={[0.008, 0.008, 0.02, 10]} />
      <meshStandardMaterial
        color={on ? '#ff8a3c' : tool === 'manometer' ? '#ffd35a' : BRASS}
        emissive={on ? '#a03a00' : tool === 'manometer' ? '#7a5a00' : '#000000'}
        metalness={0.8}
        roughness={0.3}
      />
    </mesh>
  );
  return (
    <group>
      <mesh position={[vx, vy, vz]} castShadow {...click('Gas valve', 'gasValve')}>
        <boxGeometry args={[0.09, 0.09, 0.08]} />
        <meshStandardMaterial color="#7d8288" metalness={0.6} roughness={0.45} />
      </mesh>
      {tap(vx + 0.028, 'Gas valve inlet pressure tap', 'inletTap', manoAt === 'inlet')}
      {tap(vx - 0.028, 'Gas valve manifold (outlet) pressure tap', 'manifoldTap', manoAt === 'manifold')}
      {/* Supply pipe with manual shut-off */}
      <mesh position={[0.3475, vy, vz]} rotation={X_AXIS}>
        <cylinderGeometry args={[0.014, 0.014, 0.305, 12]} />
        <meshStandardMaterial color="#1c1c1e" metalness={0.5} roughness={0.6} />
      </mesh>
      <mesh position={[0.5, vy / 2, vz]}>
        <cylinderGeometry args={[0.014, 0.014, vy, 12]} />
        <meshStandardMaterial color="#1c1c1e" metalness={0.5} roughness={0.6} />
      </mesh>
      <mesh position={GAS_COCK as unknown as THREE.Vector3Tuple} {...click(open ? 'Gas shut-off (open)' : 'Gas shut-off (closed)', 'gasCock')}>
        <boxGeometry args={[0.05, 0.045, 0.045]} />
        <meshStandardMaterial color={BRASS} metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh
        position={[GAS_COCK[0], GAS_COCK[1] + 0.034, GAS_COCK[2]]}
        rotation={[0, open ? 0 : Math.PI / 2, 0]}
        {...click(open ? 'Gas shut-off handle - in line with the pipe (open)' : 'Gas shut-off handle - across the pipe (closed)', 'gasCock')}
      >
        <boxGeometry args={[0.1, 0.012, 0.02]} />
        <meshStandardMaterial color="#f2c200" roughness={0.5} />
      </mesh>
    </group>
  );
}

function DraftAssembly(): ReactNode {
  const tool = useSim((s) => s.tool);
  const onTap = useSim((s) => s.manoAt === 'draft');
  const [ix, iy, iz] = INDUCER;
  const inducer = click('Inducer (draft) motor', 'inducer');
  return (
    <group>
      <mesh position={[ix, iy, iz]} rotation={Z_AXIS} castShadow {...inducer}>
        <cylinderGeometry args={[0.12, 0.12, 0.08, 32]} />
        <Sheet color={GALV} />
      </mesh>
      <mesh position={[ix, iy, iz + 0.1]} rotation={Z_AXIS} castShadow {...inducer}>
        <cylinderGeometry args={[0.052, 0.052, 0.12, 20]} />
        <meshStandardMaterial color="#2d3035" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* Flue */}
      <mesh position={[ix + 0.09, 1.33, iz]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.9, 20]} />
        <Sheet color={GALV} />
      </mesh>

      <mesh position={PRESSURE_SWITCH as unknown as THREE.Vector3Tuple} rotation={Z_AXIS} {...click('Pressure switch', 'pressureSwitch')}>
        <cylinderGeometry args={[0.042, 0.042, 0.035, 24]} />
        <meshStandardMaterial color="#e6dfcd" roughness={0.7} />
      </mesh>
      <Tube points={[[-0.15, 0.828, 0.085], [-0.13, 0.775, 0.12], [-0.09, 0.762, 0.15]]} radius={0.005} color="#2b2b2b" roughness={0.9} />
      <mesh position={[-0.13, 0.775, 0.12]} {...click('Pressure switch hose tap', 'pressureTap')}>
        <sphereGeometry args={[0.011, 12, 12]} />
        <meshStandardMaterial
          color={onTap ? '#ff8a3c' : tool === 'manometer' ? '#ffd35a' : BRASS}
          emissive={onTap ? '#a03a00' : tool === 'manometer' ? '#7a5a00' : '#000000'}
          metalness={0.8}
          roughness={0.3}
        />
      </mesh>

      <mesh position={LIMIT_SWITCH as unknown as THREE.Vector3Tuple} rotation={Z_AXIS} {...click('High-limit switch', 'limit')}>
        <cylinderGeometry args={[0.03, 0.03, 0.022, 20]} />
        <meshStandardMaterial color="#c9ccd0" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}

/** Status LED: steady when normal, counted flashes for a fault code. */
function BoardLed(): ReactNode {
  const material = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    const f = useSim.getState().furnace;
    if (!material.current) return;
    let lit = false;
    if (f && boardPowered(f)) {
      const code = f.board.code;
      if (code === 0) lit = true;
      else {
        const t = clock.elapsedTime % (code * 0.5 + 1.4);
        lit = t < code * 0.5 && t % 0.5 < 0.25;
      }
    }
    material.current.emissiveIntensity = lit ? 3 : 0;
  });
  return (
    <mesh position={[-0.02, 0.385, 0.208]}>
      <sphereGeometry args={[0.007, 12, 12]} />
      <meshStandardMaterial ref={material} color="#5a1010" emissive="#ff2a2a" emissiveIntensity={0} />
    </mesh>
  );
}

function BlowerCompartment(): ReactNode {
  const wheel = useRef<THREE.Group>(null);
  const taped = useSim((s) => s.doorSwitchTaped);
  useFrame((_, delta) => {
    const speed = useSim.getState().furnace?.blowerSpeed ?? 0;
    if (wheel.current) wheel.current.rotation.x += delta * speed * 22;
  });
  const [bx, by, bz] = BLOWER;
  const blower = click('Blower motor and wheel', 'blowerMotor');
  const board = click('Integrated furnace control board', 'board');
  return (
    <group>
      {/* Squirrel-cage wheel between two side rings */}
      <group position={[bx, by, bz]}>
        <group ref={wheel}>
          {Array.from({ length: 18 }, (_, i) => (
            <group key={i} rotation={[(i * Math.PI * 2) / 18, 0, 0]}>
              <mesh position={[0, 0.145, 0]} rotation={[0.5, 0, 0]}>
                <boxGeometry args={[0.28, 0.004, 0.03]} />
                <meshStandardMaterial color="#8d949a" metalness={0.6} roughness={0.4} />
              </mesh>
            </group>
          ))}
        </group>
        {[-0.145, 0.145].map((x) => (
          <mesh key={x} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.158, 0.012, 8, 36]} />
            <Sheet color={GALV} />
          </mesh>
        ))}
        <mesh rotation={X_AXIS} {...blower}>
          <cylinderGeometry args={[0.06, 0.06, 0.2, 20]} />
          <meshStandardMaterial color="#2d3035" metalness={0.5} roughness={0.5} />
        </mesh>
      </group>

      {/* Control board on its bracket, with transformer */}
      <mesh position={[BOARD[0], BOARD[1], BOARD[2] - 0.012]} {...solid}>
        <boxGeometry args={[0.44, 0.19, 0.006]} />
        <Sheet color={GALV} />
      </mesh>
      <mesh position={BOARD as unknown as THREE.Vector3Tuple} {...board}>
        <boxGeometry args={[0.2, 0.15, 0.008]} />
        <meshStandardMaterial color="#1f6b3a" roughness={0.6} />
      </mesh>
      {(
        [
          [-0.155, 0.385, 0.05, 0.022],
          [-0.14, 0.275, 0.085, 0.022],
          [-0.02, 0.275, 0.022, 0.022],
          [-0.1, 0.385, 0.022, 0.022],
        ] as const
      ).map(([x, y, w, h]) => (
        <mesh key={`${x}${y}`} position={[x, y, 0.206]}>
          <boxGeometry args={[w, h, 0.006]} />
          <meshStandardMaterial color="#c9ccd0" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      {[-0.12, -0.02].map((x) => (
        <mesh key={x} position={[x, 0.33, 0.212]} {...board}>
          <boxGeometry args={[0.035, 0.03, 0.016]} />
          <meshStandardMaterial color="#15171a" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[-0.065, 0.34, 0.211]} {...click('3 A low-voltage fuse', 'fuse')}>
        <boxGeometry args={[0.018, 0.022, 0.014]} />
        <meshStandardMaterial color="#8e44ad" roughness={0.5} transparent opacity={0.9} />
      </mesh>
      <BoardLed />
      <mesh position={[0.13, 0.36, 0.215]} castShadow>
        <boxGeometry args={[0.075, 0.075, 0.055]} />
        <meshStandardMaterial color="#3a3d42" metalness={0.4} roughness={0.6} />
      </mesh>
      <mesh position={[0.065, 0.3, 0.203]}>
        <boxGeometry args={[0.065, 0.026, 0.02]} />
        <meshStandardMaterial color="#e9e6dc" roughness={0.7} />
      </mesh>

      {/* Blower run capacitor */}
      <mesh position={BLOWER_CAP as unknown as THREE.Vector3Tuple} castShadow {...click('Blower run capacitor - 7.5 uF 370 V', 'blowerCap')}>
        <cylinderGeometry args={[0.028, 0.028, 0.08, 20]} />
        <meshStandardMaterial color="#d5d8db" metalness={0.85} roughness={0.25} />
      </mesh>

      {/* Door interlock switch */}
      <mesh position={DOOR_SWITCH as unknown as THREE.Vector3Tuple}>
        <boxGeometry args={[0.055, 0.04, 0.03]} />
        <meshStandardMaterial color="#22252a" roughness={0.6} />
      </mesh>
      <mesh
        position={[DOOR_SWITCH[0], DOOR_SWITCH[1] + 0.012, DOOR_SWITCH[2] + (taped ? 0.016 : 0.026)]}
        {...click(taped ? 'Door switch - taped down' : 'Door switch - click to tape it down', 'doorSwitch')}
      >
        <boxGeometry args={[0.02, 0.014, 0.022]} />
        <meshStandardMaterial color={taped ? '#2a5db0' : '#e8dfc4'} roughness={0.6} />
      </mesh>
    </group>
  );
}

function Ducts(): ReactNode {
  const dirt = useSim((s) => s.furnace?.unit.filterDirt ?? 0);
  const probes = useSim((s) => s.probes);
  const filterColor = useMemo(
    () => new THREE.Color('#f1f3f4').lerp(new THREE.Color('#57504a'), Math.min(1, dirt * 1.1)),
    [dirt],
  );
  const filter = click(dirt > 0.5 ? 'Air filter - grey and matted with dust' : 'Air filter', 'filter');
  const supply = click('Supply plenum (heated air)', 'supplyDuct');
  const ret = click('Return air duct', 'returnDuct');
  return (
    <group>
      {/* Return boot and drop on the left */}
      <mesh position={[-0.405, 0.25, 0]} castShadow {...ret}>
        <boxGeometry args={[0.31, 0.5, 0.6]} />
        <Sheet color={DUCT} />
      </mesh>
      <mesh position={[-0.435, 1.3, 0]} castShadow {...ret}>
        <boxGeometry args={[0.25, 1.6, 0.5]} />
        <Sheet color={DUCT} />
      </mesh>
      {/* Filter in its rack between the boot and the furnace */}
      <mesh position={[-0.238, 0.25, 0.01]} {...filter}>
        <boxGeometry args={[0.022, 0.47, 0.66]} />
        <meshStandardMaterial color={filterColor} roughness={1} />
      </mesh>
      {/* Supply plenum and trunk on top */}
      <mesh position={[0, 1.28, -0.16]} castShadow {...supply}>
        <boxGeometry args={[0.45, 0.55, 0.38]} />
        <Sheet color={DUCT} />
      </mesh>
      <mesh position={[0.35, 1.68, -0.16]} castShadow {...supply}>
        <boxGeometry args={[1.6, 0.26, 0.38]} />
        <Sheet color={DUCT} />
      </mesh>
      {probes.supply && (
        <mesh position={[0.1, 1.3, 0.04]}>
          <sphereGeometry args={[0.018, 12, 12]} />
          <meshStandardMaterial color="#f2c200" />
        </mesh>
      )}
      {probes.return && (
        <mesh position={[-0.435, 0.95, 0.26]}>
          <sphereGeometry args={[0.018, 12, 12]} />
          <meshStandardMaterial color="#f2c200" />
        </mesh>
      )}
    </group>
  );
}

export function Furnace(): ReactNode {
  const fdoors = useSim((s) => s.fdoors);
  const powerOn = useSim((s) => s.furnace?.controls.powerOn ?? true);
  const label = useMemo(() => makeTextTexture(DOOR_LABEL, { width: 640, height: 420, size: 30 }), []);
  const ids = Object.keys(F_TEST_POINTS) as FTestPointId[];
  const upperH = F_HEIGHT - F_DECK_Y;
  const upperY = F_DECK_Y + upperH / 2;

  return (
    <group>
      {/* Basement */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[9, 40]} />
        <meshStandardMaterial color="#8a8d90" roughness={1} />
      </mesh>
      <mesh position={[0.3, 1.25, -0.47]} receiveShadow {...solid}>
        <boxGeometry args={[4.4, 2.5, 0.1]} />
        <meshStandardMaterial color="#b9b3a6" roughness={1} />
      </mesh>

      {/* Cabinet shell */}
      {[-F_HALF_W, F_HALF_W].map((x) => (
        <mesh key={x} position={[x, F_HEIGHT / 2, 0]} castShadow {...solid}>
          <boxGeometry args={[0.01, F_HEIGHT, F_HALF_D * 2]} />
          <Sheet />
        </mesh>
      ))}
      <mesh position={[0, F_HEIGHT / 2, -F_HALF_D]} {...solid}>
        <boxGeometry args={[F_HALF_W * 2, F_HEIGHT, 0.01]} />
        <Sheet />
      </mesh>
      {[0.005, F_DECK_Y, F_HEIGHT].map((y) => (
        <mesh key={y} position={[0, y, 0]} {...solid}>
          <boxGeometry args={[F_HALF_W * 2, 0.012, F_HALF_D * 2]} />
          <Sheet color={GALV} />
        </mesh>
      ))}
      <mesh position={[0, upperY, F_HX_Z]} {...solid}>
        <boxGeometry args={[F_HALF_W * 2, upperH, 0.01]} />
        <meshStandardMaterial color="#5d6269" metalness={0.5} roughness={0.6} />
      </mesh>

      <Burners />
      <GasTrain />
      <DraftAssembly />
      <BlowerCompartment />
      <Ducts />
      {F_WIRES.map((w) => (
        <Wire key={w.id} wire={w} />
      ))}

      {/* Service switch on the side of the cabinet */}
      <mesh position={SWITCH_BOX as unknown as THREE.Vector3Tuple} castShadow {...solid}>
        <boxGeometry args={[0.065, 0.14, 0.08]} />
        <Sheet color={GALV} />
      </mesh>
      <mesh
        position={[SWITCH_BOX[0], SWITCH_BOX[1], 0.09]}
        rotation={[powerOn ? -0.5 : 0.5, 0, 0]}
        {...click(powerOn ? 'Furnace service switch (ON)' : 'Furnace service switch (OFF)', 'serviceSwitch')}
      >
        <boxGeometry args={[0.014, 0.034, 0.022]} />
        <meshStandardMaterial color={powerOn ? '#f4f1e8' : '#c0271d'} roughness={0.5} />
      </mesh>

      {ids.map((id) => (
        <TestPoint key={id} id={id} />
      ))}

      {/* Lift-off doors */}
      <Movable
        fitted={fdoors.burner}
        home={[0, upperY, F_HALF_D + 0.007]}
        away={[0.95, 0.012, 0.95]}
        awayRotation={[-Math.PI / 2, 0, 0.25]}
      >
        <mesh castShadow {...click('Burner compartment door', 'burnerDoor')}>
          <boxGeometry args={[F_HALF_W * 2, upperH, 0.012]} />
          <Sheet color={DOOR} />
        </mesh>
        {[-0.14, -0.17, -0.2].map((y) => (
          <mesh key={y} position={[0, y, 0.0065]}>
            <boxGeometry args={[0.34, 0.012, 0.002]} />
            <meshStandardMaterial color="#2b2d30" roughness={0.8} />
          </mesh>
        ))}
        <mesh position={[0, 0.1, 0.0066]}>
          <planeGeometry args={[0.3, 0.197]} />
          <meshStandardMaterial map={label} roughness={0.6} />
        </mesh>
      </Movable>
      <Movable
        fitted={fdoors.blower}
        home={[0, F_DECK_Y / 2, F_HALF_D + 0.007]}
        away={[0.85, 0.02, 1.6]}
        awayRotation={[-Math.PI / 2, 0, -0.1]}
      >
        <mesh castShadow {...click('Blower compartment door', 'blowerDoor')}>
          <boxGeometry args={[F_HALF_W * 2, F_DECK_Y, 0.012]} />
          <Sheet color={DOOR} />
        </mesh>
        <mesh position={[-0.02, 0.16, 0.0066]}>
          <circleGeometry args={[0.014, 16]} />
          <meshStandardMaterial color="#1a1c1f" roughness={0.3} />
        </mesh>
      </Movable>
    </group>
  );
}
