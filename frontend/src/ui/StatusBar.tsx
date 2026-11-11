import type { ReactNode } from 'react';
import { useSim } from '../store/useSim';
import { observationRows } from './observations';

/** "What you see and hear", as a strip along the bottom of the 3D view. */
export function StatusBar(): ReactNode {
  // A string selector re-renders only when one of the values actually changes.
  const packed = useSim((s) => observationRows(s).map(([k, v]) => `${k}\t${v}`).join('\n'));
  const rows = packed ? packed.split('\n').map((line) => line.split('\t')) : [];
  return (
    <dl className="statusbar" aria-label="What you see and hear">
      <span className="statusbar-title">What you see and hear</span>
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
