import { describe, it, expect, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { isDragStart, useTileDrag } from './drag.js';

describe('drag gesture slop', () => {
  it('keeps mouse and pen taps well below the drag threshold', () => {
    expect(isDragStart(10, 10, 10, 10, 'mouse')).toBe(false);
    expect(isDragStart(0, 0, 4, 4, 'pen')).toBe(false); // ~5.7 < 6
    expect(isDragStart(0, 0, 7, 0, 'mouse')).toBe(true); // 7 > 6
  });

  it('gives touch a wider slop so wobbling fingers do not move pieces', () => {
    expect(isDragStart(0, 0, 12, 12, 'touch')).toBe(false); // ~17 < 18
    expect(isDragStart(0, 0, 13, 13, 'touch')).toBe(true); // ~18.4 > 18
    expect(isDragStart(0, 0, 7, 0, 'touch')).toBe(false); // 7 < 18
  });
});

// Both puzzles hang their window listeners on this hook, so what it does while a
// tile is in the air - and what it does when the gesture ends, however it ends -
// is worth pinning on its own rather than twice through two panels.
describe('drag gesture listeners', () => {
  function Dragging({ active, onMove, onRelease, onCancel }) {
    useTileDrag({ active, onMove, onRelease, onCancel });
    return null;
  }

  function pointer(type, x = 0, y = 0) {
    act(() => {
      window.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }));
    });
  }

  it('listens only while a tile is in the air', () => {
    const onMove = vi.fn();
    const onRelease = vi.fn();
    const view = render(<Dragging active={null} onMove={onMove} onRelease={onRelease} onCancel={() => {}} />);

    pointer('pointermove', 40, 40);
    pointer('pointerup', 40, 40);
    expect(onMove).not.toHaveBeenCalled();
    expect(onRelease).not.toHaveBeenCalled();

    view.rerender(<Dragging active={{ piece: 0 }} onMove={onMove} onRelease={onRelease} onCancel={() => {}} />);
    pointer('pointermove', 40, 40);
    pointer('pointerup', 40, 40);
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onRelease).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('stops listening once the drag is over', () => {
    const onMove = vi.fn();
    const view = render(<Dragging active={{ piece: 0 }} onMove={onMove} onRelease={() => {}} onCancel={() => {}} />);

    view.rerender(<Dragging active={null} onMove={onMove} onRelease={() => {}} onCancel={() => {}} />);
    pointer('pointermove', 90, 90);
    expect(onMove).not.toHaveBeenCalled();
    cleanup();
  });

  // The gesture a mobile browser claims ends with pointercancel instead of
  // pointerup: nothing is dropped, and nothing keeps listening either.
  it('ends on pointercancel without dropping anything', () => {
    const onRelease = vi.fn();
    const onCancel = vi.fn();
    const onMove = vi.fn();
    render(<Dragging active={{ piece: 0 }} onMove={onMove} onRelease={onRelease} onCancel={onCancel} />);

    pointer('pointermove', 60, 60);
    pointer('pointercancel', 60, 60);

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onRelease).not.toHaveBeenCalled();
    cleanup();
  });

  it('leaves no listener behind when the panel is closed mid-drag', () => {
    const onRelease = vi.fn();
    const view = render(<Dragging active={{ piece: 0 }} onMove={() => {}} onRelease={onRelease} onCancel={() => {}} />);

    // Closing the puzzle unmounts the hook with a drag still open; a stale
    // window listener would then answer the child's next gesture.
    view.unmount();
    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup', { clientX: 10, clientY: 10, bubbles: true }));
    });
    expect(onRelease).not.toHaveBeenCalled();
  });
});
