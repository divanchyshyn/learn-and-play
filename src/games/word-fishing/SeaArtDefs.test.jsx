import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { BoatArt } from './BoatArt.jsx';
import { FISH_SPECIES, FishArt } from './FishArt.jsx';
import { REWARD_IDS, ReefArt } from './ReefRewards.jsx';
import { Anchor, Driftwood, Kelp, RockCluster, SandFloor, Stones } from './SeaFloor.jsx';
import { SeaArtDefs, paint } from './SeaArtDefs.jsx';
import { SkyLayer } from './SeaSky.jsx';
import { WaterBody, WaveLine } from './SeaWater.jsx';

// The stylesheet paints a couple of things itself (the old anchor is drawn as
// strokes), so its paint references are part of the same contract. Tests run from
// the project root, which is how the rest of the suite resolves too.
const STYLESHEET = readFileSync(resolve(process.cwd(), 'src/games/word-fishing/style.css'), 'utf8');

// Every gradient the scene paints with lives in one shared <defs> block, and every
// sprite points at it by id. That keeps the paint layer tiny – but it also means a
// typo, or a defs block that stops being mounted, would quietly turn a sprite
// transparent. These tests are the guard for that: they render every drawing the
// game can put on screen and prove that every paint it asks for exists, exactly
// once.
//
// The same canvas the game draws: the scene composes these very pieces.
function SeaCanvas() {
  return <>
    <SeaArtDefs />
    <SkyLayer />
    <WaterBody />
    <WaveLine />
    <SandFloor />
    <RockCluster />
    <Kelp />
    <Anchor />
    <Driftwood />
    <Stones />
    <BoatArt tripNumber={3} />
    {FISH_SPECIES.map((species) => <FishArt key={species} species={species} />)}
    {REWARD_IDS.map((id) => <ReefArt key={id} id={id} />)}
  </>;
}

// Every `url(#…)` the rendered markup points at: a fill, a stroke, a filter.
function domPaintReferences(container) {
  const references = new Set();
  for (const element of container.querySelectorAll('*')) {
    for (const name of ['fill', 'stroke', 'filter', 'clip-path', 'mask']) {
      const value = element.getAttribute(name) ?? '';
      for (const match of value.matchAll(/url\(#([^)]+)\)/g)) references.add(match[1]);
    }
  }
  return references;
}

describe('word-fishing shared paints', () => {
  it('builds a paint reference from a name', () => {
    expect(paint('hull')).toBe('url(#wf-hull)');
  });

  it('defines every paint the drawings ask for', () => {
    const { container } = render(<SeaCanvas />);
    const references = domPaintReferences(container);
    expect(references.size).toBeGreaterThan(30);
    for (const id of references) {
      expect(document.getElementById(id), `${id} is never defined`).toBeTruthy();
    }
  });

  it('defines every paint the stylesheet asks for', () => {
    render(<SeaArtDefs />);
    const references = [...STYLESHEET.matchAll(/url\(#([^)]+)\)/g)].map((match) => match[1]);
    expect(references.length).toBeGreaterThan(0);
    for (const id of references) {
      expect(document.getElementById(id), `${id} is never defined`).toBeTruthy();
    }
  });

  it('never defines the same id twice, so two sprites can never swap colours', () => {
    const { container } = render(<SeaCanvas />);
    const ids = [...container.querySelectorAll('[id]')].map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('mounts its paints in an svg that is invisible but still resolvable', () => {
    const { container } = render(<SeaArtDefs />);
    const defs = container.querySelector('svg.sea-defs');
    expect(defs).toBeTruthy();
    expect(defs.getAttribute('aria-hidden')).toBe('true');
  });

  it('paints every shape, from its own attribute or from the stylesheet', () => {
    // A shape with neither a paint of its own nor a class the stylesheet knows
    // falls back to SVG's default black. That is how a missing rule hides: the
    // drawing still renders, just wrong. A class on any ancestor counts, because
    // the stylesheet is allowed to paint a group's children (`.shoal-fish path`).
    const { container } = render(<SeaCanvas />);
    const styled = new Set([...STYLESHEET.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((match) => match[1]));
    const paintedByStyle = (shape) => {
      for (let node = shape; node && node !== container; node = node.parentElement) {
        if ([...node.classList].some((name) => styled.has(name))) return true;
      }
      return false;
    };
    const unpainted = [...container.querySelectorAll('path, circle, ellipse, rect, polygon, line')]
      .filter((shape) => !shape.getAttribute('fill') && !shape.getAttribute('stroke'))
      .filter((shape) => !paintedByStyle(shape));
    expect(unpainted.map((shape) => `${shape.tagName}.${shape.getAttribute('class') ?? shape.parentElement?.getAttribute('class') ?? ''}`)).toEqual([]);
  });
});
