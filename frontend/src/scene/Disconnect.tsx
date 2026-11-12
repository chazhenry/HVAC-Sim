import { useFrame } from '@react-three/fiber';
import { type ReactNode, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { TEST_POINTS, type TestPointId } from '../sim/testPoints';
import { useSim } from '../store/useSim';
import { interactive, makeTextTexture, Movable, solid, TestPoint, Tube } from './parts';

const BOX: THREE.Vector3Tuple = [1.0, 1.15, -0.65];
const GREY = '#8d9499';

/** House wall with the fused pull-out disconnect that feeds the unit. */
export function Disconnect(): ReactNode {
  const doorOpen = useSim((s) => s.doorOpen);
  const pulledIn = useSim((s) => s.sim?.controls.disconnectIn ?? true);
  const door = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (door.current) {
      door.current.rotation.y = THREE.MathUtils.damp(door.current.rotation.y, doorOpen ? -2.1 : 0, 7, delta);
    }
  });
  const label = useMemo(
    () =>
      makeTextTexture(['A/C DISCONNECT', '60 A  240 V', 'FUSED  2 x 30 A'], {
        width: 420,
        height: 200,
        size: 34,
        bg: '#f2c200',
      }),
    [],
  );
  const ids = (Object.keys(TEST_POINTS) as TestPointId[]).filter((id) => TEST_POINTS[id].enclosure === 'disconnect');
  const [bx, by, bz] = BOX;

  const pullout = interactive(
    pulledIn ? 'Disconnect pull-out (IN - unit has power)' : 'Disconnect pull-out (OUT) with fuses',
    () => {
      const s = useSim.getState();
      if (s.tool === 'part_fuses') s.clickPart('fuses');
      else s.clickPullout();
    },
  );

  return (
    <group>
      {/* House wall */}
      <mesh position={[1.0, 0.95, -0.75]} receiveShadow castShadow {...solid}>
        <boxGeometry args={[0.55, 1.9, 0.1]} />
        <meshStandardMaterial color="#d6cdbb" roughness={0.9} />
      </mesh>

      {/* Enclosure: back and four sides */}
      <mesh position={[bx, by, bz - 0.045]} {...solid}>
        <boxGeometry args={[0.24, 0.34, 0.008]} />
        <meshStandardMaterial color={GREY} metalness={0.4} roughness={0.5} />
      </mesh>
      {(
        [
          [bx - 0.12, by, 0.008, 0.34],
          [bx + 0.12, by, 0.008, 0.34],
          [bx, by - 0.17, 0.248, 0.008],
          [bx, by + 0.17, 0.248, 0.008],
        ] as const
      ).map(([x, y, w, h]) => (
        <mesh key={`${x}${y}`} position={[x, y, bz]} castShadow>
          <boxGeometry args={[w, h, 0.1]} />
          <meshStandardMaterial color={GREY} metalness={0.4} roughness={0.5} />
        </mesh>
      ))}

      {/* Lugs */}
      {(
        [
          [0.95, 1.265],
          [1.05, 1.265],
          [0.95, 1.04],
          [1.05, 1.04],
        ] as const
      ).map(([x, y]) => (
        <mesh key={`${x}${y}`} position={[x, y, -0.664]}>
          <boxGeometry args={[0.04, 0.032, 0.055]} />
          <meshStandardMaterial color="#c9ccd0" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[1.088, 1.15, -0.668]}>
        <boxGeometry args={[0.02, 0.08, 0.05]} />
        <meshStandardMaterial color="#c8a04a" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Fused pull-out head */}
      <Movable fitted={pulledIn} home={[bx, 1.152, -0.645]} away={[bx, 1.395, -0.65]} awayRotation={[-Math.PI / 2, 0, 0]}>
        <mesh castShadow {...pullout}>
          <boxGeometry args={[0.13, 0.13, 0.05]} />
          <meshStandardMaterial color="#1d1f22" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0, 0.04]} {...pullout}>
          <boxGeometry args={[0.07, 0.02, 0.03]} />
          <meshStandardMaterial color="#e0e0e0" roughness={0.5} />
        </mesh>
        {[-0.04, 0.04].map((x) => (
          <mesh key={x} position={[x, 0, -0.03]}>
            <cylinderGeometry args={[0.011, 0.011, 0.11, 12]} />
            <meshStandardMaterial color="#b9632b" roughness={0.6} />
          </mesh>
        ))}
      </Movable>

      {/* Hinged cover */}
      <group ref={door} position={[bx - 0.124, by, bz + 0.054]}>
        <mesh position={[0.124, 0, 0]} castShadow {...interactive('Disconnect cover', () => useSim.getState().clickDoor())}>
          <boxGeometry args={[0.25, 0.35, 0.008]} />
          <meshStandardMaterial color={GREY} metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh position={[0.124, 0.06, 0.0045]}>
          <planeGeometry args={[0.18, 0.086]} />
          <meshStandardMaterial map={label} roughness={0.7} />
        </mesh>
      </group>

      {/* Keep the power whip above the refrigerant lines and service valves. */}
      <Tube
        points={[[bx, 0.98, -0.65], [1.0, 0.76, -0.5], [0.86, 0.62, 0.0], [0.62, 0.52, 0.3], [0.437, 0.46, 0.34]]}
        radius={0.014}
        color="#6c7075"
        metalness={0.5}
        roughness={0.5}
      />

      {ids.map((id) => (
        <TestPoint key={id} id={id} />
      ))}
    </group>
  );
}
