use chrono::{DateTime, Utc};
use sqlx::{FromRow, PgPool};

use crate::domain::rate_limit::Attempts;

#[derive(Debug, FromRow)]
struct AttemptRow {
    window_start: DateTime<Utc>,
    failures: i32,
    blocked_until: Option<DateTime<Utc>>,
}

impl From<AttemptRow> for Attempts {
    fn from(row: AttemptRow) -> Self {
        Self {
            window_start: row.window_start,
            failures: row.failures,
            blocked_until: row.blocked_until,
        }
    }
}

pub async fn load(pool: &PgPool, key: &str) -> sqlx::Result<Option<Attempts>> {
    let row = sqlx::query_as::<_, AttemptRow>(
        "SELECT window_start, failures, blocked_until FROM auth_attempts WHERE key = $1",
    )
    .bind(key)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(Into::into))
}

pub async fn save(pool: &PgPool, key: &str, state: Attempts) -> sqlx::Result<()> {
    sqlx::query(
        "INSERT INTO auth_attempts (key, window_start, failures, blocked_until) \
         VALUES ($1, $2, $3, $4) \
         ON CONFLICT (key) DO UPDATE SET \
           window_start = EXCLUDED.window_start, \
           failures = EXCLUDED.failures, \
           blocked_until = EXCLUDED.blocked_until",
    )
    .bind(key)
    .bind(state.window_start)
    .bind(state.failures)
    .bind(state.blocked_until)
    .execute(pool)
    .await?;
    Ok(())
}

/// A successful sign-in forgets the failures: the counters exist to slow down
/// guessing, not to punish somebody who eventually remembers.
pub async fn clear(pool: &PgPool, key: &str) -> sqlx::Result<()> {
    sqlx::query("DELETE FROM auth_attempts WHERE key = $1")
        .bind(key)
        .execute(pool)
        .await?;
    Ok(())
}
