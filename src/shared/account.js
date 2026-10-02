import { useCallback, useEffect, useRef, useState } from 'react';
import { request } from './api.js';
import { readStorage, removeStorage, writeStorage } from './persistence.js';

// The account, as the rest of the app sees it.
//
// The session cookie is `HttpOnly`, so no script can ask the browser whether it
// is signed in; `/api/me` is the only source of truth. What *is* kept locally is
// a hint — a JS-readable note that this browser has a session — because the sync
// engine has to decide whether to make a request at all before a game mounts,
// and asking the server on every page load would make every game wait.

/** Where the "this browser has a session" hint lives. */
export const SIGN_IN_HINT_KEY = 'account:signedIn';

export function readSignInHint() {
  const raw = readStorage(SIGN_IN_HINT_KEY);
  if (raw === null) return null;
  try {
    const hint = JSON.parse(raw);
    return typeof hint?.username === 'string' ? hint : null;
  } catch {
    return null;
  }
}

export function writeSignInHint(username) {
  writeStorage(SIGN_IN_HINT_KEY, JSON.stringify({ username }));
}

export function clearSignInHint() {
  removeStorage(SIGN_IN_HINT_KEY);
}

/**
 * The account state of this browser.
 *
 * `status` is `checking` until `/api/me` has answered once, `ready` afterwards.
 * A failed request leaves the account as "signed out" rather than surfacing an
 * error: the games do not depend on it, and the account page can ask again.
 */
export function useAccount() {
  const [state, setState] = useState({
    status: 'checking',
    signedIn: false,
    username: null,
  });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const result = await request('/me');
    if (!mounted.current) return null;

    if (result.ok && result.data?.signedIn) {
      const username = result.data.username ?? null;
      if (username) writeSignInHint(username);
      setState({ status: 'ready', signedIn: true, username });
      return result;
    }

    // Signed out, or the service could not be reached. Both mean the same thing
    // to the games, and only the account page ever shows a message.
    if (result.ok) clearSignInHint();
    setState({ status: 'ready', signedIn: false, username: null });
    return result;
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Shared by sign-up and sign-in: both end with a session and a username. */
  const startSession = useCallback((result) => {
    if (result.ok) {
      const username = result.data?.username ?? null;
      if (username) writeSignInHint(username);
      setState({ status: 'ready', signedIn: true, username });
    }
    return result;
  }, []);

  const signUp = useCallback(
    async (username, password) =>
      startSession(await request('/account', { method: 'POST', body: { username, password } })),
    [startSession],
  );

  const signIn = useCallback(
    async (username, password) =>
      startSession(await request('/session', { method: 'POST', body: { username, password } })),
    [startSession],
  );

  const signOut = useCallback(async () => {
    const result = await request('/session', { method: 'DELETE' });
    // Even a failed request clears the local state: the child asked to be signed
    // out, and the session will not be offered again by this browser.
    clearSignInHint();
    if (mounted.current) setState({ status: 'ready', signedIn: false, username: null });
    return result;
  }, []);

  const changePassword = useCallback(
    async (currentPassword, newPassword) =>
      request('/password', { method: 'POST', body: { currentPassword, newPassword } }),
    [],
  );

  const deleteAccount = useCallback(async (password) => {
    const result = await request('/account', { method: 'DELETE', body: { password } });
    if (result.ok) {
      clearSignInHint();
      if (mounted.current) setState({ status: 'ready', signedIn: false, username: null });
    }
    return result;
  }, []);

  return {
    ...state,
    refresh,
    signUp,
    signIn,
    signOut,
    changePassword,
    deleteAccount,
  };
}

/** The Norwegian copy for every error this app can show. */
export const ERROR_MESSAGES = {
  username_taken: 'Det brukernavnet er opptatt. Prøv et annet.',
  username_too_short: 'Brukernavnet må ha minst 3 tegn.',
  username_too_long: 'Brukernavnet kan ha høyst 20 tegn.',
  username_must_start_with_letter: 'Brukernavnet må begynne med en bokstav.',
  username_invalid_characters: 'Brukernavnet kan bare ha bokstaver, tall, bindestrek og understrek.',
  username_reserved: 'Det brukernavnet kan du ikke bruke. Prøv et annet.',
  password_too_short: 'Passordet må ha minst 8 tegn.',
  password_too_long: 'Passordet er for langt. Bruk høyst 128 tegn.',
  invalid_credentials: 'Fant ingen konto med det brukernavnet og det passordet.',
  too_many_attempts: 'For mange forsøk på rad. Vent noen minutter og prøv igjen.',
  origin_missing: 'Noe gikk galt med siden. Last den inn på nytt.',
  origin_mismatch: 'Noe gikk galt med siden. Last den inn på nytt.',
  not_configured: 'Kontoer er ikke satt opp ennå. Prøv igjen senere.',
  offline: 'Fikk ikke kontakt. Sjekk nettet og prøv igjen.',
  timeout: 'Fikk ikke kontakt. Sjekk nettet og prøv igjen.',
  request_failed: 'Noe gikk galt. Prøv igjen.',
  internal: 'Noe gikk galt. Prøv igjen.',
};

/** Turn an API error code into something a child can read. */
export function errorMessage(error) {
  return ERROR_MESSAGES[error] ?? ERROR_MESSAGES.request_failed;
}
