import { describe, it, expect, vi, afterEach } from 'vitest';
import { pickNorwegianVoice, speakNorwegian } from './speech.js';

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

  it('prefers an installed norwegian voice over foreign ones', () => {
    const spoken = [];
    vi.stubGlobal('SpeechSynthesisUtterance', class FakeUtterance {
      constructor(text) { this.text = text; }
    });
    vi.stubGlobal('speechSynthesis', {
      getVoices: () => [
        { lang: 'en-US', name: 'English' },
        { lang: 'nn-NO', name: 'Nynorsk' },
        { lang: 'nb-NO', name: 'Bokmål' },
        { lang: 'de-DE', name: 'Deutsch' },
      ],
      cancel() {},
      speak(utterance) { spoken.push(utterance); },
    });

    speakNorwegian('brød');
    expect(spoken[0].voice.name).toBe('Bokmål'); // nb beats nn/no
    expect(spoken[0].lang).toBe('nb-NO');
  });

  it('falls back to the nb-NO language tag when no norwegian voice exists', () => {
    const spoken = [];
    vi.stubGlobal('SpeechSynthesisUtterance', class FakeUtterance {
      constructor(text) { this.text = text; }
    });
    vi.stubGlobal('speechSynthesis', {
      getVoices: () => [{ lang: 'en-GB', name: 'English' }],
      cancel() {},
      speak(utterance) { spoken.push(utterance); },
    });

    speakNorwegian('brød');
    expect(spoken[0].voice).toBeUndefined();
    expect(spoken[0].lang).toBe('nb-NO');
  });
});

describe('pickNorwegianVoice', () => {
  it('returns null when nothing norwegian is installed', () => {
    expect(pickNorwegianVoice([])).toBeNull();
    expect(pickNorwegianVoice([{ lang: 'en-US' }, { lang: 'sv-SE' }])).toBeNull();
    expect(pickNorwegianVoice(undefined)).toBeNull();
  });

  it('ranks bokmål above nynorsk and the no macro tag', () => {
    const voices = [
      { lang: 'no', name: 'macro' },
      { lang: 'nn-NO', name: 'nynorsk' },
      { lang: 'nb_NO'.replace('_', '-'), name: 'bokmaal' },
    ];
    expect(pickNorwegianVoice(voices).name).toBe('bokmaal');
    expect(pickNorwegianVoice(voices.slice(0, 2)).name).toBe('nynorsk');
    expect(pickNorwegianVoice([voices[0]]).name).toBe('macro');
  });
});
