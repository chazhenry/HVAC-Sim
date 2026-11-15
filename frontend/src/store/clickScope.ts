/**
 * While a click on a 3D object is being handled, messages it produces belong to that click: the toast
 * shows them at once, centred on the click point, instead of queueing behind other messages.
 */
export interface ClickScope { key: number; x: number; y: number }

let current: ClickScope | null = null;
let nextKey = 0;

export function beginClick(x: number, y: number): ClickScope {
  current = { key: ++nextKey, x, y };
  return current;
}

export function endClick(scope: ClickScope): void {
  if (current === scope) current = null;
}

export const activeClick = (): ClickScope | null => current;
