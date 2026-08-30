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

  it('never gives two side-by-side doors the same first letter', () => {
    // Doors earlier in the list sit next to each other on the board, so an
    // adjacent pair sharing a first letter would be a confusing choice.
    for (let trial = 0; trial < 150; trial += 1) {
      const picked = pickWords(7, 'skog');
      for (let index = 1; index < picked.length; index += 1) {
        expect(picked[index].word[0]).not.toBe(picked[index - 1].word[0]);
      }
    }
  });

  it('handles small counts', () => {
    expect(pickWords(0, 'skog')).toEqual([]);
    const two = pickWords(2, 'skog');
    expect(two).toHaveLength(2);
  });

  it('throws when a habitat cannot fill the request', () => {
    expect(() => pickWords(9, 'skog')).toThrow();
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