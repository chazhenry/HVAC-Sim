import type { ReactNode } from 'react';
import { useIdentify } from '../store/useIdentify';
import { useSim } from '../store/useSim';

/** Gap between the fingertip and the label, so the finger never hides the name. */
const ABOVE_FINGER_PX = 72;

/**
 * Press-and-hold feedback on touch screens: a ring where the finger rests (Safari cannot vibrate, so
 * this is the cue that the hold registered) and the part's name floating above the finger.
 */
export function IdentifyLabel(): ReactNode {
  const { active, x, y } = useIdentify();
  const hover = useSim((s) => s.hover);
  if (!active) return null;
  const top = Math.max(8, y - ABOVE_FINGER_PX);
  const left = Math.min(Math.max(x, 120), window.innerWidth - 120);
  return (
    <>
      <div className="identify-ring" style={{ left: x, top: y }} aria-hidden="true" />
      <div className={`identify-label${hover ? '' : ' empty'}`} style={{ left, top }} role="status">
        {hover ?? 'Slide onto a part'}
      </div>
    </>
  );
}
