import { useCallback, useEffect, useRef, useState } from 'react';
import { isDragStart, useTileDrag } from './drag.js';
import { sounds } from './sounds.js';
import {
  PUZZLE_PIECE_COUNT,
  cellForPiece,
  isBoardFull,
  isPuzzleCorrect,
} from './puzzle.js';

// The puzzle's pure rules - which picture a run collects, the reward order, and
// where a piece may go - live in puzzle.js, because the saved-progress codec
// needs them and must not import a component module. They are re-exported here
// so the game keeps one import site for the puzzle.
export {
  PUZZLE_PIECE_COUNT,
  cellForPiece,
  createPuzzleSession,
  earnPiece,
  isBoardFull,
  isPuzzleCorrect,
  nextImageIndex,
  placePiece,
  recallPiece,
} from './puzzle.js';

// Assembler panel for the collected picture. Found pieces wait in the slot row
// on top; every piece can be dragged into any of the four cells (or tapped
// into the first free one). A full board is judged exactly like a written
// word: when the picture reads correctly it snaps together, zooms, and bursts
// confetti; a jumbled picture shakes red and the child drags the pieces back
// to the top and tries again.
export function PiecePuzzle({ images, session, onClose, onPlace, onRecall, onRestart, onSolved }) {
  const { imageIndex, earned, cells } = session;
  const image = images[imageIndex] ?? images[0];
  const solved = isBoardFull(session) && isPuzzleCorrect(session);
  const [drag, setDrag] = useState(null); // { piece, from, startX, startY, moved }
  const [ghost, setGhost] = useState(null); // { x, y } while dragging
  const [wrong, setWrong] = useState(false);
  const [shakeKey, setShakeKey] = useState(0); // bumped to restart the red shake
  const [feedback, setFeedback] = useState(null);
  const solvedRef = useRef(false);
  const verdictRef = useRef('open'); // 'open' | 'full-wrong' | 'full-correct'
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const dragRef = useRef(drag);
  dragRef.current = drag;

  // The first piece to place is the next slot that is earned but not used yet.
  const nextSlot = earned.find((piece) => cellForPiece(session, piece) === -1) ?? -1;

  // Judge every finished face like a checked word. A wrong arrangement keeps
  // the board filled and marked red until the child frees a piece; a correct
  // picture stays assembled on screen and is dismissed only by a click on it.
  useEffect(() => {
    if (solvedRef.current) return undefined;
    const full = isBoardFull(session);
    const correct = isPuzzleCorrect(session);
    const verdict = full ? (correct ? 'full-correct' : 'full-wrong') : 'open';
    if (verdictRef.current === verdict) return undefined;
    verdictRef.current = verdict;

    if (verdict === 'full-correct') {
      solvedRef.current = true;
      setWrong(false);
      setFeedback(null);
      sounds.puzzleDone();
      // The picture has been seen whole: tell the game so its rotation moves on
      // to a picture the child has not seen yet (the gallery in progress.js).
      onSolved?.(imageIndex);
    } else if (verdict === 'full-wrong') {
      setWrong(true);
      setFeedback('Ikke riktig – prøv igjen!');
      sounds.wrong();
      setShakeKey((key) => key + 1);
    } else {
      setWrong(false);
      setFeedback(null);
    }
    return undefined;
  }, [imageIndex, onSolved, session]);

  const startDrag = useCallback((piece, from, event) => {
    setDrag({ piece, from, startX: event.clientX, startY: event.clientY, moved: false, pointerType: event.pointerType });
    setGhost({ x: event.clientX, y: event.clientY });
  }, []);

  // Follow the pointer while dragging. On release: over a board cell the piece
  // lands there, over the top slot row it goes back to a slot, and a plain tap
  // places a top piece (into the first free cell) or recalls a placed one. The
  // listeners and their cleanup are shared with the spelling lock (useTileDrag);
  // what a drop means for a quadrant is this puzzle's own rule.
  const onMove = useCallback((event) => {
    setDrag((prev) => (prev
      ? { ...prev, moved: prev.moved || isDragStart(prev.startX, prev.startY, event.clientX, event.clientY, prev.pointerType) }
      : prev));
    setGhost({ x: event.clientX, y: event.clientY });
  }, []);

  const onRelease = useCallback((event) => {
    const active = dragRef.current;
    if (active) {
      const target = active.moved ? pieceDropTarget(event.clientX, event.clientY) : null;
      if (target?.area === 'board') {
        onPlace(active.piece, target.cell);
      } else if (active.moved && target?.area === 'slots') {
        onRecall(active.piece);
      } else if (!active.moved && active.from === 'slot') {
        const free = sessionRef.current.cells.indexOf(null);
        if (free >= 0) onPlace(active.piece, free);
      } else if (!active.moved && active.from === 'board') {
        onRecall(active.piece);
      }
    }
    setDrag(null);
    setGhost(null);
  }, [onPlace, onRecall]);

  const onCancel = useCallback(() => {
    setDrag(null);
    setGhost(null);
  }, []);

  useTileDrag({ active: drag, onMove, onRelease, onCancel });

  const slotClass = (piece) => {
    let className = 'puzzle-slot';
    if (earned.includes(piece)) className += ' earned';
    if (cellForPiece(session, piece) !== -1) className += ' placed';
    return className;
  };

  return (
    <div className="puzzle-backdrop">
      <div
        className="puzzle-card"
        role="dialog"
        aria-modal="true"
        aria-label="Puslespill"
        style={{ '--puzzle-image': `url(${image})` }}
      >
        <h2 className="puzzle-title">{'\u{1F9E9}'} Puslespill</h2>
        {solved
          ? <p className="puzzle-hint">Bildet er ferdig – trykk på bildet for å lukke. {'\u{1F389}'}</p>
          : (
            <p className="puzzle-hint">
              {earned.length < PUZZLE_PIECE_COUNT
                ? `Løs labyrinter for å finne brikker. ${earned.length} av 4 funnet.`
                : 'Alle brikkene er funnet! Dra dem ned i rutene – hvis bildet blir rødt, prøv å bytte om.'}
            </p>
          )}

        <div className="puzzle-slots" aria-label="Puslespillbrikker">
          {[0, 1, 2, 3].map((piece) => {
            const has = earned.includes(piece);
            const placed = cellForPiece(session, piece) !== -1;
            return (
              <button
                type="button"
                key={piece}
                className={slotClass(piece)}
                disabled={!has || placed || solved}
                autoFocus={piece === nextSlot}
                onPointerDown={(event) => { if (has && !placed && !solved) startDrag(piece, 'slot', event); }}
                onClick={() => {
                  // A pointerup tap already places the piece; the session check
                  // keeps the click that follows from dropping it a second time.
                  if (sessionRef.current.cells.includes(piece)) return;
                  const free = sessionRef.current.cells.indexOf(null);
                  if (free >= 0) onPlace(piece, free);
                }}
                aria-label={!has
                  ? `Tom plass ${piece + 1} – løs en labyrint for å vinne den`
                  : (placed
                      ? `Brikke ${piece + 1} ligger i bildet`
                      : `Brikke ${piece + 1} – dra den til bildet eller trykk`)}
              >
                {has
                  ? <span className={`puzzle-piece piece-${piece}`} aria-hidden="true" />
                  : <span className="puzzle-slot-empty" aria-hidden="true">?</span>}
              </button>
            );
          })}
        </div>

        {!solved && <p className="puzzle-prompt">Sett brikkene sammen:</p>}

        {/* The board remounts on each wrong check so the red shake restarts. When the
            picture is complete it stays on screen and a click anywhere on it
            closes the panel – the only way to hide the finished picture. */}
        <div
          key={wrong ? `wrong-${shakeKey}` : 'board'}
          className={`puzzle-board${solved ? ' done' : ''}${wrong ? ' wrong' : ''}`}
          role="application"
          aria-label={solved ? 'Ferdig bilde – trykk for å lukke' : 'Løs firkant til brikkene'}
          onClick={solved ? onClose : undefined}
        >
          {cells.map((piece, cell) => (
            <div className={`puzzle-cell${piece !== null ? ' filled' : ''}`} key={cell}>
              {piece !== null && (
                <button
                  type="button"
                  className={`puzzle-piece piece-${piece}`}
                  disabled={solved}
                  onPointerDown={solved ? undefined : (event) => startDrag(piece, 'board', event)}
                  onClick={solved ? undefined : () => {
                    // Same guard as the slots: a pointerup tap already recalled.
                    if (sessionRef.current.cells[cell] !== piece) return;
                    onRecall(piece);
                  }}
                  aria-label={`Brikke ${piece + 1} ligger i rute ${cell + 1} – dra eller trykk for å ta den tilbake`}
                />
              )}
            </div>
          ))}
        </div>

        {drag && ghost && (
          <span
            className="puzzle-ghost"
            style={{ left: ghost.x, top: ghost.y }}
            aria-hidden="true"
          >
            <span className={`puzzle-piece piece-${drag.piece}`} />
          </span>
        )}

        {feedback && (
          <p className="puzzle-feedback" role="status" aria-live="polite">{feedback}</p>
        )}

        {solved && (
          <div className="puzzle-solved-actions">
            <button className="outline-button" type="button" onClick={onRestart}>Spill igjen</button>
          </div>
        )}

        {!solved && (
          <button type="button" className="puzzle-close" onClick={onClose}>Lukk {'\u2715'}</button>
        )}
      </div>
    </div>
  );
}

// Where is the pointer relative to the panel? Every board cell is an individual
// drop target; the whole slot row acts as the "back to the top" area.
function pieceDropTarget(x, y) {
  const cells = document.querySelectorAll('.puzzle-cell');
  for (let index = 0; index < cells.length; index += 1) {
    const rect = cells[index].getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return { area: 'board', cell: index };
  }
  const row = document.querySelector('.puzzle-slots');
  if (row) {
    const rect = row.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return { area: 'slots', index: -1 };
  }
  return null;
}