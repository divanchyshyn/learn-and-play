import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  clearSignInHint,
  ERROR_MESSAGES,
  errorMessage,
  readSignInHint,
  useAccount,
  writeSignInHint,
} from './account.js';

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

describe('the account state', () => {
  let fetchMock;

  beforeEach(() => {
    window.localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('starts as signed out when the service says so', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ signedIn: false }));

    const { result } = renderHook(() => useAccount());

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.signedIn).toBe(false);
    expect(readSignInHint()).toBeNull();
  });

  it('remembers a signed-in browser, so a game can decide without asking', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ signedIn: true, username: 'TestKid' }));

    const { result } = renderHook(() => useAccount());

    await waitFor(() => expect(result.current.signedIn).toBe(true));
    expect(result.current.username).toBe('TestKid');
    expect(readSignInHint()).toEqual({ username: 'TestKid' });
  });

  it('keeps the account usable when the service cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const { result } = renderHook(() => useAccount());

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.signedIn).toBe(false);
  });

  it('signs in and signs out through the API', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ signedIn: false }));
    const { result } = renderHook(() => useAccount());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    fetchMock.mockResolvedValueOnce(jsonResponse({ username: 'TestKid' }));
    await act(async () => {
      await result.current.signIn('TestKid', 'et-langt-passord');
    });

    expect(result.current.signedIn).toBe(true);
    let [url, init] = fetchMock.mock.calls.at(-1);
    expect(url).toBe('/api/session');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"username":"TestKid","password":"et-langt-passord"}');

    fetchMock.mockResolvedValueOnce(jsonResponse(null, 204));
    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.signedIn).toBe(false);
    expect(readSignInHint()).toBeNull();
    [url, init] = fetchMock.mock.calls.at(-1);
    expect(url).toBe('/api/session');
    expect(init.method).toBe('DELETE');
  });

  it('creates an account and treats it as signed in', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ signedIn: false }));
    const { result } = renderHook(() => useAccount());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    fetchMock.mockResolvedValueOnce(jsonResponse({ username: 'TestKid' }, 201));
    await act(async () => {
      await result.current.signUp('TestKid', 'et-langt-passord');
    });

    expect(result.current.signedIn).toBe(true);
    expect(fetchMock.mock.calls.at(-1)[0]).toBe('/api/account');
  });

  it('leaves the account signed in when an action is refused', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ signedIn: true, username: 'TestKid' }));
    const { result } = renderHook(() => useAccount());
    await waitFor(() => expect(result.current.signedIn).toBe(true));

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'password_too_short' }, 400));
    let failure;
    await act(async () => {
      failure = await result.current.changePassword('et-langt-passord', 'kort');
    });

    expect(failure.ok).toBe(false);
    expect(result.current.signedIn).toBe(true);
  });

  it('forgets the local hint when the account is deleted', async () => {
    writeSignInHint('TestKid');
    fetchMock.mockResolvedValueOnce(jsonResponse({ signedIn: true, username: 'TestKid' }));
    const { result } = renderHook(() => useAccount());
    await waitFor(() => expect(result.current.signedIn).toBe(true));

    fetchMock.mockResolvedValueOnce(jsonResponse(null, 204));
    await act(async () => {
      await result.current.deleteAccount('et-langt-passord');
    });

    expect(result.current.signedIn).toBe(false);
    expect(readSignInHint()).toBeNull();
  });

  it('ignores a hint that is not readable, rather than trusting it', () => {
    window.localStorage.setItem('account:signedIn', 'not json at all');
    expect(readSignInHint()).toBeNull();

    window.localStorage.setItem('account:signedIn', JSON.stringify({ username: 42 }));
    expect(readSignInHint()).toBeNull();

    window.localStorage.setItem('account:signedIn', JSON.stringify('TestKid'));
    expect(readSignInHint()).toBeNull();

    writeSignInHint('TestKid');
    expect(readSignInHint()).toEqual({ username: 'TestKid' });

    clearSignInHint();
    expect(readSignInHint()).toBeNull();
  });

  it('signs in even when the answer does not name the account', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ signedIn: false }));
    const { result } = renderHook(() => useAccount());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    fetchMock.mockResolvedValueOnce(jsonResponse({}, 200));
    await act(async () => {
      await result.current.signIn('TestKid', 'et-langt-passord');
    });

    expect(result.current.signedIn).toBe(true);
    expect(result.current.username).toBeNull();
    // Nothing worth remembering, so nothing is remembered.
    expect(readSignInHint()).toBeNull();
  });
});

describe('error copy', () => {
  it('says something a child can act on, in Norwegian', () => {
    expect(errorMessage('username_taken')).toContain('opptatt');
    expect(errorMessage('invalid_credentials')).toContain('Fant ingen konto');
    expect(errorMessage('offline')).toContain('nettet');
    expect(errorMessage('something_nobody_planned')).toBe('Noe gikk galt. Prøv igjen.');
    expect(errorMessage(undefined)).toBe('Noe gikk galt. Prøv igjen.');
  });

  it('never blames the child', () => {
    for (const message of Object.values(ERROR_MESSAGES)) {
      expect(message).not.toMatch(/ugyldig|ulovlig|ulovlig|bryter reglene/i);
    }
  });
});
