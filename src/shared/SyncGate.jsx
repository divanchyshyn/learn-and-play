import { useEffect, useState } from 'react';
import { hydrate, needsHydration, startSync } from './sync.js';

/**
 * Hold a game back just long enough to hear from the database.
 *
 * The database is the record, but a game reads its saved values when it mounts —
 * so on a device that has never held this account's progress (a new tablet,
 * cleared storage, a different child) the game would start from nothing and the
 * pulled values would only show up on the next reload. This gate closes that gap.
 *
 * It waits **only** in that case, and never longer than `HYDRATION_TIMEOUT_MS`:
 * with a warm cache there is no wait at all, and with no cache the game still
 * starts after a moment and plays from whatever is there. A child never sees an
 * error here, and never sees a spinner caused by a server.
 */
export function SyncGate({ children }) {
  const [ready, setReady] = useState(() => !needsHydration());

  useEffect(() => {
    if (ready) {
      // Warm cache: reconcile behind the game instead of in front of it.
      startSync();
      return undefined;
    }

    let cancelled = false;
    hydrate().finally(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  if (!ready) {
    return (
      <p className="sync-gate" role="status">
        Henter framgangen din …
      </p>
    );
  }

  return children;
}

/**
 * The library page has no saved progress of its own, so it never waits — it just
 * starts the pull, so that by the time a child opens a game the cache is usually
 * already warm and the gate above resolves immediately.
 */
export function StartSync() {
  useEffect(() => {
    startSync();
  }, []);

  return null;
}
