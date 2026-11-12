import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { type ComponentRef, type ReactNode, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { create } from 'zustand';
import { useSim } from '../store/useSim';
import { Condenser } from './Condenser';
import { AirHandler } from './AirHandler';
import { Disconnect } from './Disconnect';
import { Furnace } from './Furnace';
import { airHandlerPosition, HOME_VIEW, type View } from './layout';
import { named, Tube } from './parts';

/** Camera preset requests from the HUD. `n` makes repeat requests distinct. */
export const useView = create<{ view: View; n: number; go: (view: View) => void }>()((set) => ({
  view: HOME_VIEW,
  n: 0,
  go: (view) => set((s) => ({ view, n: s.n + 1 })),
}));

function Controls(): ReactNode {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree((s) => s.camera);
  const request = useView((s) => s.n);
  const flight = useRef<{ t: number; fromPos: THREE.Vector3; fromTarget: THREE.Vector3; to: View } | null>(null);

  useEffect(() => {
    if (!controls.current || request === 0) return;
    flight.current = {
      t: 0,
      fromPos: camera.position.clone(),
      fromTarget: controls.current.target.clone(),
      to: useView.getState().view,
    };
  }, [request, camera]);

  useFrame((_, delta) => {
    const f = flight.current;
    const c = controls.current;
    if (!f || !c) return;
    f.t = Math.min(1, f.t + delta / 0.7);
    const k = f.t * f.t * (3 - 2 * f.t);
    camera.position.lerpVectors(f.fromPos, new THREE.Vector3(...f.to.camera), k);
    c.target.lerpVectors(f.fromTarget, new THREE.Vector3(...f.to.target), k);
    c.update();
    if (f.t >= 1) flight.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={HOME_VIEW.target as unknown as THREE.Vector3Tuple}
      enableDamping
      dampingFactor={0.12}
      minDistance={0.25}
      maxDistance={6}
      maxPolarAngle={Math.PI / 2 - 0.03}
      zoomSpeed={0.9}
    />
  );
}

function Outdoors(): ReactNode {
  const context = useSim((s) => s.context);
  const dimensions = context?.dimensionsM;
  const scale: [number, number, number] = dimensions ? [dimensions.width / 0.86, dimensions.height / 0.85, dimensions.depth / 0.86] : [1, 1, 1];
  const indoor = context?.systemType === 'heat_pump' ? airHandlerPosition(context) : null;
  const [sx, sy, sz] = scale;
  return (
    <>
      <color attach="background" args={['#b9d0e2']} />
      <fog attach="fog" args={['#b9d0e2', 9, 22]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[14, 48]} />
        <meshStandardMaterial color="#5f7d4c" roughness={1} />
      </mesh>
      <mesh position={[0.2, 0.006, 0.1]} receiveShadow>
        <cylinderGeometry args={[1.9, 1.9, 0.012, 48]} />
        <meshStandardMaterial color="#a39f93" roughness={1} />
      </mesh>
      <pointLight position={[0.3, 0.6, 0.9]} intensity={0.6} distance={1.6} />
      <pointLight position={[-0.1, 1.5, 0]} intensity={0.8} distance={2} />
      <group scale={scale}><Condenser /><Disconnect /></group>
      <AirHandler />
      {indoor && <>
        <Tube points={[[.8 * sx, .32 * sy, -.7 * sz], [.8 * sx, .32 * sy, -.95 * sz],
          [indoor[0] + .36, .40, indoor[2] + .23], [indoor[0] + .26, .43, indoor[2] + .12]]}
          radius={.021} color="#141414" roughness={.95} handlers={named('Insulated vapor refrigerant line through the wall to the indoor coil')} />
        <Tube points={[[.76 * sx, .2 * sy, -.7 * sz], [.76 * sx, .2 * sy, -.95 * sz],
          [indoor[0] + .36, .25, indoor[2] + .10], [indoor[0] + .26, .28, indoor[2] - .02]]}
          radius={.008} color="#b87333" metalness={.8} handlers={named('Liquid refrigerant line through the wall to the indoor TXV')} />
        <Tube points={[[.437 * sx, .5 * sy, .34 * sz], [.62 * sx, .45 * sy, .24 * sz], [.94 * sx, .44 * sy, -.7 * sz],
          [.94 * sx, .44 * sy, -.95 * sz], [indoor[0] + .31, .74, indoor[2] + .12], [indoor[0] + .26, .74, indoor[2]]]}
          radius={.005} color="#66503c" handlers={named('24 V control cable linking the outdoor board and indoor air handler')} />
      </>}
    </>
  );
}

function Basement(): ReactNode {
  return (
    <>
      <color attach="background" args={['#3b3f45']} />
      <fog attach="fog" args={['#3b3f45', 7, 16]} />
      {/* Work light so both compartments stay readable */}
      <pointLight position={[0.1, 0.75, 1.0]} intensity={1.1} distance={2.2} />
      <pointLight position={[0.1, 0.3, 0.9]} intensity={0.7} distance={1.6} />
      <Furnace />
    </>
  );
}

export function Scene(): ReactNode {
  const unitType = useSim((s) => s.unitType);
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: HOME_VIEW.camera as unknown as THREE.Vector3Tuple, fov: 42, near: 0.02, far: 60 }}
    >
      <hemisphereLight args={['#ffffff', '#6b7a55', 0.9]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[3.5, 6, 4.5]}
        intensity={unitType === 'furnace' ? 1.3 : 2.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
        shadow-bias={-0.0004}
      />
      {unitType === 'furnace' ? <Basement /> : <Outdoors />}
      <Controls />
    </Canvas>
  );
}
