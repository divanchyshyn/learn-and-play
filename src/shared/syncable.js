import syncKeys from '../../api/sync-keys.json';
import { albumCodec } from '../games/card-battle/album.js';
import { createAlbum } from '../games/card-battle/album.js';
import { createGallery, galleryCodec, recordSeenImage } from '../games/sound-labyrinth/progress.js';
import { PUZZLE_IMAGES } from '../games/sound-labyrinth/puzzle-images.js';
import { createJournal, journalCodec } from '../games/word-fishing/journal.js';

// Which saved values follow a child between devices, and how two devices' copies
// of one are put back together.
//
// The list of keys comes from `sync-keys.json`, the same file the Rust service
// reads to decide what it may store — so a key the server refuses can never be
// sent, and a key the server accepts always has a merge rule here.
//
// Every value that syncs is **monotonic**: a word caught cannot be un-caught, a
// picture assembled cannot be un-assembled, an animal found cannot be unfound.
// That is why the merges are unions, and why merging can never lose a child's
// progress — the worst case is that one device learns something it did not know.

export const SYNC_KEYS = Object.freeze([...syncKeys.keys]);

export function isSyncKey(key) {
  return SYNC_KEYS.includes(key);
}

/** Keep the first list's order, then append whatever is new in the second. */
export function unionInOrder(first = [], second = []) {
  const seen = new Set(first);
  const merged = [...first];
  for (const item of second) {
    if (seen.has(item)) continue;
    seen.add(item);
    merged.push(item);
  }
  return merged;
}

function mergeGallery(local, remote) {
  const seen = unionInOrder(local.seen, remote.seen);
  // `round` is not merged: it is rebuilt by replaying the game's own rule over
  // the unioned `seen`. Replaying the real rule is what makes the merged gallery
  // behave exactly like one a child built locally, including the way a fresh
  // round starts from the picture just finished.
  return seen.reduce(
    (gallery, imageIndex) => recordSeenImage(gallery, imageIndex, PUZZLE_IMAGES.length),
    createGallery(),
  );
}

function mergeJournal(local, remote) {
  return {
    words: unionInOrder(local.words, remote.words),
    // Trips are a count, not a list: the higher number is the truth.
    trips: Math.max(local.trips ?? 0, remote.trips ?? 0),
    decorations: unionInOrder(local.decorations, remote.decorations),
  };
}

function mergeAlbum(local, remote) {
  return { discovered: unionInOrder(local.discovered, remote.discovered) };
}

const RECORDS = {
  'soundLabyrinth:gallery': { codec: galleryCodec, empty: createGallery, merge: mergeGallery },
  'wordFishing:journal': { codec: journalCodec, empty: createJournal, merge: mergeJournal },
  'cardBattle:album': { codec: albumCodec, empty: createAlbum, merge: mergeAlbum },
};

/**
 * Merge one record from two devices.
 *
 * @param {string} key
 * @param {string|null} localRaw   what this device has saved, if anything
 * @param {string|null} remoteRaw  what the server has, if anything
 * @returns {string|null} the merged value to store, or null when neither side
 *   holds anything this version of the game can read (a corrupt value on both
 *   sides is treated as "nothing", never as a crash)
 */
export function mergeRecord(key, localRaw, remoteRaw) {
  const record = RECORDS[key];
  if (!record) return null;

  const local = typeof localRaw === 'string' ? record.codec.parse(localRaw) : null;
  const remote = typeof remoteRaw === 'string' ? record.codec.parse(remoteRaw) : null;
  if (local === null && remote === null) return null;

  return record.codec.serialize(
    record.merge(local ?? record.empty(), remote ?? record.empty()),
  );
}
