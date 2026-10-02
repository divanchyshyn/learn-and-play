import { describe, expect, it } from 'vitest';
import syncKeys from '../../sync-keys.json';
import { SYNC_KEYS, isSyncKey, mergeRecord, unionInOrder } from './syncable.js';
import { albumCodec } from '../games/card-battle/album.js';
import { galleryCodec } from '../games/sound-labyrinth/progress.js';
import { PUZZLE_IMAGES } from '../games/sound-labyrinth/puzzle-images.js';
import { journalCodec } from '../games/word-fishing/journal.js';

// Every merge here is a union over values that only ever grow. That is what makes
// syncing safe: the worst case is that one device learns something it did not
// know, and no case loses a child's progress.

const gallery = (seen, round = seen) => galleryCodec.serialize({ seen, round });
const journal = (words, trips, decorations = []) =>
  journalCodec.serialize({ words, trips, decorations });
const album = (discovered) => albumCodec.serialize({ discovered });

describe('the sync registry', () => {
  it('syncs exactly the keys the service allows', () => {
    expect(SYNC_KEYS).toEqual(syncKeys.keys);
    expect(SYNC_KEYS).toEqual([
      'soundLabyrinth:gallery',
      'wordFishing:journal',
      'cardBattle:album',
    ]);
  });

  it('leaves a session in progress and a mute setting on the device', () => {
    expect(isSyncKey('soundLabyrinth:gallery')).toBe(true);
    expect(isSyncKey('soundLabyrinth:game')).toBe(false);
    expect(isSyncKey('soundLabyrinth:progress')).toBe(false);
    expect(isSyncKey('wordFishing:trip')).toBe(false);
    expect(isSyncKey('wordFishing:muted')).toBe(false);
  });

  it('has a merge rule for every key it lets through', () => {
    for (const key of SYNC_KEYS) {
      expect(mergeRecord(key, null, null)).toBeNull();
      expect(mergeRecord(key, 'not json', 'not json')).toBeNull();
    }
  });
});

describe('unionInOrder', () => {
  it('keeps the first list\'s order and appends what is new', () => {
    expect(unionInOrder(['a', 'b'], ['b', 'c', 'a', 'd'])).toEqual(['a', 'b', 'c', 'd']);
    expect(unionInOrder([], ['x'])).toEqual(['x']);
    expect(unionInOrder(['x'], [])).toEqual(['x']);
    expect(unionInOrder(undefined, undefined)).toEqual([]);
  });
});

describe('merging the picture gallery', () => {
  it('unions what the two devices have seen, in order', () => {
    const merged = galleryCodec.parse(
      mergeRecord('soundLabyrinth:gallery', gallery([0, 1]), gallery([1, 2])),
    );

    expect(merged.seen).toEqual([0, 1, 2]);
  });

  it('rebuilds the rotation from the union instead of guessing it', () => {
    const merged = galleryCodec.parse(
      mergeRecord('soundLabyrinth:gallery', gallery([0, 1]), gallery([1, 2])),
    );

    // The rule the game uses: the round is the pictures used since it last
    // restarted, in the order they were finished.
    expect(merged.round).toEqual([0, 1, 2]);
  });

  it('starts a fresh round once every picture has been seen', () => {
    const all = PUZZLE_IMAGES.map((_, index) => index);
    const merged = galleryCodec.parse(
      mergeRecord('soundLabyrinth:gallery', gallery(all.slice(0, 4)), gallery(all.slice(4))),
    );

    expect(merged.seen).toEqual(all);
    expect(merged.round).toEqual([all.at(-1)]);
  });

  it('ignores an index this version of the game does not have', () => {
    const tooBig = PUZZLE_IMAGES.length + 3;
    const merged = galleryCodec.parse(
      mergeRecord('soundLabyrinth:gallery', gallery([0]), gallery([tooBig, 1])),
    );

    expect(merged.seen).toEqual([0, 1]);
  });

  it('reads what it can when one side is corrupt', () => {
    const merged = galleryCodec.parse(
      mergeRecord('soundLabyrinth:gallery', 'not json', gallery([2])),
    );

    expect(merged.seen).toEqual([2]);
  });
});

describe('merging the fishing journal', () => {
  it('unions the words and the decorations, and keeps the higher trip count', () => {
    const merged = journalCodec.parse(
      mergeRecord(
        'wordFishing:journal',
        journal(['hund', 'katt'], 5, [0]),
        journal(['katt', 'fisk'], 2, [1, 0]),
      ),
    );

    expect(merged.words).toEqual(['hund', 'katt', 'fisk']);
    expect(merged.trips).toBe(5, 'a trip finished on one device is still finished');
    expect(merged.decorations).toEqual([0, 1]);
  });

  it('keeps the higher count whichever side it came from', () => {
    const merged = journalCodec.parse(
      mergeRecord('wordFishing:journal', journal([], 2), journal([], 7)),
    );

    expect(merged.trips).toBe(7);
  });
});

describe('merging the animal album', () => {
  it('unions the animals found', () => {
    const merged = albumCodec.parse(
      mergeRecord('cardBattle:album', album(['fox', 'owl']), album(['owl', 'wolf'])),
    );

    expect(merged.discovered).toEqual(['fox', 'owl', 'wolf']);
  });

  it('drops an animal this version does not have', () => {
    const merged = albumCodec.parse(
      mergeRecord('cardBattle:album', album(['fox']), album(['unicorn'])),
    );

    expect(merged.discovered).toEqual(['fox']);
  });
});

describe('an unknown key', () => {
  it('is never merged, and never sent', () => {
    expect(mergeRecord('soundLabyrinth:game', gallery([0]), gallery([1]))).toBeNull();
    expect(mergeRecord('anything:else', '{}', '{}')).toBeNull();
  });
});
