import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, screen, act } from '@testing-library/react';
import { ANIMATION_STEP_MS, BOARD_SIZE, SlangenEnLadders, cellToGridPosition } from './SlangenEnLadders.jsx';

let rollQueue;

beforeEach(() => {
  vi.useFakeTimers();
  // Rolls are fed as dice values through Math.random; anything not queued is a 4,
  // making games deterministic.
  rollQueue = [];
  vi.spyOn(Math, 'random').mockImplementation(() => {
    const value = rollQueue.length > 0 ? rollQueue.shift() : 4;
    return (value - 0.5) / 6;
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function rollButton() {
  return screen.getByRole('button', { name: 'Kast terningen' });
}

function confirmButton() {
  return screen.queryByRole('button', { name: 'Riktig' });
}

function settle(passes = 30) {
  // One runAllTimers pass fires one animation step: React commits the step and
  // its effect schedules the next timer only afterwards. Keep making passes
  // until the whole movement (worst case a long dice walk plus a slide) is done.
  for (let pass = 0; pass < passes; pass += 1) {
  act(() => { vi.runAllTimers(); });
}
}

function takeTurn() {
  settle();
  fireEvent.click(rollButton());
  fireEvent.click(confirmButton());
  settle();
}

// Expected token centre for a cell, as the left/top percentage used inline.
function expectedPosition(cell) {
  const { row, column } = cellToGridPosition(cell);
  return { left: (column * 100 + 50) / BOARD_SIZE, top: (row * 100 + 50) / BOARD_SIZE };
}

function expectTokenAt(container, toneClass, cell) {
  const token = container.querySelector(`.token.${toneClass}`);
  const wanted = expectedPosition(cell);
  expect(parseFloat(token.style.left)).toBeCloseTo(wanted.left, 5);
  expect(parseFloat(token.style.top)).toBeCloseTo(wanted.top, 5);
}

describe('slangen-en-ladders game', () => {
  it('starts with both players on cell 1 and a fresh message', () => {
    render(<SlangenEnLadders />);
    expect(screen.getByText('Kast terningen for å starte spillet.')).toBeInTheDocument();
    expect(screen.getAllByText('Rute 1')).toHaveLength(2);
    expect(rollButton()).toBeEnabled();
    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.getByText('Mål')).toBeInTheDocument();
  });

  it('rolls the dice and asks the player to read the word', () => {
    render(<SlangenEnLadders />);
    fireEvent.click(rollButton());

    // Roll is always 4 by default, so Spiller 1 lands on cell 5.
    expect(screen.getByText(/landet på rute 5/)).toBeInTheDocument();
    expect(screen.getByText(/Les høyt/)).toBeInTheDocument();

    // The board cell exposes its word through the aria-label.
    const cell = screen.getByLabelText(/^Rute 5: .+/);
    expect(cell.getAttribute('aria-label')).toMatch(/^Rute 5: \S+$/);

    // The roll button locks while a word is pending.
    expect(rollButton()).toBeDisabled();
  });

  it('walks the token through every square instead of jumping to the target', () => {
    const { container } = render(<SlangenEnLadders />);
    fireEvent.click(rollButton()); // Spiller 1 moves 1 → 5

    // First hop is already on square 2, not the target square.
    expectTokenAt(container, 'one', 2);

    // Each timer tick advances exactly one square along the path.
    act(() => { vi.advanceTimersByTime(ANIMATION_STEP_MS); });
    expectTokenAt(container, 'one', 3);
    act(() => { vi.advanceTimersByTime(ANIMATION_STEP_MS); });
    expectTokenAt(container, 'one', 4);
    act(() => { vi.advanceTimersByTime(ANIMATION_STEP_MS); });
    expectTokenAt(container, 'one', 5);

    // After the final step the movement finishes and the position stays put.
    act(() => { vi.advanceTimersByTime(ANIMATION_STEP_MS); });
    expectTokenAt(container, 'one', 5);
  });

  it('slides straight to the ladder top without visiting the squares between', () => {
    const { container } = render(<SlangenEnLadders />);
    rollQueue.push(2); // Spiller 1 lands on cell 3, the first ladder.
    settle();
    fireEvent.click(rollButton());
    // Confirm immediately, while the dice walk is still animating.
    expectTokenAt(container, 'one', 2);
    fireEvent.click(confirmButton());

    // The leftover hop of the dice roll is still walked square by square.
    expectTokenAt(container, 'one', 3);

    // The very next step is one direct slide to the ladder top, skipping cells 4–9.
    act(() => { vi.advanceTimersByTime(ANIMATION_STEP_MS); });
    expectTokenAt(container, 'one', 10);

    // The movement finishes and the token stays on the target square.
    act(() => { vi.advanceTimersByTime(ANIMATION_STEP_MS); });
    expectTokenAt(container, 'one', 10);
  });

  it('keeps the position on a plain square after the word is read and passes the turn', () => {
    render(<SlangenEnLadders />);
    takeTurn();

    expect(screen.getByText(/holder posisjonen/)).toBeInTheDocument();
    expect(screen.getAllByText(/Rute 5/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Les høyt/)).not.toBeInTheDocument();
    expect(screen.getByText('Spiller 2', { selector: '.panel-label' })).toBeInTheDocument();
    expect(rollButton()).toBeEnabled();
  });

  it('climbs the ladder at cell 3 after the word is read', () => {
    render(<SlangenEnLadders />);
    rollQueue.push(2); // Spiller 1 lands on cell 3, the first ladder.
    takeTurn();

    expect(screen.getByText(/klatrer opp til rute 10/)).toBeInTheDocument();
    expect(screen.getAllByText(/^Rute 10$/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Les høyt/)).not.toBeInTheDocument();
    expect(rollButton()).toBeEnabled();
  });

  it('slides down the snake at cell 20 to cell 11', () => {
    render(<SlangenEnLadders />);
    // Spiller 1 rolls 4, 4, 4, 4 and then 3: 1 → 5 → 9 → 13 → 17 → 20.
    while (rollQueue.length < 9) rollQueue.push(4);
    rollQueue[8] = 3;
    for (let turn = 0; turn < 9; turn += 1) takeTurn();

    expect(screen.getByText(/sklir ned til rute 11/)).toBeInTheDocument();
    expect(screen.getAllByText(/^Rute 11$/).length).toBeGreaterThan(0);
  });

  it('lets the player practise the word again without moving', () => {
    render(<SlangenEnLadders />);
    settle();
    fireEvent.click(rollButton());
    fireEvent.click(screen.getByRole('button', { name: 'Øv mer' }));
    settle();

    expect(screen.getByText(/prøv ordet én gang til/)).toBeInTheDocument();
    expect(screen.getAllByText('Rute 5').length).toBeGreaterThan(0);
    expect(screen.queryByText(/klatrer opp|sklir ned/)).not.toBeInTheDocument();
  });

  it('plays a whole game through to the winner dialog', () => {
    render(<SlangenEnLadders />);

    for (let turn = 0; turn < 300; turn += 1) {
      if (screen.queryByText(/vant!/)) break;
      settle();
      if (!rollButton().disabled) {
        fireEvent.click(rollButton());
      } else if (confirmButton()) {
        fireEvent.click(confirmButton());
      }
    }
    settle();

    expect(screen.getByText(/vant!/)).toBeInTheDocument();
    expect(screen.getByText('Spillet er ferdig')).toBeInTheDocument();
    expect(rollButton()).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Spill igjen' }));
    settle();
    expect(screen.getByText('Kast terningen for å starte spillet.')).toBeInTheDocument();
    expect(screen.getAllByText('Rute 1')).toHaveLength(2);
  });
});

