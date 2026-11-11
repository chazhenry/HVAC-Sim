import { Html } from '@react-three/drei';
import { type ThreeEvent, useFrame } from '@react-three/fiber';
import { type CSSProperties, type ReactNode, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { type AnyTestPointId, clampLabel, isFurnacePoint, pointInfo } from '../sim/points';
import { activeHot, useSim } from '../store/useSim';
import { F_TEST_POINT_PLACEMENT } from './furnaceLayout';
import { TEST_POINT_PLACEMENT, type TestPointPlacement, type Vec3, type WireDef } from './layout';

const placementOf = (id: AnyTestPointId): TestPointPlacement =>
  isFurnacePoint(id) ? F_TEST_POINT_PLACEMENT[id] : TEST_POINT_PLACEMENT[id];

type PointerHandlers = {
  onClick: (e: ThreeEvent<MouseEvent>) => void;
  onPointerOver: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut: (e: ThreeEvent<PointerEvent>) => void;
};

/**
 * Pointer handlers for a clickable object: shows a hover label, swallows the
 * event so things behind it are not hit, and ignores the click that ends an
 * orbit drag.
 */
export function interactive(label: string, onActivate: () => void): PointerHandlers {
  return {
    onClick: (e) => {
      e.stopPropagation();
      if (e.delta > 6) return;
      onActivate();
    },
    onPointerOver: (e) => {
      e.stopPropagation();
      useSim.getState().setHover(label);
    },
    onPointerOut: () => {
      useSim.getState().setHover(null);
    },
  };
}

/** Blocks clicks from reaching whatever is behind a solid piece of sheet metal. */
export const solid = {
  onClick: (e: ThreeEvent<MouseEvent>) => e.stopPropagation(),
  onPointerOver: (e: ThreeEvent<PointerEvent>) => e.stopPropagation(),
};

export function makeTextTexture(
  lines: readonly string[],
  opts: { width?: number; height?: number; bg?: string; fg?: string; size?: number } = {},
): THREE.CanvasTexture {
  const { width = 512, height = 512, bg = '#d8d8d2', fg = '#1a1a1a', size = 30 } = opts;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, width - 16, height - 16);
    ctx.fillStyle = fg;
    ctx.textBaseline = 'top';
    lines.forEach((line, i) => {
      ctx.font = `${i === 0 ? 'bold ' : ''}${i === 0 ? size * 1.25 : size}px Arial, sans-serif`;
      ctx.fillText(line, 26, 26 + i * size * 1.45);
    });
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Fine vertical fins for the condenser coil. */
export function makeFinTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#7d858a';
    for (let x = 0; x < 64; x += 8) ctx.fillRect(x, 0, 3, 64);
    ctx.fillStyle = 'rgba(120,80,40,0.35)';
    for (let y = 14; y < 64; y += 32) ctx.fillRect(0, y, 64, 5);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A group that glides between its fitted and removed positions. */
export function Movable(props: {
  fitted: boolean;
  home: Vec3;
  away: Vec3;
  awayRotation?: Vec3;
  children: ReactNode;
}): ReactNode {
  const { fitted, home, away, awayRotation = [0, 0, 0], children } = props;
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    const pos = fitted ? home : away;
    const rot = fitted ? ([0, 0, 0] as const) : awayRotation;
    const k = 7;
    g.position.x = THREE.MathUtils.damp(g.position.x, pos[0], k, delta);
    g.position.y = THREE.MathUtils.damp(g.position.y, pos[1], k, delta);
    g.position.z = THREE.MathUtils.damp(g.position.z, pos[2], k, delta);
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, rot[0], k, delta);
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, rot[1], k, delta);
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, rot[2], k, delta);
  });
  return (
    <group ref={ref} position={home as unknown as THREE.Vector3Tuple}>
      {children}
    </group>
  );
}

/** A wall of horizontal louvers, centred on the origin, facing +z. */
export function LouverWall(props: { width: number; height: number; color: string }): ReactNode {
  const { width, height, color } = props;
  const slats = useMemo(() => {
    const count = Math.floor(height / 0.052);
    return Array.from({ length: count }, (_, i) => -height / 2 + 0.03 + i * ((height - 0.06) / (count - 1)));
  }, [height]);
  return (
    <group>
      {slats.map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[0.55, 0, 0]} castShadow>
          <boxGeometry args={[width, 0.03, 0.004]} />
          <meshStandardMaterial color={color} metalness={0.35} roughness={0.55} />
        </mesh>
      ))}
      {[-width / 2 + 0.012, 0, width / 2 - 0.012].map((x) => (
        <mesh key={x} position={[x, 0, -0.004]}>
          <boxGeometry args={[0.024, height, 0.008]} />
          <meshStandardMaterial color={color} metalness={0.35} roughness={0.55} />
        </mesh>
      ))}
    </group>
  );
}

export function Tube(props: {
  points: readonly Vec3[];
  radius: number;
  color: string;
  metalness?: number;
  roughness?: number;
  emissive?: string;
  /** Extra radius of an invisible sleeve that makes a thin run easier to click. */
  hitPadding?: number;
  handlers?: PointerHandlers;
}): ReactNode {
  const { points, radius, color, metalness = 0.1, roughness = 0.6, emissive = '#000000', hitPadding = 0, handlers } = props;
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(
      points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
      false,
      'catmullrom',
      0.35,
    );
    return {
      visible: new THREE.TubeGeometry(curve, points.length * 10, radius, 8, false),
      hit: hitPadding > 0 ? new THREE.TubeGeometry(curve, points.length * 6, radius + hitPadding, 6, false) : null,
    };
  }, [points, radius, hitPadding]);
  return (
    <>
      <mesh geometry={geometry.visible} castShadow {...handlers}>
        <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} emissive={emissive} />
      </mesh>
      {geometry.hit && handlers && (
        <mesh geometry={geometry.hit} {...handlers}>
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </>
  );
}

/** A control-box wire. With the clamp meter selected it can be clamped. */
export function Wire({ wire }: { wire: WireDef }): ReactNode {
  const clampTool = useSim((s) => s.tool === 'clamp');
  const clamped = useSim((s) => wire.clamp !== undefined && s.clampAt === wire.clamp);
  const { clamp } = wire;
  const handlers =
    clamp === undefined
      ? undefined
      : interactive(`Wire: ${clampLabel(clamp)}`, () => useSim.getState().clampWire(clamp));
  const mid = wire.points[Math.floor(wire.points.length / 2)] ?? [0, 0, 0];
  return (
    <group>
      <Tube
        points={wire.points}
        radius={wire.radius}
        color={wire.color}
        emissive={clampTool && clamp !== undefined ? '#3a2a00' : '#000000'}
        hitPadding={clampTool ? 0.006 : 0}
        {...(handlers ? { handlers } : {})}
      />
      {clamped && (
        <mesh position={mid as unknown as THREE.Vector3Tuple} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.016, 0.005, 10, 24]} />
          <meshStandardMaterial color="#f5a623" emissive="#7a4a00" />
        </mesh>
      )}
    </group>
  );
}

const LABEL_STYLE: CSSProperties = {
  pointerEvents: 'none',
  font: '600 10px/1 system-ui, sans-serif',
  color: '#fff',
  background: 'rgba(12,16,22,0.78)',
  padding: '2px 4px',
  borderRadius: 3,
  whiteSpace: 'nowrap',
  transform: 'translateY(-14px)',
};

/** A probe-able terminal. Only rendered while its enclosure is open. */
export function TestPoint({ id }: { id: AnyTestPointId }): ReactNode {
  const def = pointInfo(id);
  const { pos, normal } = placementOf(id);
  const open = useSim((s) => s.isAccessible(def.enclosure));
  const probing = useSim((s) => s.tool === 'multimeter' || s.tool === 'ncv');
  const lead = useSim((s) => (s.leads.red === id ? 'red' : s.leads.black === id ? 'black' : null));
  const ncvHere = useSim((s) => s.ncvAt === id);
  const hot = useSim((s) => s.ncvAt === id && activeHot(s, id));
  // Hooks above must run unconditionally; bail out afterwards.
  if (!open) return null;

  const rotation: THREE.EulerTuple = normal === 'front' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
  const out = (d: number): THREE.Vector3Tuple => (normal === 'front' ? [0, 0, d] : [0, d, 0]);
  return (
    <group position={pos as unknown as THREE.Vector3Tuple}>
      <mesh>
        <sphereGeometry args={[0.0075, 14, 14]} />
        <meshStandardMaterial
          color={probing ? '#ffd35a' : '#b9a36a'}
          emissive={probing ? '#7a5a00' : '#000000'}
          metalness={0.8}
          roughness={0.3}
        />
      </mesh>
      {/* Generous invisible hit target */}
      <mesh {...interactive(def.label, () => useSim.getState().probe(id))}>
        <sphereGeometry args={[0.015, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {lead && (
        <group rotation={rotation}>
          <mesh position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.0018, 0.0012, 0.06, 8]} />
            <meshStandardMaterial color="#cfd3d6" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.095, 0]}>
            <cylinderGeometry args={[0.006, 0.005, 0.075, 10]} />
            <meshStandardMaterial color={lead === 'red' ? '#d32f2f' : '#111111'} roughness={0.5} />
          </mesh>
        </group>
      )}
      {ncvHere && (
        <group position={out(0.012)} rotation={rotation}>
          <mesh position={[0, 0.045, 0]}>
            <cylinderGeometry args={[0.007, 0.004, 0.09, 10]} />
            <meshStandardMaterial
              color={hot ? '#ff2d2d' : '#f2c200'}
              emissive={hot ? '#ff0000' : '#000000'}
              emissiveIntensity={hot ? 1.5 : 0}
            />
          </mesh>
        </group>
      )}
      {/* Sit the label just outside the hit sphere and the probe so walls in front can hide it. */}
      {(probing || lead) && (
        <Html center position={normal === 'front' ? [0.012, 0, 0.02] : [0.012, 0.02, 0]} style={LABEL_STYLE} zIndexRange={[5, 0]} occlude>
          {def.short}
        </Html>
      )}
    </group>
  );
}
