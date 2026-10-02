import { ApiContainer } from './container.js';
import { workerFetch } from './router.js';

// The Worker front door (see docs/backend/PLAN.md, P8):
//
//   /  and  /games/**   served by Cloudflare's asset router (no code runs)
//   /api/**             proxied into the Rust container through ApiContainer
//
// The Durable Object class must be exported from the Worker's entry point, and
// it is the only way to reach a container.
export { ApiContainer };

export default {
  fetch: workerFetch,
};
