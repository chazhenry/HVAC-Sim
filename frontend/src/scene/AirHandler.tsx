import { useFrame } from '@react-three/fiber';
import { type ReactNode, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSim } from '../store/useSim';
import { makeTextTexture, named } from './parts';
import { airHandlerPosition } from './layout';

/** Companion indoor unit shown as a cutaway, separate from the outdoor cabinet. */
export function AirHandler(): ReactNode {
  const context = useSim((s) => s.context);
  const blower = useRef<THREE.Group>(null);
  const label = useMemo(() => makeTextTexture(['GOODMAN AIR HANDLER', context?.indoorModel ?? '', 'INDOOR CUTAWAY · ECM / TXV'],
    { width: 640, height: 220, size: 32 }), [context?.indoorModel]);
  useFrame((_, delta) => {
    if (blower.current && useSim.getState().sim?.heatPump?.indoorBlower) blower.current.rotation.z += delta * 12;
  });
  if (context?.systemType !== 'heat_pump') return null;
  return <group position={[...airHandlerPosition(context)]} rotation={[0, Math.PI / 3, 0]}
    {...named(`Indoor ${context.manufacturer} ${context.indoorModel} air handler · cutaway`)}>
    <mesh position={[0, -.07, 0]} rotation={[0, -Math.PI / 3, 0]} receiveShadow><boxGeometry args={[.95, .06, .9]} /><meshStandardMaterial color="#b9afa1" roughness={.95} /></mesh>
    <mesh position={[0, 0.57, -0.20]}><boxGeometry args={[0.5334, 1.143, 0.10]} /><meshStandardMaterial color="#9da3a6" metalness={0.5} /></mesh>
    {[-0.25, 0.25].map((x) => <mesh key={x} position={[x, 0.57, 0]}><boxGeometry args={[0.03, 1.143, 0.5]} /><meshStandardMaterial color="#9da3a6" metalness={0.5} /></mesh>)}
    <mesh position={[0, 1.06, 0.26]}><planeGeometry args={[0.48, 0.15]} /><meshStandardMaterial map={label} /></mesh>
    <group ref={blower} position={[0, 0.78, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.16, 0.16, 0.26, 28]} /><meshStandardMaterial color="#383e44" wireframe /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.06, 0.06, 0.28, 20]} /><meshStandardMaterial color="#aab2b8" metalness={0.7} /></mesh>
    </group>
    {[-1, 1].map((side) => <mesh key={side} position={[side * 0.1, 0.33, 0]} rotation={[0, 0, side * 0.35]}>
      <boxGeometry args={[0.05, 0.42, 0.4]} /><meshStandardMaterial color="#a6b7bf" roughness={0.6} wireframe />
    </mesh>)}
    <mesh position={[0, 0.06, 0]}><boxGeometry args={[0.5, 0.08, 0.5]} /><meshStandardMaterial color="#33373c" /></mesh>
  </group>;
}
