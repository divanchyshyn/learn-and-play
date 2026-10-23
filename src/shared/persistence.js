// A tiny, safe localStorage wrapper shared by every game that wants its
// progress to survive a page refresh. Storage is always best-effort: a
// blocked or missing store (private browsing, file:// pages, tests) must
// never stop a game from running – it just means the game forgets on reload.

export function defaultStore() {
  return typeof window === 'undefined' ? null : window.localStorage;
}

// Listeners that want to know when a saved value changes. The sync engine is the
// only subscriber today: it needs to hear about a game's own writes without every
// game having to tell it.
const observers = new Set();

/**
 * Watch saved values. Returns a function that stops watching.
 *
 * `value` is the raw stored string, or null when the key was removed. Listeners
 * are called **after** the store was written, and a listener that throws is
 * ignored: a bug in one must never be able to break a game's save.
 */
export function onStorageWrite(listener) {
  observers.add(listener);
  return () => observers.delete(listener);
}

function notify(key, value) {
  for (const listener of observers) {
    try {
      listener(key, value);
    } catch {
      // A listener is a guest here, never a dependency.
    }
  }
}

// The raw stored string for a key, or null when nothing is saved there. Any
// read failure (blocked storage) reads as "nothing saved".
export function readStorage(key, store = defaultStore()) {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

// Save a serialized value under a key. Failures are swallowed on purpose:
// a full or locked store is not the child's problem – the game keeps going,
// it just forgets its progress on the next reload.
export function writeStorage(key, serialized, store = defaultStore()) {
  try {
    store?.setItem(key, serialized);
  } catch {
    // Storage may be unavailable; playing still works fine without it.
    return;
  }
  notify(key, serialized);
}

export function removeStorage(key, store = defaultStore()) {
  try {
    store?.removeItem(key);
  } catch {
    // Same best-effort rule as the other two.
    return;
  }
  notify(key, null);
}

// Move a value that used to be saved under an older key to its current home.
// A game calls this once at startup with the key it used to write, so a rename
// of the key never costs a child their saved progress: the value is copied to
// the new key and the old one is dropped, which makes the move happen exactly
// once. Returns the moved value, or null when there was nothing to move.
export function migrateStorage(legacyKey, currentKey, store = defaultStore()) {
  if (legacyKey === currentKey) return null;
  const legacy = readStorage(legacyKey, store);
  if (legacy === null) return null;
  writeStorage(currentKey, legacy, store);
  removeStorage(legacyKey, store);
  return legacy;
}