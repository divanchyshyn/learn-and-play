import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useState } from 'react';
import { render, fireEvent, act, screen, within } from '@testing-library/react';
import {
  PiecePuzzle,
  PUZZLE_PIECE_COUNT,
  cellForPiece,
  createPuzzleSession,
  earnPiece,
  isBoardFull,
  isPuzzleCorrect,
  placePiece,
  recallPiece,
} from './PiecePuzzle.jsx';

// A session that has already collected all four pieces (deterministic image 0).
function earnedAll(imageCount = 3) {
  let session = createPuzzleSession(imageCount, () => 0);
  for (let i = 0; i < PUZZLE_PIECE_COUNT; i += 1) session = earnPiece(session);
  return session;
}

// Controlled harness so tests can place/recall pieces and watch the parent
// state move, exactly like the real game wires the panel.
function PuzzleHarness({ images, initial }) {
  const [session, setSession] = useState(initial);
  return (
    <PiecePuzzle
      images={images}
      session={session}
      onClose={() => {}}
      onPlace={(piece, cell) => setSession((prev) => placePiece(prev, piece, cell))}
      onRecall={(piece) => setSession((prev) => recallPiece(prev, piece))}
      onRestart={() => {}}
    />
  );
}

describe('piece puzzle helpers', () => {
  it('createPuzzleSession picks a deterministic image index and starts empty', () => {
    expect(createPuzzleSession(5, () => 0).imageIndex).toBe(0);
    expect(createPuzzleSession(5, () => 0.6).imageIndex).toBe(3);
    const session = createPuzzleSession(1, () => 0);
    expect(session.earned).toEqual([]);
    expect(session.cells).toEqual([null, null, null, null]);
  });

  it('earnPiece rewards pieces in order and caps at four', () => {
    let session = createPuzzleSession(1, () => 0);
    for (let i = 0; i < PUZZLE_PIECE_COUNT; i += 1) {
      session = earnPiece(session);
      expect(session.earned).toHaveLength(i + 1);
      expect(session.earned[i]).toBe(i);
    }
    expect(earnPiece(session)).toBe(session);
  });

  it('placePiece puts an earned piece into any requested cell', () => {
    const session = createPuzzleSession(1, () => 0);
    expect(placePiece(session, 0, 0)).toBe(session); // not earned yet
    let earned = earnPiece(session);
    earned = placePiece(earned, 0, 2);
    expect(earned.cells).toEqual([null, null, 0, null]);
    // The same cell again and out-of-range cells are safe no-ops.
    expect(placePiece(earned, 0, 2)).toBe(earned);
    expect(placePiece(earned, 0, 8)).toBe(earned);
    expect(placePiece(earned, 0, -1)).toBe(earned);
    // A piece that was never found cannot be placed.
    expect(placePiece(earned, 1, 0)).toBe(earned);
  });

  it('placePiece moves a placed piece and frees its old cell', () => {
    let session = earnPiece(createPuzzleSession(1, () => 0));
    session = placePiece(session, 0, 2);
    session = placePiece(session, 0, 3);
    expect(session.cells).toEqual([null, null, null, 0]);
  });

  it('placePiece returns an occupant to the slot row', () => {
    let session = earnedAll();
    session = placePiece(session, 0, 0);
    session = placePiece(session, 1, 0);
    expect(session.cells[0]).toBe(1);
    expect(session.cells).not.toContain(0); // piece 0 is back in its slot
  });

  it('recallPiece takes a placed piece off the board', () => {
    let session = earnPiece(createPuzzleSession(1, () => 0));
    session = placePiece(session, 0, 3);
    expect(cellForPiece(session, 0)).toBe(3);
    const recalled = recallPiece(session, 0);
    expect(recalled.cells[3]).toBeNull();
    expect(recallPiece(recalled, 0)).toBe(recalled);
  });

  it('isBoardFull and isPuzzleCorrect judge the finished face', () => {
    let session = earnedAll();
    expect(isBoardFull(session)).toBe(false);
    expect(isPuzzleCorrect(session)).toBe(false);

    // Deliberately jumbled: every cell holds a piece, but not its own.
    session = placePiece(session, 1, 0);
    session = placePiece(session, 0, 1);
    session = placePiece(session, 3, 2);
    session = placePiece(session, 2, 3);
    expect(isBoardFull(session)).toBe(true);
    expect(isPuzzleCorrect(session)).toBe(false);

    // Clear it and rebuild correctly: piece n into cell n.
    for (const piece of [0, 1, 2, 3]) session = recallPiece(session, piece);
    for (const piece of [0, 1, 2, 3]) session = placePiece(session, piece, piece);
    expect(isBoardFull(session)).toBe(true);
    expect(isPuzzleCorrect(session)).toBe(true);
  });
});
describe('piece puzzle screen', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows four locked slots and an empty square board until pieces are earned', () => {
    const session = createPuzzleSession(3, () => 0);
    render(<PuzzleHarness images={['a', 'b', 'c']} initial={session} />);
    expect(screen.getByRole('dialog', { name: 'Puslespill' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Tom plass/ })).toHaveLength(4);
    expect(screen.getByRole('application', { name: 'Løs firkant til brikkene' })).toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: /Brikke \d – dra den/ })).toHaveLength(0);
  });

  it('celebrates when the pieces finish in the right cells', () => {
    render(<PuzzleHarness images={['a', 'b', 'c']} initial={earnedAll()} />);
    const dialog = screen.getByRole('dialog', { name: 'Puslespill' });
    expect(within(dialog).getAllByRole('button', { name: /Brikke \d – dra den til bildet eller trykk/ })).toHaveLength(4);

    // Tapping pieces 1–4 drops each into the first free cell, which reads 1-1,
    // 2-2, 3-3, 4-4 – the correct picture straight away.
    for (const name of ['Brikke 1', 'Brikke 2', 'Brikke 3', 'Brikke 4']) {
      fireEvent.click(within(dialog).getByRole('button', { name: new RegExp(`^${name}`) }));
    }

    expect(dialog.querySelectorAll('.puzzle-cell.filled')).toHaveLength(4);
    expect(dialog.querySelector('.puzzle-board').classList.contains('wrong')).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(dialog.querySelector('.puzzle-board').classList.contains('done')).toBe(true);
    // Confetti rides in its own lifted layer outside the card (above the popup).
    expect(document.querySelectorAll('.confetti-piece').length).toBeGreaterThan(0);
    expect(screen.getByText('Bildet er ferdig!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Lukk bildet/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Spill igjen/ })).toBeInTheDocument();
  });

  it('shakes the picture red for a jumbled order and lets the child try again', () => {
    render(<PuzzleHarness images={['a', 'b', 'c']} initial={earnedAll()} />);
    const dialog = screen.getByRole('dialog', { name: 'Puslespill' });

    // Scrambled order: piece 2 lands in cell 1, piece 1 in cell 2, and so on.
    for (const name of ['Brikke 2', 'Brikke 1', 'Brikke 4', 'Brikke 3']) {
      fireEvent.click(within(dialog).getByRole('button', { name: new RegExp(`^${name}`) }));
    }
    expect(dialog.querySelectorAll('.puzzle-cell.filled')).toHaveLength(4);
    expect(dialog.querySelector('.puzzle-board').classList.contains('wrong')).toBe(true);
    expect(dialog.querySelector('.puzzle-board').classList.contains('done')).toBe(false);
    expect(screen.getByText('Ikke riktig – prøv igjen!')).toBeInTheDocument();
    expect(screen.queryByText('Bildet er ferdig!')).toBeNull();

    // Drag/tap each placed piece back to the top row and start over. The board
    // cell labels are the only ones that include "i rute", so they cannot be
    // confused with the placed slot labels ("ligger i bildet").
    for (const piece of [1, 2, 3, 4]) {
      fireEvent.click(within(dialog).getByRole('button', { name: new RegExp(`Brikke ${piece} ligger i rute`) }));
    }
    expect(dialog.querySelector('.puzzle-board').classList.contains('wrong')).toBe(false);
    expect(screen.queryByText('Ikke riktig – prøv igjen!')).toBeNull();
    expect(dialog.querySelectorAll('.puzzle-cell.filled')).toHaveLength(0);

    // Assemble correctly this time.
    for (const name of ['Brikke 1', 'Brikke 2', 'Brikke 3', 'Brikke 4']) {
      fireEvent.click(within(dialog).getByRole('button', { name: new RegExp(`^${name}`) }));
    }
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(screen.getByText('Bildet er ferdig!')).toBeInTheDocument();
    expect(document.querySelectorAll('.confetti-piece').length).toBeGreaterThan(0);
  });

  it('a placed piece can be taken back to its slot by tapping the board cell', () => {
    let session = earnPiece(createPuzzleSession(1, () => 0));
    session = placePiece(session, 0, 0);
    render(<PuzzleHarness images={['a']} initial={session} />);

    expect(screen.getByRole('button', { name: /Brikke 1 ligger i rute 1/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Brikke 1 ligger i rute 1/ }));
    expect(screen.getByRole('button', { name: /Brikke 1 – dra den til bildet eller trykk/ })).toBeInTheDocument();
  });
});