use sqlx::{FromRow, PgPool};
use uuid::Uuid;

/// The columns the sign-in path needs. The hash never leaves this module except
/// to be verified.
#[derive(Debug, Clone, FromRow)]
pub struct UserRow {
    pub id: Uuid,
    pub username: String,
    pub password_hash: String,
}

/// The outcome of `INSERT`, with the one failure that is not an error.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Created {
    /// The account exists, with this id.
    Yes(Uuid),
    /// Somebody already has that username (matched without regard to case:
    /// `Kim` and `kim` are the same name to a child).
    UsernameTaken,
}

pub async fn create(pool: &PgPool, username: &str, password_hash: &str) -> sqlx::Result<Created> {
    let id = Uuid::new_v4();

    let result = sqlx::query("INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3)")
        .bind(id)
        .bind(username)
        .bind(password_hash)
        .execute(pool)
        .await;

    match result {
        Ok(_) => Ok(Created::Yes(id)),
        Err(error)
            if error
                .as_database_error()
                .is_some_and(|error| error.is_unique_violation()) =>
        {
            Ok(Created::UsernameTaken)
        }
        Err(error) => Err(error),
    }
}

pub async fn find_by_username(pool: &PgPool, username: &str) -> sqlx::Result<Option<UserRow>> {
    sqlx::query_as::<_, UserRow>(
        "SELECT id, username, password_hash FROM users WHERE lower(username) = lower($1)",
    )
    .bind(username)
    .fetch_optional(pool)
    .await
}

pub async fn find_by_id(pool: &PgPool, id: Uuid) -> sqlx::Result<Option<UserRow>> {
    sqlx::query_as::<_, UserRow>("SELECT id, username, password_hash FROM users WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn update_password(pool: &PgPool, id: Uuid, password_hash: &str) -> sqlx::Result<()> {
    sqlx::query("UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1")
        .bind(id)
        .bind(password_hash)
        .execute(pool)
        .await?;
    Ok(())
}

/// Delete an account. Because every table references `users(id)` with
/// `ON DELETE CASCADE`, this one statement also removes the sessions, the
/// progress and the rate-limit counters that belonged to it.
pub async fn delete(pool: &PgPool, id: Uuid) -> sqlx::Result<()> {
    sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}
