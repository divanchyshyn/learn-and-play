import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Kortkrig, HEADLINES, REX_QUIPS, mathLine, spokenMath } from './Kortkrig.jsx';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete window.speechSynthesis;
  delete window.SpeechSynthesisUtterance;
  vi.useRealTimers();
});

// Card values are random per round (each deck is a shuffled 1–20 pile), so
// the tests read whatever was actually rendered and derive expectations.
function cardValues(scope) {
  return [...scope.querySelectorAll('.battle-card.face-up .card-value')]
    .map((element) => Number(element.textContent))
    .filter((value) => !Number.isNaN(value));
}

function flipAndWait(scope) {
  fireEvent.click(screen.getByRole('button', { name: '⚔️ Slå ut!' }));
  // Rex has not flipped yet – anticipation beat, never a countdown to race.
  expect(cardValues(scope)).toHaveLength(1);
  act(() => {
    vi.advanceTimersByTime(900);
  });
  const values = cardValues(scope);
  expect(values).toHaveLength(2);
  return values;
}

function stubSpeech() {
  const speak = vi.fn();
  window.speechSynthesis = { cancel: vi.fn(), speak };
  window.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
    }
  };
  return speak;
}

describe('kortkrig battle flow', () => {
  it('flips both cards and reveals a result with math and celebration', () => {
    const view = render(<Kortkrig />);
    const [playerValue, opponentValue] = flipAndWait(view.container);

    const expectedOutcome = playerValue > opponentValue ? 'player' : opponentValue > playerValue ? 'opponent' : 'tie';
    expect(screen.getByText(mathLine('pluss', playerValue, opponentValue))).toBeInTheDocument();
    const headline = view.container.querySelector('.headline').textContent;
    expect(HEADLINES[expectedOutcome]).toContain(headline);
    expect(REX_QUIPS[expectedOutcome]).toContain(view.container.querySelector('.quip').textContent.replace('🦖', '').trim());
    expect(view.container.querySelector('.result-card')).toHaveAttribute('data-outcome', expectedOutcome);

    // Every single round gets its silly burst – win, loss or tie alike.
    expect(view.container.querySelector('.burst-layer')).toBeTruthy();
  });

  it('counts rounds played today without judging them', () => {
    const view = render(<Kortkrig />);
    const chip = view.container.querySelector('.rounds-chip');
    expect(chip).toHaveClass('hidden-chip');

    flipAndWait(view.container);
    expect(screen.getByText('⚔️ 1 slag i dag')).toBeInTheDocument();
    expect(chip).not.toHaveClass('hidden-chip');

    fireEvent.click(screen.getByRole('button', { name: 'Nytt slag ⚔️' }));
    flipAndWait(view.container);
    expect(screen.getByText('⚔️ 2 slag i dag')).toBeInTheDocument();
  });

  it('starts the next round immediately with fresh face-down cards', () => {
    const view = render(<Kortkrig />);
    flipAndWait(view.container);

    fireEvent.click(screen.getByRole('button', { name: 'Nytt slag ⚔️' }));
    expect(cardValues(view.container)).toHaveLength(0);
    expect(view.container.querySelector('.battle-card.face-up')).toBeNull();
    expect(screen.getByText('Klar til kamp? Trykk på kortet ditt!')).toBeInTheDocument();

    // No gate in between: the very next strike is one click away.
    expect(screen.getByRole('button', { name: '⚔️ Slå ut!' })).toBeEnabled();
  });

  it('switches modes any time and cancels a pending reveal instead of rushing', () => {
    const view = render(<Kortkrig />);

    fireEvent.click(screen.getByRole('button', { name: 'Minus-slag' }));
    expect(screen.getByRole('button', { name: 'Minus-slag' })).toHaveAttribute('aria-pressed', 'true');
    let [playerValue, opponentValue] = flipAndWait(view.container);
    const high = Math.max(playerValue, opponentValue);
    const low = Math.min(playerValue, opponentValue);
    expect(screen.getByText(`${high} − ${low} = ${high - low}`)).toBeInTheDocument();

    // Flip again, then bail out to another mode while Rex is still turning his card.
    fireEvent.click(screen.getByRole('button', { name: 'Nytt slag ⚔️' }));
    fireEvent.click(screen.getByRole('button', { name: '⚔️ Slå ut!' }));
    expect(cardValues(view.container)).toHaveLength(1);
    fireEvent.click(screen.getAllByRole('button', { name: 'Størst vinner' })[0]);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(cardValues(view.container)).toHaveLength(0); // board quietly reset, nobody rushed
    expect(view.container.querySelector('.result-card')).toBeNull();
    expect(screen.getByText('Klar til kamp? Trykk på kortet ditt!')).toBeInTheDocument();

    // Størst mode compares the cards without showing any arithmetic.
    const [storstPlayer, storstOpponent] = flipAndWait(view.container);
    expect(view.container.querySelector('.math-line')).toBeNull();
    expect(view.container.querySelector('.result-card')).toHaveAttribute(
      'data-outcome',
      storstPlayer > storstOpponent ? 'player' : storstOpponent > storstPlayer ? 'opponent' : 'tie',
    );
    expect(screen.getByText(/ingen regning/)).toBeInTheDocument();
  });

  it('reads the math aloud only when narration is switched on', () => {
    const speak = stubSpeech();
    render(<Kortkrig />);

    flipAndWait(document.body);
    expect(speak).not.toHaveBeenCalled(); // opt-in: silent by default

    fireEvent.click(screen.getByRole('button', { name: 'Les tallene høyt' }));
    expect(screen.getByRole('button', { name: 'Slå av opplesning' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Nytt slag ⚔️' }));
    const [playerValue, opponentValue] = flipAndWait(document.body);
    expect(speak).toHaveBeenCalledTimes(1);
    const utterance = speak.mock.calls[0][0];
    expect(utterance.lang).toBe('nb-NO');
    expect(utterance.text).toContain(spokenMath('pluss', playerValue, opponentValue));
    expect(utterance.text).toMatch(/Du vant runden!|Rex vant runden!|Uavgjort!/);
  });

  it('survives a browser without speech support when narration is on', () => {
    render(<Kortkrig />);
    fireEvent.click(screen.getByRole('button', { name: 'Les tallene høyt' }));

    expect(() => flipAndWait(document.body)).not.toThrow();
    expect(document.querySelector('.result-card')).not.toBeNull();
  });
});
