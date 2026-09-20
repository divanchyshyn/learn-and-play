// Simple Norwegian words at 1st-grade level, grouped so a fishing trip can sort
// its catch into crates. Words are short and phonetically regular where possible.
//
// Deliberately no picture hints on the fish: the reading practice should
// come from decoding, and the optional scaffold is *hearing* the word
// (tap the word on a caught fish), not guessing it from an image.

import { shuffle } from '../../shared/random.js';

// The crate a word belongs to is the game's reading task: every catch has to be
// decoded and put in the right crate. Every category crate draws from a pool of
// twenty words – eighty in all – but it only takes ten words to fill it. The
// target a child has to reach therefore stays at ten, while the bigger pool
// keeps the sea from dealing the same words every run.
export const WORD_CATEGORIES = {
  animals: 'Dyr',
  food: 'Mat',
  nature: 'Natur',
  home: 'Hjemmet',
};

const CATEGORY_ICONS = {
  animals: '🐾',
  food: '🍎',
  nature: '🌿',
  home: '🏠',
};

export const CATEGORY_CRATE_IDS = Object.keys(WORD_CATEGORIES);

// Every crate the boat can carry, by id. A crate takes the words whose meaning
// belongs in it and nothing else (see crateTakesWord in trip.js).
const CRATE_DEFS = Object.fromEntries(CATEGORY_CRATE_IDS.map((id) => [
  id,
  { id, label: WORD_CATEGORIES[id], icon: CATEGORY_ICONS[id] },
]));

// Every crate the boat can carry, in display order.
export const ALL_CRATES = Object.values(CRATE_DEFS);

export function crateById(id) {
  return CRATE_DEFS[id] ?? null;
}

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
  { word: 'bjørn', cat: 'animals' },
  { word: 'ulv', cat: 'animals' },
  { word: 'elg', cat: 'animals' },
  { word: 'geit', cat: 'animals' },
  { word: 'and', cat: 'animals' },
  { word: 'ørn', cat: 'animals' },
  { word: 'kanin', cat: 'animals' },
  { word: 'frosk', cat: 'animals' },
  { word: 'bie', cat: 'animals' },
  { word: 'maur', cat: 'animals' },
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
  { word: 'suppe', cat: 'food' },
  { word: 'ris', cat: 'food' },
  { word: 'salt', cat: 'food' },
  { word: 'sukker', cat: 'food' },
  { word: 'smør', cat: 'food' },
  { word: 'saft', cat: 'food' },
  { word: 'vann', cat: 'food' },
  { word: 'tomat', cat: 'food' },
  { word: 'agurk', cat: 'food' },
  { word: 'gulrot', cat: 'food' },
  { word: 'potet', cat: 'food' },
  // Nature
  { word: 'sol', cat: 'nature' },
  { word: 'måne', cat: 'nature' },
  { word: 'snø', cat: 'nature' },
  { word: 'regn', cat: 'nature' },
  { word: 'sky', cat: 'nature' },
  { word: 'skog', cat: 'nature' },
  { word: 'tre', cat: 'nature' },
  { word: 'blad', cat: 'nature' },
  { word: 'stein', cat: 'nature' },
  { word: 'hav', cat: 'nature' },
  { word: 'vind', cat: 'nature' },
  { word: 'gress', cat: 'nature' },
  { word: 'blomst', cat: 'nature' },
  { word: 'fjell', cat: 'nature' },
  { word: 'elv', cat: 'nature' },
  { word: 'bølge', cat: 'nature' },
  { word: 'sand', cat: 'nature' },
  { word: 'jord', cat: 'nature' },
  { word: 'stjerne', cat: 'nature' },
  { word: 'tåke', cat: 'nature' },
  // The home
  { word: 'hus', cat: 'home' },
  { word: 'bok', cat: 'home' },
  { word: 'stol', cat: 'home' },
  { word: 'seng', cat: 'home' },
  { word: 'bord', cat: 'home' },
  { word: 'dør', cat: 'home' },
  { word: 'sko', cat: 'home' },
  { word: 'lue', cat: 'home' },
  { word: 'kopp', cat: 'home' },
  { word: 'lampe', cat: 'home' },
  { word: 'gulv', cat: 'home' },
  { word: 'tak', cat: 'home' },
  { word: 'vegg', cat: 'home' },
  { word: 'vindu', cat: 'home' },
  { word: 'sofa', cat: 'home' },
  { word: 'teppe', cat: 'home' },
  { word: 'pute', cat: 'home' },
  { word: 'kniv', cat: 'home' },
  { word: 'skje', cat: 'home' },
  { word: 'nøkkel', cat: 'home' },
];

export const WORD_COUNT = WORD_BANK.length;

// Which crate holds this meaning? Unknown words belong nowhere – a word that was
// removed from the bank must never be sorted into a crate.
const WORD_TO_CATEGORY = new Map(WORD_BANK.map((entry) => [entry.word, entry.cat]));

export function categoryForWord(word) {
  return WORD_TO_CATEGORY.get(word) ?? null;
}

export function wordsInCrate(crateId) {
  return WORD_BANK.filter((entry) => entry.cat === crateId);
}

export function crateWordCount(crateId) {
  return wordsInCrate(crateId).length;
}

// How many words fill one category crate. The pool behind it is twice as big
// (see crateWordCount), so the target is what keeps "collect them all" the same
// ten-word goal per crate it has always been.
export const CRATE_TARGET = 10;

export function crateTarget(crateId) {
  if (!crateById(crateId)) return 0;
  return Math.min(CRATE_TARGET, crateWordCount(crateId));
}

// The number of words that fill the fishing book: ten in every category.
// Deliberately smaller than WORD_COUNT, which is the size of the whole pool.
export const TARGET_WORD_COUNT = CATEGORY_CRATE_IDS.reduce(
  (sum, crateId) => sum + crateTarget(crateId),
  0,
);

export function isWordInBank(word) {
  return WORD_TO_CATEGORY.has(word);
}

export function pickWordOrder() {
  return shuffle(WORD_BANK.map((_, index) => index));
}

// Walk the shuffled order from `pos`, skipping any word that is already on
// screen, so two fish never show the same word at once, and skipping any word
// `accepts` refuses. A trip that asks for one kind of word draws through this,
// so the child never has to wait for a fish that counts; the sea also refuses
// words the fishing book already has. When nothing in the whole bank is allowed
// – say, every word it could carry is already caught – it hands out nothing:
// the caller may not show a word the child has already caught.
export function drawWordIndexWhere(order, pos, takenIndexes, accepts) {
  const total = order.length;
  for (let step = 0; step < total; step += 1) {
    const candidate = order[pos % total];
    if (accepts(candidate) && !takenIndexes.has(candidate)) return { index: candidate, nextPos: pos + 1 };
    pos += 1;
  }
  return { index: null, nextPos: pos };
}
