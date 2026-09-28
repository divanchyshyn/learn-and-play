import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { RIG_DX, RIG_Y } from './rig.js';
import { TICK_MS, WATERLINE } from './sea.js';
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

// The steps of one @keyframes block, each collapsed the same way, so a test can ask
// what a movement actually moves. The block is found by counting braces, so a
// rule written on one line and a rule written over several read the same here.
function keyframes(name) {
  const start = STYLESHEET.indexOf(`@keyframes ${name}`);
  expect(start, `style.css has no @keyframes ${name}`).toBeGreaterThanOrEqual(0);
  const open = STYLESHEET.indexOf('{', start);
  let depth = 0;
  let end = open;
  for (let i = open; i < STYLESHEET.length; i += 1) {
    if (STYLESHEET[i] === '{') depth += 1;
    else if (STYLESHEET[i] === '}') {
      depth -= 1;
      if (depth === 0) { end = i; break; }
    }
  }
  expect(depth, `@keyframes ${name} is never closed`).toBe(0);
  const frames = {};
  for (const frame of STYLESHEET.slice(open + 1, end).matchAll(/([a-z0-9-]+)\s*\{([^}]*)\}/g)) {
    frames[frame[1]] = frame[2].replace(/\s+/g, ' ').trim();
  }
  return frames;
}

// Every colour in a rule's gradients, as plain [r, g, b] triples, so a test can ask
// which way a layer leans (warm dawn light or the water's own cold blue).
function coloursOf(selector) {
  return [...declarations(selector).matchAll(/rgba\((\d+),\s*(\d+),\s*(\d+),/g)]
    .map((match) => match.slice(1).map(Number));
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

// Three layers meet at the waterline: the sky above it, the surface strip on it and
// the water below. That is where the fault was - a dark, flat strip cut a hard bar
// across the sun's own reflection - so what these tests hold on to is the blend:
// the layers either side of the line, and the light that carries the eye across it.
describe('word-fishing the waterline', () => {
  it("carries the sun's glint across the line, over the strip and under what floats", () => {
    // It shares the strip's layer and is painted after it (it comes later in the
    // scene - see the order the stage mounts, held by WordFishing.test.jsx), and it
    // stays under the boat, the float and the fish: a wash of sunlight that slid
    // over them would read as a pane of glass.
    expect(zIndexOf('.sea-glint')).toBe(zIndexOf('.sea-waves'));
    expect(zIndexOf('.sea-glint')).toBeLessThan(zIndexOf('.boat'));

    // It is anchored on the waterline and centred on it, so the wash straddles the
    // line instead of hanging off one side of it.
    const glint = declarations('.sea-glint');
    expect(glint).toContain('top: var(--waterline, 22%)');
    expect(glint).toMatch(/translate:\s*0 -50%/);

    // A wide wash and a small core, both warm: it is dawn light, not foam.
    const stops = coloursOf('.sea-glint');
    expect(stops.length).toBeGreaterThanOrEqual(4);
    for (const [r, , b] of stops) expect(r).toBeGreaterThan(b);
  });

  it('veils the water just under the surface with its own pale blue', () => {
    // The strip is a photograph of this same water, so the two can only meet in an
    // edge; the veil is what turns that edge into a surface. It is the water's own
    // colour - cold, unlike the haze above - and it stops well above the seabed.
    const veil = declarations('.sea-water::before');
    const stops = coloursOf('.sea-water::before');
    expect(stops.length).toBeGreaterThanOrEqual(2);
    for (const [r, , b] of stops) expect(b).toBeGreaterThan(r);
    const height = Number(veil.match(/height:\s*(\d+)%/)[1]);
    expect(height).toBeGreaterThan(10);
    expect(height).toBeLessThan(40);
    expect(zIndexOf('.sea-water::before')).toBeLessThan(zIndexOf('.water-depth'));
  });

  it("washes the horizon with dawn light rather than the water's cold blue", () => {
    // A blue haze at the horizon is what made the meeting of sky and sea read as a
    // lavender stripe through the sun. Warmth is the point here, so warmth is what
    // this holds on to - and a band of real height, or the sky meets the line raw.
    const stops = coloursOf('.sky-haze');
    expect(stops.length).toBeGreaterThanOrEqual(2);
    for (const [r, , b] of stops) expect(r).toBeGreaterThan(b);
    expect(declarations('.sky-haze')).toMatch(/height:\s*38%/);
  });

  it('leaves the water on the line still, so nothing there can read as a current', () => {
    // This band is the horizon: the furthest water in the scene, seen at a grazing
    // angle, where real crests foreshorten into an almost unbroken line and the water
    // travels nowhere in view. A pattern moving along that line can only be read as
    // flow, which leaves the child asking how fast the river runs - so the strip
    // repeats to span a sea many tiles wide and travels nowhere, and the veil under
    // it is still as well.
    const strip = declarations('.sea-waves::before');
    expect(strip).not.toContain('animation');
    expect(strip).toContain('background-repeat: repeat-x');
    expect(strip).toContain('background-size: var(--surface-tile) 100%');
    expect(declarations('.sea-water::before')).not.toContain('animation');
  });

  it('fades the band into the sky and the water instead of drawing two edges', () => {
    // The band's own edges are the last place the waterline could show a line: a
    // bright seam where it meets the sky's haze, and a pale shelf where it meets the
    // sunlit water. They are faded with a mask - the same trick the sand plate's top
    // edge uses - so this guards both halves of the promise: that the fade is there
    // at all (a hard-edged bar is what made the band read as a slab), and that it
    // cannot be widened until it eats the band it is fading into.
    const mask = declarations('.sea-waves::before').match(/;\s*mask-image:\s*([^;]+)/);
    expect(mask, 'the band has no mask to fade its edges with').toBeTruthy();
    const gradient = mask[1];
    expect(gradient).toMatch(/linear-gradient\(\s*rgba\(0, 0, 0, 0\)/);
    expect(gradient).toMatch(/rgba\(0, 0, 0, 0\)\s*\)$/);

    const stops = [...gradient.matchAll(/(\d+)%/g)].map((stop) => Number(stop[1]));
    expect(stops, 'the fade needs both of its own edges').toHaveLength(2);
    const [opaqueFrom, opaqueTo] = stops;
    expect(opaqueFrom).toBeGreaterThan(15);
    expect(opaqueTo).toBeLessThan(85);
    // The middle of the band is still real water, at full strength.
    expect(opaqueTo - opaqueFrom).toBeGreaterThanOrEqual(30);
  });

  it('moves the light on the line, and only its brightness', () => {
    // The one thing that does move up here is the sun's glare breathing, the way the
    // light on real water does: a change of light where a drifting strip was a change
    // of place. That is why this is allowed where the drift was not - and why the
    // steps may hold nothing but opacity, since a translate, a `left` or a filter in
    // there would put something that travels (or shimmers) back on the waterline.
    expect(declarations('.sea-glint')).toContain('animation: glint-breathe');
    const steps = Object.values(keyframes('glint-breathe'));
    expect(steps.length).toBeGreaterThanOrEqual(2);
    for (const step of steps) {
      expect(step, 'the glint may only change brightness').toMatch(/^(?:opacity: [\d.]+;?\s*)+$/);
    }
  });
});

// The boat and her angler are two photographs, and the two things a child sees go
// wrong first are her floating above the water and her crew standing in the air.
// Both are settled by the stylesheet's own numbers, so these tests read those numbers
// and do the arithmetic rather than trusting a layout that jsdom cannot run.
describe('word-fishing the boat and her angler', () => {
  it('rests the hull\'s own waterline on the sea\'s surface, not her lower edge', () => {
    // The picture carries her waterline *inside* it: her paint ends along row 88 of
    // 100 and the water she sits in fills the rows below it. `--hull-dip` is those
    // rows as a share of the hull's own height, and the frame's lower edge belongs
    // that far under the sea's surface - which is exactly what its `bottom` is, the
    // waterline less the dip. Resting the picture's *lower edge* on the waterline, as
    // this rule used to, floats the whole hull and her own strip of water above it.
    const boat = declarations('.boat');
    expect(boat).toContain('--hull-dip: calc(var(--hull-height) * (100 - var(--hull-waterline)) / 100)');

    const height = Number(boat.match(/--hull-height:\s*(\d+)%/)[1]);
    const waterlineRow = Number(boat.match(/--hull-waterline:\s*(\d+)/)[1]);
    const dip = (height * (100 - waterlineRow)) / 100;
    // The row of the picture that ends up on the surface, worked back out of the
    // frame's own geometry: the dip is what hangs below it.
    expect(((height - dip) / height) * 100).toBeCloseTo(waterlineRow, 6);

    const hull = declarations('.boat-hull');
    expect(hull).toContain('bottom: calc(var(--waterline, 22%) - var(--hull-dip))');
    expect(hull).toContain('height: var(--hull-height)');
  });

  it('stands the angler on the foredeck, inside the hull\'s frame', () => {
    const boat = declarations('.boat');
    const angler = declarations('.angler-photo');
    const top = Number(angler.match(/top:\s*(-?\d+)%/)[1]);
    const height = Number(angler.match(/height:\s*(\d+)%/)[1]);
    const left = Number(angler.match(/left:\s*(\d+)%/)[1]);

    // His boots belong on the foredeck's white stripe, a row just past halfway down
    // the picture. He may rise past the frame's top edge, because his head does - but
    // never down to the deck's own row, or he would be standing through the hull.
    expect(top + height).toBeGreaterThan(40);
    expect(top + height).toBeLessThan(60);

    // His picture is 620 tall to 224 wide, in a frame 900 wide to 553 tall, so his
    // box covers this much of the frame's width: on the foredeck, well inside her.
    const width = height * (224 / 620) * (553 / 900);
    expect(left).toBeGreaterThan(4);
    expect(left + width).toBeLessThan(40);

    // What the rod is drawn from is his hands, so they have to be at the row the rig
    // anchors call the grip (RIG_Y.rodBase in rig.js) - in the sea's own percentages,
    // where his hands are: the frame's top edge is the waterline less the hull's
    // height and plus the dip she hangs by, and his hands sit halfway down his box.
    // The two numbers are tuned on the sea the stylesheet sizes a boat by (23% of its
    // height); on a sea of a very different shape the rig's own shares of it drift
    // from him, which is a change to the rig rather than to where he stands (see
    // BoatArt.jsx).
    const box = Number(boat.match(/height:\s*clamp\(\d+px,\s*(\d+)%,\s*\d+px\)/)[1]) / 100;
    const frameInSea = box * Number(boat.match(/--hull-height:\s*(\d+)%/)[1]) / 100;
    const dipInSea = frameInSea * (100 - Number(boat.match(/--hull-waterline:\s*(\d+)/)[1])) / 100;
    const frameTop = WATERLINE / 100 + dipInSea - frameInSea;
    const hands = (frameTop + ((top + height / 2) / 100) * frameInSea) * 100;
    expect(hands).toBeCloseTo(RIG_Y.rodBase, 0);
  });
});
