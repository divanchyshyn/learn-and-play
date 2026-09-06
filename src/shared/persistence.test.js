import { describe, it, expect, afterEach, vi } from 'vitest';
import { readStorage, writeStorage, removeStorage } from './persistence.js';

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
});