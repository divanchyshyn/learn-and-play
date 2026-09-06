import { describe, it, expect } from 'vitest';
import { pieceSessionCodec } from './progress.js';

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