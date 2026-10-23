import { clearSignInHint, readSignInHint, SIGN_IN_HINT_KEY, writeSignInHint } from './account.js';
import { request } from './api.js';
import { onStorageWrite, readStorage, removeStorage, writeStorage } from './persistence.js';
import { SYNC_KEYS, isSyncKey, mergeRecord } from './syncable.js';

// The sync engine.
//
// The rules it exists to keep (docs/backend/ARCHITECTURE.md, Progress and sync):
//
//  * **the database is the record, localStorage is a cache** — a game reads the
//    cache at mount, and this module reconciles it with the server behind or
//    before that mount;
//  * **fail-open** — not signed in means no request at all, and a dead or slow
//    service means the game plays from the cache and nobody sees a thing;
//  * **never lose progress** — every merge is a union over monotonic values, and
//    a write only lands when it names the revision the server already holds;
//  * **whose progress is this?** — an account's records are never uploaded into
//    a different account (see `adopt`).

const OWNER_KEY = 'sync:owner';
const REVISION_PREFIX = 'sync:revision:';

/** This browser has never had an account: its progress may be claimed by one. */
export const OWNER_ANONYMOUS = 'anonymous';
/** This browser had an account and signed out: the cache is not anyone's yet. */
export const OWNER_DETACHED = 'detached';

/** How long a write waits for the child to stop whatever they are doing. */
export const PUSH_DEBOUNCE_MS = 2000;
/** The longest a game will wait for the database before it plays from cache. */
export const HYDRATION_TIMEOUT_MS = 1500;

const dirty = new Set();
let booted = null;
let stopListening = null;
let applyingRemote = false;
let pushTimer = null;

function ownerKeyFor(username) {
  return `user:${username}`;
}

export function readOwner() {
  return readStorage(OWNER_KEY);
}

export function readRevision(key) {
  const raw = readStorage(`${REVISION_PREFIX}${key}`);
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function writeRevision(key, revision) {
  writeStorage(`${REVISION_PREFIX}${key}`, String(revision));
}

function clearRevisions() {
  for (const key of SYNC_KEYS) removeStorage(`${REVISION_PREFIX}${key}`);
}

function clearRecords() {
  for (const key of SYNC_KEYS) removeStorage(key);
}

/**
 * Should a game wait for the database before it mounts?
 *
 * Only when this device is missing *this game's* synced records: never signed in
 * (no request worth waiting for), a different account's cache, or a game whose
 * own record has not arrived yet. Checking one game's keys rather than "any
 * synced value" is what stops a deep link from mounting before its own pull
 * lands just because another game warmed the cache. With `keys = []` (a game
 * that syncs nothing) there is nothing to wait for.
 */
export function needsHydration(keys = SYNC_KEYS) {
  const hint = readSignInHint();
  if (!hint) return false;
  // A game that syncs nothing has nothing to wait for, even on a brand-new
  // device: waiting would only cost the child 1.5 seconds for no data.
  if (keys.length === 0) return false;
  if (readOwner() !== ownerKeyFor(hint.username)) return true;
  return keys.some((key) => readStorage(key) === null);
}

function forgetAccount() {
  // Signed out. The cached values stay — the child keeps playing — but they
  // belong to nobody now, so they must never be uploaded into the next account.
  writeStorage(OWNER_KEY, OWNER_DETACHED);
  clearRevisions();
  dirty.clear();
  if (pushTimer !== null) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  booted = null;
}

/**
 * A deleted account's cache goes too.
 *
 * Unlike signing out, there is no account to come back to, and a re-created
 * username on this tablet must not adopt the deleted account's progress. It
 * clears the records, the owner, the revisions and anything waiting to upload.
 */
export function forgetDeletedAccount() {
  // This may notify the storage observer, which writes `detached`; clearing the
  // owner afterwards leaves no owner at all.
  clearSignInHint();
  clearRecords();
  clearRevisions();
  removeStorage(OWNER_KEY);
  dirty.clear();
  if (pushTimer !== null) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  booted = null;
}

function onVisibilityChange() {
  // A child closing the tab should not cost them the last few minutes of play.
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    flushPush({ keepalive: true });
  }
}

function onPageHide() {
  // `visibilitychange` is not fired reliably on a desktop tab close, and a
  // mobile browser can suspend the page before a normal fetch finishes. A
  // keepalive request survives both.
  flushPush({ keepalive: true });
}

function subscribe() {
  if (stopListening !== null) return;

  const stop = onStorageWrite((key, value) => {
    if (key === SIGN_IN_HINT_KEY) {
      if (value === null) forgetAccount();
      return;
    }
    if (!isSyncKey(key)) return;

    // A value written *from* the server is not automatically worth sending back:
    // the merge below decides, and only when the local copy added something the
    // server does not have. That is what keeps a plain pull to one request.
    if (applyingRemote) return;

    // A signed-out browser must never make a request. The hint is what every
    // other part of the engine already treats as "this browser may have a
    // session"; without it, a child finishing a picture is not a sync event.
    if (readSignInHint() === null) return;

    dirty.add(key);
    schedulePush();
  });

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('pagehide', onPageHide);
  }

  stopListening = () => {
    stop();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('pagehide', onPageHide);
    }
  };
}

function schedulePush(delay = PUSH_DEBOUNCE_MS) {
  if (readSignInHint() === null) return;
  if (pushTimer !== null) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    push();
  }, delay);
}

/** Send whatever is waiting right now (used when the page is going away). */
export function flushPush({ keepalive = false } = {}) {
  if (pushTimer !== null) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  return push({ keepalive });
}

/**
 * Start syncing, once per page load.
 *
 * Resolves to `{ signedIn: false }` without making a single request when there is
 * no hint of an account.
 */
export function startSync() {
  if (booted === null) {
    booted = boot().then((result) => {
      // A signed-out outcome must not be memoised: a later sign-in on this page
      // (or on the next one) has to be able to start the engine again.
      if (!result?.signedIn) booted = null;
      return result;
    });
  }
  return booted;
}

async function boot() {
  subscribe();

  const hint = readSignInHint();
  if (!hint) return { ok: true, signedIn: false };

  const me = await request('/me', { timeoutMs: 3000 });
  if (!me.ok) {
    // The service is asleep or the network is gone. Keep the hint and the cache:
    // the next page load tries again.
    return { ok: false, signedIn: false, error: me.error };
  }
  if (!me.data?.signedIn || !me.data.username) {
    clearSignInHint();
    return { ok: true, signedIn: false };
  }

  const username = me.data.username;
  if (username !== hint.username) writeSignInHint(username);

  adopt(username);
  const pulled = await pull();
  const pushed = await push();
  return { ok: pulled.ok && pushed.ok, signedIn: true, username };
}

/**
 * Decide what to do with whatever is cached here before anything is uploaded.
 *
 * This is the rule that protects a child's progress in both directions:
 * a device that played anonymously **uploads** what it has (it is about to
 * become the account's progress), while a device that holds *another* account's
 * cache — or a signed-out cache — **drops** it before pulling, so one child's
 * progress can never land in another child's account.
 */
function adopt(username) {
  const target = ownerKeyFor(username);
  const owner = readOwner();
  if (owner === target) return;

  const claimable = owner === null || owner === OWNER_ANONYMOUS;
  if (!claimable) {
    clearRecords();
    clearRevisions();
    dirty.clear();
  } else {
    for (const key of SYNC_KEYS) {
      if (readStorage(key) !== null) dirty.add(key);
    }
  }

  writeStorage(OWNER_KEY, target);
}

export async function pull() {
  const result = await request('/progress');
  if (!result.ok) return result;

  applyingRemote = true;
  try {
    for (const record of result.data?.records ?? []) {
      if (!isSyncKey(record.key)) continue;

      // Only a revision this device has not seen is worth reading; anything
      // older is what this device already sent.
      if (record.revision <= readRevision(record.key)) continue;

      const current = readStorage(record.key);
      const merged = mergeRecord(record.key, current, record.payload);
      if (merged !== null && merged !== current) {
        writeStorage(record.key, merged);
        // Send it back only when this device knew something the server did not.
        if (merged !== record.payload) dirty.add(record.key);
      }
      writeRevision(record.key, record.revision);
    }
  } finally {
    applyingRemote = false;
  }

  return result;
}

/**
 * Send the records that changed. Two attempts at most: the first may come back
 * with conflicts, and a conflict is answered by merging the server's copy and
 * trying once more.
 */
export async function push({ keepalive = false } = {}) {
  const empty = { ok: true, status: 0, data: { accepted: [], conflicts: [] } };
  let lastResult = empty;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    // A signed-out browser never uploads, even if a debounce timer was already
    // running when the hint went away.
    if (readSignInHint() === null) return lastResult;

    const keys = [...dirty].filter((key) => isSyncKey(key) && readStorage(key) !== null);
    if (keys.length === 0) return lastResult;

    // Remember exactly what was sent: a write that lands while this request is
    // in flight is newer than the answer, and must stay dirty.
    const sent = new Map(keys.map((key) => [key, readStorage(key)]));
    const records = keys.map((key) => ({
      key,
      payload: sent.get(key),
      baseRevision: readRevision(key),
    }));

    const result = await request('/progress', {
      method: 'PUT',
      body: { records },
      keepalive,
    });
    if (!result.ok) return result;
    lastResult = result;

    for (const accepted of result.data?.accepted ?? []) {
      writeRevision(accepted.key, accepted.revision);
      if (sent.has(accepted.key) && readStorage(accepted.key) === sent.get(accepted.key)) {
        dirty.delete(accepted.key);
      }
    }

    const conflicts = (result.data?.conflicts ?? []).filter((conflict) => isSyncKey(conflict.key));
    if (conflicts.length === 0) {
      if (dirty.size > 0 && readSignInHint() !== null) schedulePush();
      return result;
    }

    applyingRemote = true;
    try {
      for (const conflict of conflicts) {
        const current = readStorage(conflict.key);
        const merged = mergeRecord(conflict.key, current, conflict.payload);
        if (merged !== null && merged !== current) {
          writeStorage(conflict.key, merged);
          if (merged !== conflict.payload) dirty.add(conflict.key);
        }
        writeRevision(conflict.key, conflict.revision);
      }
    } finally {
      applyingRemote = false;
    }
  }

  // Two attempts left something newer in the cache; send it after the debounce
  // rather than waiting for the next write.
  if (dirty.size > 0 && readSignInHint() !== null) schedulePush();
  return lastResult;
}

/**
 * Wait for the database, but never longer than `timeoutMs`.
 *
 * A game calls this before it mounts. Whatever happens — merged, timed out, or
 * unreachable — the game renders; the only difference is what it renders from.
 */
export async function hydrate(timeoutMs = HYDRATION_TIMEOUT_MS) {
  let timer = null;
  const patience = new Promise((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });

  try {
    await Promise.race([startSync(), patience]);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

/** Test seam: forget everything this module remembers about the current page. */
export function resetSync() {
  if (pushTimer !== null) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  if (stopListening !== null) {
    stopListening();
    stopListening = null;
  }
  booted = null;
  applyingRemote = false;
  dirty.clear();
}
