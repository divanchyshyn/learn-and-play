import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { FISH_SPECIES } from './FishArt.jsx';
import { FISH_PHOTOS, PHOTOS } from './photos.js';

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
// it moves with them.
const styleSheet = readFileSync(join(dirname(localFile(PHOTOS.sky)), '..', 'style.css'), 'utf8');

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

  it('gives every species the size correction the stylesheet knows it by', () => {
    for (const species of FISH_SPECIES) {
      expect(styleSheet, `${species} has no size correction`).toContain(`.fish.species-${species} {`);
    }
  });
});
