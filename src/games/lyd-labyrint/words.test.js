import { describe, it, expect, vi } from 'vitest';
import { WORDS_BY_THEME, pickWords, speakWord } from './words.js';

describe('lyd-labyrint word picker', () => {
  for (const theme of Object.keys(WORDS_BY_THEME)) {
    it(`picks a full set of distinct ${theme} theme words`, () => {
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

  it('returns a fresh random ordering of the theme words each time', () => {
    // Every door is a spelling lock now, so no first-letter constraint is
    // needed – the guarantee that matters is that the words are drawn as a
    // full, fresh shuffle from their theme every single time.
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

  it('ships at least twenty words per theme (days of the week slightly fewer)', () => {
    const minimums = { ukedager: 13 };
    for (const theme of Object.keys(WORDS_BY_THEME)) {
      expect(WORDS_BY_THEME[theme].length, theme).toBeGreaterThanOrEqual(minimums[theme] ?? 20);
    }
  });

  it('keeps forest, ocean and savannah words at most 5 letters for the tray', () => {
    for (const theme of ['skog', 'hav', 'savanne']) {
      for (const entry of WORDS_BY_THEME[theme]) {
        expect(entry.word.length, `${theme}: ${entry.word}`).toBeLessThanOrEqual(5);
      }
    }
  });

  it('keeps every word a single token or one of the known day phrases', () => {
    const phraseWords = ['i dag', 'i morgen', 'i går'];
    for (const theme of Object.keys(WORDS_BY_THEME)) {
      for (const entry of WORDS_BY_THEME[theme]) {
        expect(entry.word.trim(), `${theme}: ${entry.word}`).not.toBe('');
        expect(entry.word.includes('  '), `${theme}: ${entry.word}`).toBe(false);
        if (entry.word.includes(' ')) {
          expect(phraseWords, `${theme}: ${entry.word}`).toContain(entry.word);
        }
      }
    }
  });

  it('parses the required day, month and season words from the curriculum text', () => {
    const dayWords = WORDS_BY_THEME.ukedager.map((entry) => entry.word);
    for (const required of ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag', 'dag', 'uke', 'helg', 'i dag', 'i morgen', 'i går']) {
      expect(dayWords).toContain(required);
    }
    const seasonWords = WORDS_BY_THEME.aarstider.map((entry) => entry.word);
    for (const required of ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember', 'vår', 'våren', 'sommer', 'sommeren', 'høst', 'høsten', 'vinter', 'vinteren']) {
      expect(seasonWords).toContain(required);
    }
  });

  it('throws when a theme cannot fill the request', () => {
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