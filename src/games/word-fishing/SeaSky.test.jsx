import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

// The clouds are pure CSS, so their regression test reads the stylesheet - the
// same way SeaScene.test.jsx reads the scene's clock. Comments go first, so a
// rule that is commented out can never satisfy a test. Tests run from the
// project root, which is how the rest of the suite resolves too.
const STYLESHEET = readFileSync(resolve(process.cwd(), 'src/games/word-fishing/style.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// The declarations of one rule, collapsed to a single line so an assertion reads
// the rule it is about rather than the whole stylesheet.
function declarations(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rule = STYLESHEET.match(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`));
  expect(rule, `style.css has no ${selector} rule`).toBeTruthy();
  return rule[1].replace(/\s+/g, ' ');
}

// The step names of one @keyframes block, each collapsed the same way.
function keyframes(name) {
  const rule = STYLESHEET.match(new RegExp(`@keyframes\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`));
  expect(rule, `style.css has no @keyframes ${name}`).toBeTruthy();
  const frames = {};
  for (const frame of rule[1].matchAll(/([a-z0-9-]+)\s*\{([^}]*)\}/g)) {
    frames[frame[1]] = frame[2].replace(/\s+/g, ' ').trim();
  }
  return frames;
}

describe('word-fishing the drifting clouds', () => {
  it('sails every cloud across the sky and loops it where the sky hides the reset', () => {
    // The bug this guards against: a cloud that reaches the end of a short nudge
    // and snaps back to the start in front of the child. The sky clips its own
    // edges, so entering at its right edge and leaving past its left edge puts
    // both ends - and the restart between them - out of sight.
    expect(declarations('.sea-sky')).toContain('overflow: hidden');
    expect(declarations('.sea-cloud')).toMatch(/animation: cloud-drift[^;]*linear[^;]*infinite/);

    const drift = keyframes('cloud-drift');
    const start = drift.from.match(/left:\s*(-?[\d.]+)%/);
    expect(start, 'the cloud must enter at the sky’s right edge').toBeTruthy();
    expect(Number(start[1])).toBeGreaterThanOrEqual(100);

    const end = drift.to.match(/left:\s*(-?[\d.]+)px/);
    expect(end, 'the cloud must leave in pixels, not a percentage of the sky').toBeTruthy();
    const widths = ['.cloud-a', '.cloud-b', '.cloud-c'].map((cloud) => {
      const width = declarations(cloud).match(/width:\s*(\d+)px/);
      expect(width, `${cloud} needs a pixel width to measure its exit`).toBeTruthy();
      return Number(width[1]);
    });
    // The widest cloud is fully past the left edge before the loop restarts.
    expect(Number(end[1]) + Math.max(...widths)).toBeLessThanOrEqual(0);
  });
});
