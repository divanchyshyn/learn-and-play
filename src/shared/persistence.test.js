import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  migrateStorage,
  onStorageWrite,
  readStorage,
  removeStorage,
  writeStorage,
} from './persistence.js';

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

  it('tells a listener what was written and what was removed', () => {
    const seen = [];
    const stop = onStorageWrite((key, value) => seen.push([key, value]));

    writeStorage('game:draft', '{"a":1}');
    removeStorage('game:draft');
    stop();

    expect(seen).toEqual([
      ['game:draft', '{"a":1}'],
      ['game:draft', null],
    ]);
  });

  it('stops telling a listener that unsubscribed', () => {
    const listener = vi.fn();
    const stop = onStorageWrite(listener);

    writeStorage('game:draft', 'first');
    stop();
    writeStorage('game:draft', 'second');

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('lets a broken listener fail without breaking the save or the next listener', () => {
    const good = vi.fn();
    const stopBad = onStorageWrite(() => {
      throw new Error('a listener that misbehaves');
    });
    const stopGood = onStorageWrite(good);

    expect(() => writeStorage('game:draft', 'value')).not.toThrow();
    expect(readStorage('game:draft')).toBe('value');
    expect(good).toHaveBeenCalledWith('game:draft', 'value');

    stopBad();
    stopGood();
  });

  it('says nothing when the write itself failed', () => {
    const listener = vi.fn();
    const stop = onStorageWrite(listener);
    const broken = { setItem: () => { throw new Error('full'); } };

    writeStorage('game:draft', 'value', broken);
    stop();

    expect(listener).not.toHaveBeenCalled();
  });
});