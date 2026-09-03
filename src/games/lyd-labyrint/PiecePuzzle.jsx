import { useCallback, useEffect, useRef, useState } from 'react';
import { ConfettiLayer } from '../../shared/ConfettiLayer.jsx';
import { sounds } from './sounds.js';

export const PUZZLE_PIECE_COUNT = 4;

// A puzzle session is one whole picture run: which picture is being collected
// (rotated between sessions) and which of the four pieces have been earned /
// already placed on the board. Pure and injectable, so tests can pin
// Math.random and stay deterministic.
export function createPuzzleSession(imageCount, random = Math.random) {
  return {
    imageIndex: Math.floor(random() * imageCount),
    earned: [],
    placed: [false, false, false, false],
  };
}

// Earning the piece for one solved maze. Pieces are rewarded in a fixed order
// (front row left-to-right, then back row left-to-right), so every piece
// simply snaps to "its own" cell – easy on purpose, this is a child's game.
export function earnPiece(session) {
  if (session.earned.length >= PUZZLE_PIECE_COUNT) return session;
  return { ...session, earned: [...session.earned, session.earned.length] };
}

// A piece can only be placed once it has been earned; every other call is a
// safe no-op that returns the very same session object (so React bails out).
export function placePiece(session, piece) {
  if (!session.earned.includes(piece) || session.placed[piece]) return session;
  const placed = [...session.placed];
  placed[piece] = true;
  return { ...session, placed };
}

// Taking a piece back from the board returns it to the slot row.
export function recallPiece(session, piece) {
  if (!session.placed[piece]) return session;
  const placed = [...session.placed];
  placed[piece] = false;
  return { ...session, placed };
}

// The picture is complete once all four pieces sit on the board.
export function isPuzzleComplete(session) {
  return (
    session.earned.length === PUZZLE_PIECE_COUNT
    && session.placed.every(Boolean)
  );
}

// Panel for assembling the collected picture. Earned pieces wait in the slot
// row on top; dragging one anywhere inside the square board below (or tapping
// it) drops it onto its own cell. The board is a 2x2 grid and the piece's
// quadrant simply covers one quarter of the source image via CSS background
// positioning – no extra slicing needed on the image itself. When the picture
// is complete the cells snap together, the board zooms, confetti falls, and a
// little victory card offers closing the popup or starting over.
export function PiecePuzzle({ images, session, onClose, onPlace, onRecall, onRestart }) {
  const { imageIndex, earned, placed } = session;
  const image = images[imageIndex] ?? images[0];
  const done = isPuzzleComplete(session);
  const [drag, setDrag] = useState(null); // { piece, startX, startY, moved }
  const [ghost, setGhost] = useState(null); // { x, y } while dragging
  const [showComplete, setShowComplete] = useState(false);
  const completedRef = useRef(false);

  // The first piece to place is the next slot that is earned but not yet used.
  const nextSlot = earned.find((piece) => !placed[piece]) ?? -1;

  useEffect(() => {
    if (done && !completedRef.current) {
      completedRef.current = true;
      sounds.puzzleDone();
      const timer = window.setTimeout(() => setShowComplete(true), 1000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [done]);

  const startDrag = useCallback((piece, event) => {
    setDrag({ piece, startX: event.clientX, startY: event.clientY, moved: false });
    setGhost({ x: event.clientX, y: event.clientY });
  }, []);

  const dragRef = useRef(drag);
  dragRef.current = drag;

  // Follow the pointer while dragging. Committing on release: the piece lands
  // on the board when dropped over it, and a plain tap on a slot places the
  // piece too (pointerup without a move), mirroring the spelling puzzle.
  useEffect(() => {
    if (drag === null) return undefined;
    const onMove = (event) => {
      setDrag((prev) => (prev
        ? { ...prev, moved: prev.moved || Math.hypot(event.clientX - prev.startX, event.clientY - prev.startY) > 6 }
        : prev));
      setGhost({ x: event.clientX, y: event.clientY });
    };
    const onUp = (event) => {
      const active = dragRef.current;
      if (active) {
        const overBoard = pieceBoardAt(event.clientX, event.clientY);
        if (overBoard || !active.moved) onPlace(active.piece);
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
  }, [drag, onPlace]);
const slotClass = (piece) => {
    let className = 'puzzle-slot';
    if (earned.includes(piece)) className += ' earned';
    if (placed[piece]) className += ' placed';
    return className;
  };

  return (
    <div className="puzzle-backdrop">
      {done && (
        <div className="confetti-lift" aria-hidden="true">
          <ConfettiLayer count={44} />
        </div>
      )}

      <div
        className="puzzle-card"
        role="dialog"
        aria-modal="true"
        aria-label="Puslespill"
        style={{ '--puzzle-image': `url(${image})` }}
      >
        <h2 className="puzzle-title">{'\u{1F9E9}'} Puslespill</h2>
        {done
          ? <p className="puzzle-hint">Bildet er ferdig! Fantastisk jobbet.</p>
          : (
            <p className="puzzle-hint">
              {earned.length < PUZZLE_PIECE_COUNT
                ? `Løs labyrinter for å finne brikker. ${earned.length} av 4 funnet.`
                : 'Alle brikkene er funnet! Dra dem ned til plassene sine for å bygge bildet.'}
            </p>
          )}

        <div className="puzzle-slots" aria-label="Puslespillbrikker">
          {[0, 1, 2, 3].map((piece) => {
            const has = earned.includes(piece);
            const used = placed[piece];
            return (
              <button
                type="button"
                key={piece}
                className={slotClass(piece)}
                disabled={!has || used}
                autoFocus={piece === nextSlot}
                onPointerDown={(event) => { if (has && !used) startDrag(piece, event); }}
                onClick={() => { if (has && !used) onPlace(piece); }}
                aria-label={!has
                  ? `Tom plass ${piece + 1} – løs en labyrint for å vinne den`
                  : (used
                      ? `Brikke ${piece + 1} er lagt i bildet`
                      : `Brikke ${piece + 1} – dra den til bildet eller trykk`)}
              >
                {has
                  ? <span className={`puzzle-piece piece-${piece}`} aria-hidden="true" />
                  : <span className="puzzle-slot-empty" aria-hidden="true">?</span>}
              </button>
            );
          })}
        </div>

        <p className="puzzle-prompt">Sett brikkene sammen:</p>

        <div
          className={`puzzle-board${done ? ' done' : ''}`}
          role="application"
          aria-label="Tomt kvadrat til brikkene"
        >
          {[0, 1, 2, 3].map((piece) => (
            <div className={`puzzle-cell${placed[piece] ? ' filled' : ''}`} key={piece}>
              {placed[piece] && (
                <button
                  type="button"
                  className={`puzzle-piece piece-${piece}`}
                  onClick={() => onRecall(piece)}
                  aria-label={`Brikke ${piece + 1} – trykk for å ta den tilbake til toppen`}
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

        {showComplete && (
          <div className="puzzle-victory">
            <p className="puzzle-victory-emoji" aria-hidden="true">{'\u{1F389}'}</p>
            <h3>Bildet er ferdig!</h3>
            <p>Du samlet hele bildet ved å løse alle fire labyrintene. Nå er spillet fullført!</p>
            <div className="puzzle-victory-actions">
              <button className="roll-button" type="button" onClick={onClose}>Lukk bildet</button>
              <button className="outline-button" type="button" onClick={onRestart}>Spill igjen</button>
            </div>
          </div>
        )}

        <button type="button" className="puzzle-close" onClick={onClose}>Lukk {'\u2715'}</button>
      </div>
    </div>
  );
}

// The board is one drop target: dropping a piece anywhere inside the square
// auto-snaps it to its own cell. Returns true when the point is over it.
function pieceBoardAt(x, y) {
  const board = document.querySelector('.puzzle-board');
  if (!board) return false;
  const rect = board.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}