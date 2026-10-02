import { describe, expect, it, vi } from 'vitest';
import { API_INSTANCE, forwardToApi, isApiPath, jsonError, workerFetch } from './router.js';

// A stand-in for the Worker's bindings: the container binding records what it
// was asked to fetch, and the assets binding answers with a marker so a
// fall-through is unmistakable.
function stubEnv({ containerFails = false } = {}) {
  const seen = [];
  const env = {
    API_CONTAINER: {
      idFromName: vi.fn((name) => `do:${name}`),
      get: vi.fn((id) => ({
        fetch: vi.fn(async (request) => {
          if (containerFails) throw new Error('container did not start');
          seen.push({
            id,
            url: request.url,
            method: request.method,
            clientIp: request.headers.get('x-client-ip'),
          });
          return Response.json({ ok: true, db: 'unconfigured' });
        }),
      })),
    },
    ASSETS: {
      fetch: vi.fn(async () => new Response('an asset', { status: 200 })),
    },
  };
  return { env, seen };
}

function apiRequest(path, headers = {}) {
  return new Request(`https://test.play2learn.divanchyshyn.com${path}`, { headers });
}

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
  it('sends /api/* to the single container instance and returns its answer', async () => {
    const { env, seen } = stubEnv();

    const response = await workerFetch(apiRequest('/api/health'), env);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, db: 'unconfigured' });
    expect(env.API_CONTAINER.idFromName).toHaveBeenCalledWith(API_INSTANCE);
    expect(seen).toHaveLength(1);
    expect(seen[0].id).toBe(`do:${API_INSTANCE}`);
    expect(seen[0].url).toBe('https://test.play2learn.divanchyshyn.com/api/health');
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

    expect(seen[0].clientIp).toBe('203.0.113.7');
  });

  it('sends no X-Client-IP at all when the edge did not provide one', async () => {
    const { env, seen } = stubEnv();

    await workerFetch(apiRequest('/api/me', { 'x-client-ip': '10.0.0.1' }), env);

    expect(seen[0].clientIp).toBeNull();
  });

  it('keeps the method on the way through', async () => {
    const { env, seen } = stubEnv();

    await forwardToApi(
      new Request('https://play2learn.divanchyshyn.com/api/progress', {
        method: 'PUT',
        body: JSON.stringify({ records: [] }),
      }),
      env,
    );

    expect(seen[0].method).toBe('PUT');
  });

  it('answers a container that cannot start with JSON, not a crash', async () => {
    const { env } = stubEnv({ containerFails: true });
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
