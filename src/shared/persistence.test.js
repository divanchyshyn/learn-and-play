import { describe, it, expect, afterEach, vi } from 'vitest';
import { readStorage, writeStorage, removeStorage, migrateStorage } from './persistence.js';

// A tiny in-memory store shaped like localStorage, for tests that want a store
// which is not the browser's.
function memoryStore() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: (key) => { data.delete(key); },
  };
}

describe('shared persistence storage helpers', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('reads null for a missing key and the stored string for a saved one', () => {
    expect(readStorage('missing')).toBeNull();
    writeStorage('game:draft', '{"a":1}');
    expect(readStorage('game:draft')).toBe('{"a":1}');
  });

  it('removes a stored key', () => {
    writeStorage('game:draft', 'payload');
    removeStorage('game:draft');
    expect(readStorage('game:draft')).toBeNull();
  });

  it('works through an injected store', () => {
    const store = memoryStore();
    writeStorage('key', 'value', store);
    expect(readStorage('key', store)).toBe('value');
    removeStorage('key', store);
    expect(readStorage('key', store)).toBeNull();
  });

  it('reads as "nothing saved" when the store cannot be read', () => {
    const broken = { getItem: () => { throw new Error('blocked'); } };
    expect(readStorage('key', broken)).toBeNull();
  });

  it('swallows write and remove failures so games keep running', () => {
    const broken = {
      setItem: () => { throw new Error('full'); },
      removeItem: () => { throw new Error('locked'); },
    };
    expect(() => writeStorage('key', 'value', broken)).not.toThrow();
    expect(() => removeStorage('key', broken)).not.toThrow();
  });

  it('moves a value saved under an older key to its current key exactly once', () => {
    const store = memoryStore();
    writeStorage('oldKey:muted', '1', store);

    expect(migrateStorage('oldKey:muted', 'newKey:muted', store)).toBe('1');
    expect(readStorage('newKey:muted', store)).toBe('1');
    expect(readStorage('oldKey:muted', store)).toBeNull();

    // A second call has nothing left to move, so the current value stays put.
    writeStorage('newKey:muted', '0', store);
    expect(migrateStorage('oldKey:muted', 'newKey:muted', store)).toBeNull();
    expect(readStorage('newKey:muted', store)).toBe('0');
  });

  it('leaves the current key alone when there is no legacy value', () => {
    const store = memoryStore();
    writeStorage('currentKey:progress', 'fresh', store);
    expect(migrateStorage('legacyKey:progress', 'currentKey:progress', store)).toBeNull();
    expect(readStorage('currentKey:progress', store)).toBe('fresh');
  });

  it('does nothing when both keys are the same', () => {
    const store = memoryStore();
    writeStorage('same:key', 'value', store);
    expect(migrateStorage('same:key', 'same:key', store)).toBeNull();
    expect(readStorage('same:key', store)).toBe('value');
  });
});