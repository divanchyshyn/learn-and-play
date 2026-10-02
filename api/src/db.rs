use anyhow::{Context, Result};
use sqlx::postgres::{PgPool, PgPoolOptions};

/// How long a query may take before the health endpoint calls the database
/// down. Neon scales to zero when nobody is playing, so the first query after a
/// quiet night waits for a wake-up - but not forever.
pub const HEALTH_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(2);

/// Connect a pool that does **not** connect yet.
///
/// This is what lets the service boot before the database exists: the process
/// starts, `/api/health` reports `unconfigured` or `down`, and the games - which
/// never call this service to be played - are unaffected. A malformed URL is
/// still a hard error, because that is a configuration mistake rather than a
/// database being asleep.
pub fn lazy_pool(database_url: &str) -> Result<PgPool> {
    PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(std::time::Duration::from_secs(5))
        // A Neon compute that suspended leaves dead connections in the pool;
        // checking one before handing it out reconnects instead of failing a
        // request that had nothing wrong with it.
        .test_before_acquire(true)
        .connect_lazy(database_url)
        .context("DATABASE_URL is not a usable Postgres connection string")
}

/// Apply every migration in `api/migrations`, in order.
///
/// Run as a one-shot command before a deploy (never on every start): it keeps a
/// broken migration from reaching production as a surprise at boot, and the
/// `_sqlx_migrations` table makes a second run a no-op.
pub async fn migrate(pool: &PgPool) -> Result<()> {
    sqlx::migrate!("./migrations")
        .run(pool)
        .await
        .context("could not apply the database migrations")?;
    Ok(())
}

/// The cheapest possible "is the database there" question.
pub async fn ping(pool: &PgPool) -> bool {
    matches!(
        tokio::time::timeout(
            HEALTH_TIMEOUT,
            sqlx::query_scalar::<_, i32>("SELECT 1").fetch_one(pool)
        )
        .await,
        Ok(Ok(_))
    )
}
