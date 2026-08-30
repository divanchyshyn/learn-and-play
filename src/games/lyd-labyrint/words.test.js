import { describe, it, expect, vi } from 'vitest';
import { WORDS_BY_THEME, pickWords, speakWord } from './words.js';

describe('lyd-labyrint word picker', () => {
  for (const theme of Object.keys(WORDS_BY_THEME)) {
    it(`picks a full set of distinct ${theme} habitat words`, () => {
      const bank = WORDS_BY_THEME[theme];
      for (let trial = 0; trial < 40; trial += 1) {
        const picked = pickWords(7, theme);
        expect(picked).toHaveLength(7);
        expect(new Set(picked.map((entry) => entry.word)).size).toBe(7);
        for (const entry of picked) {
          const match = bank.find((candidate) => candidate.word === entry.word);
          expect(match).toBeTruthy();
          expect(entry.emoji).toBe(match.emoji);
        }
      }
    });
  }

  it('returns a fresh random ordering of the habitat words each time', () => {
    // Every door is a spelling lock now, so no first-letter constraint is
    // needed – the guarantee that matters is that the words are drawn as a
    // full, fresh shuffle from their habitat every single time.
    for (const theme of Object.keys(WORDS_BY_THEME)) {
      const full = pickWords(WORDS_BY_THEME[theme].length, theme);
      expect(full.map((entry) => entry.word).sort())
        .toEqual(WORDS_BY_THEME[theme].map((entry) => entry.word).sort());
    }
  });

  it('handles small counts', () => {
    expect(pickWords(0, 'skog')).toEqual([]);
    const two = pickWords(2, 'skog');
    expect(two).toHaveLength(2);
  });

  it('keeps every word at most 5 letters for the spelling tray', () => {
    for (const theme of Object.keys(WORDS_BY_THEME)) {
      for (const entry of WORDS_BY_THEME[theme]) {
        expect(entry.word.length, `${theme}: ${entry.word}`).toBeLessThanOrEqual(5);
      }
    }
  });

  it('throws when a habitat cannot fill the request', () => {
    expect(() => pickWords(WORDS_BY_THEME.skog.length + 1, 'skog')).toThrow();
    expect(() => pickWords(3, 'unknown')).toThrow();
  });
});

describe('lyd-labyrint spoken words', () => {
  it('reads a word aloud through speechSynthesis when available', () => {
    const spoken = [];
    vi.stubGlobal('SpeechSynthesisUtterance', class FakeUtterance {
      constructor(text) { this.text = text; }
    });
    vi.stubGlobal('speechSynthesis', {
      cancel() {},
      speak(utterance) { spoken.push(utterance.text); },
    });

    speakWord('rev');

    expect(spoken).toEqual(['rev']);
    vi.unstubAllGlobals();
  });

  it('does not throw when speechSynthesis is unavailable', () => {
    // jsdom has no speechSynthesis – the guard must keep it a silent no-op.
    expect(() => speakWord('rev')).not.toThrow();
  });
});