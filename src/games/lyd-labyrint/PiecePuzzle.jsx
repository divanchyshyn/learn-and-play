import { useCallback, useEffect, useRef, useState } from 'react';
import { isDragStart } from './drag.js';
import { sounds } from './sounds.js';

export const PUZZLE_PIECE_COUNT = 4;

// A puzzle session is one whole picture run: which picture is being collected
// (rotated between sessions), the order the pieces were found, and which
// pieces already sit on the board (indexed by cell). Pure and injectable, so
// tests can pin Math.random and stay deterministic.
export function createPuzzleSession(imageCount, random = Math.random) {
  return {
    imageIndex: Math.floor(random() * imageCount),
    earned: [],
    cells: [null, null, null, null], // cell -> piece index, or null when empty
  };
}

// Earning the piece for one solved maze, in a fixed reward order.
export function earnPiece(session) {
  if (session.earned.length >= PUZZLE_PIECE_COUNT) return session;
  return { ...session, earned: [...session.earned, session.earned.length] };
}

// Which cell is this piece sitting in, or -1 when it is still up in a slot.
export function cellForPiece(session, piece) {
  return session.cells.findIndex((cell) => cell === piece);
}

// The child may place any found piece into any cell – the picture only works
// when the right quadrant lands in the right place. Dropping onto a cell that
// already holds a piece sends that piece back to the slot row (the spelling
// board swaps letters rather than losing any, and so does the puzzle).
// Moving a placed piece to another cell moves it there, freeing its old cell.
export function placePiece(session, piece, cell) {
  if (!session.earned.includes(piece)) return session;
  if (cell < 0 || cell >= PUZZLE_PIECE_COUNT) return session;
  const cells = [...session.cells];
  const current = cells.indexOf(piece);
  if (current === cell) return session;
  if (current !== -1) cells[current] = null;
  cells[cell] = piece;
  return { ...session, cells };
}

// Taking a piece off the board returns it to the slot row.
export function recallPiece(session, piece) {
  const cell = cellForPiece(session, piece);
  if (cell === -1) return session;
  const cells = [...session.cells];
  cells[cell] = null;
  return { ...session, cells };
}

// The board is full once every cell holds a piece...
export function isBoardFull(session) {
  return session.cells.every((cell) => cell !== null);
}

// ...and correct when the quadrants line up: piece n belongs in cell n.
export function isPuzzleCorrect(session) {
  return session.cells.every((piece, cell) => piece === cell);
}

// Assembler panel for the collected picture. Found pieces wait in the slot row
// on top; every piece can be dragged into any of the four cells (or tapped
// into the first free one). A full board is judged exactly like a written
// word: when the picture reads correctly it snaps together, zooms, and bursts
// confetti; a jumbled picture shakes red and the child drags the pieces back
// to the top and tries again.
export function PiecePuzzle({ images, session, onClose, onPlace, onRecall, onRestart }) {
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
  }, [session]);

  const startDrag = useCallback((piece, from, event) => {
    setDrag({ piece, from, startX: event.clientX, startY: event.clientY, moved: false, pointerType: event.pointerType });
    setGhost({ x: event.clientX, y: event.clientY });
  }, []);

  // Follow the pointer while dragging. On release: over a board cell the piece
  // lands there, over the top slot row it goes back to a slot, and a plain tap
  // places a top piece (into the first free cell) or recalls a placed one.
  useEffect(() => {
    if (drag === null) return undefined;
    const onMove = (event) => {
      setDrag((prev) => (prev
        ? { ...prev, moved: prev.moved || isDragStart(prev.startX, prev.startY, event.clientX, event.clientY, prev.pointerType) }
        : prev));
      setGhost({ x: event.clientX, y: event.clientY });
    };
    const onUp = (event) => {
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
    };
    // When a mobile browser claims a gesture (usually for scrolling or an
    // overscroll edge) it fires pointercancel instead of pointerup; clear the
    // drag so a piece is never left in a half-finished state.
    const onCancel = () => {
      setDrag(null);
      setGhost(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }, [drag, onPlace, onRecall]);

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