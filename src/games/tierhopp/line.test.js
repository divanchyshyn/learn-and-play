import { describe, it, expect } from 'vitest';
import { LANDING_TOLERANCE, LINE_MAX, LINE_MIN, clampToLine, needsAdjust, tapToValue } from './line.js';

describe('tierhopp number line helpers', () => {
  it('clamps anything a player can produce back onto the line', () => {
    expect(clampToLine(-20)).toBe(LINE_MIN);
    expect(clampToLine(42)).toBe(42);
    expect(clampToLine(999)).toBe(LINE_MAX);
  });

  it('maps a tap position onto the nearest line value', () => {
    const width = 1000;
    expect(tapToValue(500, width)).toBe(50);
    expect(tapToValue(203, width)).toBe(20); // rounds to the closest unit
    expect(tapToValue(999, width)).toBe(100);
    expect(tapToValue(0, width)).toBe(0);
  });

  it('taps outside the strip stick to the ends of the line', () => {
    const width = 800;
    expect(tapToValue(-120, width)).toBe(LINE_MIN);
    expect(tapToValue(width + 300, width)).toBe(LINE_MAX);
  });

  it('falls back to the middle of the line when width is unknown', () => {
    expect(tapToValue(123, 0)).toBe(50);
    expect(tapToValue(123, undefined)).toBe(50);
  });

  it('treats near-enough landings as landed', () => {
    const answer = 47;
    expect(needsAdjust(answer, answer)).toBe(false);
    expect(needsAdjust(answer - LANDING_TOLERANCE, answer)).toBe(false);
    expect(needsAdjust(answer + LANDING_TOLERANCE, answer)).toBe(false);
    expect(needsAdjust(answer - LANDING_TOLERANCE - 1, answer)).toBe(true);
    expect(needsAdjust(answer + LANDING_TOLERANCE + 1, answer)).toBe(true);
  });
});
