import { describe, it, expect } from 'vitest';
import { DEAD_ZONE, reelAngle } from './ActionBar.jsx';

// A spool of 100 x 100 at the origin: its centre is (50, 50), and the dead zone
// is a share of its side around that centre.
const spoolBox = { left: 0, top: 0, width: 100, height: 100 };
const centre = { x: 50, y: 50 };
const RIM = 50;

function onRim(degrees, radius = RIM) {
  const radians = (degrees * Math.PI) / 180;
  return {
    clientX: centre.x + Math.cos(radians) * radius,
    clientY: centre.y + Math.sin(radians) * radius,
  };
}

describe('word-fishing reading the reel', () => {
  it('reads a finger around the spool as an angle in degrees', () => {
    expect(reelAngle(spoolBox, onRim(0))).toBeCloseTo(0);
    expect(reelAngle(spoolBox, onRim(90))).toBeCloseTo(90);
    expect(reelAngle(spoolBox, onRim(180))).toBeCloseTo(180);
    expect(reelAngle(spoolBox, onRim(-90))).toBeCloseTo(-90);
  });

  it('ignores a finger inside the dead zone, so a move across the centre is no turn', () => {
    expect(DEAD_ZONE).toBeGreaterThan(0);
    expect(DEAD_ZONE).toBeLessThan(1);
    // Right on the centre, and just inside the zone's rim, there is no angle.
    expect(reelAngle(spoolBox, { clientX: centre.x, clientY: centre.y })).toBeNull();
    expect(reelAngle(spoolBox, onRim(0, RIM * DEAD_ZONE * 0.9))).toBeNull();
    // Out past the zone the same finger reads as usual.
    expect(reelAngle(spoolBox, onRim(0, RIM * DEAD_ZONE * 1.1))).toBeCloseTo(0);
  });
});
