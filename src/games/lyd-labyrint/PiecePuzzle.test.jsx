import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useState } from 'react';
import { render, fireEvent, act, screen, within } from '@testing-library/react';
import {
  PiecePuzzle,
  PUZZLE_PIECE_COUNT,
  createPuzzleSession,
  earnPiece,
  isPuzzleComplete,
  placePiece,
  recallPiece,
} from './PiecePuzzle.jsx';

// A session that has already collected all four pieces (deterministic image 0).
function earnedAll(imageCount = 3) {
  let session = createPuzzleSession(imageCount, () => 0);
  for (let i = 0; i < PUZZLE_PIECE_COUNT; i += 1) session = earnPiece(session);
  return session;
}

// Controlled harness so tests can click pieces and watch the parent state move.
function PuzzleHarness({ images, initial }) {
  const [session, setSession] = useState(initial);
  return (
    <PiecePuzzle
      images={images}
      session={session}
      onClose={() => {}}
      onPlace={(piece) => setSession((prev) => placePiece(prev, piece))}
      onRecall={(piece) => setSession((prev) => recallPiece(prev, piece))}
      onRestart={() => {}}
    />
  );
}

describe('piece puzzle helpers', () => {
  it('createPuzzleSession picks a deterministic image index', () => {
    expect(createPuzzleSession(5, () => 0).imageIndex).toBe(0);
    expect(createPuzzleSession(5, () => 0.6).imageIndex).toBe(3);
    expect(createPuzzleSession(1, () => 0).earned).toEqual([]);
  });

  it('earnPiece rewards pieces in order and caps at four', () => {
    let session = createPuzzleSession(1, () => 0);
    for (let i = 0; i < PUZZLE_PIECE_COUNT; i += 1) {
      session = earnPiece(session);
      expect(session.earned).toHaveLength(i + 1);
      expect(session.earned[i]).toBe(i);
    }
    // Once the picture is full, earning is a safe no-op that keeps the object.
    expect(earnPiece(session)).toBe(session);
  });

  it('placePiece only accepts earned pieces and no-ops on repeats', () => {
    const session = createPuzzleSession(1, () => 0);
    expect(placePiece(session, 0)).toBe(session); // not earned yet
    const earned = earnPiece(session);
    const placed = placePiece(earned, 0);
    expect(placed.placed[0]).toBe(true);
    expect(placePiece(placed, 0)).toBe(placed); // already placed
    expect(placePiece(placed, 1)).toBe(placed); // not earned
  });

  it('recallPiece clears a placed piece and remembers recall of empty cells', () => {
    let session = earnPiece(createPuzzleSession(1, () => 0));
    session = placePiece(session, 0);
    const recalled = recallPiece(session, 0);
    expect(recalled.placed[0]).toBe(false);
    expect(recallPiece(recalled, 0)).toBe(recalled); // already taken back
  });

  it('isPuzzleComplete requires all four pieces to sit on the board', () => {
    let session = earnedAll();
    expect(isPuzzleComplete(session)).toBe(false);
    session = [0, 1, 2, 3].reduce((acc, piece) => placePiece(acc, piece), session);
    expect(isPuzzleComplete(session)).toBe(true);
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
    expect(screen.getByRole('application', { name: 'Tomt kvadrat til brikkene' })).toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: /Brikke \d – dra den/ })).toHaveLength(0);
  });

  it('places earned pieces by tap and celebrates the finished picture', () => {
    render(<PuzzleHarness images={['a', 'b', 'c']} initial={earnedAll()} />);
    const dialog = screen.getByRole('dialog', { name: 'Puslespill' });
    expect(within(dialog).getAllByRole('button', { name: /Brikke \d – dra den til bildet eller trykk/ })).toHaveLength(4);

    for (const name of ['Brikke 1', 'Brikke 2', 'Brikke 3', 'Brikke 4']) {
      fireEvent.click(within(dialog).getByRole('button', { name: new RegExp(`^${name}`) }));
    }

    // Every cell is filled and the moved pieces leave empty slots behind.
    expect(dialog.querySelectorAll('.puzzle-cell.filled')).toHaveLength(4);
    expect(within(dialog).queryAllByRole('button', { name: /Brikke \d – dra den/ })).toHaveLength(0);

    // The zoom animation + confetti + victory card follow the last placement.
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

  it('a placed piece can be taken back to its slot by tapping the board cell', () => {
    let session = earnPiece(createPuzzleSession(1, () => 0));
    session = placePiece(session, 0);
    render(<PuzzleHarness images={['a']} initial={session} />);

    expect(screen.getByRole('button', { name: /Brikke 1 – trykk for å ta den tilbake/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Brikke 1 – trykk for å ta den tilbake/ }));
    expect(screen.getByRole('button', { name: /Brikke 1 – dra den til bildet eller trykk/ })).toBeInTheDocument();
  });
});