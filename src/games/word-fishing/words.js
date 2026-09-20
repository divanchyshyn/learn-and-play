// Simple Norwegian words at 1st-grade level, grouped by theme so sessions
// stay varied. Words are short and phonetically regular where possible.
//
// Deliberately no picture hints on the fish: the reading practice should
// come from decoding, and the optional scaffold is *hearing* the word
// (tap the word on a surfaced fish), not guessing it from an image.

export const WORD_CATEGORIES = {
  animals: 'Dyr',
  food: 'Mat',
  nature: 'Natur',
  home: 'Hjemmet',
};

export const WORD_BANK = [
  // Animals
  { word: 'fisk', cat: 'animals' },
  { word: 'katt', cat: 'animals' },
  { word: 'hund', cat: 'animals' },
  { word: 'mus', cat: 'animals' },
  { word: 'ku', cat: 'animals' },
  { word: 'sau', cat: 'animals' },
  { word: 'gris', cat: 'animals' },
  { word: 'hest', cat: 'animals' },
  { word: 'rev', cat: 'animals' },
  { word: 'fugl', cat: 'animals' },
  { word: 'and', cat: 'animals' },
  { word: 'bie', cat: 'animals' },
  // Food
  { word: 'is', cat: 'food' },
  { word: 'ost', cat: 'food' },
  { word: 'egg', cat: 'food' },
  { word: 'melk', cat: 'food' },
  { word: 'brød', cat: 'food' },
  { word: 'kake', cat: 'food' },
  { word: 'eple', cat: 'food' },
  { word: 'pære', cat: 'food' },
  { word: 'banan', cat: 'food' },
  { word: 'ris', cat: 'food' },
  { word: 'smør', cat: 'food' },
  { word: 'suppe', cat: 'food' },
  // Nature
  { word: 'sol', cat: 'nature' },
  { word: 'måne', cat: 'nature' },
  { word: 'snø', cat: 'nature' },
  { word: 'regn', cat: 'nature' },
  { word: 'sky', cat: 'nature' },
  { word: 'vind', cat: 'nature' },
  { word: 'skog', cat: 'nature' },
  { word: 'tre', cat: 'nature' },
  { word: 'blad', cat: 'nature' },
  { word: 'stein', cat: 'nature' },
  { word: 'hav', cat: 'nature' },
  { word: 'elv', cat: 'nature' },
  // The home
  { word: 'hus', cat: 'home' },
  { word: 'bok', cat: 'home' },
  { word: 'penn', cat: 'home' },
  { word: 'stol', cat: 'home' },
  { word: 'seng', cat: 'home' },
  { word: 'bord', cat: 'home' },
  { word: 'dør', cat: 'home' },
  { word: 'sko', cat: 'home' },
  { word: 'lue', cat: 'home' },
  { word: 'vott', cat: 'home' },
  { word: 'kopp', cat: 'home' },
  { word: 'lampe', cat: 'home' },
];

import { shuffle } from '../../shared/random.js';

export function pickWordOrder() {
  return shuffle(WORD_BANK.map((_, index) => index));
}

// Walk the shuffled order from `pos`, skipping any word that is already
// swimming around on screen, so two fish never show the same word at once.
// Wraps around when the bank runs dry mid-session; if every single word is
// somehow taken it falls back to the next in line rather than getting stuck.
export function drawWordIndex(order, pos, takenIndexes) {
  const total = order.length;
  for (let step = 0; step < total; step += 1) {
    const candidate = order[pos % total];
    if (!takenIndexes.has(candidate)) return { index: candidate, nextPos: pos + 1 };
    pos += 1;
  }
  return { index: order[pos % total], nextPos: pos + 1 };
}
