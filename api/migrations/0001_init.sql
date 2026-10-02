-- The account and progress schema. Postgres 17 (Neon in the deployed
-- environments, `docker-compose.yml` locally).
--
-- Two things this schema deliberately does NOT hold: any personal data beyond a
-- chosen username (no email address, no real name, no birthday, no analytics)
-- and any session token in a usable form.

-- One row per account.
CREATE TABLE users (
  id            uuid PRIMARY KEY,
  username      text NOT NULL,
  -- The argon2id PHC string, peppered. Never the password, and never anything
  -- that can be reversed into it.
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- A username is what a child types, so it is stored as typed and matched
  -- without regard to case.
  CONSTRAINT users_username_shape CHECK (
    username = btrim(username) AND char_length(username) BETWEEN 3 AND 20
  )
);
CREATE UNIQUE INDEX users_username_key ON users (lower(username));

-- One row per signed-in browser. `token_hash` is sha256 of the cookie value, so
-- a dump of this table yields nothing that can be presented as a session.
CREATE TABLE sessions (
  token_hash   bytea PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL
);
CREATE INDEX sessions_user_key ON sessions (user_id);

-- Progress is stored as opaque per-record blobs, keyed by the same storage keys
-- the games already use in localStorage. `payload` is exactly what the game's
-- own codec produces - the service never parses or judges it.
--
-- `revision` is the server-assigned counter that decides which write wins: a
-- client may only write when it names the revision it last saw.
CREATE TABLE progress (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  record_key text NOT NULL,
  payload    text NOT NULL,
  revision   bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, record_key),
  CONSTRAINT progress_payload_size CHECK (octet_length(payload) <= 65536)
);

-- Rate-limiting counters for sign-in and sign-up. Written only when an attempt
-- fails, so ordinary use costs no rows. Counters, not lockouts: a window passes
-- and the account is usable again without anybody's help.
CREATE TABLE auth_attempts (
  key           text PRIMARY KEY, -- 'ip:<address>' | 'user:<lowercase name>'
  window_start  timestamptz NOT NULL DEFAULT now(),
  failures      integer NOT NULL DEFAULT 0,
  blocked_until timestamptz
);
