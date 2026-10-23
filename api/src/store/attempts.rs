use chrono::{DateTime, Utc};
use sqlx::{FromRow, PgPool};

use crate::domain::rate_limit::{self, Attempts};

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

/// Record one attempt against a counter, atomically.
///
/// A read-modify-write in the caller would lose concurrent failures (two requests
/// read the same count and each write `old + 1`), and under Cloud Run's
/// concurrency that is a way to multiply the guesses allowed before the limit
/// trips. Here the row is created if missing, locked with `FOR UPDATE`, and the
/// arithmetic is still the pure domain rule; the transaction is what serialises
/// the writers.
pub async fn record(
    pool: &PgPool,
    key: &str,
    limit: i32,
    now: DateTime<Utc>,
) -> sqlx::Result<Attempts> {
    let mut transaction = pool.begin().await?;

    // Create the row without disturbing a live one, so the `FOR UPDATE` below
    // has something to lock even on the very first failure for this key.
    sqlx::query(
        "INSERT INTO auth_attempts (key, window_start, failures) VALUES ($1, $2, 0) \
         ON CONFLICT (key) DO NOTHING",
    )
    .bind(key)
    .bind(now)
    .execute(&mut *transaction)
    .await?;

    let row = sqlx::query_as::<_, AttemptRow>(
        "SELECT window_start, failures, blocked_until FROM auth_attempts \
         WHERE key = $1 FOR UPDATE",
    )
    .bind(key)
    .fetch_one(&mut *transaction)
    .await?;

    let next = rate_limit::record_failure(Some(row.into()), limit, now);

    sqlx::query(
        "UPDATE auth_attempts SET window_start = $2, failures = $3, blocked_until = $4 \
         WHERE key = $1",
    )
    .bind(key)
    .bind(next.window_start)
    .bind(next.failures)
    .bind(next.blocked_until)
    .execute(&mut *transaction)
    .await?;

    transaction.commit().await?;
    Ok(next)
}

/// Delete counters whose window is long past. Called when a counter is written,
/// so an idle service never wakes Neo just to prune. A live block is never
/// removed: the longest block is an hour, far inside the retention period.
pub async fn prune(pool: &PgPool, cutoff: DateTime<Utc>) -> sqlx::Result<u64> {
    let result = sqlx::query(
        "DELETE FROM auth_attempts \
         WHERE window_start < $1 AND (blocked_until IS NULL OR blocked_until < now())",
    )
    .bind(cutoff)
    .execute(pool)
    .await?;

    Ok(result.rows_affected())
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
