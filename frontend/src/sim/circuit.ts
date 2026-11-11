/**
 * Small complex-valued nodal-analysis solver.
 *
 * The condenser's wiring is described as branches (admittances) between named
 * nodes. Some nodes are held at a known potential (the line, ground, the 24 V
 * source); the solver finds every other node. Because the whole network is
 * solved, effects like back-feed through a motor winding onto a dead leg fall
 * out naturally instead of being special-cased.
 */

export interface Complex {
  readonly re: number;
  readonly im: number;
}

export const cx = (re: number, im = 0): Complex => ({ re, im });
export const ZERO: Complex = cx(0);

export const cadd = (a: Complex, b: Complex): Complex => cx(a.re + b.re, a.im + b.im);
export const csub = (a: Complex, b: Complex): Complex => cx(a.re - b.re, a.im - b.im);
export const cmul = (a: Complex, b: Complex): Complex =>
  cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
export const cdiv = (a: Complex, b: Complex): Complex => {
  const d = b.re * b.re + b.im * b.im;
  return cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
};
export const cabs = (a: Complex): number => Math.hypot(a.re, a.im);
export const cinv = (a: Complex): Complex => cdiv(cx(1), a);

export interface Branch<N extends string> {
  a: N;
  b: N;
  /** Admittance in siemens. */
  y: Complex;
}

export interface NetworkInput<N extends string> {
  nodes: readonly N[];
  /** Nodes held at a known potential. */
  fixed: Partial<Record<N, Complex>>;
  branches: readonly Branch<N>[];
  /** Current injected into a node (used for the ohmmeter). */
  inject?: Partial<Record<N, Complex>>;
  /** Leakage from every free node to the reference, keeps floating nets solvable. */
  gmin?: number;
}

export function solveNetwork<N extends string>(input: NetworkInput<N>): Record<N, Complex> {
  const { nodes, fixed, branches, gmin = 1e-9 } = input;
  const inject: Partial<Record<N, Complex>> = input.inject ?? {};

  const index = new Map<N, number>();
  for (const n of nodes) if (fixed[n] === undefined) index.set(n, index.size);
  const size = index.size;

  // Dense matrix stored row-major as separate real / imaginary parts.
  const ar = new Float64Array(size * size);
  const ai = new Float64Array(size * size);
  const br = new Float64Array(size);
  const bi = new Float64Array(size);

  for (const [, i] of index) ar[i * size + i] = gmin;
  for (const n of nodes) {
    const i = index.get(n);
    const cur = inject[n];
    if (i !== undefined && cur !== undefined) {
      br[i] = (br[i] ?? 0) + cur.re;
      bi[i] = (bi[i] ?? 0) + cur.im;
    }
  }

  const stamp = (from: N, to: N, y: Complex): void => {
    const i = index.get(from);
    if (i === undefined) return;
    ar[i * size + i] = (ar[i * size + i] ?? 0) + y.re;
    ai[i * size + i] = (ai[i * size + i] ?? 0) + y.im;
    const j = index.get(to);
    if (j !== undefined) {
      ar[i * size + j] = (ar[i * size + j] ?? 0) - y.re;
      ai[i * size + j] = (ai[i * size + j] ?? 0) - y.im;
    } else {
      const v = fixed[to] ?? ZERO;
      const c = cmul(y, v);
      br[i] = (br[i] ?? 0) + c.re;
      bi[i] = (bi[i] ?? 0) + c.im;
    }
  };

  for (const b of branches) {
    if (b.a === b.b) continue;
    stamp(b.a, b.b, b.y);
    stamp(b.b, b.a, b.y);
  }

  // Gaussian elimination with partial pivoting.
  const at = (r: number, c: number): Complex => cx(ar[r * size + c] ?? 0, ai[r * size + c] ?? 0);
  const set = (r: number, c: number, v: Complex): void => {
    ar[r * size + c] = v.re;
    ai[r * size + c] = v.im;
  };
  for (let col = 0; col < size; col++) {
    let pivot = col;
    let best = cabs(at(col, col));
    for (let r = col + 1; r < size; r++) {
      const mag = cabs(at(r, col));
      if (mag > best) {
        best = mag;
        pivot = r;
      }
    }
    if (pivot !== col) {
      for (let c = 0; c < size; c++) {
        const tmp = at(col, c);
        set(col, c, at(pivot, c));
        set(pivot, c, tmp);
      }
      const tr = br[col] ?? 0;
      const ti = bi[col] ?? 0;
      br[col] = br[pivot] ?? 0;
      bi[col] = bi[pivot] ?? 0;
      br[pivot] = tr;
      bi[pivot] = ti;
    }
    const p = at(col, col);
    for (let r = col + 1; r < size; r++) {
      const f = cdiv(at(r, col), p);
      if (f.re === 0 && f.im === 0) continue;
      for (let c = col; c < size; c++) set(r, c, csub(at(r, c), cmul(f, at(col, c))));
      const rhs = csub(cx(br[r] ?? 0, bi[r] ?? 0), cmul(f, cx(br[col] ?? 0, bi[col] ?? 0)));
      br[r] = rhs.re;
      bi[r] = rhs.im;
    }
  }
  const x: Complex[] = new Array<Complex>(size).fill(ZERO);
  for (let r = size - 1; r >= 0; r--) {
    let acc = cx(br[r] ?? 0, bi[r] ?? 0);
    for (let c = r + 1; c < size; c++) acc = csub(acc, cmul(at(r, c), x[c] ?? ZERO));
    x[r] = cdiv(acc, at(r, r));
  }

  const out = {} as Record<N, Complex>;
  for (const n of nodes) {
    const i = index.get(n);
    out[n] = i === undefined ? (fixed[n] ?? ZERO) : (x[i] ?? ZERO);
  }
  return out;
}
