// Tierhopp's practice content: a handcrafted bank of 2nd-grade addition and
// subtraction problems plus the Norwegian read-aloud helpers. Everything in
// here is pure so tests can pin Math.random and check the rules directly.
import { pickOne } from '../../shared/random.js';

// The problem bank. A deliberate mix of shapes:
// - sums inside a single ten (20 + 5) and across a ten boundary (8 + 5),
// - subtraction that stays put (30 - 10) and borrows across a ten (32 - 7),
// - answers from small single digits up to 100.
export const PROBLEM_BANK = [
  { a: 3, b: 4, op: '+' },
  { a: 6, b: 2, op: '+' },
  { a: 5, b: 5, op: '+' },
  { a: 10, b: 5, op: '+' },
  { a: 8, b: 5, op: '+' },
  { a: 9, b: 3, op: '+' },
  { a: 7, b: 6, op: '+' },
  { a: 14, b: 6, op: '+' },
  { a: 12, b: 7, op: '+' },
  { a: 16, b: 4, op: '+' },
  { a: 20, b: 5, op: '+' },
  { a: 25, b: 10, op: '+' },
  { a: 27, b: 6, op: '+' },
  { a: 31, b: 9, op: '+' },
  { a: 34, b: 12, op: '+' },
  { a: 28, b: 14, op: '+' },
  { a: 38, b: 22, op: '+' },
  { a: 42, b: 17, op: '+' },
  { a: 45, b: 25, op: '+' },
  { a: 46, b: 38, op: '+' },
  { a: 55, b: 35, op: '+' },
  { a: 57, b: 13, op: '+' },
  { a: 61, b: 18, op: '+' },
  { a: 66, b: 23, op: '+' },
  { a: 71, b: 9, op: '+' },
  { a: 44, b: 28, op: '+' },
  { a: 50, b: 50, op: '+' },
  { a: 5, b: 3, op: '-' },
  { a: 10, b: 4, op: '-' },
  { a: 12, b: 5, op: '-' },
  { a: 15, b: 8, op: '-' },
  { a: 20, b: 6, op: '-' },
  { a: 30, b: 10, op: '-' },
  { a: 24, b: 12, op: '-' },
  { a: 32, b: 7, op: '-' },
  { a: 40, b: 15, op: '-' },
  { a: 44, b: 18, op: '-' },
  { a: 50, b: 25, op: '-' },
  { a: 52, b: 17, op: '-' },
  { a: 61, b: 23, op: '-' },
  { a: 70, b: 35, op: '-' },
  { a: 73, b: 28, op: '-' },
  { a: 64, b: 9, op: '-' },
  { a: 85, b: 40, op: '-' },
  { a: 90, b: 37, op: '-' },
  { a: 96, b: 19, op: '-' },
  { a: 80, b: 26, op: '-' },
  { a: 100, b: 62, op: '-' },
  { a: 99, b: 47, op: '-' },
];

export function problemAnswer(problem) {
  return problem.op === '+' ? problem.a + problem.b : problem.a - problem.b;
}

export function problemText(problem) {
  return `${problem.a} ${problem.op} ${problem.b}`;
}

const BELOW_TWENTY = ['null', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'sju', 'åtte', 'ni', 'ti', 'elleve', 'tolv', 'tretten', 'fjorten', 'femten', 'seksten', 'sytten', 'atten', 'nitten'];
const TENS = { 2: 'tjue', 3: 'tretti', 4: 'førti', 5: 'femti', 6: 'seksti', 7: 'sytti', 8: 'åtti', 9: 'nitti' };

// Norwegian number names for every value on the line (0–100), used for the
// optional read-aloud support. Modern school forms: sju, tjue, førti …
export function norwegianNumber(value) {
  const n = Math.round(value);
  if (n < 0 || n > 100 || !Number.isInteger(n)) return String(value);
  if (n < 20) return BELOW_TWENTY[n];
  if (n === 100) return 'hundre';
  if (n % 10 === 0) return TENS[n / 10];
  return TENS[Math.floor(n / 10)] + BELOW_TWENTY[n % 10];
}

// What the read-aloud button says, e.g. "fjorten pluss seks".
export function problemSpeech(problem) {
  const word = problem.op === '+' ? 'pluss' : 'minus';
  return `${norwegianNumber(problem.a)} ${word} ${norwegianNumber(problem.b)}`;
}

// Picks the next problem from the bank, never the one just solved. The
// fallback keeps the game moving even under a fully predictable random
// source (pinned in tests), where the same candidate would repeat forever.
export function nextProblem(previous) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = pickOne(PROBLEM_BANK);
    if (!previous || candidate !== previous) return candidate;
  }
  const index = PROBLEM_BANK.indexOf(previous);
  return PROBLEM_BANK[(index + 1) % PROBLEM_BANK.length];
}
