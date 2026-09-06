// A tiny, safe localStorage wrapper shared by every game that wants its
// progress to survive a page refresh. Storage is always best-effort: a
// blocked or missing store (private browsing, file:// pages, tests) must
// never stop a game from running – it just means the game forgets on reload.

export function defaultStore() {
  return typeof window === 'undefined' ? null : window.localStorage;
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
  }
}

export function removeStorage(key, store = defaultStore()) {
  try {
    store?.removeItem(key);
  } catch {
    // Same best-effort rule as the other two.
  }
}