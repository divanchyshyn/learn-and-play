import { PUZZLE_PIECE_COUNT } from './PiecePuzzle.jsx';
import { THEMES } from './mazes.js';

// What a child has collected in Lyd-labyrinten survives a page refresh. Two
// pieces of state are saved:
//
//  * the earned puzzle pieces and the picture they belong to (pieceSession
//    from PiecePuzzle.jsx), and
//  * the maze session itself – the carved labyrinth, which spelling locks are
//    already open, whether the exit was celebrated, and exactly where the
//    runner stood – so a reload drops the child back onto the same tile
//    instead of carving a fresh maze.
//
// The codecs here format each piece for localStorage and read it back,
// refusing any saved state that does not match this version of the game, so a
// future schema change can never make an old save misbehave.

export const PROGRESS_KEY = 'lydLabyrint:progress';
const PROGRESS_VERSION = 1;
export const GAME_KEY = 'lydLabyrint:game';
const GAME_VERSION = 1;

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

// ---- The maze session -------------------------------------------------------
// A game's floors are a Set, which JSON cannot hold, so the saved form flattens
// it to a list of "x,y" keys. A restored maze is rebuilt from scratch: every
// floor cell, door and position is re-checked against the board bounds, so junk
// storage can never put the runner inside a wall.

function isCoord(value) {
  return Number.isInteger(value) && value >= 0;
}

function normalizeCoord(value) {
  if (!value || typeof value !== 'object') return null;
  return isCoord(value.x) && isCoord(value.y) ? { x: value.x, y: value.y } : null;
}

function normalizeMaze(maze) {
  if (!maze || typeof maze !== 'object') return null;
  const { name, theme, width, height } = maze;
  if (typeof name !== 'string' || name.length === 0) return null;
  if (typeof theme !== 'string' || theme.length === 0) return null;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 3 || height < 3) return null;
  if (!Array.isArray(maze.floors)) return null;
  const floors = new Set();
  for (const key of maze.floors) {
    if (typeof key !== 'string') return null;
    const [x, y] = key.split(',').map(Number);
    if (!isCoord(x) || !isCoord(y) || x >= width || y >= height) return null;
    floors.add(`${x},${y}`);
  }
  const start = normalizeCoord(maze.start);
  const exit = normalizeCoord(maze.exit);
  if (!start || !exit) return null;
  if (!floors.has(`${start.x},${start.y}`) || !floors.has(`${exit.x},${exit.y}`)) return null;
  return { name, theme, width, height, floors, start, exit };
}

function normalizeDoor(door, floors) {
  if (!door || typeof door !== 'object') return null;
  if (!isCoord(door.x) || !isCoord(door.y) || !floors.has(`${door.x},${door.y}`)) return null;
  if (typeof door.word !== 'string' || door.word.length === 0) return null;
  if (typeof door.emoji !== 'string' || door.emoji.length === 0) return null;
  if (typeof door.tilt !== 'string') return null;
  return {
    x: door.x,
    y: door.y,
    word: door.word,
    emoji: door.emoji,
    open: door.open === true,
    tilt: door.tilt,
  };
}

export const gameCodec = {
  serialize(game) {
    const { maze, doors, mazeIndex, runner, pos, celebrated } = game;
    return JSON.stringify({
      version: GAME_VERSION,
      game: {
        mazeIndex,
        runner,
        pos,
        celebrated,
        doors: doors.map(({ x, y, word, emoji, open, tilt }) => ({ x, y, word, emoji, open, tilt })),
        maze: {
          name: maze.name,
          theme: maze.theme,
          width: maze.width,
          height: maze.height,
          floors: [...maze.floors],
          start: maze.start,
          exit: maze.exit,
        },
      },
    });
  },
  parse(raw) {
    try {
      const data = JSON.parse(raw);
      if (!data || data.version !== GAME_VERSION) return null;
      const saved = data.game;
      if (!saved || typeof saved !== 'object') return null;
      const maze = normalizeMaze(saved.maze);
      if (!maze) return null;
      if (!Number.isInteger(saved.mazeIndex) || saved.mazeIndex < 0 || saved.mazeIndex >= THEMES.length) return null;
      if (typeof saved.runner !== 'string' || saved.runner.length === 0) return null;
      const pos = normalizeCoord(saved.pos);
      if (!pos || !maze.floors.has(`${pos.x},${pos.y}`)) return null;
      if (!Array.isArray(saved.doors)) return null;
      const doors = [];
      const seen = new Set();
      for (const door of saved.doors) {
        const normalized = normalizeDoor(door, maze.floors);
        if (!normalized) return null;
        const key = `${normalized.x},${normalized.y}`;
        if (seen.has(key)) return null;
        seen.add(key);
        doors.push(normalized);
      }
      // An open spelling lock and the celebrate card are moments, not progress:
      // a restored game always resumes play on the tile where the child stood.
      return {
        maze: { ...maze, doors: doors.map(({ x, y }) => ({ x, y })) },
        mazeIndex: saved.mazeIndex,
        doors,
        runner: saved.runner,
        pos,
        phase: 'play',
        puzzle: null,
        celebrated: saved.celebrated === true,
        pieceJustEarned: -1,
      };
    } catch {
      return null;
    }
  },
};