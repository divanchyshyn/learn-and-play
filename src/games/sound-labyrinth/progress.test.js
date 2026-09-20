import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { pieceSessionCodec, gameCodec } from './progress.js';
import { createGame } from './LydLabyrint.jsx';

// createGame carves a maze with whatever Math.random says; pinning it keeps the
// fixture deterministic, exactly like the game tests do.
beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('lyd-labyrint progress codec', () => {
  it('round-trips a picture session through serialize and parse', () => {
    const session = { imageIndex: 3, earned: [0, 1, 3], cells: [0, null, null, 1] };
    const restored = pieceSessionCodec.parse(pieceSessionCodec.serialize(session));
    expect(restored).toEqual(session);
  });

  it('parses a fresh, empty session exactly as saved', () => {
    const raw = pieceSessionCodec.serialize({
      imageIndex: 2,
      earned: [],
      cells: [null, null, null, null],
    });
    expect(pieceSessionCodec.parse(raw)).toEqual({
      imageIndex: 2,
      earned: [],
      cells: [null, null, null, null],
    });
  });

  it('returns null for junk or non-JSON storage', () => {
    expect(pieceSessionCodec.parse('not json at all')).toBeNull();
    expect(pieceSessionCodec.parse('{"version":1,"pieceSession":"nope"}')).toBeNull();
    expect(pieceSessionCodec.parse(null)).toBeNull();
  });

  it('rejects saved states from a different schema version', () => {
    expect(pieceSessionCodec.parse('{"version":99,"pieceSession":{}}')).toBeNull();
  });

  it('rejects a cells row that is not an array of exactly four entries', () => {
    expect(pieceSessionCodec.parse('{"version":1,"pieceSession":{"earned":[],"cells":[0]}}')).toBeNull();
    expect(pieceSessionCodec.parse('{"version":1,"pieceSession":{"earned":[],"cells":"x"}}')).toBeNull();
  });

  it('normalizes earned pieces and cells instead of trusting storage', () => {
    const raw = JSON.stringify({
      version: 1,
      pieceSession: {
        imageIndex: -2,
        earned: [0, 0, 1, 7, 'x'], // duplicates and out-of-range junk
        cells: ['x', 0, 1, 0], // duplicate piece 0, plus junk
      },
    });
    expect(pieceSessionCodec.parse(raw)).toEqual({
      imageIndex: 0, // repaired to a valid picture index
      earned: [0, 1],
      cells: [null, 0, 1, null],
    });
  });
});

describe('lyd-labyrint game codec', () => {
  it('round-trips a full maze session through serialize and parse', () => {
    const game = createGame(0);
    const restored = gameCodec.parse(gameCodec.serialize(game));
    expect(restored).not.toBeNull();
    expect(restored.maze).toEqual(game.maze);
    expect(restored.doors).toEqual(game.doors);
    expect(restored.mazeIndex).toBe(game.mazeIndex);
    expect(restored.runner).toBe(game.runner);
    expect(restored.pos).toEqual(game.pos);
    expect(restored.celebrated).toBe(false);
  });

  it('restores the exact position, the open doors and the celebrated flag', () => {
    const game = createGame(1);
    const doors = game.doors.map((door, index) => (index === 0 ? { ...door, open: true } : door));
    const saved = { ...game, doors, pos: { ...game.maze.exit }, celebrated: true };
    const restored = gameCodec.parse(gameCodec.serialize(saved));
    expect(restored.pos).toEqual(game.maze.exit);
    expect(restored.doors[0].open).toBe(true);
    expect(restored.doors[1].open).toBe(false);
    expect(restored.celebrated).toBe(true);
  });

  it('resumes in play with no open lock or celebrate moment', () => {
    const game = createGame(0);
    const saved = {
      ...game,
      phase: 'puzzle',
      puzzle: { key: '1,1', dx: 0, dy: 1 },
      pieceJustEarned: 2,
    };
    const restored = gameCodec.parse(gameCodec.serialize(saved));
    expect(restored.phase).toBe('play');
    expect(restored.puzzle).toBeNull();
    expect(restored.pieceJustEarned).toBe(-1);
  });

  it('returns null for junk or non-JSON storage', () => {
    expect(gameCodec.parse('not json at all')).toBeNull();
    expect(gameCodec.parse(null)).toBeNull();
    expect(gameCodec.parse('{"version":1,"game":"nope"}')).toBeNull();
  });

  it('rejects saved states from a different schema version', () => {
    expect(gameCodec.parse('{"version":99,"game":{}}')).toBeNull();
  });

  it('rejects a position that is not a floor cell', () => {
    const game = createGame(0);
    // (0,0) is always outer wall in a generated maze.
    const raw = gameCodec.serialize({ ...game, pos: { x: 0, y: 0 } });
    expect(gameCodec.parse(raw)).toBeNull();
  });

  it('rejects a maze whose floors are not a list of in-bounds cells', () => {
    const game = createGame(0);
    const withFloors = (floors) => gameCodec.serialize({ ...game, maze: { ...game.maze, floors } });
    expect(gameCodec.parse(withFloors('nope'))).toBeNull();
    expect(gameCodec.parse(withFloors(['1,1', '99,99']))).toBeNull();
    expect(gameCodec.parse(withFloors(['1,1']))).toBeNull(); // exit is not a floor
  });

  it('rejects a door that is not a floor cell or misses its word', () => {
    const game = createGame(0);
    const offBoard = game.doors.map((door, index) => (index === 0 ? { ...door, x: 0, y: 0 } : door));
    expect(gameCodec.parse(gameCodec.serialize({ ...game, doors: offBoard }))).toBeNull();
    const wordless = game.doors.map((door, index) => (index === 0 ? { ...door, word: '' } : door));
    expect(gameCodec.parse(gameCodec.serialize({ ...game, doors: wordless }))).toBeNull();
  });

  it('rejects duplicate door positions and an unknown maze index', () => {
    const game = createGame(0);
    const first = game.doors[0];
    const doors = [first, { ...game.doors[1], x: first.x, y: first.y }];
    expect(gameCodec.parse(gameCodec.serialize({ ...game, doors }))).toBeNull();
    expect(gameCodec.parse(gameCodec.serialize({ ...game, mazeIndex: 99 }))).toBeNull();
  });
});