import { useEffect, useRef, useState } from 'react';
import { ConfettiLayer } from '../../shared/ConfettiLayer.jsx';
import { GameHeader } from '../../shared/GameHeader.jsx';
import { speakNorwegian } from '../../shared/speech.js';
import { usePersistentState } from '../../shared/usePersistentState.js';
import { CrateDock } from './CrateDock.jsx';
import { Fangstbok } from './Fangstbok.jsx';
import { FishSprite } from './FishSprite.jsx';
import { SeaScene } from './SeaScene.jsx';
import { isMuted, setMuted as setAudioMuted, sounds } from './sounds.js';
import {
  DELIVER_TICKS, FISH_ON_SCREEN, REEL_STEPS, TICK_MS, WATERLINE,
  aboardFish, activeFish, createSea, deliverFish, fishWord,
  hookFish, lineTarget, reelFish, slipFish, tickSea,
} from './sea.js';
import {
  createTripPlan, crateForWord, rewardForTrip, tripComplete,
  tripRequest, unlockedRewards, withDelivery,
} from './trip.js';
import {
  ALL_WORDS_MESSAGE, JOURNAL_KEY, TRIP_KEY, allWordsCaught, createJournal, hasWord,
  journalCodec, recordCatch, recordDecoration, recordTrip, tripCodec,
  wordsCaught, wordsLeftToCatch,
} from './journal.js';
import { WORD_COUNT } from './words.js';

const PAGE_BG = '#dceef4';
// How long a crate glows after a catch that belongs elsewhere.
const HINT_MS = 2600;

// Kept close to the constants above so tests and CSS stay in step with the
// component's timing (see sea.js).
export const TIMING = { TICK_MS, REEL_STEPS, FISH_ON_SCREEN, DELIVER_TICKS };

// Neutral narration for screen readers – and a calm map of the flow. The tug on
// the line is part of the story, so it is spoken too.
export function statusLine(sea, trip) {
  const fish = activeFish(sea);
  if (!fish) return `${tripRequest(trip)}. ${trip.collected} av ${trip.goal} i dag.`;
  if (fish.status === 'hooked') {
    const tug = fish.grip < 0.5 ? ' Den drar i snøret!' : '';
    return `${fishWord(fish)} – sveiv inn fisken, ${fish.reelStep} av ${REEL_STEPS}.${tug}`;
  }
  return `${fishWord(fish)} ligger på dekk. Hvilken kasse hører ordet til?`;
}

export function WordFishing() {
  const [journal, setJournal] = usePersistentState(JOURNAL_KEY, createJournal, journalCodec);
  const [trip, setTrip] = usePersistentState(TRIP_KEY, () => createTripPlan(1), tripCodec);
  const [sea, setSea] = useState(() => createSea(trip));
  const [soundOn, setSoundOn] = useState(!isMuted());
  const [bookOpen, setBookOpen] = useState(false);
  const [notice, setNotice] = useState(null); // { kind: 'notWanted' } while a fish had nowhere to go
  const [tripCard, setTripCard] = useState(null); // { tripNumber, reward }
  const [hintCrateId, setHintCrateId] = useState(null);

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

  useEffect(() => {
    if (!bookOpen) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setBookOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bookOpen]);

  // Every trip is a fresh sea: new shoal, new deal, same crates.
  function startTrip(tripNumber) {
    const plan = createTripPlan(tripNumber);
    setTrip(plan);
    setSea(createSea(plan));
    setNotice(null);
    setTripCard(null);
    setHintCrateId(null);
  }

  function tapFish(fish) {
    // The end-of-trip card is a moment to read, not a place to fish: while it is
    // up the shoal keeps drifting but nobody can be hooked or reeled.
    if (tripCard) return;
    if (fish.status === 'swim') {
      sounds.hook();
      setHintCrateId(null);
      setNotice(null);
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
  // into the water (exactly like the child's own "slipp ut igjen"), the right
  // crate glows, and the word is read aloud. Nothing is lost and nothing counts.
  function putInCrate(crateId) {
    const fish = aboard;
    if (!fish) return;
    const word = fishWord(fish);
    const wanted = crateForWord(trip, word);

    if (wanted !== crateId) {
      sounds.blub();
      setSea((prev) => slipFish(prev, fish.id));
      speakNorwegian(word, { rate: 0.8 });
      if (wanted) setHintCrateId(wanted);
      else setNotice({ kind: 'notWanted' });
      return;
    }

    sounds.crate();
    setSea((prev) => deliverFish(prev, fish.id, crateId));

    const isNewWord = !hasWord(journal, word);
    let nextJournal = isNewWord ? recordCatch(journal, word) : journal;
    const nextTrip = withDelivery(trip);

    // The trip is celebrated exactly on the delivery that completes it – a trip
    // that was already full (say, restored from a save) never awards twice.
    if (tripComplete(nextTrip) && !tripComplete(trip)) {
      const trips = nextJournal.trips + 1;
      const reward = rewardForTrip(trips);
      nextJournal = recordDecoration(recordTrip(nextJournal), reward ? trips - 1 : -1);
      sounds.fanfare();
      setTripCard({ tripNumber: trips, reward });
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

  function hearWord(word) {
    speakNorwegian(word, { rate: 0.8 });
  }

  function newTrip() {
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
          <span className="chip-badge">{wordsCaught(journal)}/{WORD_COUNT}</span>
        </button>
        <button className="chip" type="button" onClick={newTrip}>Ny tur <span aria-hidden="true">🎣</span></button>
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
          {sea.fishes.map((fish) => <FishSprite key={fish.id} fish={fish} onTap={tapFish} />)}
        </SeaScene>

        <div className="trip-order">
          <p className="trip-order-badge">Tur {trip.number}</p>
          <p className="trip-order-request">{tripRequest(trip)}</p>
          <p className="trip-order-progress">{trip.collected} av {trip.goal} i dag</p>
        </div>

        {aboard && <div className="catch-card">
          <p className="catch-kicker">På dekk! Hvilken kasse hører ordet til?</p>
          <button
            type="button"
            className="catch-word"
            onClick={() => hearWord(fishWord(aboard))}
            aria-label={`Hør ordet ${fishWord(aboard)}`}
          >
            {fishWord(aboard)}<span className="catch-speaker" aria-hidden="true">🔊</span>
          </button>
          <button type="button" className="outline-button" onClick={slipCatch}>
            Slipp ut igjen <span aria-hidden="true">🐟</span>
          </button>
        </div>}

        {notice?.kind === 'notWanted' && <button type="button" className="notice-card" onClick={() => setNotice(null)}>
          <span className="notice-kicker">Fisken svømmer videre <span aria-hidden="true">🐟</span></span>
          <span className="notice-note">{tripRequest(trip)}</span>
        </button>}

        {tripCard && <>
          <ConfettiLayer count={44} />
          <div className="trip-done" role="dialog" aria-live="polite" aria-label={`Tur ${tripCard.tripNumber} er ferdig`}>
            <p className="trip-done-mascot" aria-hidden="true">{tripCard.reward ? '⭐' : '🎣'}</p>
            <h2>Tur {tripCard.tripNumber} er ferdig!</h2>
            {tripCard.reward && <p className="trip-done-reward">
              Du fant {tripCard.reward.label.toLowerCase()} på sjøbunnen!
            </p>}
            {finale && <p className="trip-done-finale"><span aria-hidden="true">🎉</span> {ALL_WORDS_MESSAGE}</p>}
            <p className="trip-done-tally">{wordsCaught(journal)} av {WORD_COUNT} ord i fangstboka</p>
            <button className="primary-button" type="button" onClick={newTrip}>Ny tur <span aria-hidden="true">🎣</span></button>
          </div>
        </>}

        {bookOpen && <Fangstbok journal={journal} onClose={() => setBookOpen(false)} />}

        <p className="visually-hidden" role="status">{statusLine(sea, trip)}</p>
      </div>

      <CrateDock
        trip={trip}
        journal={journal}
        aboard={Boolean(aboard)}
        hintCrateId={hintCrateId}
        onPut={putInCrate}
      />
      <p className="sea-note">
        {finale
          ? 'Alle ordene i fangstboka er fanget!'
          : `${wordsCaught(journal)} av ${WORD_COUNT} ord i fangstboka – ${wordsLeftToCatch(journal)} igjen.`}
      </p>
    </section>
  </main>;
}

