import { describe, it, expect, vi } from 'vitest';
import { pickWords, speakWord } from './words.js';

describe('lyd-labyrint word picker', () => {
  it('picks the requested number of distinct words with a picture each', () => {
    for (let trial = 0; trial < 100; trial += 1) {
      const picked = pickWords(12);
      expect(picked).toHaveLength(12);
      expect(new Set(picked.map((entry) => entry.word)).size).toBe(12);
      for (const entry of picked) {
        expect(entry.word.length).toBeGreaterThan(0);
        expect(entry.emoji.length).toBeGreaterThan(0);
      }
    }
  });

  it('never places two words with the same first letter next to each other', () => {
    // Doors are labelled in reading order, so "next to each other" in the
    // picked sequence means the two signs visible at the same junction.
    for (let trial = 0; trial < 200; trial += 1) {
      const picked = pickWords(12);
      for (let index = 1; index < picked.length; index += 1) {
        expect(picked[index].word[0]).not.toBe(picked[index - 1].word[0]);
      }
    }
  });

  it('handles small and zero counts', () => {
    expect(pickWords(0)).toEqual([]);
    const two = pickWords(2);
    expect(two).toHaveLength(2);
    expect(two[0].word[0]).not.toBe(two[1].word[0]);
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

    speakWord('hus');

    expect(spoken).toEqual(['hus']);
    vi.unstubAllGlobals();
  });

  it('does not throw when speechSynthesis is unavailable', () => {
    // jsdom has no speechSynthesis – the guard must keep it a silent no-op.
    expect(() => speakWord('hus')).not.toThrow();
  });
});
