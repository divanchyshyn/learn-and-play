import { afterEach, describe, expect, it, vi } from 'vitest';
import { forwardToApi, isApiPath, jsonError, workerFetch } from './router.js';

const SERVICE = 'https://learn-and-play-api-uc.a.run.app';

// A stand-in for the Worker's bindings. The global `fetch` records what it was
// asked for, and the assets binding answers with a marker so a fall-through is
// unmistakable.
function stubEnv({ apiBase = SERVICE, doorSecret = 'the-door-secret', respond } = {}) {
  const seen = [];
  const fetchMock = vi.fn(async (url, init) => {
    seen.push({ url: String(url), init });
    if (respond) return respond(url, init);
    return Response.json({ ok: true, db: 'unconfigured' });
  });
  vi.stubGlobal('fetch', fetchMock);

  const env = {
    API_BASE_URL: apiBase,
    API_DOOR_SECRET: doorSecret,
    ASSETS: {
      fetch: vi.fn(async () => new Response('an asset', { status: 200 })),
    },
  };
  return { env, seen, fetchMock };
}

function apiRequest(path, headers = {}, init = {}) {
  return new Request(`https://play2learn.divanchyshyn.com${path}`, { headers, ...init });
}

function sentHeaders(seen, index = 0) {
  return new Headers(seen[index].init.headers);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('isApiPath', () => {
  it('owns /api and everything below it, and nothing that merely starts the same', () => {
    expect(isApiPath('/api')).toBe(true);
    expect(isApiPath('/api/')).toBe(true);
    expect(isApiPath('/api/health')).toBe(true);
    expect(isApiPath('/api/progress')).toBe(true);

    expect(isApiPath('/apiary')).toBe(false);
    expect(isApiPath('/')).toBe(false);
    expect(isApiPath('/games/sound-labyrinth/')).toBe(false);
    expect(isApiPath('/assets/home-abc123.js')).toBe(false);
  });
});

describe('the front door', () => {
  it('sends /api/* to the service and returns its answer', async () => {
    const { env, seen } = stubEnv();

    const response = await workerFetch(apiRequest('/api/health'), env);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, db: 'unconfigured' });
    expect(seen).toHaveLength(1);
    expect(seen[0].url).toBe(`${SERVICE}/api/health`);
    expect(seen[0].init.method).toBe('GET');
  });

  it('keeps the query string on the way through', async () => {
    const { env, seen } = stubEnv();

    await workerFetch(apiRequest('/api/progress?since=3&device=tablet'), env);

    expect(seen[0].url).toBe(`${SERVICE}/api/progress?since=3&device=tablet`);
  });

  it('leaves every other path to the asset router', async () => {
    const { env, seen } = stubEnv();

    const response = await workerFetch(apiRequest('/games/sound-labyrinth/'), env);

    expect(await response.text()).toBe('an asset');
    expect(env.ASSETS.fetch).toHaveBeenCalledTimes(1);
    expect(seen).toHaveLength(0);
  });

  it('replaces a client-supplied X-Client-IP with the edge\'s own header', async () => {
    const { env, seen } = stubEnv();

    await workerFetch(
      apiRequest('/api/me', {
        'x-client-ip': '10.0.0.1',
        'CF-Connecting-IP': '203.0.113.7',
      }),
      env,
    );

    expect(sentHeaders(seen).get('x-client-ip')).toBe('203.0.113.7');
  });

  it('sends no X-Client-IP at all when the edge did not provide one', async () => {
    const { env, seen } = stubEnv();

    await workerFetch(apiRequest('/api/me', { 'x-client-ip': '10.0.0.1' }), env);

    expect(sentHeaders(seen).get('x-client-ip')).toBeNull();
  });

  it('never forwards a caller-supplied door secret', async () => {
    const { env, seen } = stubEnv();

    await workerFetch(apiRequest('/api/me', { 'x-door-secret': 'guessed' }), env);

    expect(sentHeaders(seen).get('x-door-secret')).toBe('the-door-secret');
  });

  it('sends no door secret at all when the deployment has not set one', async () => {
    const { env, seen } = stubEnv({ doorSecret: '' });

    await workerFetch(apiRequest('/api/me', { 'x-door-secret': 'guessed' }), env);

    expect(sentHeaders(seen).get('x-door-secret')).toBeNull();
  });

  it('stops the service from choosing its own compression', async () => {
    const { env, seen } = stubEnv();

    await workerFetch(apiRequest('/api/me', { 'accept-encoding': 'gzip, br' }), env);

    expect(sentHeaders(seen).get('accept-encoding')).toBeNull();
  });

  it('keeps the method and the body on the way through', async () => {
    const { env, seen } = stubEnv();

    await forwardToApi(
      apiRequest('/api/progress', {}, {
        method: 'PUT',
        body: JSON.stringify({ records: [] }),
      }),
      env,
    );

    expect(seen[0].init.method).toBe('PUT');
    expect(await new Response(seen[0].init.body).text()).toBe('{"records":[]}');
  });

  it('keeps every Set-Cookie as its own header', async () => {
    const { env } = stubEnv({
      respond: () =>
        new Response(null, {
          status: 200,
          headers: [
            ['set-cookie', 'first=1; Path=/'],
            ['set-cookie', 'second=2; Path=/'],
          ],
        }),
    });

    const response = await workerFetch(apiRequest('/api/me'), env);

    expect(response.headers.getSetCookie()).toEqual(['first=1; Path=/', 'second=2; Path=/']);
  });

  it('answers a missing API_BASE_URL with JSON, not a crash', async () => {
    const { env, seen } = stubEnv({ apiBase: '' });
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await workerFetch(apiRequest('/api/health'), env);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'api_unconfigured' });
    expect(seen).toHaveLength(0);
    logged.mockRestore();
  });

  it('answers an unreachable service with JSON, not a crash', async () => {
    const { env } = stubEnv({
      respond: () => {
        throw new Error('the service did not answer');
      },
    });
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await workerFetch(apiRequest('/api/health'), env);

    expect(response.status).toBe(502);
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(await response.json()).toEqual({ error: 'api_unavailable' });
    logged.mockRestore();
  });
});

describe('jsonError', () => {
  it('is the one error shape the client has to understand', async () => {
    const response = jsonError(404, 'not_found');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not_found' });
  });
});
