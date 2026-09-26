import { useEffect, useRef, useState } from 'react';
import { ConfettiLayer } from '../../shared/ConfettiLayer.jsx';
import { GameHeader } from '../../shared/GameHeader.jsx';
import { usePersistentState } from '../../shared/usePersistentState.js';
import { ActionBar } from './ActionBar.jsx';
import { CrateDock } from './CrateDock.jsx';
import { FishingBook } from './FishingBook.jsx';
import { FishSprite } from './FishSprite.jsx';
import { ReefArt } from './ReefRewards.jsx';
import { SeaScene } from './SeaScene.jsx';
import { isMuted, setMuted as setAudioMuted, sounds } from './sounds.js';
import { BOAT_KEY_STEP, sailTargetForTap, tensionLevel } from './rig.js';
import {
  TICK_MS, WATERLINE, aboardFish, baitPosition, canSail, canStrike, castBait, createSea, deliverFish,
  fishWord, lineTarget, pullInBait, sailBoat, setReelHold, slipFish, strikeFish, tickSea,
} from './sea.js';
import {
  createTripPlan, crateForWord, rewardForTrip, tripComplete, tripRequest, unlockedRewards,
  withDelivery,
} from './trip.js';
import {
  ALL_WORDS_MESSAGE, JOURNAL_KEY, TRIP_KEY, allWordsCaught, createJournal, hasRoomForWord, hasWord,
  journalCodec, recordCatch, recordDecoration, recordTrip, tripCodec, unavailableWords, wordsCaught,
  wordsLeftToCatch,
} from './journal.js';
import { TARGET_WORD_COUNT, crateById } from './words.js';

const PAGE_BG = '#dceef4';
// How long a crate glows after a catch that belongs elsewhere.
const HINT_MS = 2600;
// How long the "the fish landed in this crate" pop stays on the crate.
const LANDED_MS = 1200;
// How long the little "pull the line up first" nudge stays after a tap that
// could not sail.
const NUDGE_MS = 2000;
// How long a treasure that has just been found keeps its arrival glow on the
// seabed, so the child sees what their trip added.
const REWARD_POP_MS = 3200;

// Kept close to the constants above so tests and CSS stay in step with the
// component's timing (see sea.js and rig.js for the fishing itself).
export const TIMING = { TICK_MS, LANDED_MS, NUDGE_MS, REWARD_POP_MS };

// What the trip is doing right now. One stage drives the hint, the one control
// on the water and the narration, so the three can never disagree:
//
//   sail   – no line in the water: tap the sea to sail, cast to start fishing
//   bait   – the float is out (flying, waiting or being tasted)
//   bite   – the float is under: there is a moment to strike, and only a moment
//   fight  – a fish is hooked: hold the crank, ease off before the line breaks
//   aboard – the catch is on deck: read the word and put it in its crate
//   card   – the trip is finished; finale – the whole fishing book is full
export function seaStage(sea, tripCard = null, finale = false) {
  if (finale) return 'finale';
  if (tripCard) return 'card';
  if (aboardFish(sea)) return 'aboard';
  if (sea.fight) return 'fight';
  if (canStrike(sea)) return 'bite';
  if (sea.bait) return 'bait';
  return 'sail';
}

// What the child should do next, in plain words. Short on purpose: the game is
// played on a tablet, so this line is a nudge, not a manual.
export function stageHint(sea, tripCard = null, finale = false) {
  const stage = seaStage(sea, tripCard, finale);
  if (stage === 'finale') return 'Alle ordene er fanget! 🎉';
  if (stage === 'card') return 'Trykk «Ny tur» for å fiske videre 🎣';
  if (stage === 'aboard') return 'Hvilken kasse hører ordet til?';
  if (stage === 'fight') {
    const level = tensionLevel(sea.fight.tension);
    if (level === 'danger') return 'Slipp sveiven – linjen strammer seg!';
    if (level === 'slack') return 'Stram snøret – fisken slipper kroken!';
    return 'Hold sveiven og sveiv fisken inn!';
  }
  if (stage === 'bite') return 'Napp! Trykk på duppen!';
  if (stage === 'bait') {
    return sea.bait.phase === 'flying' ? 'Agnen flyr utover …' : 'Vent på at en fisk tar agnet …';
  }
  return 'Trykk i vannet der båten skal seile 🎣';
}

// Neutral narration for screen readers – and a calm map of the flow. The bite,
// the fight and a line that snapped are all part of the story, so they are
// spoken too, with no blame anywhere in them.
export function statusLine(sea, trip, finale = false) {
  if (finale) return 'Gratulerer! Alle ordene er fanget.';
  // A fish getting away is the most immediate thing that can happen.
  if (sea.fishes.some((fish) => fish.escaped)) return 'Linjen røk – fisken svømmer videre. Kast ut igjen!';
  if (sea.fishes.some((fish) => fish.thrown)) return 'Fisken slapp kroken – den svømmer videre. Kast ut igjen!';
  if (sea.fishes.some((fish) => fish.spat)) return 'Fisken slapp agnet og svømte videre.';
  const stage = seaStage(sea);
  if (stage === 'aboard') return `${fishWord(aboardFish(sea))} ligger på dekk. Hvilken kasse hører ordet til?`;
  if (stage === 'fight') {
    const fight = sea.fight;
    const level = tensionLevel(fight.tension);
    const warning = level === 'danger' ? ' Linjen strammer seg – slipp!' : '';
    const slack = level === 'slack' ? ' Linjen er slakk – stram!' : '';
    return `Fisken er på kroken, ${Math.round(fight.distance * 100)} prosent inne.${warning}${slack}`;
  }
  if (stage === 'bite') return 'Napp! Trykk på duppen for å feste kroken.';
  return `${tripRequest()}. ${trip.collected} av ${trip.goal} i dag.`;
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
  const [nudge, setNudge] = useState(null); // { text, key } a tap that could not sail
  const [newRewardId, setNewRewardId] = useState(null); // the treasure that just arrived

  const aboard = aboardFish(sea);
  const rewards = unlockedRewards(journal.decorations);
  const finale = allWordsCaught(journal);
  const stage = seaStage(sea, tripCard, finale);

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

  // The float's own sounds, played on the moment it changes: the bait lands with
  // a splash, a fish takes a bite at it, and then the float goes under. They are
  // moments, not states, so they are read off the change in the bait.
  const lastBait = useRef(null);
  useEffect(() => {
    const bait = sea.bait;
    const before = lastBait.current;
    if (bait && before && before.phase === 'flying' && bait.phase === 'waiting') sounds.splash();
    if (bait && before && bait.phase === 'nibbling' && bait.nibbles < before.nibbles) sounds.nibble();
    if (bait && bait.phase === 'biting' && (!before || before.phase !== 'biting')) sounds.bite();
    lastBait.current = bait;
  }, [sea]);

  // The treasure a finished trip just added glows where it landed for a few
  // seconds, then settles into the collection like every other find.
  useEffect(() => {
    if (!newRewardId) return undefined;
    const timer = window.setTimeout(() => setNewRewardId(null), REWARD_POP_MS);
    return () => window.clearTimeout(timer);
  }, [newRewardId]);

  // A fish landing on deck, and the line giving way (or a fish letting go of the
  // bait), are moments too: both are read off the one-tick marks the sea leaves.
  const hadFish = useRef(false);
  useEffect(() => {
    const onDeck = Boolean(aboardFish(sea));
    if (onDeck && !hadFish.current) sounds.plop();
    hadFish.current = onDeck;
    if (sea.fishes.some((fish) => fish.escaped)) sounds.snap();
    if (sea.fishes.some((fish) => fish.thrown)) sounds.blub();
    if (sea.fishes.some((fish) => fish.spat)) sounds.blub();
    // The crank clicks as it turns, about every half second of winding.
    const fight = sea.fight;
    if (fight && fight.holding && fight.ticks % 4 === 1) sounds.reel();
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

  // …and for the nudge that answers a tap which could not sail.
  useEffect(() => {
    if (!nudge) return undefined;
    const timer = window.setTimeout(() => setNudge(null), NUDGE_MS);
    return () => window.clearTimeout(timer);
  }, [nudge]);

  useEffect(() => {
    if (!bookOpen) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setBookOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bookOpen]);

  // Every trip is a fresh sea: new shoal, new deal, same four crates, and an
  // empty boat back at its home spot. The sea never serves a word the fishing
  // book has already filled.
  function startTrip(tripNumber, planJournal = journal) {
    const plan = createTripPlan(tripNumber);
    setTrip(plan);
    setSea(createSea(plan, unavailableWords(planJournal)));
    setTripCard(null);
    setHintCrateId(null);
    setLanded(null);
    setNudge(null);
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

  // A tap that cannot sail – the line is out, or a catch is waiting on deck –
  // is answered with a nudge instead of silence, so it never feels like the
  // game ignoring the child.
  function showNudge(text) {
    setNudge((prev) => ({ text, key: (prev?.key ?? 0) + 1 }));
  }

  // Sailing: tap the water and the boat sets off for that spot. The end card and
  // the grand finale are moments to read, not places to sail.
  function sailTo(xPercent) {
    if (tripCard || finale) return;
    if (!canSail(sea)) {
      showNudge('Dra opp snøret først 🎣');
      return;
    }
    sounds.sail();
    setSea((prev) => sailBoat(prev, sailTargetForTap(xPercent)));
  }

  function sailStep(direction) {
    if (tripCard || finale) return;
    if (!canSail(sea)) return;
    sounds.sail();
    setSea((prev) => sailBoat(prev, prev.boat.targetX + direction * BOAT_KEY_STEP));
  }

  // Putting the line out: the bait is lowered into the water under the boat, and
  // the waiting begins.
  function castLine() {
    if (tripCard || finale) return;
    sounds.cast();
    setHintCrateId(null);
    setSea((prev) => castBait(prev));
  }

  function pullInLine() {
    if (tripCard || finale) return;
    sounds.reel();
    setSea((prev) => pullInBait(prev));
  }

  // The strike: the float is under, and the child answers in time. A tap that
  // comes too late simply means the fish let go – the bait is still out.
  function strike() {
    if (tripCard || finale) return;
    sounds.hook();
    setSea((prev) => strikeFish(prev));
  }

  function holdReel(holding) {
    setSea((prev) => setReelHold(prev, holding));
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
    // A word from a finished category has nowhere to go, exactly as if no crate
    // on board carried it.
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
      // A newly found treasure lands on the seabed with a glow of its own, so the
      // trip's reward is impossible to miss.
      if (reward) {
        setNewRewardId(reward.id);
        sounds.discovery();
      }
      // The final catch ends the whole game; the finale screen takes over.
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
          newRewardId={newRewardId}
          boat={sea.boat}
          bait={sea.bait}
          baitPoint={baitPosition(sea)}
          lineTo={lineTarget(sea)}
          canStrike={canStrike(sea) && !tripCard && !finale}
          nudge={nudge}
          tripNumber={trip.number}
          onSail={sailTo}
          onStep={sailStep}
          onStrike={strike}
        >
          {sea.fishes.map((fish) => <FishSprite key={fish.id} fish={fish} boat={sea.boat} />)}
        </SeaScene>

        <div className="trip-order">
          <p className="trip-order-badge">Tur {trip.number}</p>
          <p className="trip-order-request">{tripRequest(trip)}</p>
          <p className="trip-order-progress">{trip.collected} av {trip.goal} i dag</p>
        </div>

        <ActionBar
          stage={stage}
          fight={sea.fight}
          onCast={castLine}
          onPullIn={pullInLine}
          onStrike={strike}
          onHoldChange={holdReel}
        />

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
            {/* The trip's own find is the picture on the card: the child sees the
                treasure they just earned, not a star that could be anything. */}
            {tripCard.reward
              ? <span className="trip-done-art" aria-hidden="true"><ReefArt id={tripCard.reward.id} /></span>
              : <p className="trip-done-mascot" aria-hidden="true">🎣</p>}
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
      </div>

      <p className="dock-hint" id="sea-hint">
        <span className="dock-hint-stage">{stageHint(sea, tripCard, finale)}</span>
        {!finale && <span className="dock-hint-tally">
          {wordsCaught(journal)} av {TARGET_WORD_COUNT} ord i fangstboka – {wordsLeftToCatch(journal)} igjen.
        </span>}
      </p>

      <CrateDock
        trip={trip}
        journal={journal}
        aboard={Boolean(aboard)}
        hintCrateId={hintCrateId}
        landed={landed}
        onPut={putInCrate}
      />

      <p className="visually-hidden" role="status">{landed
        ? `Ordet ${landed.word} ligger i kassen ${crateById(landed.crateId).label}.${landed.gain === 1 ? '' : ` ${landed.word} var allerede i fangstboka.`}`
        : statusLine(sea, trip, finale)}</p>
    </section>
  </main>;
}
