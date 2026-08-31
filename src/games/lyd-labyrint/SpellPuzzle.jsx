import { useCallback, useEffect, useRef, useState } from 'react';
import { sounds } from './sounds.js';
import { speakWord } from './words.js';

// The door's word, split into mixed-up letter tiles. Pure and injectable so
// the game tests can pin randomness and stay deterministic.
export function scrambleLetters(word, random = Math.random) {
  const letters = [...word];
  for (let index = letters.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [letters[index], letters[target]] = [letters[target], letters[index]];
  }
  return letters;
}

// The tray and the word slots are both fixed word-length rows, so the board
// never re-shuffles as letters are moved around. Dropping `active` (a tile
// grabbed from the tray or from another slot):
// - onto a word slot (`slot`) – a tray tile lands there (its old top spot
//   stays empty; a displaced slot letter returns to the first free top slot);
// - onto the top row (`traySpot`) – a slot letter is dragged back up (if the
//   spot is taken the two letters swap), or a tray tile is reordered/swapped
//   within the top row.
// Exported so the tests can pin every rule without flying the pointer.
export function applyDrop({ slots, tray, active, slot = -1, traySpot = -1 }) {
  if (active.area === 'tray') {
    if (tray[active.index] !== active.letter) return { slots, tray, changed: false };

    if (traySpot >= 0) {
      if (traySpot >= tray.length || traySpot === active.index) return { slots, tray, changed: false };
      const nextTray = [...tray];
      nextTray[active.index] = tray[traySpot];
      nextTray[traySpot] = active.letter;
      return { slots, tray: nextTray, changed: true };
    }

    if (slot < 0 || slot >= slots.length) return { slots, tray, changed: false };
    const nextSlots = [...slots];
    const occupant = nextSlots[slot];
    nextSlots[slot] = active.letter;
    const nextTray = [...tray];
    nextTray[active.index] = null;
    if (occupant !== null) {
      const freeTop = nextTray.indexOf(null);
      if (freeTop >= 0) nextTray[freeTop] = occupant;
    }
    return { slots: nextSlots, tray: nextTray, changed: true };
  }

  if (active.area === 'slot') {
    const source = active.index;
    const letter = slots[source];
    if (letter === null) return { slots, tray, changed: false };

    if (traySpot >= 0) {
      if (traySpot >= tray.length) return { slots, tray, changed: false };
      const nextSlots = [...slots];
      const nextTray = [...tray];
      nextSlots[source] = nextTray[traySpot];
      nextTray[traySpot] = letter;
      return { slots: nextSlots, tray: nextTray, changed: true };
    }

    if (slot < 0 || slot >= slots.length || source === slot) return { slots, tray, changed: false };
    const nextSlots = [...slots];
    nextSlots[slot] = letter;
    nextSlots[source] = slots[slot];
    return { slots: nextSlots, tray, changed: true };
  }

  return { slots, tray, changed: false };
}

// Spelling lock shown when the fox walks into a closed door. Every letter can
// be tapped or dragged onto ANY slot – nothing stops a wrong order, so the
// child decides when to commit. The "Sjekk svaret" button then judges the
// word: a correct spelling unlocks the door (onSolve), a wrong one shakes the
// word red, reads the misspelling aloud and lets the child reorder and retry.
export function SpellPuzzle({ word, emoji, onSolve, onClose }) {
  const [slots, setSlots] = useState(() => Array(word.length).fill(null));
  const [tray, setTray] = useState(() => scrambleLetters(word));
  const [drag, setDrag] = useState(null); // { letter, index, area, startX, startY, moved }
  const [ghost, setGhost] = useState(null); // { x, y } while dragging
  const [shake, setShake] = useState(null); // { key } red shake after a wrong check
  const [feedback, setFeedback] = useState(null); // message under the buttons

  // Refs keep window-level drag listeners cheap and correctness easy: the
  // listeners are registered while dragging, and only need the freshest data.
  const wordRef = useRef(word);
  wordRef.current = word;
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const trayRef = useRef(tray);
  trayRef.current = tray;
  const solvedRef = useRef(false);
  const shakeKeyRef = useRef(0);
  // A tap fires pointerdown → our window pointerup handler AND a click. The
  // ref lets the click know the pointer already did the work.
  const pointerHandledRef = useRef(false);

  // Reading scaffold: play the word as the puzzle opens, and let the child
  // replay it with the "hør ordet" button.
  useEffect(() => {
    const timer = window.setTimeout(() => speakWord(word), 340);
    return () => window.clearTimeout(timer);
  }, [word]);

  const firstEmpty = slots.indexOf(null);

  // Commit a drop/tap via the pure applyDrop helper and keep the tray in sync.
  // `drop` selects the target: `{ slot }` for the word row or `{ traySpot }`
  // for the top row (dragging a placed letter back up, or reordering up top).
  const commitDrop = useCallback((active, drop) => {
    const result = applyDrop({ slots: slotsRef.current, tray: trayRef.current, active, ...drop });
    if (!result.changed) return false;
    setSlots(result.slots);
    setTray(result.tray);
    sounds.pop();
    return true;
  }, []);

  // Tap a tray tile: it lands in the first empty slot.
  const placeNext = useCallback((letter, index) => {
    commitDrop({ letter, area: 'tray', index }, { slot: slotsRef.current.indexOf(null) });
  }, [commitDrop]);

  const recall = useCallback((slot) => {
    const currentSlots = slotsRef.current;
    const letter = currentSlots[slot];
    if (!letter) return;
    const next = [...currentSlots];
    next[slot] = null;
    const nextTray = [...trayRef.current];
    const freeTop = nextTray.indexOf(null);
    if (freeTop >= 0) nextTray[freeTop] = letter;
    setSlots(next);
    setTray(nextTray);
    sounds.select();
  }, []);

  const startDrag = useCallback((letter, index, area, event) => {
    setDrag({ letter, index, area, startX: event.clientX, startY: event.clientY, moved: false });
    setGhost({ x: event.clientX, y: event.clientY });
  }, []);

  // While a tile is being dragged, follow the pointer and drop on release.
  const dragRef = useRef(drag);
  dragRef.current = drag;

  useEffect(() => {
    if (!drag) return undefined;
    const onMove = (event) => {
      setDrag((prev) => (prev
        ? { ...prev, moved: prev.moved || Math.hypot(event.clientX - prev.startX, event.clientY - prev.startY) > 6 }
        : prev));
      setGhost({ x: event.clientX, y: event.clientY });
    };
    const onUp = (event) => {
      const active = dragRef.current;
      if (active) {
        let acted = false;
        if (active.moved) {
          const target = dropTargetAt(event.clientX, event.clientY);
          if (target) {
            if (target.area === 'slots') {
              acted = commitDrop(active, { slot: target.index });
            } else if (target.index >= 0) {
              acted = commitDrop(active, { traySpot: target.index });
            } else {
              // Dropped somewhere on the tray background: send the letter to
              // the first free top spot (or re-home a slot letter up there).
              const traySpot = trayRef.current.indexOf(null);
              if (traySpot >= 0) acted = commitDrop(active, { traySpot });
            }
          }
        } else if (active.area === 'tray') {
          // Tapping a tray tile places it. A tap on a filled slot is left for
          // that button's own onClick to recall, so only tray taps act here.
          acted = commitDrop(active, { slot: slotsRef.current.indexOf(null) });
        }
        // Guard the click that follows a tap on the same button. A real drag
        // settles on a shared ancestor instead, so its stale flag must not be
        // left behind to swallow the child's next tap.
        if (acted && !active.moved) pointerHandledRef.current = true;
      }
      setDrag(null);
      setGhost(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [drag, commitDrop]);

  // A wrong answer shakes the word red, buzzes, and reads the misspelling
  // back aloud so the child hears that the order is off.
  const triggerWrong = useCallback((message) => {
    shakeKeyRef.current += 1;
    const key = shakeKeyRef.current;
    setShake({ key });
    setFeedback(message);
    sounds.wrong();
    window.setTimeout(() => {
      setShake((prev) => (prev && prev.key === key ? null : prev));
    }, 700);
  }, []);

  const checkAnswer = useCallback(() => {
    if (solvedRef.current) return;
    const current = slotsRef.current;
    if (current.some((letter) => letter === null)) {
      triggerWrong('Sett inn alle bokstavene, så trykker du på «Sjekk svaret».');
      const partial = current.join('');
      if (partial) speakWord(partial);
      return;
    }
    if (current.join('') === wordRef.current) {
      solvedRef.current = true;
      onSolve();
      return;
    }
    triggerWrong('Ikke riktig – prøv igjen!');
    speakWord(current.join(''));
  }, [onSolve, triggerWrong]);

  const slotClass = (index) => {
    let className = 'spell-slot';
    if (slots[index]) className += ' filled';
    else if (index === firstEmpty) className += ' next';
    if (drag && drag.area === 'slot' && drag.index === index) className += ' dragging';
    return className;
  };

  return (
    <div className="spell-backdrop">
      <div
        className={`spell-card${shake ? ' wrong' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Stav ordet ${word}`}
      >
        <div className="spell-picture" aria-hidden="true">{emoji}</div>
        <h2 className="spell-title">Stav ordet!</h2>
        <button type="button" className="spell-hear" autoFocus onClick={() => speakWord(word)}>
          🔉 Hør ordet
        </button>

        {drag && ghost && (
          <span className="spell-ghost" style={{ left: ghost.x, top: ghost.y }} aria-hidden="true">
            {drag.letter}
          </span>
        )}

        <div className="spell-tray" aria-label="Bokstavklosser">
          {tray.map((letter, index) => (
            letter ? (
              <button
                type="button"
                className={`spell-tile${drag && drag.area === 'tray' && drag.index === index ? ' dragging' : ''}`}
                key={index}
                onClick={() => {
                  if (pointerHandledRef.current) {
                    pointerHandledRef.current = false;
                    return;
                  }
                  placeNext(letter, index);
                }}
                onPointerDown={(event) => startDrag(letter, index, 'tray', event)}
                aria-label={`Bokstaven ${letter}`}
              >
                {letter}
              </button>
            ) : (
              <span className="spell-tray-empty" key={index} aria-hidden="true" />
            )
          ))}
        </div>

        {/*
          The key re-mounts the slot row on each wrong check so the shake
          animation restarts even when it was already running.
        */}
        <div
          className={`spell-slots${shake ? ' wrong' : ''}`}
          key={shake ? shake.key : 0}
          aria-label="Bygg ordet i døren"
        >
          {slots.map((letter, index) => (
            <button
              type="button"
              className={slotClass(index)}
              key={index}
              onClick={() => {
                if (pointerHandledRef.current) {
                  pointerHandledRef.current = false;
                  return;
                }
                recall(index);
              }}
              onPointerDown={(event) => {
                if (!letter) return;
                startDrag(letter, index, 'slot', event);
              }}
              aria-label={letter
                ? `Bokstaven ${letter} står på plass ${index + 1} – trykk for å ta den tilbake`
                : `Tom plass nummer ${index + 1}`}
            >
              {letter ?? ''}
            </button>
          ))}
        </div>

        <button type="button" className="spell-check" onClick={checkAnswer}>
          {'\u2713'} Sjekk svaret
        </button>

        {feedback && (
          <p className="spell-feedback" role="status" aria-live="polite">{feedback}</p>
        )}

        <p className="spell-help">
          Trykk eller dra en bokstav til en plass nede. Dra eller trykk den tilbake til toppen når du vil bytte om – «Sjekk svaret» avgjør om ordet er riktig.
        </p>
        <button type="button" className="spell-close" onClick={onClose}>Lukk ✕</button>
      </div>
    </div>
  );
}

// Which drop target is under the pointer, if any: a word slot, a specific top
// position, or the tray background (`{ area: 'tray', index: -1 }` for "any
// free spot up top").
function dropTargetAt(x, y) {
  const slots = document.querySelectorAll('.spell-slot');
  for (let index = 0; index < slots.length; index += 1) {
    const rect = slots[index].getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return { area: 'slots', index };
  }
  const traySpots = document.querySelectorAll('.spell-tray .spell-tile, .spell-tray .spell-tray-empty');
  for (let index = 0; index < traySpots.length; index += 1) {
    const rect = traySpots[index].getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return { area: 'tray', index };
  }
  const tray = document.querySelector('.spell-tray');
  if (tray) {
    const rect = tray.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return { area: 'tray', index: -1 };
  }
  return null;
}