import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { FISH_SPECIES } from './FishArt.jsx';
import { FISH_PHOTOS, PHOTOS } from './photos.js';
import { REEF_REWARDS } from './trip.js';

// The whole stage is photographs, so a fault in the art is a fault in the game:
// a plate that carries its own sea, a cut-out that lost its alpha channel or a
// waterline strip whose picture no longer matches the proportions the stylesheet
// repeats it at all read on the stage as something wrong. These tests open the
// shipped files themselves - a WebP names its codec in the four bytes after
// `RIFF....WEBP`, and both codecs we ship repeat their size near the start of the
// file - so the contract can be checked without an image library in the project.
//
// An asset import hands out the asset's URL, and under jsdom that URL is an http
// one, so a file is found through the project root the tests run from (or through
// the URL itself when it is a real `file:` one).
function localFile(url) {
  return url.startsWith('file:') ? fileURLToPath(url) : resolve(process.cwd(), url.replace(/^\/+/, ''));
}

function readWebp(url) {
  const bytes = readFileSync(localFile(url));
  const chunk = bytes.toString('latin1', 12, 16);
  const head = { chunk };
  if (chunk === 'VP8X') {
    // Extended format: an alpha flag, then the canvas size as two 24-bit values.
    head.alpha = (bytes[20] & 0x10) !== 0;
    head.width = bytes.readUIntLE(24, 3) + 1;
    head.height = bytes.readUIntLE(27, 3) + 1;
  } else if (chunk === 'VP8 ') {
    // Plain lossy format: the size sits in the first key frame's header.
    head.alpha = false;
    head.width = bytes.readUInt16LE(26) & 0x3fff;
    head.height = bytes.readUInt16LE(28) & 0x3fff;
  }
  return head;
}

// The stylesheet beside the pictures: found through the pictures' own folder, so
// it moves with them. Comments come out first, so a rule that is commented out can
// never satisfy a layout assertion below.
const styleSheet = readFileSync(join(dirname(localFile(PHOTOS.sky)), '..', 'style.css'), 'utf8');
const rules = styleSheet.replace(/\/\*[\s\S]*?\*\//g, '');

// The sea box the layout is designed at, the same reference the reef layout test
// uses (see trip.test.js). Sizes and offsets in this test are read from the rules
// the scene is actually laid out with, never copied from them.
const SEA = { width: 1080, height: 640 };

// The declarations of one rule, collapsed to a single line. The rule has to start
// where the selector does (a `}` or the start of the file in front of it), so the
// narrow-screen override rather than the rule it overrides is never picked up.
function declarations(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rule = rules.match(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`));
  expect(rule, `style.css has no ${selector} rule`).toBeTruthy();
  return rule[1].replace(/\s+/g, ' ');
}

// One number out of a rule - or out of the rule it inherits it from, which is how
// the clumps take their width from `.lake-kelp` unless their own rule sets one.
function pixelsIn(selector, property, inheritsFrom = null) {
  const pattern = new RegExp(`${property}:\\s*(-?[\\d.]+)`);
  const found = declarations(selector).match(pattern)
    ?? (inheritsFrom ? declarations(inheritsFrom).match(pattern) : null);
  expect(found, `${selector} has no ${property}`).toBeTruthy();
  return Number(found[1]);
}

// One of a rule's own custom properties, in pixels: the dock sizes the cell the one
// control stands in with one, so the number the row is measured against is the number
// the row is laid out with.
function variableIn(selector, name) {
  const found = declarations(selector).match(new RegExp(`${name}:\\s*(-?[\\d.]+)px`));
  expect(found, `${selector} has no ${name}`).toBeTruthy();
  return Number(found[1]);
}

// The viewport width the dock's five-cell row switches on at: the query that turns
// the dock into the one-line grid, read from the stylesheet.
function oneRowBreakpoint() {
  const found = [...rules.matchAll(/@media\s*\(min-width:\s*(\d+)px\)\s*\{([\s\S]*?)\n\}/g)]
    .find((query) => query[2].includes('var(--dock-control)'));
  expect(found, 'no media query puts the dock on one row').toBeTruthy();
  return Number(found[1]);
}

// The page - and with it the sea and the dock - on a screen of a given viewport
// width: `min(100% - <inset>, <cap>)`, read from that rule rather than copied.
function seaWidthOn(viewport) {
  const page = declarations('.game-page.fishing-page');
  const inset = Number(page.match(/100%\s*-\s*([\d.]+)px/)[1]);
  const cap = Number(page.match(/,\s*([\d.]+)px\s*\)/)[1]);
  return Math.min(viewport - inset, cap);
}

// The box a sprite covers on the stage: the picture's own shape (a photograph is
// never stretched) at the width one of the game's rules gives it, centred on the
// percentage the floor places it at - which is what `translate(-50%, -50%)` means.
function centredBox(photo, { left, top, width }) {
  const { width: pictureWidth, height: pictureHeight } = readWebp(photo);
  const height = (width * pictureHeight) / pictureWidth;
  const centreX = (left / 100) * SEA.width;
  const centreY = (top / 100) * SEA.height;
  return {
    left: centreX - width / 2,
    right: centreX + width / 2,
    top: centreY - height / 2,
    bottom: centreY + height / 2,
  };
}

// A clump of weed instead hangs off the bottom edge of the sea box by its own
// `bottom`, and is placed by its left or right edge rather than by a centre.
function clumpBox(photo, selector) {
  const width = pixelsIn(selector, 'width', '.lake-kelp');
  const { width: pictureWidth, height: pictureHeight } = readWebp(photo);
  const height = (width * pictureHeight) / pictureWidth;
  const drop = Math.abs(pixelsIn('.lake-kelp', 'bottom'));
  const placement = declarations(selector);
  const fromRight = placement.match(/right:\s*(-?[\d.]+)%/);
  const fromLeft = placement.match(/left:\s*(-?[\d.]+)%/);
  const left = fromRight
    ? SEA.width - (Number(fromRight[1]) / 100) * SEA.width - width
    : (Number(fromLeft[1]) / 100) * SEA.width;
  return { left, right: left + width, top: SEA.height + drop - height, bottom: SEA.height + drop };
}

const overlapsOnStage = (a, b) => Math.min(a.right, b.right) > Math.max(a.left, b.left)
  && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top);

// The scenery that is always on the sand, whoever is fishing: each prop's box, read
// from the rule that places it. The weed may not grow across one, so the layout guard
// below needs them beside the finds.
const STAGE_PROPS = [
  ['rock', '.reef-rock', PHOTOS.rockCluster],
  ['anchor', '.reef-anchor', PHOTOS.anchor],
  ['driftwood', '.reef-driftwood', PHOTOS.driftwood],
  ['stones', '.reef-stones', PHOTOS.stones],
];

function stageProps() {
  return STAGE_PROPS.map(([name, selector, photo]) => ({
    name,
    ...centredBox(photo, {
      left: pixelsIn(selector, 'left'),
      top: pixelsIn(selector, 'top'),
      width: pixelsIn(selector, 'width'),
    }),
  }));
}

// Every find a finished trip can stand on the sand, in the same coordinates.
function stageFinds() {
  return REEF_REWARDS.map((reward) => ({
    name: reward.id,
    ...centredBox(PHOTOS[reward.id], { left: reward.x, top: reward.y, width: reward.size }),
  }));
}

describe('word-fishing photographs', () => {
  it('pastes every plate as a full frame, with no alpha to crop against', () => {
    for (const plate of ['sky', 'water', 'seabed']) {
      const head = readWebp(PHOTOS[plate]);
      expect(head.chunk, `${plate} is not a plain WebP`).toBe('VP8 ');
      expect(head.alpha, `${plate} carries an alpha channel`).toBe(false);
      expect(head.width).toBeGreaterThan(0);
      expect(head.height).toBeGreaterThan(0);
    }
  });

  it('keeps the sky and the sand wide bands, so a bottom-anchored crop stays inside them', () => {
    // Both are pasted `cover` into a box far wider than it is tall and anchored to
    // their lower edge, so the box shows the bottom of the plate as a horizontal
    // slice. A plate that is nearly as tall as it is wide can only ever show a
    // sliver of itself - which is how an aerial photograph of a whole beach once
    // filled the sky band with open ocean.
    for (const plate of ['sky', 'seabed']) {
      const head = readWebp(PHOTOS[plate]);
      expect(head.width, `${plate} is not a wide band`).toBeGreaterThan(head.height * 2.5);
    }
  });

  it('cuts every fish out of its own picture, with alpha and one picture scale', () => {
    for (const species of FISH_SPECIES) {
      const head = readWebp(FISH_PHOTOS[species]);
      expect(head.chunk, `${species} is not a cut-out`).toBe('VP8X');
      expect(head.alpha, `${species} lost its alpha channel`).toBe(true);
      const long = Math.max(head.width, head.height);
      expect(long, `${species} is too small for the box it fills`).toBeGreaterThanOrEqual(700);
      expect(long, `${species} is larger than the 900 px its box needs`).toBeLessThanOrEqual(900);
    }
  });

  it('cuts every treasure out of its own picture, with alpha', () => {
    // The ten treasures are cut-outs like the fish: a picture of their own, keyed out
    // of its background, with the alpha channel carrying the shape. One that lost it
    // would paint its own rectangle of background onto the sand, and one drawn from a
    // postage stamp would go soft in the box the floor gives it.
    for (const reward of REEF_REWARDS) {
      const head = readWebp(PHOTOS[reward.id]);
      expect(head.chunk, `${reward.id} is not a cut-out`).toBe('VP8X');
      expect(head.alpha, `${reward.id} lost its alpha channel`).toBe(true);
      const long = Math.max(head.width, head.height);
      expect(long, `${reward.id} is too small for the box it fills`).toBeGreaterThanOrEqual(320);
      expect(long, `${reward.id} carries more pixels than its box can show`).toBeLessThanOrEqual(900);
    }
  });

  it('repeats the waterline at the proportions of its picture', () => {
    // The strip is drawn as one tile per repeat, at a size derived from the tile's
    // own numbers in the stylesheet. Those numbers and the picture are two halves
    // of one promise: once they drift apart, every crest on the waterline is
    // squashed, and a tile that carries its own horizon prints a row of horizons
    // across the sea.
    const tile = readWebp(PHOTOS.surface);
    const match = styleSheet.match(/--surface-tile: calc\(var\(--wave-h\) \* (\d+) \/ (\d+)\)/);
    expect(match, 'the stylesheet has no --surface-tile to repeat').toBeTruthy();
    expect(tile.width).toBe(Number(match[1]));
    expect(tile.height).toBe(Number(match[2]));
  });

  it('anchors the hull in the picture\'s own proportions, so she cannot be stretched', () => {
    // The hull is the one sprite whose box is not fixed by the stylesheet: it is a
    // frame in the picture's own proportions (`aspect-ratio`), and the picture is
    // pasted into it. A frame that is not this picture's shape stretches her - and
    // every row of her paint, waterline included, moves with it.
    const hull = readWebp(PHOTOS.boat);
    expect(hull.chunk, 'the hull is not a cut-out').toBe('VP8X');
    expect(hull.alpha, 'the hull lost its alpha channel').toBe(true);
    const frame = styleSheet.match(/\.boat-hull \{[^}]*aspect-ratio:\s*(\d+)\s*\/\s*(\d+)/);
    expect(frame, 'the hull has no frame in her own proportions').toBeTruthy();
    expect(Number(frame[1]) * hull.height).toBe(Number(frame[2]) * hull.width);
  });

  it('gives every species the size correction the stylesheet knows it by', () => {
    for (const species of FISH_SPECIES) {
      expect(styleSheet, `${species} has no size correction`).toContain(`.fish.species-${species} {`);
    }
  });

  it('stands the weed in front of the sand, and clear of the collection', () => {
    // The kelp grows at the very front of the stage, so it is painted over the
    // floor (see `.sea-weed`): an item drawn across a plant is what made the stones
    // look like they were lying on top of the weed. That layer is what guarantees it
    // at every screen size. The clumps' own places then keep the layer from
    // swallowing a find on the sea the layout is designed at.
    const zIndexOf = (selector) => Number(declarations(selector).match(/z-index:\s*(\d+)/)[1]);
    expect(zIndexOf('.sea-weed'), 'the weed does not paint over the sand')
      .toBeGreaterThan(zIndexOf('.sea-floor'));

    const props = stageProps();

    const finds = stageFinds();

    const clumps = [
      ['kelp-a', PHOTOS.kelpA],
      ['kelp-b', PHOTOS.kelpB],
      ['kelp-c', PHOTOS.kelpB],
    ].map(([name, photo]) => ({ name, ...clumpBox(photo, `.${name}`) }));
    expect(clumps).toHaveLength(3);

    // Every clump stands in clear sand: no find and no prop is underneath it, so
    // the foreground layer never hides part of the child's collection.
    for (const clump of clumps) {
      for (const item of [...finds, ...props]) {
        expect(overlapsOnStage(clump, item), `${clump.name} grows across the ${item.name}`).toBe(false);
      }
    }
  });

  it('keeps the four crates and the one control on one row', () => {
    // The control lives in the crates' own row now (see `.crate-dock`), so the five
    // cells have to fit the page the layout is designed at, on the one line the dock
    // switches to: four crates at their narrowest, the control's own cell, and the
    // gaps between them. The breakpoint and every size below are read from the rules
    // the row is actually laid out with, never copied from them.
    const gap = pixelsIn('.crate-dock', 'gap');
    const crateFloor = pixelsIn('.crate', 'min-width');
    const controlCell = variableIn('.crate-dock', '--dock-control');
    const widestControl = Math.max(
      pixelsIn('.action-button', 'min-width'),
      pixelsIn('.bite-button', 'min-width'),
      pixelsIn('.reel', 'width'),
    );
    const fiveCells = 4 * crateFloor + controlCell + 4 * gap;

    // The control's cell is the widest control there is, so the pill and the reel
    // never resize the crates they stand between.
    expect(controlCell, 'the control does not fit its own cell').toBeGreaterThanOrEqual(widestControl);

    // …and the five cells fit the page at the width the row goes onto one line, with
    // the page's own inset taken off (`min(100% - <inset>, <cap>)`, see the page rule).
    const breakpoint = oneRowBreakpoint();
    const pageAtBreakpoint = seaWidthOn(breakpoint);
    expect(fiveCells, `the row needs ${fiveCells}px at ${breakpoint}px, where the page is ${pageAtBreakpoint}px`)
      .toBeLessThanOrEqual(pageAtBreakpoint);
  });
});
