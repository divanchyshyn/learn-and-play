import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, act, screen, within } from '@testing-library/react';
import { LydLabyrint } from './LydLabyrint.jsx';

// Math.random is pinned so the game always starts on the first maze
// (Skogen, start cell 1,8) and shuffles become deterministic.
beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

function renderGame() {
  return render(<LydLabyrint />);
}

function press(view, key) {
  act(() => {
    fireEvent.keyDown(window, { key });
  });
}

// One ordinary step plus enough time for the movement lock to clear.
function step(view, key) {
  press(view, key);
  act(() => {
    vi.advanceTimersByTime(200);
  });
}

// Walking through a door: open animation, step into the doorway,
// auto-continue past it, and the lock release.
function throughDoor(view, key) {
  press(view, key);
  act(() => {
    vi.advanceTimersByTime(800);
  });
}

function runnerPosition(view) {
  const runner = view.container.querySelector('.runner');
  return {
    x: runner.style.getPropertyValue('--tx'),
    y: runner.style.getPropertyValue('--ty'),
  };
}

describe('lyd-labyrint game', () => {
  it('renders a board with word signs and the fox on the start cell', () => {
    const view = renderGame();
    expect(runnerPosition(view)).toEqual({ x: '1', y: '8' });
    expect(screen.getByText(/Skogen/)).toBeInTheDocument();
    // Skogen has four junctions with two doors each.
    expect(screen.getAllByRole('button', { name: /Hør ordet/ })).toHaveLength(8);
  });

  it('moves with arrow keys and bumps into walls without moving', () => {
    const view = renderGame();
    step(view, 'ArrowRight');
    expect(runnerPosition(view)).toEqual({ x: '2', y: '8' });

    // Above column 2 row 8 is wall – the fox must stay put.
    step(view, 'ArrowUp');
    expect(runnerPosition(view)).toEqual({ x: '2', y: '8' });
  });

  it('gives a gentle bounce on a wrong door and never opens it', () => {
    const view = renderGame();
    for (let i = 0; i < 4; i += 1) step(view, 'ArrowRight');
    expect(runnerPosition(view)).toEqual({ x: '5', y: '8' }); // junction

    // Door "a" north of the junction is the bounce-back door.
    press(view, 'ArrowUp');
    expect(runnerPosition(view)).toEqual({ x: '5', y: '8' });
    expect(view.container.querySelector('.door-panel.shake')).toBeTruthy();
    expect(view.container.querySelector('.door-panel.open')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(450); // bounce finished, lock released
    });
    expect(view.container.querySelector('.door-panel.shake')).toBeNull();
    expect(view.container.querySelector('.door-panel.open')).toBeNull();

    // The fox is free to try again or take the other door immediately.
    throughDoor(view, 'ArrowRight');
    expect(view.container.querySelector('.door-panel.open')).toBeTruthy();
  });

  it('speaks a word when its sign is tapped', () => {
    const spoken = [];
    vi.stubGlobal('SpeechSynthesisUtterance', class FakeUtterance {
      constructor(text) { this.text = text; }
    });
    vi.stubGlobal('speechSynthesis', {
      cancel() {},
      speak(utterance) { spoken.push(utterance.text); },
    });

    renderGame();
    const sign = screen.getAllByRole('button', { name: /Hør ordet/ })[0];
    fireEvent.click(sign);

    expect(spoken).toEqual([sign.textContent]);
    vi.unstubAllGlobals();
  });

  it('plays through to the exit, celebrates, and starts a fresh maze', () => {
    const view = renderGame();

    // Solution path for Skogen: east corridor → door A, north-east corridor
    // → door B, north corridor → west door C, west corridor → north door D,
    // then out through the exit.
    for (let i = 0; i < 4; i += 1) step(view, 'ArrowRight');
    throughDoor(view, 'ArrowRight');            // A – correct
    for (let i = 0; i < 3; i += 1) step(view, 'ArrowRight');
    throughDoor(view, 'ArrowUp');               // B – correct
    step(view, 'ArrowUp');
    step(view, 'ArrowUp');
    throughDoor(view, 'ArrowLeft');             // C – correct
    for (let i = 0; i < 3; i += 1) step(view, 'ArrowLeft');
    throughDoor(view, 'ArrowUp');               // D – correct
    step(view, 'ArrowUp');                      // onto the exit ✨

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(screen.getByText('Du fant veien ut!')).toBeInTheDocument();

    // Two "Nytt labyrint" buttons exist while celebrating (header chip +
    // card); use the one inside the celebration card.
    const card = screen.getByText('Du fant veien ut!').closest('.celebrate-card');
    fireEvent.click(within(card).getByRole('button', { name: /Ny labyrint/ }));

    expect(screen.queryByText('Du fant veien ut!')).not.toBeInTheDocument();
    expect(screen.getByText(/Havet/)).toBeInTheDocument();
    expect(runnerPosition(view)).toEqual({ x: '1', y: '11' }); // Havet start
  });

  it('offers an always-available restart from the header', () => {
    const view = renderGame();
    fireEvent.click(screen.getByRole('button', { name: /Nytt labyrint/ }));
    expect(screen.getByText(/Havet/)).toBeInTheDocument();
    expect(runnerPosition(view)).toEqual({ x: '1', y: '11' });
  });
});
