// One wrapper for every call to the API.
//
// The rule it exists to enforce: **a failure is a value, never an exception.**
// Games must keep playing, and the account page must keep rendering, when the
// network is gone or the service is asleep — so nothing here throws, and every
// outcome is `{ ok: true, ... }` or `{ ok: false, error }` with a code the
// caller can turn into Norwegian copy.

const DEFAULT_TIMEOUT_MS = 4000;

/** The API lives on the same origin as the games; there is no base URL to set. */
export const API_PREFIX = '/api';

async function readBody(response) {
  // 204 and friends have nothing to parse, and a proxy error page is not JSON.
  const text = await response.text().catch(() => '');
  if (text === '') return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Call the API.
 *
 * @param {string} path   Path below `/api`, e.g. `/progress`.
 * @param {object} [options]
 * @param {string} [options.method]
 * @param {unknown} [options.body]        Serialized as JSON when given.
 * @param {number} [options.timeoutMs]    Give up after this long.
 * @param {boolean} [options.keepalive]   Let the request outlive the page.
 * @returns {Promise<{ok: true, status: number, data: unknown}
 *                 | {ok: false, status: number, error: string}>}
 */
export async function request(path, options = {}) {
  const {
    method = 'GET',
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    keepalive = false,
  } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_PREFIX}${path}`, {
      method,
      // The session is an HttpOnly cookie: it travels only when asked for.
      credentials: 'include',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      keepalive,
    });

    const data = await readBody(response);

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: data?.error ?? 'request_failed',
      };
    }

    return { ok: true, status: response.status, data };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error?.name === 'AbortError' ? 'timeout' : 'offline',
    };
  } finally {
    clearTimeout(timer);
  }
}
