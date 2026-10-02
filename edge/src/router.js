// The routing half of the front door, kept free of any import that only exists
// on Cloudflare's runtime (`cloudflare:workers`, which `./container.js` pulls
// in through `@cloudflare/containers`). That is what lets the routing rules -
// which paths are ours, which header is trustworthy - be unit-tested in plain
// Node with Vitest.

// The single container instance that serves this Worker. One instance is all a
// site this size needs, and it keeps the deployment (and the bill) predictable.
export const API_INSTANCE = 'api';

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
 * Hand a request to the container, replacing the client-IP header on the way.
 *
 * `X-Client-IP` is what the Rust rate limiter trusts, so it must never be
 * whatever a caller sent: the client's own header is deleted and the value is
 * set from `CF-Connecting-IP`, which only the edge can write.
 */
export async function forwardToApi(request, env) {
  const headers = new Headers(request.headers);
  headers.delete('x-client-ip');
  const clientIp = request.headers.get('CF-Connecting-IP');
  if (clientIp) {
    headers.set('x-client-ip', clientIp);
  }

  const container = env.API_CONTAINER.get(env.API_CONTAINER.idFromName(API_INSTANCE));

  try {
    return await container.fetch(new Request(request, { headers }));
  } catch (error) {
    // A container that cannot start is not a game's problem, and it is not the
    // page's either: the browser code treats any failure as "no answer" and
    // carries on with what it has.
    console.error('api container unreachable', error);
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
