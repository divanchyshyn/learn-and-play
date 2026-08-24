import { describe, it, expect } from 'vitest';
import {
  BOARD_SIZE,
  FINAL_CELL,
  WORDS,
  ROUTES,
  makeWords,
  cellToGridPosition,
  getCellNumber,
} from './SlangenEnLadders.jsx';

describe('slangen-en-ladders board config', () => {
  it('is an 8×8 board ending at cell 64', () => {
    expect(BOARD_SIZE).toBe(8);
    expect(FINAL_CELL).toBe(64);
  });

  it('has ladders that only go up and snakes that only go down', () => {
    for (const route of ROUTES) {
      if (route.type === 'ladder') expect(route.to).toBeGreaterThan(route.from);
      if (route.type === 'snake') expect(route.to).toBeLessThan(route.from);
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
    // Bottom row runs left → right, next row right → left, and so on. With an
    // even number of rows the top row also runs right → left, ending at 64.
    expect(getCellNumber(BOARD_SIZE - 1, 0)).toBe(1);
    expect(getCellNumber(BOARD_SIZE - 1, BOARD_SIZE - 1)).toBe(BOARD_SIZE);
    expect(getCellNumber(BOARD_SIZE - 2, BOARD_SIZE - 1)).toBe(BOARD_SIZE + 1);
    expect(getCellNumber(BOARD_SIZE - 2, 0)).toBe(2 * BOARD_SIZE);
    expect(getCellNumber(0, 0)).toBe(FINAL_CELL);
    expect(getCellNumber(0, BOARD_SIZE - 1)).toBe(FINAL_CELL - BOARD_SIZE + 1);
  });
});

describe('slangen-en-ladders words', () => {
  it('has a word bank without duplicates', () => {
    expect(new Set(WORDS).size).toBe(WORDS.length);
  });

  it('deals one unique word onto every playable cell', () => {
    for (let trial = 0; trial < 20; trial += 1) {
      const words = makeWords();
      // The bank holds one spare word (64 words, 63 playable cells), so the
      // array may be one slot longer than the board.
      expect(words.length).toBeGreaterThanOrEqual(FINAL_CELL + 1);
      expect(words[0]).toBe('');
      expect(words[1]).toBe('');

      const dealt = words.slice(2, FINAL_CELL + 1);
      expect(dealt.every((word) => word.length > 0)).toBe(true);
      expect(new Set(dealt).size).toBe(dealt.length);
      for (const word of dealt) expect(WORDS).toContain(word);
    }
  });
});
