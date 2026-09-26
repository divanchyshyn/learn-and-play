import { shuffle } from '../../shared/random.js';

// Everything behind Kortkrigen's riddles lives here: the animal cards hidden
// behind each page of the album, how the maths grows from page to page, and the
// pure arithmetic that builds and checks a riddle. The component only renders
// what these helpers return, so every rule stays testable without a DOM.

export const PAGE_COUNT = 4;
export const CREATURES_PER_PAGE = 4;

// Four pages of friendly animals. The ids are English (they are saved in the
// album), while everything a child reads stays Norwegian.
export const PAGES = [
  { id: 'forest', label: 'Skogen', emoji: '🌳' },
  { id: 'mountain', label: 'Fjellet', emoji: '⛰️' },
  { id: 'sea', label: 'Sjøen', emoji: '🌊' },
  { id: 'savanna', label: 'Savannen', emoji: '🌾' },
];

export const CREATURES = [
  { id: 'fox', emoji: '🦊', name: 'Reven', fact: 'Reven hører mus under snøen.', page: 'forest' },
  { id: 'owl', emoji: '🦉', name: 'Uglen', fact: 'Uglen kan nesten vri hodet helt rundt.', page: 'forest' },
  { id: 'squirrel', emoji: '🐿️', name: 'Ekornet', fact: 'Ekornet glemmer nøtter som blir til nye trær.', page: 'forest' },
  { id: 'deer', emoji: '🦌', name: 'Rådyret', fact: 'Rådyret er Norges minste hjort.', page: 'forest' },
  { id: 'eagle', emoji: '🦅', name: 'Ørnen', fact: 'Ørnen ser en hare på veldig lang avstand.', page: 'mountain' },
  { id: 'bear', emoji: '🐻', name: 'Bjørnen', fact: 'Bjørnen sover hele vinteren.', page: 'mountain' },
  { id: 'goat', emoji: '🐐', name: 'Fjellgeita', fact: 'Fjellgeita klatrer der ingen andre tør.', page: 'mountain' },
  { id: 'wolf', emoji: '🐺', name: 'Ulven', fact: 'Ulven uler for å snakke med flokken sin.', page: 'mountain' },
  { id: 'dolphin', emoji: '🐬', name: 'Delfinen', fact: 'Delfinen sover med ett øye åpent.', page: 'sea' },
  { id: 'octopus', emoji: '🐙', name: 'Blekkfisken', fact: 'Blekkfisken spruter blekk når den blir redd.', page: 'sea' },
  { id: 'turtle', emoji: '🐢', name: 'Skilpadden', fact: 'Skilpadden kan bli over hundre år.', page: 'sea' },
  { id: 'otter', emoji: '🦦', name: 'Oteren', fact: 'Oteren holder en venn i labben når den sover.', page: 'sea' },
  { id: 'lion', emoji: '🦁', name: 'Løven', fact: 'Løvens brøl høres mange kilometer unna.', page: 'savanna' },
  { id: 'elephant', emoji: '🐘', name: 'Elefanten', fact: 'Elefanten husker vennene sine i mange år.', page: 'savanna' },
  { id: 'giraffe', emoji: '🦒', name: 'Sjiraffen', fact: 'Sjiraffen har like mange halsvirvler som deg.', page: 'savanna' },
  { id: 'zebra', emoji: '🦓', name: 'Sebraen', fact: 'Sebraens striper er unike, som fingeravtrykk.', page: 'savanna' },
];

export function creatureById(id) {
  return CREATURES.find((entry) => entry.id === id) ?? null;
}

export function creaturesInPage(pageId) {
  return CREATURES.filter((entry) => entry.page === pageId);
}

export function pageById(pageId) {
  return PAGES.find((entry) => entry.id === pageId) ?? null;
}

// The number cards that can sit in a hand.
const CARD_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const CARD_MAX = 10;
// Rex never lays a bigger card than this, so the missing card always stays
// inside the hand's range in every tier.
const REX_MAX = 9;
const HAND_SIZE = 4;

// The difficulty moves one page at a time. `mixed` keeps dealing both
// operations so the last page never settles into a rut.
export const TIERS = ['plus10', 'plus18', 'minus', 'mixed'];

export function tierForDiscovered(count) {
  if (!Number.isInteger(count) || count < 0) return TIERS[0];
  const page = Math.floor(count / CREATURES_PER_PAGE);
  return TIERS[Math.min(page, TIERS.length - 1)];
}

function pickInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// The missing card is the answer; the three other cards are decoys that can
// never solve the same riddle (only one card equals `answer`), so a child who
// checks their work always lands on the same card.
function dealHand(answer, pool) {
  const decoys = shuffle(pool.filter((value) => value !== answer)).slice(0, HAND_SIZE - 1);
  return shuffle([answer, ...decoys]);
}

function makePlusRiddle(minTarget, maxTarget) {
  // The answer must leave room for Rex's card on both sides of the target.
  const answer = pickInt(Math.max(2, minTarget - REX_MAX), Math.min(CARD_MAX, maxTarget - 1));
  const rexValue = pickInt(Math.max(1, minTarget - answer), Math.min(REX_MAX, maxTarget - answer));
  const target = answer + rexValue;
  return { operation: 'plus', rexValue, target, answer, hand: dealHand(answer, CARD_VALUES) };
}

// Subtraction gives the blank card the biggest role: `? − Rex = target`, so
// the answer is the target plus Rex's card.
function makeMinusRiddle() {
  const rexValue = pickInt(1, 4);
  const answer = pickInt(rexValue + 1, CARD_MAX);
  const target = answer - rexValue;
  const pool = CARD_VALUES.filter((value) => value > rexValue);
  return { operation: 'minus', rexValue, target, answer, hand: dealHand(answer, pool) };
}

export function makeRiddle(tierId) {
  const tier = TIERS.includes(tierId) ? tierId : TIERS[0];
  if (tier === 'plus10') return makePlusRiddle(2, 10);
  if (tier === 'plus18') return makePlusRiddle(11, 18);
  if (tier === 'minus') return makeMinusRiddle();
  return Math.random() < 0.5 ? makePlusRiddle(2, 18) : makeMinusRiddle();
}

// What one card would do to the riddle. `result` is always displayed, correct
// or not, so a wrong card teaches the real sum instead of only buzzing.
export function attempt(riddle, card) {
  const result = riddle.operation === 'plus' ? card + riddle.rexValue : card - riddle.rexValue;
  return { correct: result === riddle.target, result };
}

export function equationText(operation, card, rexValue, result) {
  return `${card} ${operation === 'plus' ? '+' : '−'} ${rexValue} = ${result}`;
}

const UNITS = ['null', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'sju', 'åtte', 'ni', 'ti', 'elleve', 'tolv', 'tretten', 'fjorten', 'femten', 'seksten', 'sytten', 'atten', 'nitten'];
const TENS = { 2: 'tjue', 3: 'tretti', 4: 'førti', 5: 'femti', 6: 'seksti', 7: 'sytti', 8: 'åtti', 9: 'nitti' };

export function numberToNorwegian(value) {
  if (!Number.isInteger(value) || value < 0 || value > 100) return String(value);
  if (value <= 19) return UNITS[value];
  if (value === 100) return 'hundre';
  const tens = Math.floor(value / 10);
  const unit = value % 10;
  return TENS[tens] + (unit ? UNITS[unit] : '');
}

// The riddle card is read as one calm sentence for screen readers: the blank
// is "noe", the same word the child sees as a question mark.
export function riddleLabel(riddle) {
  const rex = numberToNorwegian(riddle.rexValue);
  const target = numberToNorwegian(riddle.target);
  return riddle.operation === 'plus'
    ? `${rex} pluss noe er ${target}`
    : `noe minus ${rex} er ${target}`;
}

// Read-aloud support is opt-in and speaks the solved riddle only.
export function spokenEquation(operation, card, rexValue) {
  const result = operation === 'plus' ? card + rexValue : card - rexValue;
  const word = operation === 'plus' ? 'pluss' : 'minus';
  return `${numberToNorwegian(card)} ${word} ${numberToNorwegian(rexValue)} er ${numberToNorwegian(result)}`;
}
