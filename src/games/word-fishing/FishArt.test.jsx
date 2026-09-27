import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { WORD_BANK } from './words.js';
import { FISH_SPECIES, FishArt, fishPhoto, speciesForWord } from './FishArt.jsx';

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

  it('paints every species as its own photograph', () => {
    const sources = new Set();
    for (const species of FISH_SPECIES) {
      const { container, unmount } = render(<FishArt species={species} />);
      const photo = container.querySelector('img.fish-drawing');
      expect(photo, `${species} has no picture`).toBeTruthy();
      expect(photo.getAttribute('src'), `${species} has no source`).toBeTruthy();
      expect(photo.getAttribute('alt'), `${species} must stay silent`).toBe('');
      sources.add(photo.getAttribute('src'));
      unmount();
    }
    // Six species, six different fish: the shoal is never five copies of one.
    expect(sources.size).toBe(FISH_SPECIES.length);
  });

  it('falls back to a plain fish for a species it does not know', () => {
    const { container } = render(<FishArt species="finnesikke" />);
    expect(container.querySelector('img.fish-drawing').getAttribute('src')).toBe(fishPhoto('bass'));
  });
});
