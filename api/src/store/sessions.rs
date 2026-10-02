use chrono::{DateTime, Duration, Utc};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::domain::session::SESSION_DAYS;

/// The signed-in user, as every authenticated handler needs them.
#[derive(Debug, Clone, FromRow)]
pub struct SessionUser {
    pub id: Uuid,
    pub username: String,
}

pub async fn create(
    pool: &PgPool,
    token_hash: &[u8],
    user_id: Uuid,
    now: DateTime<Utc>,
) -> sqlx::Result<()> {
    sqlx::query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)")
        .bind(token_hash)
        .bind(user_id)
        .bind(now + Duration::days(SESSION_DAYS))
        .execute(pool)
        .await?;
    Ok(())
}

/// Look up a session that has not expired. An expired row is the same as no
/// row at all, which is what makes a year-long cookie safe to hand out.
pub async fn find(pool: &PgPool, token_hash: &[u8]) -> sqlx::Result<Option<SessionUser>> {
    sqlx::query_as::<_, SessionUser>(
        "SELECT u.id, u.username \
         FROM sessions s JOIN users u ON u.id = s.user_id \
         WHERE s.token_hash = $1 AND s.expires_at > now()",
    )
    .bind(token_hash)
    .fetch_optional(pool)
    .await
}

/// Keep a session alive while it is being used, at most once an hour: this is
/// what makes the year roll forward instead of ending on a fixed date.
pub async fn touch(pool: &PgPool, token_hash: &[u8]) -> sqlx::Result<()> {
    sqlx::query(
        "UPDATE sessions \
         SET last_seen_at = now(), expires_at = now() + make_interval(days => $2) \
         WHERE token_hash = $1 AND last_seen_at < now() - interval '1 hour'",
    )
    .bind(token_hash)
    .bind(SESSION_DAYS as i32)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn delete(pool: &PgPool, token_hash: &[u8]) -> sqlx::Result<()> {
    sqlx::query("DELETE FROM sessions WHERE token_hash = $1")
        .bind(token_hash)
        .execute(pool)
        .await?;
    Ok(())
}

/// Sign out everywhere except here. Used after a password change, which is the
/// only credential operation this service has.
pub async fn delete_others(pool: &PgPool, user_id: Uuid, keep: &[u8]) -> sqlx::Result<u64> {
    let result = sqlx::query("DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2")
        .bind(user_id)
        .bind(keep)
        .execute(pool)
        .await?;
    Ok(result.rows_affected())
}
