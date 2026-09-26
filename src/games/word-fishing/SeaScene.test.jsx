import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { RIG_DX, RIG_Y } from './rig.js';
import { TICK_MS } from './sea.js';
import { LINE_BOW, lineEnds } from './SeaScene.jsx';

// The stylesheet is the other half of the scene's timing, so the tests that are
// about the clock read it straight from style.css instead of trusting a copy.
// Comments go first, so a rule that is commented out can never satisfy a test.
// Tests run from the project root, which is how the rest of the suite resolves too.
const STYLESHEET = readFileSync(resolve(process.cwd(), 'src/games/word-fishing/style.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// The declarations of one rule, collapsed to a single line so a timing assertion
// reads the rule it is about rather than the whole stylesheet.
function declarations(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rule = STYLESHEET.match(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`));
  expect(rule, `style.css has no ${selector} rule`).toBeTruthy();
  return rule[1].replace(/\s+/g, ' ');
}

function zIndexOf(selector) {
  return Number(declarations(selector).match(/z-index:\s*(\d+)/)[1]);
}

describe('word-fishing the rod and the line', () => {
  it('hangs the line off the boat, from the rod tip to the float', () => {
    const boat = { x: 30, targetX: 30 };
    // Both ends are percentages of the line's own layer, which is anchored at the
    // boat's left edge - the rod tip is a fixed offset from it, and the far end is
    // whatever the line is tied to, measured back from the same edge.
    expect(lineEnds(boat, null)).toEqual({
      tip: { x: RIG_DX.rodTip, y: RIG_Y.rodTip },
      end: null,
    });

    expect(lineEnds(boat, { x: 58, y: 46 })).toEqual({
      tip: { x: RIG_DX.rodTip, y: RIG_Y.rodTip },
      end: { x: 28, y: 46 },
    });
  });

  it('bows the line below its own ends, so a long drop sags more than a short one', () => {
    // 0.5 would run the curve straight between the rod tip and the float.
    expect(LINE_BOW).toBeGreaterThan(0.5);
    expect(LINE_BOW).toBeLessThan(1);
  });

  // The whole reason the line lives in its own frame: the float glides between
  // ticks, so a line that is simply re-drawn at each tick comes loose from the
  // float it is tied to for most of every tick. The far end rides the float, and
  // the fish during a fight, so all of them have to keep the one step.
  it('glides the line, the float and the fish on the very same clock', () => {
    expect(TICK_MS).toBe(120);
    const float = declarations('.fishing-float');
    expect(float).toMatch(new RegExp(`transition:[^;]*left ${TICK_MS}ms linear`));
    expect(float).toMatch(new RegExp(`transition:[^;]*top ${TICK_MS}ms linear`));
    const fish = declarations('.fish');
    expect(fish).toMatch(new RegExp(`transition:[^;]*left ${TICK_MS}ms linear`));
    expect(fish).toMatch(new RegExp(`transition:[^;]*top ${TICK_MS}ms linear`));
    expect(declarations('.fishing-line-frame')).toMatch(new RegExp(`transition: transform ${TICK_MS}ms linear`));
  });

  it('draws the line behind the float, so it is tied into it rather than across it', () => {
    const layer = zIndexOf('.line-layer');
    // Over the boat and the fish it is drawn from and to...
    expect(layer).toBeGreaterThan(zIndexOf('.fish'));
    // ...and under the float, whose body covers the last of the line.
    expect(layer).toBeLessThan(zIndexOf('.fishing-float'));
  });
});
