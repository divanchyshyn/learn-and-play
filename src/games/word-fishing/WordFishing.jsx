import { useEffect, useState } from 'react';
import { ConfettiLayer } from '../../shared/ConfettiLayer.jsx';
import { GameHeader } from '../../shared/GameHeader.jsx';
import { speakNorwegian } from '../../shared/speech.js';
import {
  BUCKET_GOAL, CATCH_POINT, CATCH_TICKS, FISH_ON_SCREEN, RESUME_TICKS, TICK_MS,
  catchFish, createWorld, resetBucket, retryFish, surfaceFish, tickWorld,
} from './fish.js';
import { isMuted, setMuted as setAudioMuted, sounds } from './sounds.js';
import { WORD_BANK } from './words.js';

const POND_PAGE_BG = '#d8ecf3';

// One fish sprite. While swimming it shows its word on a small tag; when it
// surfaces the tag is replaced by a card with the big word plus ✅/🔁.
function FishSprite({ fish, onLift, onKeep, onRetry, onHear }) {
  const word = WORD_BANK[fish.wordIndex].word;
  const up = fish.status === 'surface';
  const caught = fish.status === 'caught';
  return <div
    className={`fish fish-${fish.color}${up ? ' up' : ''}${caught ? ' caught' : ''}`}
    style={{ left: `${caught ? CATCH_POINT.x : fish.x}%`, top: `${caught ? CATCH_POINT.y : fish.lane}%`, '--dir': fish.dir }}
  >
    <span className="ripple" aria-hidden="true" />
    {caught ? (
      <span className="swimmer" aria-hidden="true"><span className="tail" /><span className="body" /><span className="fin" /><span className="eye" /></span>
    ) : (
      <button
        type="button"
        className="swimmer"
        onClick={() => onLift(fish)}
        aria-hidden={up || undefined}
        tabIndex={up ? -1 : undefined}
        aria-label={`Fisk som bærer ordet ${word}`}
      >
        <span className="tail" /><span className="body" /><span className="fin" /><span className="eye" />
      </button>
    )}
    {!up && !caught && <span className="fish-tag" aria-hidden="true">{word}</span>}
    {up && <div className="fish-card">
      <button type="button" className="fish-word" onClick={() => onHear(word)} aria-label={`Hør ordet ${word}`}>
        {word}<span className="spk" aria-hidden="true">🔊</span>
      </button>
      <div className="fish-actions">
        <button type="button" className="act got" onClick={() => onKeep(fish)} aria-label="Fanget!">✅</button>
        <button type="button" className="act again" onClick={() => onRetry(fish)} aria-label="En gang til">🔁</button>
      </div>
    </div>}
  </div>;
}

export function Ordfiske() {
  const [world, setWorld] = useState(() => createWorld());
  const [soundOn, setSoundOn] = useState(!isMuted());

  // The whole pond lives on one calm heartbeat; every rule runs inside
  // tickWorld, so the component only renders and plays sounds.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setWorld((prev) => tickWorld(prev));
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    document.body.style.background = POND_PAGE_BG;
    return () => { document.body.style.background = ''; };
  }, []);

  function liftFish(fish) {
    if (fish.status !== 'swim') return;
    sounds.splash();
    setWorld((prev) => surfaceFish(prev, fish.id));
  }

  function keepCatch(fish) {
    if (fish.status !== 'surface') return;
    if (world.caught + 1 >= BUCKET_GOAL) sounds.fanfare(); else sounds.plop();
    setWorld((prev) => catchFish(prev, fish.id));
  }

  function backToSchool(fish) {
    if (fish.status !== 'surface') return;
    sounds.blub();
    setWorld((prev) => retryFish(prev, fish.id));
  }

  function hearWord(word) {
    speakNorwegian(word, { rate: 0.8 });
  }

  function keepFishing() {
    sounds.select();
    setWorld((prev) => resetBucket(prev));
  }

  function freshPond() {
    sounds.select();
    setWorld(createWorld());
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setAudioMuted(!next);
    if (next) sounds.splash();
  }

  return <main className="game-page fishing-page">
    <GameHeader title="Ordfiske">
      <p className="fishing-intro">
        Vatnet vrimler av fisker med ord på seg. Trykk på en fisk, så hopper den opp til deg –
        velg <span aria-hidden="true">✅</span> for å legge den i bøtta, eller <span aria-hidden="true">🔁</span> hvis den får svømme litt til.
      </p>
      <div className="game-controls">
        <button className="chip" type="button" onClick={freshPond}>Nytt fiske 🔄</button>
        <button
          className="chip"
          type="button"
          aria-pressed={!soundOn}
          aria-label={soundOn ? 'Slå av lyd' : 'Slå på lyd'}
          onClick={toggleSound}
        >
          {soundOn ? '🔊' : '🔇'}
        </button>
      </div>
    </GameHeader>

    <section className="pond-stage">
      <div className="pond" role="group" aria-label="Fiskedammen med ord-fisker">
        <span className="weed weed-a" aria-hidden="true">🌿</span>
        <span className="weed weed-b" aria-hidden="true">🌾</span>
        <span className="bubble bubble-a" aria-hidden="true" />
        <span className="bubble bubble-b" aria-hidden="true" />
        <span className="bubble bubble-c" aria-hidden="true" />

        {world.fishes.map((fish) => (
          <FishSprite
            key={fish.id}
            fish={fish}
            onLift={liftFish}
            onKeep={keepCatch}
            onRetry={backToSchool}
            onHear={hearWord}
          />
        ))}

        <div className="bucket-dock" aria-hidden="true">
          <div className="bucket-scene">
            <span className="handle" />
            <div className="bucket">
              <span className="water" key={world.caught} style={{ height: `${(world.caught / BUCKET_GOAL) * 100}%` }} />
            </div>
          </div>
          <span className="bucket-count">{world.caught} av {BUCKET_GOAL}</span>
        </div>
        <div className="visually-hidden" role="status">{world.caught} av {BUCKET_GOAL} fisk i bøtta</div>
      </div>

      {world.celebrating && <>
        <ConfettiLayer count={40} />
        <div className="celebrate-card" role="dialog" aria-live="polite" aria-label="Bøtta er full">
          <p className="mascot" aria-hidden="true">🐟</p>
          <h2>Bøtta er full!</h2>
          <p>{BUCKET_GOAL} fisk i bøtta – godt fiska!</p>
          <button className="again-button" type="button" onClick={keepFishing}>Fisk mer 🎣</button>
        </div>
      </>}
    </section>
  </main>;
}

// Kept close to the constants above so tests and CSS stay in step with the
// component's timing (see TICK_MS / CATCH_TICKS / RESUME_TICKS in fish.js).
export const TIMING = { TICK_MS, CATCH_TICKS, RESUME_TICKS, FISH_ON_SCREEN };
