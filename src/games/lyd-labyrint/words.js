// Simple Norwegian words at 1st-grade level: short, phonetically regular
// where possible, and each with a picture so word–meaning can support reading.
const WORD_BANK = [
  { word: 'hus', emoji: '🏠' },
  { word: 'bil', emoji: '🚗' },
  { word: 'katt', emoji: '🐱' },
  { word: 'hund', emoji: '🐶' },
  { word: 'sol', emoji: '☀️' },
  { word: 'måne', emoji: '🌙' },
  { word: 'tre', emoji: '🌳' },
  { word: 'bok', emoji: '📕' },
  { word: 'ball', emoji: '⚽' },
  { word: 'fisk', emoji: '🐟' },
  { word: 'fugl', emoji: '🐦' },
  { word: 'egg', emoji: '🥚' },
  { word: 'is', emoji: '🍦' },
  { word: 'ost', emoji: '🧀' },
  { word: 'hest', emoji: '🐴' },
  { word: 'ku', emoji: '🐄' },
  { word: 'sau', emoji: '🐑' },
  { word: 'gris', emoji: '🐷' },
  { word: 'mus', emoji: '🐭' },
  { word: 'buss', emoji: '🚌' },
  { word: 'tog', emoji: '🚂' },
  { word: 'båt', emoji: '🚤' },
  { word: 'snø', emoji: '❄️' },
  { word: 'regn', emoji: '🌧️' },
  { word: 'sky', emoji: '☁️' },
  { word: 'stein', emoji: '🪨' },
  { word: 'eple', emoji: '🍎' },
  { word: 'pære', emoji: '🍐' },
  { word: 'banan', emoji: '🍌' },
  { word: 'melk', emoji: '🥛' },
  { word: 'brød', emoji: '🍞' },
  { word: 'kake', emoji: '🍰' },
  { word: 'stol', emoji: '🪑' },
  { word: 'seng', emoji: '🛏️' },
  { word: 'penn', emoji: '✏️' },
  { word: 'sko', emoji: '👟' },
  { word: 'frosk', emoji: '🐸' },
  { word: 'and', emoji: '🦆' },
  { word: 'rose', emoji: '🌹' },
  { word: 'ulv', emoji: '🐺' },
  { word: 'bjørn', emoji: '🐻' },
  { word: 'svane', emoji: '🦢' },
  { word: 'drake', emoji: '🪁' },
];

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

// Pick `count` distinct words. Consecutive picks never share a first letter,
// so the two words shown at a junction are always clearly different – the
// choice stays about reading, not spot-the-difference.
export function pickWords(count) {
  const pool = shuffle(WORD_BANK);
  const picked = [];
  let previousFirst = '';
  for (const entry of pool) {
    if (picked.length >= count) break;
    const first = entry.word[0];
    if (first === previousFirst) continue;
    picked.push(entry);
    previousFirst = first;
  }
  for (const entry of pool) {
    if (picked.length >= count) break;
    if (!picked.includes(entry)) picked.push(entry);
  }
  return picked.slice(0, count);
}

// Voluntary scaffold: tapping a sign reads the word aloud. Uses whatever
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
