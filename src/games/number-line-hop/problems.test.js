import { describe, it, expect, afterEach, vi } from 'vitest';
import { PROBLEM_BANK, nextProblem, norwegianNumber, problemAnswer, problemSpeech, problemText } from './problems.js';

describe('tierhopp problem bank', () => {
  it('holds a large mixed bank of additions and subtractions', () => {
    expect(PROBLEM_BANK.length).toBeGreaterThanOrEqual(40);
    expect(PROBLEM_BANK.some((problem) => problem.op === '+')).toBe(true);
    expect(PROBLEM_BANK.some((problem) => problem.op === '-')).toBe(true);
  });

  it('keeps every problem whole, sensible and on the 0–100 line', () => {
    for (const problem of PROBLEM_BANK) {
      expect(Number.isInteger(problem.a)).toBe(true);
      expect(Number.isInteger(problem.b)).toBe(true);
      expect(problem.a).toBeGreaterThanOrEqual(0);
      expect(problem.b).toBeGreaterThanOrEqual(1);
      if (problem.op === '-') {
        // Subtraction may never leave the line at the bottom.
        expect(problem.a).toBeGreaterThan(problem.b);
      }
      const answer = problemAnswer(problem);
      expect(answer).toBeGreaterThanOrEqual(0);
      expect(answer).toBeLessThanOrEqual(100);
    }
  });

  it('never repeats the exact same problem', () => {
    const seen = new Set(PROBLEM_BANK.map((problem) => `${problem.a}${problem.op}${problem.b}`));
    expect(seen.size).toBe(PROBLEM_BANK.length);
  });

  it('spreads practice across ten-boundary crossings and plain sums', () => {
    // Addition that carries over a ten (8 + 5 style) ...
    const carrying = PROBLEM_BANK.filter((p) => p.op === '+' && (p.a % 10) + (p.b % 10) >= 10);
    // ... and subtraction that borrows back across one (32 − 7 style).
    const borrowing = PROBLEM_BANK.filter((p) => p.op === '-' && (p.b % 10) > (p.a % 10));
    expect(carrying.length).toBeGreaterThanOrEqual(8);
    expect(borrowing.length).toBeGreaterThanOrEqual(8);

    // Difficulty spread: some tiny answers, plenty of bigger two-digit ones.
    const answers = PROBLEM_BANK.map(problemAnswer);
    expect(answers.filter((value) => value <= 10).length).toBeGreaterThanOrEqual(5);
    expect(answers.filter((value) => value >= 50).length).toBeGreaterThanOrEqual(10);
  });

  it('includes the two shapes called out in the design notes', () => {
    expect(PROBLEM_BANK.some((p) => p.op === '+' && p.a === 8 && p.b === 5)).toBe(true); // crosses a ten
    expect(PROBLEM_BANK.some((p) => p.op === '+' && p.a === 20 && p.b === 5)).toBe(true); // stays inside one
  });
});

describe('tierhopp read-aloud helpers', () => {
  it.each([
    [0, 'null'],
    [7, 'sju'],
    [14, 'fjorten'],
    [20, 'tjue'],
    [21, 'tjueen'],
    [40, 'førti'],
    [52, 'femtito'],
    [68, 'sekstiåtte'],
    [100, 'hundre'],
  ])('says %i as "%s"', (value, word) => {
    expect(norwegianNumber(value)).toBe(word);
  });

  it('speaks the whole problem the way a teacher would', () => {
    expect(problemSpeech({ a: 14, b: 6, op: '+' })).toBe('fjorten pluss seks');
    expect(problemSpeech({ a: 12, b: 5, op: '-' })).toBe('tolv minus fem');
  });

  it('formats problems for the screen with spaced operators', () => {
    expect(problemText({ a: 14, b: 6, op: '+' })).toBe('14 + 6');
    expect(problemText({ a: 99, b: 47, op: '-' })).toBe('99 - 47');
  });
});

describe('tierhopp nextProblem', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('never deals the same problem twice in a row', () => {
    let current = null;
    for (let round = 0; round < 80; round += 1) {
      const next = nextProblem(current);
      expect(next).not.toBe(current);
      current = next;
    }
  });

  it('still moves on when randomness repeats itself (pinned Math.random)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    // Every draw returns the first bank item, so the fallback must step aside.
    expect(nextProblem(PROBLEM_BANK[0])).toBe(PROBLEM_BANK[1]);
    expect(nextProblem(null)).toBe(PROBLEM_BANK[0]);
  });
});
