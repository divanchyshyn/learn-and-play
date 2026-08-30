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

// Spelling lock shown when the fox walks into a closed door. Tap a letter
// (or drag it) into the next slot – a correct letter clicks in with a pop, a
// wrong one wibbles away again. Tap a placed letter to put it back. There are
// no failure states and no penalty: a child may try a thousand times.
export function SpellPuzzle({ word, emoji, onSolve, onClose }) {
  const [slots, setSlots] = useState(() => Array(word.length).fill(null));
  const [tray, setTray] = useState(() => scrambleLetters(word));
  const [drag, setDrag] = useState(null); // { letter, index, startX, startY, moved }
  const [ghost, setGhost] = useState(null); // { x, y } while dragging
  const [reject, setReject] = useState(null); // { slot, key } for the wibble animation

  // Refs keep window-level drag listeners cheap and correctness easy: the
  // listeners are registered while dragging, and only need the freshest data.
  const wordRef = useRef(word);
  wordRef.current = word;
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const trayRef = useRef(tray);
  trayRef.current = tray;
  const rejectKeyRef = useRef(0);
  const solvedRef = useRef(false);
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

  const rejectSlot = useCallback((slot) => {
    rejectKeyRef.current += 1;
    const key = rejectKeyRef.current;
    setReject({ slot, key });
    window.setTimeout(() => {
      setReject((prev) => (prev && prev.key === key ? null : prev));
    }, 300);
  }, []);

  const placeLetter = useCallback((letter, slot) => {
    const currentSlots = slotsRef.current;
    if (currentSlots[slot]) return false;
    if (letter !== wordRef.current[slot]) {
      rejectSlot(slot);
      sounds.thud();
      return false;
    }
    const next = [...currentSlots];
    next[slot] = letter;
    setSlots(next);
    const trayIndex = trayRef.current.indexOf(letter);
    if (trayIndex >= 0) {
      const nextTray = [...trayRef.current];
      nextTray.splice(trayIndex, 1);
      setTray(nextTray);
    }
    sounds.pop();
    return true;
  }, [rejectSlot]);

  // Keyboard / tap convenience: "place into the next empty slot". Buttons
  // handle Enter/Space natively; a tap without dragging lands here too.
  const placeNext = useCallback((letter) => {
    const currentSlots = slotsRef.current;
    const slot = currentSlots.indexOf(null);
    if (slot === -1) return;
    placeLetter(letter, slot);
  }, [placeLetter]);

  const recall = useCallback((slot) => {
    const currentSlots = slotsRef.current;
    const letter = currentSlots[slot];
    if (!letter) return;
    const next = [...currentSlots];
    next[slot] = null;
    setSlots(next);
    setTray([...trayRef.current, letter]);
    sounds.select();
  }, []);

  const startDrag = useCallback((letter, index, event) => {
    setDrag({ letter, index, startX: event.clientX, startY: event.clientY, moved: false });
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
        pointerHandledRef.current = true;
        const slot = dropSlotAt(event.clientX, event.clientY);
        if (slot >= 0) {
          if (!slotsRef.current[slot]) placeLetter(active.letter, slot);
        } else if (!active.moved) {
          placeNext(active.letter);
        }
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
  }, [drag, placeLetter, placeNext]);
// When every slot is filled the door unlocks. SolvedRef guards against a
  // stray re-fire while the game closes the puzzle.
  useEffect(() => {
    if (!solvedRef.current && slots.every(Boolean)) {
      solvedRef.current = true;
      onSolve();
    }
  }, [slots, onSolve]);

  const slotClass = (index) => {
    let className = 'spell-slot';
    if (slots[index]) className += ' filled';
    else if (index === firstEmpty) className += ' next';
    if (reject && reject.slot === index) className += ' reject';
    return className;
  };

  return (
    <div className="spell-backdrop">
      <div className="spell-card" role="dialog" aria-modal="true" aria-label={`Stav ordet ${word}`}>
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
            <button
              type="button"
              className={`spell-tile${drag && drag.index === index ? ' dragging' : ''}`}
              key={`${index}-${letter}`}
              onClick={() => {
                if (pointerHandledRef.current) {
                  pointerHandledRef.current = false;
                  return;
                }
                placeNext(letter);
              }}
              onPointerDown={(event) => startDrag(letter, index, event)}
              aria-label={`Bokstaven ${letter}`}
            >
              {letter}
            </button>
          ))}
        </div>

        <div className="spell-slots" aria-label="Sett bokstavene på riktig plass">
          {slots.map((letter, index) => (
            <button
              type="button"
              className={slotClass(index)}
              key={index}
              onClick={() => recall(index)}
              aria-label={letter
                ? `Bokstaven ${letter} står på plass ${index + 1} – trykk for å ta den tilbake`
                : `Tom plass nummer ${index + 1}`}
            >
              {letter ?? ''}
            </button>
          ))}
        </div>

        <p className="spell-help">
          Trykk eller dra en bokstav ned på riktig plass. Trykk på en lagt bokstav for å ta den tilbake.
        </p>
        <button type="button" className="spell-close" onClick={onClose}>Lukk ✕</button>
      </div>
    </div>
  );
}

// Which slot is under the pointer, if any.
function dropSlotAt(x, y) {
  const slots = document.querySelectorAll('.spell-slot');
  let hit = -1;
  slots.forEach((element, index) => {
    const rect = element.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) hit = index;
  });
  return hit;
}