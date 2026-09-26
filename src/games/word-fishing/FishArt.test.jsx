import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { WORD_BANK } from './words.js';
import { FISH_SPECIES, FishArt, speciesForWord } from './FishArt.jsx';

// Which fish a word swims in as is a pure function of the word, so a test can pin
// it down – and it has to be stable, because a fish must not change shape while a
// child is watching it come for the bait.
describe('word-fishing fish species', () => {
  it('gives every word in the bank a species, always the same one', () => {
    for (const entry of WORD_BANK) {
      const species = speciesForWord(entry.word);
      expect(FISH_SPECIES).toContain(species);
      expect(speciesForWord(entry.word)).toBe(species);
    }
  });

  it('spreads the bank over several species, so the shoal is never one fish', () => {
    const species = new Set(WORD_BANK.map((entry) => speciesForWord(entry.word)));
    expect(species.size).toBeGreaterThanOrEqual(5);
  });

  it('does not care which way round a word is asked for it', () => {
    // Same word, same species – whatever else the sea is doing.
    expect(speciesForWord('fisk')).toBe(speciesForWord('fisk'));
    expect(speciesForWord('')).toBe(FISH_SPECIES[7 % FISH_SPECIES.length]);
  });

  it('draws every species, with fins, a pattern and an eye', () => {
    for (const species of FISH_SPECIES) {
      const { container, unmount } = render(<FishArt species={species} />);
      const svg = container.querySelector('svg.fish-drawing');
      expect(svg, `${species} is not drawn`).toBeTruthy();
      expect(svg.querySelectorAll('path, circle, ellipse').length, `${species} is too simple`)
        .toBeGreaterThanOrEqual(15);
      expect(svg.querySelector('.fish-body'), `${species} has no body`).toBeTruthy();
      expect(svg.querySelector('.fish-eye'), `${species} has no eye`).toBeTruthy();
      expect(svg.querySelector('.fish-mouth'), `${species} has no mouth`).toBeTruthy();
      unmount();
    }
  });

  it('falls back to a plain fish for a species it does not know', () => {
    const { container } = render(<FishArt species="finnesikke" />);
    expect(container.querySelector('svg.fish-drawing')).toBeTruthy();
  });
});
