import { workerFetch } from './router.js';

// The Worker front door (see docs/backend/ARCHITECTURE.md, The request path):
//
//   /, /account/ and /games/**   served by Cloudflare's asset router (no code runs)
//   /api/**                      proxied to the Rust service on Google Cloud Run
//
// There is no Durable Object and no container any more: the paid Workers plan
// went with them. Static asset requests are free and unlimited on the Free
// plan, and only the `/api/*` requests below count toward its daily limit.
export default {
  fetch: workerFetch,
};
