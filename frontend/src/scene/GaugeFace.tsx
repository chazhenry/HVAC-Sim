import { type ReactNode, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { inchesHg } from '../sim/service';

const SIZE = 256;
/** The needle sweeps 270°, from bottom-left (0) clockwise to bottom-right (max), like a real manifold gauge. */
const START = (135 * Math.PI) / 180;
const SWEEP = (270 * Math.PI) / 180;

function draw(ctx: CanvasRenderingContext2D, psig: number | null, max: number, color: string, side: string): void {
  const c = SIZE / 2;
  ctx.clearRect(0, 0, SIZE, SIZE);
  // Face and coloured bezel.
  ctx.beginPath(); ctx.arc(c, c, c - 2, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  ctx.beginPath(); ctx.arc(c, c, c - 14, 0, Math.PI * 2); ctx.fillStyle = '#f4f2ea'; ctx.fill();
  // Scale: ticks every 10 % with labels at 0, half and max.
  ctx.strokeStyle = '#222'; ctx.fillStyle = '#222'; ctx.lineCap = 'round';
  for (let i = 0; i <= 10; i++) {
    const a = START + (SWEEP * i) / 10;
    const outer = c - 20;
    const inner = outer - (i % 5 === 0 ? 16 : 9);
    ctx.lineWidth = i % 5 === 0 ? 4 : 2;
    ctx.beginPath(); ctx.moveTo(c + Math.cos(a) * inner, c + Math.sin(a) * inner); ctx.lineTo(c + Math.cos(a) * outer, c + Math.sin(a) * outer); ctx.stroke();
  }
  ctx.font = '600 17px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const [i, text] of [[0, '0'], [5, String(max / 2)], [10, String(max)]] as const) {
    const a = START + (SWEEP * i) / 10;
    ctx.fillText(text, c + Math.cos(a) * (c - 54), c + Math.sin(a) * (c - 54));
  }
  ctx.font = '700 15px system-ui, sans-serif'; ctx.fillStyle = color;
  ctx.fillText(side, c, c - 42);
  // Digital readout, so the value can be read at any zoom.
  const vacuum = psig !== null && psig < -0.05;
  const value = psig === null ? '—' : vacuum ? inchesHg(psig).toFixed(1) : psig.toFixed(0);
  ctx.fillStyle = '#111'; ctx.font = '800 44px system-ui, sans-serif';
  ctx.fillText(value, c, c + 46);
  ctx.font = '600 15px system-ui, sans-serif'; ctx.fillStyle = '#444';
  ctx.fillText(psig === null ? 'not connected' : vacuum ? 'in. Hg vac' : 'psig', c, c + 76);
  // Needle (resting on 0 when disconnected or in vacuum).
  const frac = psig === null ? 0 : Math.min(1, Math.max(0, psig / max));
  const a = START + SWEEP * frac;
  ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(c - Math.cos(a) * 14, c - Math.sin(a) * 14); ctx.lineTo(c + Math.cos(a) * (c - 30), c + Math.sin(a) * (c - 30)); ctx.stroke();
  ctx.beginPath(); ctx.arc(c, c, 9, 0, Math.PI * 2); ctx.fillStyle = '#222'; ctx.fill();
}

/**
 * Live dial face for a manifold gauge: needle plus large digital psig (or in. Hg vacuum) readout.
 * Faces +Z; redrawn only when the rounded reading changes.
 */
export function GaugeFace({ psig, max, color, side, radius, position }: {
  psig: number | null; max: number; color: string; side: string; radius: number; position: readonly [number, number, number];
}): ReactNode {
  const canvas = useMemo(() => {
    const element = document.createElement('canvas');
    element.width = SIZE; element.height = SIZE;
    return element;
  }, []);
  const texture = useMemo(() => {
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    return map;
  }, [canvas]);
  useEffect(() => () => texture.dispose(), [texture]);
  useEffect(() => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    draw(ctx, psig, max, color, side);
    texture.needsUpdate = true;
  }, [canvas, texture, psig, max, color, side]);
  return (
    <mesh position={[...position]}>
      <circleGeometry args={[radius, 48]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}
