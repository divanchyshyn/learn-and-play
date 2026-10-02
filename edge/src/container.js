import { Container } from '@cloudflare/containers';

// The Durable Object that owns the Rust container. A Cloudflare Container can
// only be reached through a Durable Object, so this class is what makes the
// service addressable at all: the base class starts the instance on the first
// request, proxies HTTP to it, keeps it warm for `sleepAfter`, and stops it when
// the activity window expires.
export class ApiContainer extends Container {
  // The Rust service listens here (api/src/main.rs, PORT default 8080).
  defaultPort = 8080;

  // Ten minutes of idleness before the instance sleeps. Every wake-up costs a
  // cold start of 1-3 seconds, which no game ever waits for: `/api/*` is the
  // only path that reaches this class.
  sleepAfter = '10m';

  // Port readiness is checked against the service's own health endpoint, so a
  // container that cannot serve requests is never treated as ready.
  pingEndpoint = '/api/health';

  constructor(ctx, env) {
    super(ctx, env);

    // The service reads all of its configuration from the environment, so the
    // Worker's secrets and vars are handed to the container here. Empty strings
    // read as "not set" on the Rust side.
    this.envVars = {
      DATABASE_URL: env.DATABASE_URL ?? '',
      PEPPER: env.PEPPER ?? '',
      PUBLIC_ORIGIN: env.PUBLIC_ORIGIN ?? '',
      NOINDEX: env.NOINDEX ?? '',
      RUST_LOG: env.RUST_LOG ?? 'info',
    };
  }

  async onStart() {
    console.log('api container started');
  }

  async onStop({ exitCode, reason }) {
    console.log('api container stopped', { exitCode, reason });
  }
}
