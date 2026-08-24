import { describe, it, expect } from 'vitest';
import {
  BOARD_SIZE,
  FINAL_CELL,
  WORDS,
  ROUTES,
  buildPath,
  makeWords,
  cellToGridPosition,
  getCellNumber,
} from './SlangenEnLadders.jsx';

const rowOf = (cell) => Math.floor((cell - 1) / BOARD_SIZE);

describe('slangen-en-ladders board config', () => {
  it('is a 7×7 board ending at cell 49', () => {
    expect(BOARD_SIZE).toBe(7);
    expect(FINAL_CELL).toBe(49);
  });

  it('has ladders that only go up and snakes that only go down', () => {
    for (const route of ROUTES) {
      if (route.type === 'ladder') expect(route.to).toBeGreaterThan(route.from);
      if (route.type === 'snake') expect(route.to).toBeLessThan(route.from);
    }
  });

  it('has exactly three snakes', () => {
    expect(ROUTES.filter((route) => route.type === 'snake')).toHaveLength(3);
    expect(ROUTES.filter((route) => route.type === 'ladder').length).toBeGreaterThan(0);
  });

  it('never takes a snake more than ten squares back', () => {
    for (const route of ROUTES.filter((route) => route.type === 'snake')) {
      expect(route.from - route.to, `snake ${route.from}→${route.to}`).toBeLessThanOrEqual(10);
    }
  });

  it('climbs ladders no more than two levels up', () => {
    for (const route of ROUTES.filter((route) => route.type === 'ladder')) {
      const levelsClimbed = rowOf(route.to) - rowOf(route.from);
      expect(levelsClimbed, `ladder ${route.from}→${route.to}`).toBeGreaterThanOrEqual(1);
      expect(levelsClimbed, `ladder ${route.from}→${route.to}`).toBeLessThanOrEqual(1);
    }
  });

  it('mixes snakes and ladders across both halves of the board', () => {
    const startColumn = (route) => cellToGridPosition(route.from).column;
    for (const type of ['ladder', 'snake']) {
      expect(ROUTES.some((route) => route.type === type && startColumn(route) < BOARD_SIZE / 2), `${type} on the left half`).toBe(true);
      expect(ROUTES.some((route) => route.type === type && startColumn(route) > BOARD_SIZE / 2), `${type} on the right half`).toBe(true);
    }
  });

  it('keeps every route strictly inside the playable cells', () => {
    for (const route of ROUTES) {
      expect(route.from).toBeGreaterThan(1);
      expect(route.from).toBeLessThan(FINAL_CELL);
      expect(route.to).toBeGreaterThan(1);
      expect(route.to).toBeLessThanOrEqual(FINAL_CELL);
    }
  });

  it('never starts two routes on the same cell', () => {
    const starts = ROUTES.map((route) => route.from);
    expect(new Set(starts).size).toBe(starts.length);
  });

  it('never ends a route on another route’s start cell', () => {
    const starts = new Set(ROUTES.map((route) => route.from));
    for (const route of ROUTES) {
      expect(starts.has(route.to), `route ${route.from}→${route.to}`).toBe(false);
    }
  });
});

describe('slangen-en-ladders cell numbering', () => {
  it('maps every cell to the grid and back without loss', () => {
    for (let number = 1; number <= FINAL_CELL; number += 1) {
      const { row, column } = cellToGridPosition(number);
      expect(row).toBeGreaterThanOrEqual(0);
      expect(row).toBeLessThan(BOARD_SIZE);
      expect(column).toBeGreaterThanOrEqual(0);
      expect(column).toBeLessThan(BOARD_SIZE);
      expect(getCellNumber(row, column)).toBe(number);
    }
  });

  it('snakes upward row by row (boustrophedon)', () => {
    // The bottom row runs left → right, the next row right → left, and so on.
    // With an odd number of rows the top row runs left → right again, ending
    // at 49 in the top-right corner.
    expect(getCellNumber(BOARD_SIZE - 1, 0)).toBe(1);
    expect(getCellNumber(BOARD_SIZE - 1, BOARD_SIZE - 1)).toBe(BOARD_SIZE);
    expect(getCellNumber(BOARD_SIZE - 2, BOARD_SIZE - 1)).toBe(BOARD_SIZE + 1);
    expect(getCellNumber(BOARD_SIZE - 2, 0)).toBe(2 * BOARD_SIZE);
    expect(getCellNumber(0, 0)).toBe(FINAL_CELL - BOARD_SIZE + 1);
    expect(getCellNumber(0, BOARD_SIZE - 1)).toBe(FINAL_CELL);
  });
});

describe('slangen-en-ladders token path', () => {
  it('steps through every square on a normal move', () => {
    expect(buildPath(1, 5)).toEqual([2, 3, 4, 5]);
  });

  it('walks backwards down a snake one square at a time', () => {
    expect(buildPath(41, 32)).toEqual([40, 39, 38, 37, 36, 35, 34, 33, 32]);
  });

  it('handles single-square moves', () => {
    expect(buildPath(7, 8)).toEqual([8]);
  });
});

describe('slangen-en-ladders words', () => {
  it('has a word bank without duplicates', () => {
    expect(new Set(WORDS).size).toBe(WORDS.length);
  });

  it('deals one unique word onto every playable cell', () => {
    for (let trial = 0; trial < 20; trial += 1) {
      const words = makeWords();
      // The bank is much larger than the board, so exactly enough words are
      // dealt onto cells 2…48; cell 49 shows “Mål”.
      expect(words.length).toBeGreaterThanOrEqual(FINAL_CELL + 1);
      expect(words[0]).toBe('');
      expect(words[1]).toBe('');

      const dealt = words.slice(2, FINAL_CELL);
      expect(dealt.every((word) => word.length > 0)).toBe(true);
      expect(new Set(dealt).size).toBe(dealt.length);
      for (const word of dealt) expect(WORDS).toContain(word);
    }
  });
});

