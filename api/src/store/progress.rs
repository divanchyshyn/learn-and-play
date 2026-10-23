use sqlx::{FromRow, PgPool};
use uuid::Uuid;

/// One stored record, exactly as the client's own codec produced it.
#[derive(Debug, Clone, FromRow)]
pub struct Record {
    pub key: String,
    pub payload: String,
    pub revision: i64,
}

/// Every record this user has.
pub async fn all(pool: &PgPool, user_id: Uuid) -> sqlx::Result<Vec<Record>> {
    sqlx::query_as::<_, Record>(
        "SELECT record_key AS key, payload, revision FROM progress WHERE user_id = $1 ORDER BY record_key",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
}

pub async fn get(pool: &PgPool, user_id: Uuid, key: &str) -> sqlx::Result<Option<Record>> {
    sqlx::query_as::<_, Record>(
        "SELECT record_key AS key, payload, revision FROM progress \
         WHERE user_id = $1 AND record_key = $2",
    )
    .bind(user_id)
    .bind(key)
    .fetch_optional(pool)
    .await
}

/// Write a record, but only if the client named the revision it last saw.
///
/// * a record that does not exist yet is inserted at revision 1, whatever the
///   client claimed (`base_revision` 0 is the honest way to say "I have
///   nothing");
/// * an existing record is only overwritten when `base_revision` equals the
///   revision the server holds, and then the revision goes up by one;
/// * anything else writes nothing and returns `None`, which the caller answers
///   with the current row so the client can merge and try again.
///
/// That is why a device that was offline for a week cannot wipe the work of the
/// device that stayed online: it has to name a revision it never saw.
pub async fn upsert(
    pool: &PgPool,
    user_id: Uuid,
    key: &str,
    payload: &str,
    base_revision: i64,
) -> sqlx::Result<Option<i64>> {
    sqlx::query_scalar::<_, i64>(
        "INSERT INTO progress (user_id, record_key, payload, revision) VALUES ($1, $2, $3, 1) \
         ON CONFLICT (user_id, record_key) DO UPDATE \
           SET payload = EXCLUDED.payload, revision = progress.revision + 1, updated_at = now() \
           WHERE progress.revision = $4 \
         RETURNING revision",
    )
    .bind(user_id)
    .bind(key)
    .bind(payload)
    .bind(base_revision)
    .fetch_optional(pool)
    .await
}
