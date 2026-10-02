import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSignInHint, readSignInHint, writeSignInHint } from './account.js';
import { readStorage, writeStorage } from './persistence.js';
import {
  HYDRATION_TIMEOUT_MS,
  OWNER_DETACHED,
  PUSH_DEBOUNCE_MS,
  flushPush,
  needsHydration,
  readOwner,
  readRevision,
  resetSync,
  startSync,
} from './sync.js';
import { albumCodec } from '../games/card-battle/album.js';

const ALBUM = 'cardBattle:album';
const album = (discovered) => albumCodec.serialize({ discovered });

function json(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

/** A fetch stand-in that routes the two endpoints the engine uses. */
function apiMock({ me = { signedIn: false }, records = [], put } = {}) {
  const requests = [];
  const fetchMock = vi.fn(async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : null;
    requests.push({ url, method, body });

    if (url === '/api/me') return json(me);
    if (url === '/api/progress' && method === 'GET') return json({ records });
    if (url === '/api/progress' && method === 'PUT') {
      const attempt = requests.filter((request) => request.method === 'PUT').length;
      if (put) return put(body, attempt);
      return json({
        accepted: body.records.map((record) => ({
          key: record.key,
          revision: record.baseRevision + 1,
        })),
        conflicts: [],
      });
    }
    throw new Error(`unexpected ${method} ${url}`);
  });
  fetchMock.requests = requests;
  return fetchMock;
}

function sends(fetchMock) {
  return fetchMock.requests.map((request) => `${request.method} ${request.url}`);
}

describe('the sync engine', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetSync();
  });

  afterEach(() => {
    resetSync();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('does nothing at all when this browser has no account', async () => {
    const fetchMock = apiMock();
    vi.stubGlobal('fetch', fetchMock);

    const result = await startSync();

    expect(result).toEqual({ ok: true, signedIn: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('pulls the record onto a device that has nothing', async () => {
    writeSignInHint('Kid');
    const fetchMock = apiMock({
      me: { signedIn: true, username: 'Kid' },
      records: [{ key: ALBUM, payload: album(['fox']), revision: 3 }],
    });
    vi.stubGlobal('fetch', fetchMock);

    await startSync();

    expect(albumCodec.parse(readStorage(ALBUM))).toEqual({ discovered: ['fox'] });
    expect(readRevision(ALBUM)).toBe(3);
    expect(readOwner()).toBe('user:Kid');
    // Nothing local was added, so there is nothing worth sending back.
    expect(sends(fetchMock)).toEqual(['GET /api/me', 'GET /api/progress']);
  });

  it('uploads what an anonymous device has when an account claims it', async () => {
    writeSignInHint('Kid');
    writeStorage(ALBUM, album(['fox']));
    const fetchMock = apiMock({ me: { signedIn: true, username: 'Kid' } });
    vi.stubGlobal('fetch', fetchMock);

    await startSync();

    const put = fetchMock.requests.find((request) => request.method === 'PUT');
    expect(put.body.records).toEqual([
      { key: ALBUM, payload: album(['fox']), baseRevision: 0 },
    ]);
  });

  it('never uploads one account\'s progress into another', async () => {
    window.localStorage.setItem('sync:owner', 'user:Other');
    writeStorage(ALBUM, album(['fox']));
    writeSignInHint('Kid');
    const fetchMock = apiMock({ me: { signedIn: true, username: 'Kid' } });
    vi.stubGlobal('fetch', fetchMock);

    await startSync();

    expect(readStorage(ALBUM)).toBeNull();
    expect(readOwner()).toBe('user:Kid');
    expect(fetchMock.requests.some((request) => request.method === 'PUT')).toBe(false);
  });

  it('keeps a signed-out cache out of the next account', async () => {
    writeStorage('sync:owner', OWNER_DETACHED);
    writeStorage(ALBUM, album(['fox']));
    writeSignInHint('Sibling');
    const fetchMock = apiMock({ me: { signedIn: true, username: 'Sibling' } });
    vi.stubGlobal('fetch', fetchMock);

    await startSync();

    expect(readStorage(ALBUM)).toBeNull();
    expect(fetchMock.requests.some((request) => request.method === 'PUT')).toBe(false);
  });

  it('merges a newer remote record and sends the union back', async () => {
    writeSignInHint('Kid');
    window.localStorage.setItem('sync:owner', 'user:Kid');
    writeStorage(ALBUM, album(['fox']));
    writeStorage('sync:revision:cardBattle:album', '1');
    const fetchMock = apiMock({
      me: { signedIn: true, username: 'Kid' },
      records: [{ key: ALBUM, payload: album(['owl']), revision: 4 }],
    });
    vi.stubGlobal('fetch', fetchMock);

    await startSync();

    expect(albumCodec.parse(readStorage(ALBUM))).toEqual({ discovered: ['fox', 'owl'] });
    const put = fetchMock.requests.find((request) => request.method === 'PUT');
    expect(put.body.records[0].baseRevision).toBe(4);
    expect(albumCodec.parse(put.body.records[0].payload)).toEqual({
      discovered: ['fox', 'owl'],
    });
  });

  it('leaves local progress untouched when the service cannot be reached', async () => {
    writeSignInHint('Kid');
    writeStorage(ALBUM, album(['fox']));
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await startSync();

    expect(result.ok).toBe(false);
    expect(albumCodec.parse(readStorage(ALBUM))).toEqual({ discovered: ['fox'] });
    expect(readSignInHint()).toEqual({ username: 'Kid' });
  });

  it('sends a game\'s change only after the child stops writing', async () => {
    writeSignInHint('Kid');
    window.localStorage.setItem('sync:owner', 'user:Kid');
    const fetchMock = apiMock({ me: { signedIn: true, username: 'Kid' } });
    vi.stubGlobal('fetch', fetchMock);

    await startSync();
    const before = fetchMock.requests.length;

    vi.useFakeTimers();
    writeStorage(ALBUM, album(['fox']));
    writeStorage(ALBUM, album(['fox', 'owl']));

    await vi.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS - 1);
    expect(fetchMock.requests.length).toBe(before);

    await vi.advanceTimersByTimeAsync(1);
    const puts = fetchMock.requests.filter((request) => request.method === 'PUT');
    expect(puts).toHaveLength(1);
    expect(albumCodec.parse(puts[0].body.records[0].payload)).toEqual({
      discovered: ['fox', 'owl'],
    });
  });

  it('answers a conflict by merging the server\'s copy and trying once more', async () => {
    writeSignInHint('Kid');
    window.localStorage.setItem('sync:owner', 'user:Kid');
    const fetchMock = apiMock({
      me: { signedIn: true, username: 'Kid' },
      put: (body, attempt) => {
        if (attempt === 1) {
          return json({
            accepted: [],
            conflicts: [{ key: ALBUM, payload: album(['owl', 'wolf']), revision: 9 }],
          });
        }
        return json({
          accepted: body.records.map((record) => ({ key: record.key, revision: 10 })),
          conflicts: [],
        });
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    await startSync();

    vi.useFakeTimers();
    writeStorage(ALBUM, album(['fox']));
    await vi.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS + 1);

    const puts = fetchMock.requests.filter((request) => request.method === 'PUT');
    expect(puts).toHaveLength(2);
    expect(albumCodec.parse(readStorage(ALBUM))).toEqual({
      discovered: ['fox', 'owl', 'wolf'],
    });
    expect(readRevision(ALBUM)).toBe(10);
  });

  it('decides when a game should wait for the database', () => {
    // No account: nothing to wait for.
    expect(needsHydration()).toBe(false);

    writeSignInHint('Kid');
    expect(needsHydration()).toBe(true); // signed in, but this device has no cache

    window.localStorage.setItem('sync:owner', 'user:Kid');
    writeStorage(ALBUM, album(['fox']));
    expect(needsHydration()).toBe(false); // a warm cache plays straight away

    window.localStorage.setItem('sync:owner', 'user:Other');
    expect(needsHydration()).toBe(true); // another account is not this cache
  });

  it('forgets everything about the account when the child signs out', async () => {
    writeSignInHint('Kid');
    window.localStorage.setItem('sync:owner', 'user:Kid');
    writeStorage(ALBUM, album(['fox']));
    writeStorage('sync:revision:cardBattle:album', '4');
    const fetchMock = apiMock({ me: { signedIn: true, username: 'Kid' } });
    vi.stubGlobal('fetch', fetchMock);

    await startSync();
    clearSignInHint();

    expect(readOwner()).toBe(OWNER_DETACHED);
    expect(readRevision(ALBUM)).toBe(0);
    expect(albumCodec.parse(readStorage(ALBUM))).toEqual({ discovered: ['fox'] });
  });

  it('sends nothing when nothing changed', async () => {
    writeSignInHint('Kid');
    window.localStorage.setItem('sync:owner', 'user:Kid');
    const fetchMock = apiMock({ me: { signedIn: true, username: 'Kid' } });
    vi.stubGlobal('fetch', fetchMock);

    await startSync();
    const before = fetchMock.requests.length;

    await flushPush();

    expect(fetchMock.requests).toHaveLength(before);
  });

  it('sends what is waiting when the page is hidden', async () => {
    writeSignInHint('Kid');
    window.localStorage.setItem('sync:owner', 'user:Kid');
    const fetchMock = apiMock({ me: { signedIn: true, username: 'Kid' } });
    vi.stubGlobal('fetch', fetchMock);

    await startSync();

    vi.useFakeTimers();
    writeStorage(ALBUM, album(['fox']));
    // The debounce has not fired yet; the child closing the tab must not cost them
    // the fox they just found.
    await flushPush();

    const puts = fetchMock.requests.filter((request) => request.method === 'PUT');
    expect(puts).toHaveLength(1);
    expect(albumCodec.parse(puts[0].body.records[0].payload)).toEqual({ discovered: ['fox'] });
  });

  it('says so, quietly, when the account check is refused', async () => {
    writeSignInHint('Kid');
    const fetchMock = vi.fn(async (url) =>
      url === '/api/me' ? { ok: true, status: 200, text: async () => JSON.stringify({ signedIn: false }) } : json({ records: [] }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await startSync();

    expect(result).toEqual({ ok: true, signedIn: false });
    expect(readSignInHint()).toBeNull();
    // Signed out means nothing else is asked for.
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/me']);
  });

  it('ignores a record this version does not sync', async () => {
    writeSignInHint('Kid');
    const fetchMock = apiMock({
      me: { signedIn: true, username: 'Kid' },
      records: [
        { key: 'soundLabyrinth:game', payload: '{"a maze in progress"}', revision: 7 },
        { key: 'cardBattle:album', payload: album(['fox']), revision: 2 },
      ],
    });
    vi.stubGlobal('fetch', fetchMock);

    await startSync();

    expect(readStorage('soundLabyrinth:game')).toBeNull();
    expect(readRevision('soundLabyrinth:game')).toBe(0);
    expect(albumCodec.parse(readStorage(ALBUM))).toEqual({ discovered: ['fox'] });
  });

  it('keeps a change waiting when the service refuses it', async () => {
    writeSignInHint('Kid');
    window.localStorage.setItem('sync:owner', 'user:Kid');
    const fetchMock = apiMock({
      me: { signedIn: true, username: 'Kid' },
      put: () => json({ error: 'internal' }, 500),
    });
    vi.stubGlobal('fetch', fetchMock);

    await startSync();

    vi.useFakeTimers();
    writeStorage(ALBUM, album(['fox']));
    await vi.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS + 1);

    expect(albumCodec.parse(readStorage(ALBUM))).toEqual({ discovered: ['fox'] });
    expect(readRevision(ALBUM)).toBe(0);

    // The next attempt — a later change, or the next page load — still sends it.
    writeStorage(ALBUM, album(['fox', 'owl']));
    await vi.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS + 1);

    const puts = fetchMock.requests.filter((request) => request.method === 'PUT');
    expect(puts.length).toBeGreaterThanOrEqual(2);
    expect(albumCodec.parse(puts.at(-1).body.records[0].payload)).toEqual({
      discovered: ['fox', 'owl'],
    });
  });

  it('ignores a conflict for a record this version does not sync', async () => {
    writeSignInHint('Kid');
    window.localStorage.setItem('sync:owner', 'user:Kid');
    const fetchMock = apiMock({
      me: { signedIn: true, username: 'Kid' },
      put: (body) =>
        json({
          accepted: body.records.map((record) => ({
            key: record.key,
            revision: record.baseRevision + 1,
          })),
          conflicts: [{ key: 'soundLabyrinth:game', payload: '{}', revision: 3 }],
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await startSync();

    vi.useFakeTimers();
    writeStorage(ALBUM, album(['fox']));
    await vi.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS + 1);

    expect(readStorage('soundLabyrinth:game')).toBeNull();
    expect(readRevision('soundLabyrinth:game')).toBe(0);
    expect(readRevision(ALBUM)).toBe(1);
  });

  it('puts up with an answer that carries no records at all', async () => {
    writeSignInHint('Kid');
    let call = 0;
    const fetchMock = vi.fn(async (url, init = {}) => {
      call += 1;
      if (url === '/api/me') return json({ signedIn: true, username: 'Kid' });
      if ((init.method ?? 'GET') === 'GET') return { ok: true, status: 200, text: async () => '' };
      return json({});
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await startSync();

    expect(result.signedIn).toBe(true);
    expect(call).toBeGreaterThanOrEqual(2);
  });

  it('drops a pending push when the page is torn down', async () => {
    writeSignInHint('Kid');
    window.localStorage.setItem('sync:owner', 'user:Kid');
    const fetchMock = apiMock({ me: { signedIn: true, username: 'Kid' } });
    vi.stubGlobal('fetch', fetchMock);

    await startSync();

    vi.useFakeTimers();
    writeStorage(ALBUM, album(['fox']));
    const before = fetchMock.requests.length;

    // A test seam, and also what a torn-down page does: stop everything pending.
    resetSync();
    await vi.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS + 1);

    expect(fetchMock.requests).toHaveLength(before);
    expect(albumCodec.parse(readStorage(ALBUM))).toEqual({ discovered: ['fox'] });
  });

  it('starts again after signing in on the same page', async () => {    const fetchMock = apiMock();
    vi.stubGlobal('fetch', fetchMock);

    await startSync();
    expect(fetchMock).not.toHaveBeenCalled();

    writeSignInHint('Kid');
    const signedIn = apiMock({ me: { signedIn: true, username: 'Kid' } });
    vi.stubGlobal('fetch', signedIn);

    const result = await startSync();

    expect(result.signedIn).toBe(true);
    expect(signedIn.requests.map((request) => request.url)).toEqual([
      '/api/me',
      '/api/progress',
    ]);
  });
});

describe('the hydration ceiling', () => {
  it('is short enough that waiting is barely noticeable', () => {
    expect(HYDRATION_TIMEOUT_MS).toBeLessThanOrEqual(2000);
  });
});
