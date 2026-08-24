// Simple Norwegian words at 1st-grade level, grouped by theme so sessions
// stay varied. Words are short and phonetically regular where possible.
//
// Deliberately no picture hints on the fish: the reading practice should
// come from decoding, and the optional scaffold is *hearing* the word
// (tap the word on a surfaced fish), not guessing it from an image.

export const WORD_CATEGORIES = {
  dyr: 'Dyr',
  mat: 'Mat',
  natur: 'Natur',
  hjem: 'Hjemmet',
};

export const WORD_BANK = [
  // Dyr
  { word: 'fisk', cat: 'dyr' },
  { word: 'katt', cat: 'dyr' },
  { word: 'hund', cat: 'dyr' },
  { word: 'mus', cat: 'dyr' },
  { word: 'ku', cat: 'dyr' },
  { word: 'sau', cat: 'dyr' },
  { word: 'gris', cat: 'dyr' },
  { word: 'hest', cat: 'dyr' },
  { word: 'rev', cat: 'dyr' },
  { word: 'fugl', cat: 'dyr' },
  { word: 'and', cat: 'dyr' },
  { word: 'bie', cat: 'dyr' },
  // Mat
  { word: 'is', cat: 'mat' },
  { word: 'ost', cat: 'mat' },
  { word: 'egg', cat: 'mat' },
  { word: 'melk', cat: 'mat' },
  { word: 'brød', cat: 'mat' },
  { word: 'kake', cat: 'mat' },
  { word: 'eple', cat: 'mat' },
  { word: 'pære', cat: 'mat' },
  { word: 'banan', cat: 'mat' },
  { word: 'ris', cat: 'mat' },
  { word: 'smør', cat: 'mat' },
  { word: 'suppe', cat: 'mat' },
  // Natur
  { word: 'sol', cat: 'natur' },
  { word: 'måne', cat: 'natur' },
  { word: 'snø', cat: 'natur' },
  { word: 'regn', cat: 'natur' },
  { word: 'sky', cat: 'natur' },
  { word: 'vind', cat: 'natur' },
  { word: 'skog', cat: 'natur' },
  { word: 'tre', cat: 'natur' },
  { word: 'blad', cat: 'natur' },
  { word: 'stein', cat: 'natur' },
  { word: 'hav', cat: 'natur' },
  { word: 'elv', cat: 'natur' },
  // Hjemmet
  { word: 'hus', cat: 'hjem' },
  { word: 'bok', cat: 'hjem' },
  { word: 'penn', cat: 'hjem' },
  { word: 'stol', cat: 'hjem' },
  { word: 'seng', cat: 'hjem' },
  { word: 'bord', cat: 'hjem' },
  { word: 'dør', cat: 'hjem' },
  { word: 'sko', cat: 'hjem' },
  { word: 'lue', cat: 'hjem' },
  { word: 'vott', cat: 'hjem' },
  { word: 'kopp', cat: 'hjem' },
  { word: 'lampe', cat: 'hjem' },
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
