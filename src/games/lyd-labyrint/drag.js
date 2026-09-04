// Gesture slop per pointer kind, shared by the picture puzzle and the spelling
// lock. A finger wobbles far more than a mouse click, so touches get a wider
// tolerance before they count as a drag: otherwise a slightly sloppy tap can
// nudge a piece or a letter into a neighbouring position, which a stationary
// mouse click never does. Both puzzles keep the same feel.
export const DRAG_SLOP_POINTER = 6;
export const DRAG_SLOP_TOUCH = 18;

export function isDragStart(startX, startY, x, y, pointerType) {
  const slop = pointerType === 'touch' ? DRAG_SLOP_TOUCH : DRAG_SLOP_POINTER;
  return Math.hypot(x - startX, y - startY) > slop;
}