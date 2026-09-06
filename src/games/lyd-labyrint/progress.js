import { PUZZLE_PIECE_COUNT } from './PiecePuzzle.jsx';

// What a child has collected in Lyd-labyrinten survives a page refresh: the
// earned puzzle pieces and the picture they belong to (pieceSession from
// PiecePuzzle.jsx). The maze itself is deliberately never saved – every visit
// carves a fresh labyrinth, and only the collection carries over.
//
// The codec here formats a pieceSession for localStorage and reads it back,
// refusing any saved state that does not match this version of the game, so a
// future schema change can never make an old save misbehave.

export const PROGRESS_KEY = 'lydLabyrint:progress';
const PROGRESS_VERSION = 1;

// A stored piece index is only real when it names one of the four quadrants.
const isPieceIndex = (piece) =>
  Number.isInteger(piece) && piece >= 0 && piece < PUZZLE_PIECE_COUNT;

// `cells` maps board cell -> piece index (or null while the slot row holds
// it). A restored row is rebuilt from scratch so junk storage (duplicates,
// foreign indices) can never put two pieces on the same board cell.
function normalizeCells(cells) {
  if (!Array.isArray(cells) || cells.length !== PUZZLE_PIECE_COUNT) return null;
  const normalized = Array(PUZZLE_PIECE_COUNT).fill(null);
  for (let cell = 0; cell < cells.length; cell += 1) {
    const piece = cells[cell];
    if (!isPieceIndex(piece)) continue;
    if (normalized.includes(piece)) continue; // a piece sits only once
    normalized[cell] = piece;
  }
  return normalized;
}

export const pieceSessionCodec = {
  serialize(session) {
    return JSON.stringify({ version: PROGRESS_VERSION, pieceSession: session });
  },
  parse(raw) {
    try {
      const data = JSON.parse(raw);
      if (!data || data.version !== PROGRESS_VERSION) return null;
      const saved = data.pieceSession;
      if (!saved || typeof saved !== 'object') return null;
      const cells = normalizeCells(saved.cells);
      if (cells === null) return null;
      const earned = Array.isArray(saved.earned)
        ? [...new Set(saved.earned.filter(isPieceIndex))]
        : [];
      const imageIndex = Number.isInteger(saved.imageIndex) && saved.imageIndex >= 0
        ? saved.imageIndex
        : 0;
      return { imageIndex, earned, cells };
    } catch {
      return null;
    }
  },
};