import { describe, it, expect, vi, afterEach } from 'vitest';
import { speakNorwegian } from './speech.js';

afterEach(() => {
  vi.unstubAllGlobals();
  delete window.speechSynthesis;
  delete window.SpeechSynthesisUtterance;
});

describe('shared norwegian speech', () => {
  it('reports false and stays silent when the browser cannot speak', () => {
    // jsdom has no speechSynthesis – the guard must keep it a no-op.
    expect(speakNorwegian('hus')).toBe(false);
    expect(() => speakNorwegian('hus')).not.toThrow();
  });

  it('speaks with the norwegian voice at the requested pace', () => {
    const spoken = [];
    vi.stubGlobal('SpeechSynthesisUtterance', class FakeUtterance {
      constructor(text) { this.text = text; }
    });
    vi.stubGlobal('speechSynthesis', {
      cancel() {},
      speak(utterance) { spoken.push(utterance); },
    });

    expect(speakNorwegian('tjueen')).toBe(true);
    expect(spoken).toHaveLength(1);
    expect(spoken[0].text).toBe('tjueen');
    expect(spoken[0].lang).toBe('nb-NO');
    expect(spoken[0].rate).toBe(0.95);
    expect(spoken[0].pitch).toBe(1);

    speakNorwegian('tre', { rate: 0.75, pitch: 1.05 });
    expect(spoken[1].rate).toBe(0.75);
    expect(spoken[1].pitch).toBe(1.05);
  });
});
