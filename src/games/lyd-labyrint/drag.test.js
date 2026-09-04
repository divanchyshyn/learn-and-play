import { describe, it, expect } from 'vitest';
import { DRAG_SLOP_POINTER, DRAG_SLOP_TOUCH, isDragStart } from './drag.js';

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

  it('exposes the two slop constants used by both puzzles', () => {
    expect(DRAG_SLOP_POINTER).toBe(6);
    expect(DRAG_SLOP_TOUCH).toBe(18);
  });
});