import { useEffect } from 'react';

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

// The window-level half of a tile drag, shared by both puzzles. While a tile is
// in the air the pointer leaves the tile and travels over the panel, so the
// listeners have to live on the window - and they have to come off again
// whatever ends the gesture, including a mobile browser that claims it and
// fires pointercancel instead of pointerup.
//
// Each puzzle keeps what only it knows: `onMove` says how a finger's travel is
// recorded, and `onRelease` (or `onCancel`) decides what the drop means. This
// hook is only the wiring and the cleanup, so neither puzzle can be left with a
// half-finished drag by the gesture the other one already handles.
export function useTileDrag({ active, onMove, onRelease, onCancel }) {
  useEffect(() => {
    if (!active) return undefined;
    const handleMove = (event) => onMove(event);
    const handleUp = (event) => onRelease(event);
    // A gesture the browser takes over (scrolling, an overscroll edge) ends here
    // with nothing dropped, so no tile is left in a half-finished state.
    const handleCancel = () => onCancel();
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleCancel);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleCancel);
    };
    // The callbacks are rebuilt by their puzzles every render on purpose: they
    // read the freshest refs (the drag, the tray, the session), so the effect
    // re-registers with them. `active` is what opens and closes the gesture.
  }, [active, onMove, onRelease, onCancel]);
}