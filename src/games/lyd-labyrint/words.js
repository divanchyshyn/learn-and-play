// Simple Norwegian animal words at 1st-grade level: short, phonetically
// regular where possible, with a picture for word–meaning support. Words are
// grouped by habitat so each themed maze only meets animals that belong
// there – forest, ocean, savannah. Every word must be at most 5 letters so
// the spelling tray stays comfortable on small screens (see LydLabyrint.jsx).

export const WORDS_BY_THEME = {
  skog: [
    { word: 'rev', emoji: '🦊' },
    { word: 'ulv', emoji: '🐺' },
    { word: 'bjørn', emoji: '🐻' },
    { word: 'ekorn', emoji: '🐿' },
    { word: 'ugle', emoji: '🦉' },
    { word: 'elg', emoji: '🫎' },
    { word: 'hjort', emoji: '🦌' },
    { word: 'bever', emoji: '🦫' },
    { word: 'hauk', emoji: '🦅' },
    { word: 'mus', emoji: '🐭' },
    { word: 'maur', emoji: '🐜' },
    { word: 'and', emoji: '🦆' },
    { word: 'kanin', emoji: '🐰' },
    { word: 'frosk', emoji: '🐸' },
  ],
  hav: [
    { word: 'fisk', emoji: '🐟' },
    { word: 'hai', emoji: '🦈' },
    { word: 'hval', emoji: '🐋' },
    { word: 'sel', emoji: '🦭' },
    { word: 'reke', emoji: '🦐' },
    { word: 'akkar', emoji: '🦑' },
    { word: 'måke', emoji: '🕊️' },
    { word: 'kreps', emoji: '🦞' },
  ],
  savanne: [
    { word: 'løve', emoji: '🦁' },
    { word: 'sebra', emoji: '🦓' },
    { word: 'bison', emoji: '🐃' },
    { word: 'kamel', emoji: '🐫' },
    { word: 'ape', emoji: '🐒' },
    { word: 'øgle', emoji: '🦎' },
    { word: 'ørn', emoji: '🦅' },
    { word: 'geit', emoji: '🐐' },
  ],
};

function shuffle(items, random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

// Pick `count` distinct words from one themed habitat. The whole set is
// shuffled fresh every call, so every maze gets its words in a new random
// order – the runner world never stacks doors in the same sequence twice.
export function pickWords(count, theme, random = Math.random) {
  const pool = shuffle(WORDS_BY_THEME[theme] ?? [], random);
  if (pool.length < count) {
    throw new Error(`Theme "${theme}" only has ${pool.length} words, need ${count}`);
  }
  return pool.slice(0, count);
}

// Voluntary support for tapping a door: reads its word aloud. Uses whatever
// Norwegian voice the browser has; fails silently when none is available.
export function speakWord(text) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'nb-NO';
    utterance.rate = 0.75;
    utterance.pitch = 1.05;
    synth.speak(utterance);
  } catch {
    // Speech is a bonus, never a requirement.
  }
}
