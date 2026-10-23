// The routing half of the front door, kept free of any import that only exists
// on Cloudflare's runtime, so the routing rules - which paths are ours, which
// header is trustworthy, how the answer travels back - can be unit-tested in
// plain Node with Vitest.
//
// The games never reach this file: `run_worker_first` is scoped to `/api/*`, and
// Cloudflare's asset router serves every game page without invoking code. What
// does reach it is forwarded as one `fetch` to the Rust service on Google Cloud
// Run (docs/backend/ARCHITECTURE.md, The request path).

/** Is this a path the Rust service owns, rather than a static asset? */
export function isApiPath(pathname) {
  return pathname === '/api' || pathname.startsWith('/api/');
}

/** The JSON shape every front-door failure uses (the service uses the same one). */
export function jsonError(status, code) {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * The headers that go on to the service.
 *
 * Two of them are security-sensitive and are never taken from the caller:
 * `X-Client-IP` (what the rate limiter trusts) and `X-Door-Secret` (what proves
 * the request came through this Worker rather than straight to Cloud Run). The
 * Worker deletes whatever the caller sent and writes its own values.
 *
 * `Accept-Encoding` is dropped so the answers stay small, plain JSON. The
 * responses here are a few kilobytes; leaving compression to the edge also
 * avoids passing a compressed body through unchanged.
 */
function forwardHeaders(request, env) {
  const headers = new Headers(request.headers);
  headers.delete('x-client-ip');
  headers.delete('x-door-secret');
  headers.delete('accept-encoding');

  const clientIp = request.headers.get('CF-Connecting-IP');
  if (clientIp) {
    headers.set('x-client-ip', clientIp);
  }
  if (env.API_DOOR_SECRET) {
    headers.set('x-door-secret', env.API_DOOR_SECRET);
  }

  return headers;
}

/**
 * The service's answer, with every `Set-Cookie` kept as its own header.
 *
 * A `Headers` copy can merge repeated headers, and the session cookie must not
 * be merged with anything: `getSetCookie()` gives the values separately and
 * they are appended one by one.
 */
function forwardResponse(response) {
  const headers = new Headers(response.headers);
  const cookies = response.headers.getSetCookie?.() ?? [];
  if (cookies.length > 0) {
    headers.delete('set-cookie');
    for (const cookie of cookies) {
      headers.append('set-cookie', cookie);
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Hand a request to the Rust service on Cloud Run.
 *
 * `X-Client-IP` is what the Rust rate limiter trusts, so it must never be
 * whatever a caller sent: the client's own header is deleted and the value is
 * set from `CF-Connecting-IP`, which only the edge can write. The door secret
 * guards the call itself: the service is technically reachable at its `run.app`
 * address, and this header is what says the request came through the front
 * door.
 */
export async function forwardToApi(request, env) {
  const base = env.API_BASE_URL;
  if (!base) {
    // The runbook sets this after the first Cloud Run deploy (R6/R7). Until
    // then the site is still whole: no game ever asks for /api/*.
    console.error('API_BASE_URL is not set: /api/* cannot reach the service');
    return jsonError(503, 'api_unconfigured');
  }

  const url = new URL(request.url);
  const target = new URL(url.pathname + url.search, base);

  try {
    return forwardResponse(
      await fetch(target, {
        method: request.method,
        headers: forwardHeaders(request, env),
        body: request.body,
        redirect: 'manual',
      }),
    );
  } catch (error) {
    // A service that cannot be reached is not a game's problem, and it is not
    // the page's either: the browser code treats any failure as "no answer" and
    // carries on with what it has.
    console.error('api service unreachable', error);
    return jsonError(502, 'api_unavailable');
  }
}

/** The Worker's fetch handler. */
export async function workerFetch(request, env) {
  const url = new URL(request.url);

  if (isApiPath(url.pathname)) {
    return forwardToApi(request, env);
  }

  // In production nothing reaches this line: `run_worker_first: ["/api/*"]`
  // leaves every other path to Cloudflare's asset router, which serves the
  // games without invoking any code at all. The fallback keeps the Worker
  // sensible when it is exercised directly.
  return env.ASSETS.fetch(request);
}
