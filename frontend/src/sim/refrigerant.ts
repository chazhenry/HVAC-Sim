/** R-410A saturation table (temperature in degrees F, pressure in psig). */
const PT_R410A: ReadonlyArray<readonly [tempF: number, psig: number]> = [
  [-40, 10.8],
  [-20, 26.3],
  [0, 48.3],
  [10, 62.3],
  [20, 78.4],
  [30, 96.8],
  [40, 118.2],
  [50, 142.2],
  [60, 169.6],
  [70, 200.6],
  [80, 235.2],
  [90, 273.9],
  [100, 317.1],
  [110, 364.9],
  [120, 417.7],
  [130, 475.6],
  [140, 539.7],
  [150, 610.0],
  [160, 686.0],
  [170, 768.0],
  [190, 950.0],
];

function interpolate(x: number, xi: 0 | 1, yi: 0 | 1): number {
  const first = PT_R410A[0];
  const last = PT_R410A[PT_R410A.length - 1];
  if (first === undefined || last === undefined) return 0;
  if (x <= first[xi]) return first[yi];
  if (x >= last[xi]) return last[yi];
  for (let i = 1; i < PT_R410A.length; i++) {
    const lo = PT_R410A[i - 1];
    const hi = PT_R410A[i];
    if (lo === undefined || hi === undefined) continue;
    if (x <= hi[xi]) {
      const f = (x - lo[xi]) / (hi[xi] - lo[xi]);
      return lo[yi] + f * (hi[yi] - lo[yi]);
    }
  }
  return last[yi];
}

/** Saturation pressure (psig) for a saturation temperature (F). */
export const satPsig = (tempF: number): number => interpolate(tempF, 0, 1);

/** Saturation temperature (F) for a pressure (psig). */
export const satTempF = (psig: number): number => interpolate(psig, 1, 0);
