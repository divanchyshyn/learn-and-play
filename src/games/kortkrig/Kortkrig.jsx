import { useEffect, useMemo, useRef, useState } from 'react';
import { pickOne, shuffle } from '../../shared/random.js';
import { speakNorwegian } from '../../shared/speech.js';
import { GameHeader } from '../../shared/GameHeader.jsx';
import { setMuted as setAudioMuted, sounds } from './sounds.js';

// Read-aloud stays part of this game's public surface for tests/tools.
export { speakNorwegian };

const OPPONENT_DELAY_MS = 850;
const TALLY_KEY = 'kortkrig-tally';
const DECK_VALUES = Array.from({ length: 20 }, (_, index) => index + 1);

export const MODES = [
  { id: 'pluss', label: 'Pluss-slag' },
  { id: 'minus', label: 'Minus-slag' },
  { id: 'storst', label: 'Størst vinner' },
];

// Winning and losing are framed identically: loud, silly, and fun either way.
export const HEADLINES = {
  player: ['BOOM! Du vant runden! 💥', 'KRAK! Det var et kraftslag! 🎉', 'ZAPP! Runden din! ⚡'],
  opponent: ['POFF! Rex vant dette slaget! 💫', 'BUM! Rex tok runden! 🎈', 'SPLATT! Rex slo hardest denne gangen! ✨'],
  tie: ['KRASJ! Akkurat likt! ✨', 'DUSS! Nøyaktig samme slag! 🤝', 'PLING! Helt uavgjort! 🌟'],
};

export const REX_QUIPS = {
  player: ['Rex snurrer rundt av begeistring!', 'Rex roper: STAS! Igjen! Igjen!', 'Rex reiser tommelen helt opp.'],
  opponent: ['Rex danser seiersdans – kom igjen, neste slag!', 'Rex blåser glitrende røykringer av glede.', 'Rex bøyer seg dypt og ler hjertelig.'],
  tie: ['Rex gir deg en skikkelig høyt-fem!', 'Rex bumper neven din, staselig.', 'Rex humrer fornøyd begge to.'],
};

const OUTCOME_SPOKEN = {
  player: 'Du vant runden!',
  opponent: 'Rex vant runden!',
  tie: 'Uavgjort!',
};

const BURST_EMOJI = {
  player: ['💥', '🎉', '⭐', '✨', '🎊'],
  opponent: ['💥', '💫', '🌟', '✨', '🎈'],
  tie: ['🌈', '💥', '✨', '⭐', '🌟'],
};
const BURST_COLORS = {
  player: ['#e46e4b', '#e5ae45', '#ffd95c'],
  opponent: ['#0c9fc4', '#7a5fd0', '#4dc3e8'],
  tie: ['#63a375', '#0c9fc4', '#e46e4b'],
};

export function createDeck() {
  return shuffle(DECK_VALUES);
}

// Draw the top card; when the deck is empty it quietly wraps around by
// handing back a freshly shuffled deck as the remaining pile.
export function drawFrom(deck) {
  if (!deck.length) return { value: null, rest: createDeck(), wrapped: true };
  const [value, ...rest] = deck;
  return { value, rest, wrapped: false };
}

// The battle rule never changes – biggest card wins the round – so the game
// stays predictable no matter which math mode is active.
export function roundOutcome(playerValue, opponentValue) {
  if (playerValue > opponentValue) return 'player';
  if (opponentValue > playerValue) return 'opponent';
  return 'tie';
}

export function pickLine(lines) {
  return pickOne(lines);
}

export function mathLine(modeId, playerValue, opponentValue) {
  if (modeId === 'pluss') return `${playerValue} + ${opponentValue} = ${playerValue + opponentValue}`;
  if (modeId === 'minus') {
    const high = Math.max(playerValue, opponentValue);
    const low = Math.min(playerValue, opponentValue);
    return `${high} − ${low} = ${high - low}`;
  }
  return null;
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

export function spokenMath(modeId, playerValue, opponentValue) {
  if (modeId === 'pluss') {
    return `${numberToNorwegian(playerValue)} pluss ${numberToNorwegian(opponentValue)} er ${numberToNorwegian(playerValue + opponentValue)}`;
  }
  if (modeId === 'minus') {
    const high = Math.max(playerValue, opponentValue);
    const low = Math.min(playerValue, opponentValue);
    return `${numberToNorwegian(high)} minus ${numberToNorwegian(low)} er ${numberToNorwegian(high - low)}`;
  }
  return `${numberToNorwegian(playerValue)} mot ${numberToNorwegian(opponentValue)}`;
}

// Opt-in read-aloud support lives in src/shared/speech.js.

export function todayKey(now = new Date()) {
  const pad = (part) => String(part).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function defaultStore() {
  return typeof window === 'undefined' ? null : window.localStorage;
}

// The tally only counts how many rounds were played today – it is flavour,
// never a score, and it resets by itself at midnight.
export function loadTally(store = defaultStore()) {
  try {
    const raw = store?.getItem(TALLY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.date !== todayKey()) return null;
    return { date: parsed.date, rounds: Number(parsed.rounds) || 0 };
  } catch {
    return null;
  }
}

export function saveTally(tally, store = defaultStore()) {
  try {
    store?.setItem(TALLY_KEY, JSON.stringify(tally));
  } catch {
    // Storage may be unavailable (private mode); playing still works fine.
  }
}

export function bumpTally(tally, now = new Date()) {
  const date = todayKey(now);
  const rounds = (tally && tally.date === date ? tally.rounds : 0) + 1;
  return { date, rounds };
}

function BurstLayer({ tone }) {
  const bits = useMemo(() => Array.from({ length: 26 }, (_, index) => {
    const angle = (index / 26) * Math.PI * 2 + Math.random() * 0.4;
    const distance = 120 + Math.random() * 190;
    return {
      id: index,
      emoji: BURST_EMOJI[tone][index % BURST_EMOJI[tone].length],
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      delay: Math.random() * 0.18,
      size: 17 + Math.random() * 22,
      spin: `${Math.round((Math.random() > 0.5 ? 1 : -1) * (200 + Math.random() * 320))}deg`,
      color: BURST_COLORS[tone][index % BURST_COLORS[tone].length],
      round: index % 3 === 0,
    };
  }), []);
  return <div className="burst-layer" aria-hidden="true">
    {bits.map((bit) => <span
      className={`burst-bit${bit.round ? ' round' : ''}`}
      key={bit.id}
      style={{
        '--dx': `${bit.dx}px`,
        '--dy': `${bit.dy}px`,
        '--spin': bit.spin,
        fontSize: `${bit.size}px`,
        color: bit.color,
        animationDelay: `${bit.delay}s`,
      }}
    >{bit.emoji}</span>)}
  </div>;
}

function BattleCard({ value, faceUp, thinking }) {
  return <div className={`battle-card${faceUp ? ' face-up' : ''}${thinking ? ' thinking' : ''}`}>
    <div className="battle-card-inner">
      <div className="battle-face battle-back"><span aria-hidden="true">⚔️</span></div>
      <div className="battle-face battle-front"><span className="card-value">{faceUp ? value : ''}</span></div>
    </div>
  </div>;
}

function makeDecks() {
  return { player: createDeck(), opponent: createDeck() };
}

export function Kortkrig() {
  const [mode, setMode] = useState('pluss');
  const [decks, setDecks] = useState(makeDecks);
  const decksRef = useRef(decks);
  const [playerCard, setPlayerCard] = useState(null);
  const [opponentCard, setOpponentCard] = useState(null);
  const [phase, setPhase] = useState('ready');
  const [result, setResult] = useState(null);
  const [roundsToday, setRoundsToday] = useState(() => loadTally()?.rounds || 0);
  const [soundOn, setSoundOn] = useState(true);
  const [voiceOn, setVoiceOn] = useState(false);
  const timerRef = useRef(null);
  const lockRef = useRef(false);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
  }, []);

  function clearRoundTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function resetBoard() {
    clearRoundTimer();
    lockRef.current = false;
    setPlayerCard(null);
    setOpponentCard(null);
    setResult(null);
    setPhase('ready');
  }

  function changeMode(nextMode) {
    if (nextMode === mode && phase === 'ready') return;
    setMode(nextMode);
    resetBoard();
    sounds.select();
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setAudioMuted(!next);
    if (next) sounds.flip();
  }

  function toggleVoice() {
    setVoiceOn((on) => !on);
    sounds.select();
  }

  function startRound() {
    if (lockRef.current || phase !== 'ready') return;
    lockRef.current = true;
    const source = decksRef.current;
    const playerDraw = drawFrom(source.player);
    const opponentDraw = drawFrom(source.opponent);
    const nextDecks = { player: playerDraw.rest, opponent: opponentDraw.rest };
    decksRef.current = nextDecks;
    setDecks(nextDecks);
    setPlayerCard(playerDraw.value);
    setOpponentCard(null);
    setResult(null);
    setPhase('waiting');
    sounds.flip();
    timerRef.current = setTimeout(() => finishRound(playerDraw.value, opponentDraw.value), OPPONENT_DELAY_MS);
  }

  function finishRound(playerValue, opponentValue) {
    timerRef.current = null;
    const outcome = roundOutcome(playerValue, opponentValue);
    const headline = pickLine(HEADLINES[outcome]);
    const quip = pickLine(REX_QUIPS[outcome]);
    setOpponentCard(opponentValue);
    setResult({ outcome, headline, quip });
    setPhase('revealed');
    setRoundsToday((count) => {
      const next = bumpTally({ date: todayKey(), rounds: count });
      saveTally(next);
      return next.rounds;
    });
    sounds.clash();
    (outcome === 'player' ? sounds.cheer : sounds.boing)();
    if (voiceOn) speakNorwegian(`${spokenMath(mode, playerValue, opponentValue)}. ${OUTCOME_SPOKEN[outcome]}`);
    lockRef.current = false;
  }

  function strike() {
    if (phase === 'revealed') resetBoard();
    else startRound();
  }

  const activeMode = MODES.find((entry) => entry.id === mode);
  const line = phase === 'revealed' && result ? mathLine(mode, playerCard, opponentCard) : null;

  return <main className="game-page battle-page">
    <GameHeader title="Kortkrig">
      <p>Kortduell mot Rex! Snu kortet ditt og se hvem som slår hardest.</p>
      <div className="game-controls">
        <span className={`rounds-chip${roundsToday === 0 ? ' hidden-chip' : ''}`}>⚔️ {roundsToday} slag i dag</span>
        <div className="chip-group" role="group" aria-label="Måte å spille på">
          {MODES.map((entry) => (
            <button className={`chip${mode === entry.id ? ' active' : ''}`} aria-pressed={mode === entry.id} key={entry.id} onClick={() => changeMode(entry.id)} type="button">{entry.label}</button>
          ))}
        </div>
        <button className="chip toggle" aria-pressed={voiceOn} aria-label={voiceOn ? 'Slå av opplesning' : 'Les tallene høyt'} onClick={toggleVoice} type="button">{voiceOn ? '🗣 Lesing: på' : '🗣 Lesing: av'}</button>
        <button className="chip toggle" aria-pressed={!soundOn} aria-label={soundOn ? 'Slå av lyd' : 'Slå på lyd'} onClick={toggleSound} type="button">{soundOn ? '🔊' : '🔇'}</button>
      </div>
    </GameHeader>

    <section className="arena" aria-label="Kortkrig-arenaen">
      <div className="fighter fighter-player" data-side="player">
        <span className="fighter-avatar" aria-hidden="true">🧒</span>
        <h2>Deg</h2>
        <button className="card-flip-btn" onClick={strike} disabled={phase !== 'ready'} aria-label="Snur kortet ditt" type="button">
          <BattleCard value={playerCard} faceUp={playerCard !== null} />
        </button>
      </div>
      <div className="versus" aria-hidden="true">VS</div>
      <div className="fighter fighter-opponent" data-side="opponent">
        <span className="fighter-avatar" aria-hidden="true">🦖</span>
        <h2>Rex</h2>
        <BattleCard value={opponentCard} faceUp={opponentCard !== null} thinking={phase === 'waiting'} />
      </div>
    </section>

    <section className="result-zone" aria-live="polite">
      {phase === 'ready' && <p className="status-line">Klar til kamp? Trykk på kortet ditt!</p>}
      {phase === 'waiting' && <p className="status-line">Rex snur kortet sitt…</p>}
      {phase === 'revealed' && result && <div className="result-card" data-outcome={result.outcome}>
        {line && <p className="math-line">{line}</p>}
        <h2 className="headline">{result.headline}</h2>
        <p className="quip"><span aria-hidden="true">🦖</span> {result.quip}</p>
      </div>}
      <button className="strike-button" onClick={strike} disabled={phase === 'waiting'} type="button">
        {phase === 'ready' ? '⚔️ Slå ut!' : phase === 'waiting' ? 'Rex snur kortet…' : 'Nytt slag ⚔️'}
      </button>
      <p className="mode-hint">
        {activeMode.id === 'pluss' && 'Pluss-slag: kortene legges sammen – hvem slo hardest?'}
        {activeMode.id === 'minus' && 'Minus-slag: hvor stort er gapet mellom kortene?'}
        {activeMode.id === 'storst' && 'Størst vinner: bare se på kortene, ingen regning.'}
      </p>
    </section>

    {phase === 'revealed' && result && <BurstLayer tone={result.outcome} />}
  </main>;
}
