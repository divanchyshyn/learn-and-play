// Simple Norwegian words at 1st-grade level: short, phonetically regular where
// possible, with a picture for word–meaning support. Words are grouped by
// theme so each themed maze only meets words that belong there – forest,
// ocean, savannah, the days of the week, and the months and seasons. Forest,
// ocean and savannah words stay at most 5 letters so the spelling tray stays
// comfortable on small screens; day, month and season names run longer and
// the tray simply wraps them onto a second row (see SpellPuzzle.jsx). The day
// phrases ("i dag", "i morgen", "i går") keep their spaces: a space is just
// another tile a child can place. Every theme holds at least 13 words – more
// than a maze can ever lock (see mazes.js) – so a fresh maze draws a full,
// distinct set every game.

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
    { word: 'hare', emoji: '🐇' },
    { word: 'gaupe', emoji: '🐆' },
    { word: 'sopp', emoji: '🍄' },
    { word: 'tre', emoji: '🌲' },
    { word: 'blad', emoji: '🍃' },
    { word: 'bie', emoji: '🐝' },
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
    { word: 'oter', emoji: '🦦' },
    { word: 'nise', emoji: '🐬' },
    { word: 'sild', emoji: '🐟' },
    { word: 'skate', emoji: '🐟' },
    { word: 'torsk', emoji: '🐟' },
    { word: 'sei', emoji: '🐟' },
    { word: 'manet', emoji: '🪼' },
    { word: 'ål', emoji: '🐍' },
    { word: 'tang', emoji: '🌿' },
    { word: 'skarv', emoji: '🐦' },
    { word: 'øy', emoji: '🏝️' },
    { word: 'båt', emoji: '🚤' },
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
    { word: 'gnu', emoji: '🦬' },
    { word: 'kudu', emoji: '🦌' },
    { word: 'kobra', emoji: '🐍' },
    { word: 'mamba', emoji: '🐍' },
    { word: 'gribb', emoji: '🦅' },
    { word: 'hyene', emoji: '🐺' },
    { word: 'eland', emoji: '🦌' },
    { word: 'gress', emoji: '🌾' },
    { word: 'sol', emoji: '☀️' },
    { word: 'fugl', emoji: '🐦' },
    { word: 'okse', emoji: '🐂' },
    { word: 'tiger', emoji: '🐅' },
  ],
  // The days of the week, plus the handful of related time words around them.
  // The phrases keep their spaces – the spelling lock treats a space as one
  // more letter tile (see SpellPuzzle.jsx).
  ukedager: [
    { word: 'mandag', emoji: '📅' },
    { word: 'tirsdag', emoji: '📅' },
    { word: 'onsdag', emoji: '📅' },
    { word: 'torsdag', emoji: '📅' },
    { word: 'fredag', emoji: '📅' },
    { word: 'lørdag', emoji: '📅' },
    { word: 'søndag', emoji: '📅' },
    { word: 'dag', emoji: '☀️' },
    { word: 'uke', emoji: '🗓️' },
    { word: 'helg', emoji: '🎉' },
    { word: 'i dag', emoji: '📍' },
    { word: 'i morgen', emoji: '⏭️' },
    { word: 'i går', emoji: '⏮️' },
  ],
  // The twelve months and the four seasons, each given once in base form and
  // once in the definite form the child meets in everyday Norwegian speech.
  aarstider: [
    { word: 'januar', emoji: '❄️' },
    { word: 'februar', emoji: '❄️' },
    { word: 'mars', emoji: '🌱' },
    { word: 'april', emoji: '🌸' },
    { word: 'mai', emoji: '🌷' },
    { word: 'juni', emoji: '☀️' },
    { word: 'juli', emoji: '☀️' },
    { word: 'august', emoji: '🌻' },
    { word: 'september', emoji: '🍂' },
    { word: 'oktober', emoji: '🍂' },
    { word: 'november', emoji: '🌧️' },
    { word: 'desember', emoji: '🎄' },
    { word: 'vår', emoji: '🌸' },
    { word: 'våren', emoji: '🌸' },
    { word: 'sommer', emoji: '☀️' },
    { word: 'sommeren', emoji: '☀️' },
    { word: 'høst', emoji: '🍂' },
    { word: 'høsten', emoji: '🍂' },
    { word: 'vinter', emoji: '❄️' },
    { word: 'vinteren', emoji: '❄️' },
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

// Pick `count` distinct words from one theme. The whole set is shuffled fresh
// every call, so every maze gets its words in a new random order – the runner
// world never stacks doors in the same sequence twice.
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
