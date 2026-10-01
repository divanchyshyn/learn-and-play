// The picture puzzle's pure rules: which picture a run collects, the order the
// pieces were found, and which pieces sit where on the board. Nothing here
// touches React or the DOM, so the saved-progress codec (progress.js) can ask
// these questions without importing a component module - it only ever needed
// PUZZLE_PIECE_COUNT, and importing it from PiecePuzzle.jsx dragged the whole
// React component into the storage layer.

export const PUZZLE_PIECE_COUNT = 4;

// Which picture does this run collect? A picture the child has already seen
// whole is excluded (see the gallery in progress.js), so a finished picture
// stays out of the rotation until the other pictures have had their turn. When
// nothing is left to exclude, the whole library is allowed again. `excluded`
// may name indices the library no longer has – a renamed or removed picture
// never breaks a save – so only real indices are offered. Pure and injectable,
// so tests can pin Math.random and stay deterministic.
export function nextImageIndex(imageCount, excluded = [], random = Math.random) {
  if (imageCount <= 0) return 0;
  const used = new Set(excluded);
  const unseen = [];
  for (let index = 0; index < imageCount; index += 1) {
    if (!used.has(index)) unseen.push(index);
  }
  const pool = unseen.length > 0
    ? unseen
    : Array.from({ length: imageCount }, (_, index) => index);
  return pool[Math.floor(random() * pool.length)];
}

// A puzzle session is one whole picture run: which picture is being collected,
// the order the pieces were found, and which pieces already sit on the board
// (indexed by cell).
export function createPuzzleSession(imageCount, random = Math.random, excluded = []) {
  return {
    imageIndex: nextImageIndex(imageCount, excluded, random),
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
