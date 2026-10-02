import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from './api.js';

// The one promise this module makes: it never throws, whatever the network does.

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

function textResponse(text, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => text };
}

describe('the API wrapper', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends the session cookie and parses a JSON answer', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ signedIn: true, username: 'TestKid' }));

    const result = await request('/me');

    expect(result).toEqual({
      ok: true,
      status: 200,
      data: { signedIn: true, username: 'TestKid' },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/me',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
  });

  it('serializes a body and asks for the right method', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ username: 'TestKid' }, 201));

    await request('/account', { method: 'POST', body: { username: 'TestKid', password: 'x' } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'content-type': 'application/json' });
    expect(init.body).toBe('{"username":"TestKid","password":"x"}');
  });

  it('returns the server\'s error code instead of throwing', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'invalid_credentials' }, 401));

    const result = await request('/session', { method: 'POST', body: {} });

    expect(result).toEqual({ ok: false, status: 401, error: 'invalid_credentials' });
  });

  it('treats a non-JSON answer as a failed request, not a crash', async () => {
    fetchMock.mockResolvedValue(textResponse('<html>gateway</html>', 502));

    const result = await request('/health');

    expect(result.ok).toBe(false);
    expect(result.error).toBe('request_failed');
  });

  it('reads an empty answer as no data (204 and friends)', async () => {
    fetchMock.mockResolvedValue(textResponse('', 204));

    const result = await request('/session', { method: 'DELETE' });

    expect(result).toEqual({ ok: true, status: 204, data: null });
  });

  it('reports an unreachable service as offline', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await request('/me');

    expect(result).toEqual({ ok: false, status: 0, error: 'offline' });
  });

  it('reports a request that ran out of time as a timeout', async () => {
    const aborted = Object.assign(new Error('aborted'), { name: 'AbortError' });
    fetchMock.mockRejectedValue(aborted);

    const result = await request('/progress', { timeoutMs: 10 });

    expect(result).toEqual({ ok: false, status: 0, error: 'timeout' });
  });

  it('passes keepalive through, so a last write can outlive the page', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));

    await request('/progress', { method: 'PUT', body: {}, keepalive: true });

    expect(fetchMock.mock.calls[0][1].keepalive).toBe(true);
  });
});
