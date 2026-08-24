import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, act, screen, cleanup } from '@testing-library/react';
import { Tierhopp, TIMING } from './Tierhopp.jsx';
import { PROBLEM_BANK } from './problems.js';

// With Math.random pinned at 0 the first problem is always the first bank
// item (3 + 4) and the "never twice in a row" fallback deals the second one
// (6 + 2) afterwards – a fully deterministic round trip to test against.
const FIRST_SUM = `${PROBLEM_BANK[0].a} ${PROBLEM_BANK[0].op} ${PROBLEM_BANK[0].b}`;
const SECOND_SUM = `${PROBLEM_BANK[1].a} ${PROBLEM_BANK[1].op} ${PROBLEM_BANK[1].b}`;
const STRIP_WIDTH = 1000;

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0);
  vi.useFakeTimers();
  // jsdom has no layout; give every element a fixed geometry so taps map to
  // line values through getBoundingClientRect.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, right: STRIP_WIDTH, bottom: 200, width: STRIP_WIDTH, height: 200, x: 0, y: 0, toJSON: () => {},
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.localStorage.clear();
  cleanup();
});

function advance(ms) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function tapStrip(view, value) {
  fireEvent.click(view.container.querySelector('.number-strip'), { clientX: (value / 100) * STRIP_WIDTH });
}

function frogLeft(view) {
  return view.container.querySelector('.frog').style.left;
}

function playWholeRound(view, tappedValue) {
  tapStrip(view, tappedValue);
  advance(TIMING.HOP_MS);
  advance(TIMING.REVEAL_MS);
  advance(TIMING.ADJUST_MS); // harmless when no adjustment was needed
  advance(TIMING.CELEBRATE_MS);
}

describe('tierhopp rendered game', () => {
  it('opens ready to hop: problem up, frog at 0, nothing to configure', () => {
    const view = render(<Tierhopp />);

    expect(screen.getByText(FIRST_SUM)).toBeInTheDocument();
    expect(frogLeft(view)).toBe('0%');
    expect(screen.getByText(/Hvor skal frosken hoppe/)).toBeInTheDocument();
    expect(view.container.querySelector('.number-strip')).toBeTruthy();
  });

  it('hops wherever the player points, then reveals the answer as information', () => {
    const view = render(<Tierhopp />);

    // A wild tap still produces the hop – that is the whole point.
    tapStrip(view, 70);
    expect(frogLeft(view)).toBe('70%');

    // One hop per round: mid-flight taps are calmly ignored.
    tapStrip(view, 95);
    expect(frogLeft(view)).toBe('70%');

    advance(TIMING.HOP_MS);
    const flag = view.container.querySelector('.answer-flag');
    expect(flag).toBeTruthy();
    expect(flag.style.left).toBe('7%');
    // The solved equation is shown as neutral information.
    expect(view.container.querySelector('.problem-sum').textContent).toBe(`${FIRST_SUM} = 7`);
  });

  it('gently finishes the journey when the tap was off, then moves on by itself', () => {
    const view = render(<Tierhopp />);
    tapStrip(view, 70);

    advance(TIMING.HOP_MS);
    advance(TIMING.REVEAL_MS);
    // The small extra hop lands the frog on the flag.
    expect(frogLeft(view)).toBe('7%');

    advance(TIMING.ADJUST_MS);
    expect(document.querySelector('.confetti-layer')).toBeTruthy();
    // The reward beat is the arrival itself – "Framme!", not a verdict.
    expect(view.container.querySelector('.cheer-banner').textContent).toContain('Framme');
    advance(TIMING.CELEBRATE_MS);
    // Next problem arrives unprompted; the journey simply continues from 7.
    expect(screen.getByText(SECOND_SUM)).toBeInTheDocument();
    expect(frogLeft(view)).toBe('7%');
    expect(view.container.querySelector('.cheer-banner')).toBeNull();
  });

  it('treats a near-enough tap as landed exactly and goes straight to the party', () => {
    const view = render(<Tierhopp />);
    tapStrip(view, 8); // one unit from the answer 7 – inside the tolerance

    advance(TIMING.HOP_MS);
    expect(frogLeft(view)).toBe('8%');

    advance(TIMING.REVEAL_MS);
    expect(document.querySelector('.confetti-layer')).toBeTruthy();
    // No adjusting hop happened: the frog never left its chosen spot.
    expect(frogLeft(view)).toBe('8%');

    advance(TIMING.CELEBRATE_MS);
  });

  it('never shows failure language, scores or timers, even after rounds of play', () => {
    const view = render(<Tierhopp />);
    playWholeRound(view, 70);
    playWholeRound(view, 50);

    expect(screen.queryByText(/feil|riktig|galt|poeng|prosent|score/i)).not.toBeInTheDocument();
    expect(document.querySelector('.confetti-layer')).toBeFalsy();
  });

  it('reads the problem aloud in Norwegian when asked', () => {
    const spoken = [];
    vi.stubGlobal('SpeechSynthesisUtterance', class FakeUtterance {
      constructor(text) { this.text = text; }
    });
    vi.stubGlobal('speechSynthesis', {
      cancel() {},
      speak(utterance) { spoken.push(utterance.text); },
    });

    render(<Tierhopp />);
    fireEvent.click(screen.getByRole('button', { name: 'Hør regnestykket' }));

    expect(spoken).toEqual(['tre pluss fire']);
    vi.unstubAllGlobals();
  });

  it('mutes from the header and remembers the choice', () => {
    render(<Tierhopp />);

    fireEvent.click(screen.getByRole('button', { name: 'Slå av lyd' }));
    expect(window.localStorage.getItem('tierhopp:muted')).toBe('1');
    expect(screen.getByRole('button', { name: 'Slå på lyd' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Slå på lyd' }));
    expect(window.localStorage.getItem('tierhopp:muted')).toBe('0');
  });

  it('starts a fresh journey from 0 on demand', () => {
    const view = render(<Tierhopp />);
    playWholeRound(view, 70);
    expect(frogLeft(view)).toBe('7%');

    fireEvent.click(screen.getByRole('button', { name: /Nytt spor/ }));

    expect(frogLeft(view)).toBe('0%');
    expect(screen.getByText(FIRST_SUM)).toBeInTheDocument();
    // And the strip answers taps again straight away.
    tapStrip(view, 50);
    expect(frogLeft(view)).toBe('50%');
  });

  it('supports keyboard aiming along the line for players who prefer keys', () => {
    const view = render(<Tierhopp />);
    const strip = view.container.querySelector('.number-strip');

    fireEvent.keyDown(strip, { key: 'ArrowRight' });
    expect(view.container.querySelector('.aim-marker').style.left).toBe('1%');
    fireEvent.keyDown(strip, { key: 'ArrowRight', shiftKey: true }); // tens move fast
    expect(view.container.querySelector('.aim-marker').style.left).toBe('11%');

    fireEvent.keyDown(strip, { key: 'Enter' });
    expect(frogLeft(view)).toBe('11%');
    advance(TIMING.HOP_MS);
    expect(view.container.querySelector('.answer-flag')).toBeTruthy();
  });
});

