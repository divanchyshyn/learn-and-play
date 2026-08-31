import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, act, screen, within } from '@testing-library/react';
import { THEMES, generateMaze } from './mazes.js';
import { pickWords, WORDS_BY_THEME } from './words.js';
import { shuffle } from '../../shared/random.js';
import { applyDrop, scrambleLetters } from './SpellPuzzle.jsx';
import { LydLabyrint } from './LydLabyrint.jsx';

const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];

// The game carves a fresh maze with whatever Math.random says; pinning it to
// 0 keeps every maze deterministic while also letting tests regenerate the
// very same layout the component sees.
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

function advance(ms) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function runnerPosition(view) {
  const runner = view.container.querySelector('.runner');
  return {
    x: Number(runner.style.getPropertyValue('--tx')),
    y: Number(runner.style.getPropertyValue('--ty')),
  };
}

// Regenerate the exact starting game (Skogen with the pinned random) so the
// tests know where the doors are and which animal word sits on each.
function expectedGame() {
  const maze = generateMaze({ ...THEMES[0], random: Math.random });
  const words = shuffle(pickWords(maze.doors.length, maze.theme, Math.random));
  const doors = maze.doors.map((door, index) => ({
    ...door,
    ...words[index % words.length],
  }));
  return { maze, doors };
}

function routeBetween(maze, from, to) {
  const prev = new Map();
  const startKey = `${from.x},${from.y}`;
  prev.set(startKey, null);
  const queue = [{ ...from }];
  while (queue.length > 0) {
    const cell = queue.shift();
    if (cell.x === to.x && cell.y === to.y) break;
    for (const [dx, dy] of DIRS) {
      const key = `${cell.x + dx},${cell.y + dy}`;
      if (maze.floors.has(key) && !prev.has(key)) {
        prev.set(key, cell);
        queue.push({ x: cell.x + dx, y: cell.y + dy });
      }
    }
  }
  const route = [];
  const endKey = `${to.x},${to.y}`;
  let key = endKey;
  while (key) {
    const [x, y] = key.split(',').map(Number);
    route.unshift({ x, y });
    if (key === startKey) break;
    const parent = prev.get(key);
    key = parent ? `${parent.x},${parent.y}` : '';
  }
  return route;
}

function dirFor(from, to) {
  if (to.x === from.x + 1) return 'ArrowRight';
  if (to.x === from.x - 1) return 'ArrowLeft';
  if (to.y === from.y + 1) return 'ArrowDown';
  return 'ArrowUp';
}

function doorAt(expected, x, y) {
  return expected.doors.find((door) => door.x === x && door.y === y);
}

// Tap the letter tiles (each tap fills the next slot) and then submit the
// built word with the «Sjekk svaret» check button.
function solveSpell(view, word) {
  for (const letter of [...word]) {
    const tile = screen.getAllByRole('button', { name: `Bokstaven ${letter}` })[0];
    fireEvent.click(tile);
  }
  fireEvent.click(screen.getByRole('button', { name: /Sjekk/ }));
}

// Walk the fox along a route of floor cells, solving any door it meets, until
// it stands on `until` (defaults to the route's last cell).
function walkRoute(view, expected, route, { until } = {}) {
  const end = until ?? route[route.length - 1];
  let guard = 0;
  while (guard < route.length * 4) {
    const pos = runnerPosition(view);
    if (pos.x === end.x && pos.y === end.y) return;
    const index = route.findIndex((cell) => cell.x === pos.x && cell.y === pos.y);
    if (index === -1 || index === route.length - 1) return;
    const to = route[index + 1];
    const door = doorAt(expected, to.x, to.y);
    press(view, dirFor(pos, to));
    if (door) {
      const dialog = screen.getByRole('dialog');
      expect(dialog.getAttribute('aria-label')).toBe(`Stav ordet ${door.word}`);
      solveSpell(view, door.word);
      advance(1000);
    } else {
      advance(200);
    }
    guard += 1;
  }
  throw new Error('walkRoute could not reach its target');
}
function arrowFor([dx, dy]) {
  if (dx === 1) return 'ArrowRight';
  if (dx === -1) return 'ArrowLeft';
  if (dy === 1) return 'ArrowDown';
  return 'ArrowUp';
}

describe('lyd-labyrint spelling puzzle helpers', () => {
  it('scrambleLetters returns a full permutation of the word', () => {
    for (const word of ['rev', 'bever', 'hval']) {
      const letters = scrambleLetters(word, () => 0);
      expect([...letters].sort().join('')).toBe([...word].sort().join(''));
      expect(letters).toHaveLength(word.length);
    }
  });

  it('applyDrop places a tray tile on any empty slot and leaves it empty on top', () => {
    const result = applyDrop({
      slots: [null, null, null],
      tray: ['e', 'v', 'r'],
      active: { letter: 'e', area: 'tray', index: 0 },
      slot: 1,
    });
    expect(result.changed).toBe(true);
    expect(result.slots).toEqual([null, 'e', null]);
    // The top row keeps every position; the moved letter's spot stays empty.
    expect(result.tray).toEqual([null, 'v', 'r']);
  });

  it('applyDrop swaps a tray tile onto an occupied slot and keeps the top row whole', () => {
    const result = applyDrop({
      slots: ['r', null, null],
      tray: ['e', 'v', 'r'],
      active: { letter: 'e', area: 'tray', index: 0 },
      slot: 0,
    });
    expect(result.changed).toBe(true);
    expect(result.slots).toEqual(['e', null, null]);
    // The displaced letter returns to the first free top slot (the freed one).
    expect(result.tray).toEqual(['r', 'v', 'r']);
  });

  it('applyDrop swaps letters between slots', () => {
    const result = applyDrop({
      slots: ['r', 'e', 'v'],
      tray: [],
      active: { letter: 'e', area: 'slot', index: 1 },
      slot: 2,
    });
    expect(result.changed).toBe(true);
    expect(result.slots).toEqual(['r', 'v', 'e']);
    expect(result.tray).toEqual([]);
  });

  it('applyDrop leaves an out-of-range drop untouched', () => {
    const slots = [null, null, null];
    const tray = ['e', 'v', 'r'];
    const result = applyDrop({
      slots,
      tray,
      active: { letter: 'e', area: 'tray', index: 0 },
      slot: 99,
    });
    expect(result.changed).toBe(false);
    expect(result.slots).toBe(slots);
    expect(result.tray).toBe(tray);
  });

  it('applyDrop drags a slot letter back to an empty top spot', () => {
    const result = applyDrop({
      slots: ['r', 'e', 'v'],
      tray: [null, null, null],
      active: { letter: 'v', area: 'slot', index: 2 },
      traySpot: 0,
    });
    expect(result.changed).toBe(true);
    expect(result.slots).toEqual(['r', 'e', null]);
    expect(result.tray).toEqual(['v', null, null]);
  });

  it('applyDrop swaps a slot letter with an occupied top spot', () => {
    const result = applyDrop({
      slots: ['r', null, 'e'],
      tray: ['v', null, null],
      active: { letter: 'e', area: 'slot', index: 2 },
      traySpot: 0,
    });
    expect(result.changed).toBe(true);
    expect(result.slots).toEqual(['r', null, 'v']);
    expect(result.tray).toEqual(['e', null, null]);
  });

  it('applyDrop reorders letters within the top row', () => {
    const result = applyDrop({
      slots: [null, null, null],
      tray: ['e', 'v', 'r'],
      active: { letter: 'e', area: 'tray', index: 0 },
      traySpot: 2,
    });
    expect(result.changed).toBe(true);
    expect(result.slots).toEqual([null, null, null]);
    expect(result.tray).toEqual(['r', 'v', 'e']);
  });
});

describe('lyd-labyrint game', () => {
  it('renders a fresh themed maze with tappable habitat animal doors', () => {
    const view = renderGame();
    const expected = expectedGame();
    expect(runnerPosition(view)).toEqual({ x: 1, y: 1 });
    expect(screen.getByText(/Skogen/)).toBeInTheDocument();

    const board = view.container.querySelector('.board');
    expect(Number(board.style.getPropertyValue('--cw'))).toBe(expected.maze.width);
    expect(Number(board.style.getPropertyValue('--ch'))).toBe(expected.maze.height);

    expect(screen.getAllByRole('button', { name: /Hør ordet/ })).toHaveLength(expected.doors.length);
    const habitatEmojis = WORDS_BY_THEME.skog.map((entry) => entry.emoji);
    for (const picture of view.container.querySelectorAll('.door-picture')) {
      expect(habitatEmojis).toContain(picture.textContent);
    }
    // The runner is the forest mascot, not a single global fox.
    expect(view.container.querySelector('.runner').textContent).toBe('🦊');
  });

  it('moves with arrow keys and bumps into walls without moving', () => {
    const view = renderGame();
    const maze = expectedGame().maze;
    const openDir = DIRS.find(([dx, dy]) => maze.floors.has(`${1 + dx},${1 + dy}`));
    press(view, arrowFor(openDir));
    advance(200);
    const moved = runnerPosition(view);
    expect(moved).not.toEqual({ x: 1, y: 1 });

    const blockedDir = DIRS.find(([dx, dy]) => !maze.floors.has(`${moved.x + dx},${moved.y + dy}`));
    expect(blockedDir).toBeTruthy();
    press(view, arrowFor(blockedDir));
    expect(runnerPosition(view)).toEqual(moved);
    advance(250);
    expect(runnerPosition(view)).toEqual(moved);
  });
it('places letters freely, shakes red on a wrong spelling, and unlocks on check', () => {
    const view = renderGame();
    const expected = expectedGame();
    const door = expected.doors[0];
    const route = routeBetween(expected.maze, expected.maze.start, door);
    const before = route[route.length - 2];
    walkRoute(view, expected, route, { until: before });

    press(view, dirFor(before, door));
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-label')).toBe(`Stav ordet ${door.word}`);
    expect(runnerPosition(view)).toEqual(before);

    // Letters may sit in any slot – a wrong order fills the row anyway.
    const reversed = [...door.word].reverse();
    for (const letter of reversed) {
      fireEvent.click(screen.getAllByRole('button', { name: `Bokstaven ${letter}` })[0]);
    }
    const spelled = [...dialog.querySelectorAll('.spell-slot')].map((slot) => slot.textContent);
    expect(spelled.join('')).toBe(reversed.join(''));

    // The top row keeps every position: moved letters leave empty slots behind.
    // After placing every letter, the tray shows one empty slot per letter.
    expect(dialog.querySelectorAll('.spell-tile, .spell-tray-empty').length).toBe(door.word.length);
    expect(dialog.querySelectorAll('.spell-tray-empty').length).toBe(door.word.length);
    expect(dialog.querySelectorAll('.spell-tile').length).toBe(0);

    // Checking the wrong order shakes the card red and keeps the door shut.
    const openBefore = view.container.querySelectorAll('.door-panel.open').length;
    fireEvent.click(screen.getByRole('button', { name: /Sjekk/ }));
    expect(dialog.classList.contains('wrong')).toBe(true);
    expect(screen.getByText(/Ikke riktig/)).toBeInTheDocument();
    advance(800);
    expect(view.container.querySelectorAll('.door-panel.open').length).toBe(openBefore);

    // Reorder: return every placed letter, spell it right, check again.
    for (const slot of [...dialog.querySelectorAll('.spell-slot.filled')]) fireEvent.click(slot);
    solveSpell(view, door.word);
    advance(1000);
    expect(view.container.querySelectorAll('.door-panel.open').length).toBeGreaterThan(openBefore);
    expect(screen.queryByRole('dialog')).toBeNull();
    // The runner steps onto the solved door tile, not past it.
    expect(runnerPosition(view)).toEqual({ x: door.x, y: door.y });
  });

  it('can close a lock without solving it, and no new door ever opens', () => {
    const view = renderGame();
    const expected = expectedGame();
    const door = expected.doors[0];
    const route = routeBetween(expected.maze, expected.maze.start, door);
    const before = route[route.length - 2];
    walkRoute(view, expected, route, { until: before });

    // Walking here may have solved other doors; count what is open already.
    const openCount = () => view.container.querySelectorAll('.door-panel.open').length;
    const openedBefore = openCount();

    press(view, dirFor(before, door));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Lukk/ }));
    advance(50);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(openCount()).toBe(openedBefore);

    // Reopening and pressing Escape also just steps away, door still locked.
    press(view, dirFor(before, door));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    press(view, 'Escape');
    advance(50);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(openCount()).toBe(openedBefore);
  });

  it('speaks a word when its door is tapped', () => {
    const spoken = [];
    vi.stubGlobal('SpeechSynthesisUtterance', class FakeUtterance {
      constructor(text) { this.text = text; }
    });
    vi.stubGlobal('speechSynthesis', {
      cancel() {},
      speak(utterance) { spoken.push(utterance.text); },
    });

    renderGame();
    const doorButton = screen.getAllByRole('button', { name: /Hør ordet/ })[0];
    const word = doorButton.getAttribute('aria-label').replace('Hør ordet ', '');
    fireEvent.click(doorButton);

    expect(spoken).toEqual([word]);
    vi.unstubAllGlobals();
  });

  it('plays through to the exit, celebrates, and starts a fresh maze', () => {
    const view = renderGame();
    const expected = expectedGame();
    const route = routeBetween(expected.maze, expected.maze.start, expected.maze.exit);
    walkRoute(view, expected, route);
    expect(runnerPosition(view)).toEqual({ x: expected.maze.exit.x, y: expected.maze.exit.y });

    advance(600);
    expect(screen.getByText('Du fant veien ut!')).toBeInTheDocument();

    const card = screen.getByText('Du fant veien ut!').closest('.celebrate-card');
    fireEvent.click(within(card).getByRole('button', { name: /Ny labyrint/ }));

    expect(screen.queryByText('Du fant veien ut!')).not.toBeInTheDocument();
    expect(screen.getByText(/Havet/)).toBeInTheDocument();
    expect(runnerPosition(view)).toEqual({ x: 1, y: 1 });
    expect(screen.getAllByRole('button', { name: /Hør ordet/ }).length).toBeGreaterThanOrEqual(5);
  });

  it('offers an always-available restart from the header', () => {
    const view = renderGame();
    fireEvent.click(screen.getByRole('button', { name: /Nytt labyrint/ }));
    expect(screen.getByText(/Havet/)).toBeInTheDocument();
    expect(runnerPosition(view)).toEqual({ x: 1, y: 1 });
    // The ocean maze swaps the forest fox for a sea turtle.
    expect(view.container.querySelector('.runner').textContent).toBe('🐢');
  });
});