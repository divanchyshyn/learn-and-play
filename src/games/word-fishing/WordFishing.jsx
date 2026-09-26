import { useEffect, useRef, useState } from 'react';
import { ConfettiLayer } from '../../shared/ConfettiLayer.jsx';
import { GameHeader } from '../../shared/GameHeader.jsx';
import { usePersistentState } from '../../shared/usePersistentState.js';
import { CrateDock } from './CrateDock.jsx';
import { FishingBook } from './FishingBook.jsx';
import { FishSprite } from './FishSprite.jsx';
import { SeaScene } from './SeaScene.jsx';
import { isMuted, setMuted as setAudioMuted, sounds } from './sounds.js';
import {
  DELIVER_TICKS, FISH_ON_SCREEN, REEL_STEPS, TICK_MS, WATERLINE,
  aboardFish, activeFish, canHookFish, createSea, deliverFish, fishWord,
  hookFish, lineTarget, reelFish, slipFish, tickSea,
} from './sea.js';
import {
  createTripPlan, crateForWord, rewardForTrip, tripComplete,
  tripRequest, unlockedRewards, withDelivery,
} from './trip.js';
import {
  ALL_WORDS_MESSAGE, JOURNAL_KEY, TRIP_KEY, allWordsCaught, createJournal, hasRoomForWord, hasWord,
  journalCodec, recordCatch, recordDecoration, recordTrip, tripCodec,
  unavailableWords, wordsCaught, wordsLeftToCatch,
} from './journal.js';
import { TARGET_WORD_COUNT, crateById } from './words.js';

const PAGE_BG = '#dceef4';
// How long a crate glows after a catch that belongs elsewhere.
const HINT_MS = 2600;
// How long the "the fish landed in this crate" pop stays on the crate.
const LANDED_MS = 1200;

// Kept close to the constants above so tests and CSS stay in step with the
// component's timing (see sea.js).
export const TIMING = { TICK_MS, REEL_STEPS, FISH_ON_SCREEN, DELIVER_TICKS, LANDED_MS };

// What the dock is waiting for, in plain words. The crates cannot be answered
// until a catch is really on deck, and this line says why – without it a tap on
// a crate that has nothing to carry out looks like the game ignoring the child.
export function dockHint(sea, tripCard = null) {
  if (tripCard) return 'Trykk «Ny tur» for å fiske videre 🎣';
  const fish = activeFish(sea);
  if (!fish) return 'Fang en fisk 🎣';
  if (fish.status === 'hooked') return 'Sveiv fisken helt inn til dekk!';
  return 'Hvilken kasse hører ordet til?';
}

// Neutral narration for screen readers – and a calm map of the flow. The tug on
// the line is part of the story, so it is spoken too.
export function statusLine(sea, trip, finale = false) {
  if (finale) return 'Gratulerer! Alle ordene er fanget.';
  // A fish breaking free is the most immediate thing that can happen.
  if (sea.fishes.some((fish) => fish.escaped)) return 'Fisken slapp unna – den svømmer videre.';
  const fish = activeFish(sea);
  if (!fish) return `${tripRequest()}. ${trip.collected} av ${trip.goal} i dag.`;
  if (fish.status === 'hooked') {
    const tug = fish.grip < 0.5 ? ' Den drar i snøret!' : '';
    return `${fishWord(fish)} – sveiv inn fisken, ${fish.reelStep} av ${REEL_STEPS}.${tug}`;
  }
  return `${fishWord(fish)} ligger på dekk. Hvilken kasse hører ordet til?`;
}

export function WordFishing() {
  const [journal, setJournal] = usePersistentState(JOURNAL_KEY, createJournal, journalCodec);
  const [trip, setTrip] = usePersistentState(TRIP_KEY, () => createTripPlan(1), tripCodec);
  const [sea, setSea] = useState(() => createSea(trip, unavailableWords(journal)));
  const [soundOn, setSoundOn] = useState(!isMuted());
  const [bookOpen, setBookOpen] = useState(false);
  const [tripCard, setTripCard] = useState(null); // { tripNumber, reward }
  const [hintCrateId, setHintCrateId] = useState(null);
  const [landed, setLanded] = useState(null); // { crateId, word, gain, key } just after a catch lands

  const onLine = activeFish(sea);
  const aboard = aboardFish(sea);
  const rewards = unlockedRewards(journal.decorations);
  const finale = allWordsCaught(journal);

  // The whole sea lives on one calm heartbeat; every rule runs inside tickSea,
  // so the component only renders and plays sounds.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setSea((prev) => tickSea(prev));
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    document.body.style.background = PAGE_BG;
    return () => { document.body.style.background = ''; };
  }, []);

  // A fish landing on deck is a state change, not a click: hook it here so the
  // sound follows the catch however the reel was tapped.
  const hadFish = useRef(false);
  useEffect(() => {
    const landed = Boolean(aboardFish(sea));
    if (landed && !hadFish.current) sounds.plop();
    hadFish.current = landed;
  }, [sea]);

  // A fish breaking free is a moment, not a state: the sea marks it for exactly
  // one tick (see `escaped` in sea.js), and we answer with the sound of the line
  // coming loose. It simply swims on – nothing is lost, and it can be hooked
  // again at once.
  useEffect(() => {
    if (sea.fishes.some((fish) => fish.escaped)) sounds.escape();
  }, [sea]);

  // The "try another crate" glow is a moment, not a state: it fades by itself.
  useEffect(() => {
    if (!hintCrateId) return undefined;
    const timer = window.setTimeout(() => setHintCrateId(null), HINT_MS);
    return () => window.clearTimeout(timer);
  }, [hintCrateId]);

  // The same goes for the pop on the crate a catch just landed in.
  useEffect(() => {
    if (!landed) return undefined;
    const timer = window.setTimeout(() => setLanded(null), LANDED_MS);
    return () => window.clearTimeout(timer);
  }, [landed]);

  useEffect(() => {
    if (!bookOpen) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setBookOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bookOpen]);

  // Every trip is a fresh sea: new shoal, new deal, same crates.
  function startTrip(tripNumber, planJournal = journal) {
    const plan = createTripPlan(tripNumber);
    setTrip(plan);
    setSea(createSea(plan, unavailableWords(planJournal)));
    setTripCard(null);
    setHintCrateId(null);
    setLanded(null);
  }

  // The whole book is full: back to a brand-new hunt, with an empty book. The
  // seabed collection restarts with it on purpose – the finished journey is
  // over, so unlike Sound Labyrinth's gallery, nothing is carried over.
  function startOver() {
    sounds.select();
    const fresh = createJournal();
    setJournal(fresh);
    startTrip(1, fresh);
  }

  function tapFish(fish) {
    // The end-of-trip card, and the grand finale, are moments to read, not
    // places to fish: while either is up the shoal keeps drifting but nobody can
    // be hooked or reeled.
    if (tripCard || finale) return;
    if (fish.status === 'swim') {
      // A catch still waiting on deck is the task at hand: nobody new can be
      // hooked, so a tap on the shoal is not a move at all – no sound, no state
      // change, and no fish drawn as a button (see FishSprite).
      if (!canHookFish(sea)) return;
      sounds.hook();
      setHintCrateId(null);
      setSea((prev) => hookFish(prev, fish.id));
      return;
    }
    if (fish.status === 'hooked') {
      sounds.reel();
      setSea((prev) => reelFish(prev, fish.id));
    }
  }

  // The reading task: the catch goes into the crate the word belongs in. A crate
  // that does not take the word is not a mistake – the fish calmly slips back
  // into the water (exactly like the child's own "slipp ut igjen") and the right
  // crate glows. Nothing is lost, nothing counts, and nothing is read aloud:
  // reading the word is the whole task.
  function putInCrate(crateId) {
    const fish = aboard;
    if (!fish || finale) return;
    const word = fishWord(fish);
    // A word from a finished category has nowhere to go, exactly as if no
    // crate on board carried it.
    const targetCrateId = crateForWord(trip, word);
    const wanted = targetCrateId && hasRoomForWord(journal, word) ? targetCrateId : null;

    if (wanted !== crateId) {
      sounds.blub();
      setSea((prev) => slipFish(prev, fish.id));
      if (wanted) setHintCrateId(wanted);
      return;
    }

    sounds.crate();
    const isNewWord = !hasWord(journal, word);
    let nextJournal = isNewWord ? recordCatch(journal, word) : journal;
    // The words this delivery takes out of play – the catch itself and, when a
    // crate just reached its target, everything left in its pool – leave the
    // water with it, so no fish ever carries a word with nowhere to go.
    const outOfPlay = unavailableWords(nextJournal);
    setSea((prev) => deliverFish(prev, fish.id, crateId, outOfPlay));

    // The crate pops for every catch, but only a word that is new to the book
    // gets the "+1": the crate's count is a count of different words.
    setLanded((prev) => ({ crateId, word, gain: isNewWord ? 1 : 0, key: (prev?.key ?? 0) + 1 }));
    const nextTrip = withDelivery(trip);

    // The trip is celebrated on the delivery that completes it, and the very
    // last word of the book ends the whole game on the finale screen. A trip
    // that was already full (say, restored from a save) never awards twice.
    const final = allWordsCaught(nextJournal);
    const finished = tripComplete(nextTrip) && !tripComplete(trip);
    if (final || finished) {
      const trips = nextJournal.trips + 1;
      const reward = rewardForTrip(trips);
      nextJournal = recordDecoration(recordTrip(nextJournal), reward ? trips - 1 : -1);
      sounds.fanfare();
      if (!final) setTripCard({ tripNumber: trips, reward });
    }

    setJournal(nextJournal);
    setTrip(nextTrip);
    // A word nobody has caught before gets its own little chime and goes into the
    // fishing book – no card interrupts the fishing.
    if (isNewWord) sounds.newWord();
  }

  function slipCatch() {
    if (!aboard) return;
    sounds.blub();
    setSea((prev) => slipFish(prev, aboard.id));
  }

  function newTrip() {
    if (finale) return;
    sounds.select();
    startTrip(journal.trips + 1);
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setAudioMuted(!next);
    if (next) sounds.hook();
  }

  return <main className="game-page fishing-page">
    <GameHeader title="Ordfiske">
      <p className="fishing-intro">
        Fiskene svømmer rundt med hvert sitt ord. Trykk på en fisk for å feste kroken, og sveiv den
        inn med jevne tak – stopper du opp, drar fisken seg løs og svømmer videre. Legg fangsten i
        kassen ordet hører til, og fyll fangstboka di.
      </p>
      <div className="game-controls">
        <button className="chip" type="button" onClick={() => { sounds.select(); setBookOpen(true); }}>
          Fangstboka <span aria-hidden="true">📖</span>
          <span className="chip-badge">{wordsCaught(journal)}/{TARGET_WORD_COUNT}</span>
        </button>
        <button className="chip" type="button" onClick={newTrip} disabled={finale}>Ny tur <span aria-hidden="true">🎣</span></button>
        <button
          className="chip chip-icon"
          type="button"
          aria-pressed={!soundOn}
          aria-label={soundOn ? 'Slå av lyd' : 'Slå på lyd'}
          onClick={toggleSound}
        >
          {soundOn ? '🔊' : '🔇'}
        </button>
      </div>
    </GameHeader>

    <section className="sea-stage">
      <div className="sea" style={{ '--waterline': `${WATERLINE}%` }} role="group" aria-label="Havet med ord-fisker">
        <SeaScene
          decorations={rewards}
          lineTo={lineTarget(sea)}
          tripNumber={trip.number}
          onLine={Boolean(onLine)}
          slack={onLine && onLine.status === 'hooked' ? 1 - onLine.grip : 0}
        >
          {sea.fishes.map((fish) => (
            <FishSprite key={fish.id} fish={fish} onTap={tapFish} tappable={!tripCard && canHookFish(sea)} />
          ))}
        </SeaScene>

        <div className="trip-order">
          <p className="trip-order-badge">Tur {trip.number}</p>
          <p className="trip-order-request">{tripRequest()}</p>
          <p className="trip-order-progress">{trip.collected} av {trip.goal} i dag</p>
        </div>

        {aboard && <div className="catch-card">
          <p className="catch-kicker">På dekk! Hvilken kasse hører ordet til?</p>
          <p className="catch-word">{fishWord(aboard)}</p>
          <button type="button" className="outline-button" onClick={slipCatch}>
            Slipp ut igjen <span aria-hidden="true">🐟</span>
          </button>
        </div>}

        {tripCard && !finale && <>
          <ConfettiLayer count={44} />
          <div className="trip-done" role="dialog" aria-live="polite" aria-label={`Tur ${tripCard.tripNumber} er ferdig`}>
            <p className="trip-done-mascot" aria-hidden="true">{tripCard.reward ? '⭐' : '🎣'}</p>
            <h2>Tur {tripCard.tripNumber} er ferdig!</h2>
            {tripCard.reward && <p className="trip-done-reward">
              Du fant {tripCard.reward.label.toLowerCase()} på sjøbunnen!
            </p>}
            <p className="trip-done-tally">{wordsCaught(journal)} av {TARGET_WORD_COUNT} ord i fangstboka</p>
            <button className="primary-button" type="button" onClick={newTrip}>Ny tur <span aria-hidden="true">🎣</span></button>
          </div>
        </>}

        {finale && <>
          <ConfettiLayer count={90} />
          <div className="finale-done" role="dialog" aria-live="polite" aria-label="Gratulerer med alle ordene">
            <p className="finale-mascot" aria-hidden="true">🏆</p>
            <h2>Gratulerer!</h2>
            <p className="finale-message"><span aria-hidden="true">🎉</span> {ALL_WORDS_MESSAGE}</p>
            <p className="finale-tally">
              Du har fanget alle {TARGET_WORD_COUNT} ordene og funnet {rewards.length} skatter på sjøbunnen!
            </p>
            <button className="primary-button" type="button" onClick={startOver}>
              Start på nytt <span aria-hidden="true">🔄</span>
            </button>
          </div>
        </>}

        {bookOpen && <FishingBook journal={journal} onClose={() => setBookOpen(false)} />}

        <p className="visually-hidden" role="status">{landed
          ? `Ordet ${landed.word} ligger i kassen ${crateById(landed.crateId).label}.${landed.gain === 1 ? '' : ` ${landed.word} var allerede i fangstboka.`}`
          : statusLine(sea, trip, finale)}</p>
      </div>

      <p className="dock-hint" aria-hidden="true">{finale ? 'Alle ordene er fanget! 🎉' : dockHint(sea, tripCard)}</p>
      <CrateDock
        trip={trip}
        journal={journal}
        aboard={Boolean(aboard)}
        hintCrateId={hintCrateId}
        landed={landed}
        onPut={putInCrate}
      />
      <p className="sea-note">
        {finale
          ? 'Alle ordene i fangstboka er fanget!'
          : `${wordsCaught(journal)} av ${TARGET_WORD_COUNT} ord i fangstboka – ${wordsLeftToCatch(journal)} igjen.`}
      </p>
    </section>
  </main>;
}

