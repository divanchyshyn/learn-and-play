//! The schema, checked against a real Postgres.
//!
//! `#[sqlx::test]` creates a throwaway database per test, applies
//! `api/migrations` to it, and hands the test a pool — so these tests say
//! something about the SQL that actually ships rather than about a mock of it.
//! Locally that is the Postgres in `docker-compose.yml`; in CI it is a
//! `postgres:17` service container.

use api::{AppState, Command, Config, build_app_with_state};
use axum::{body::Body, http::Request, http::StatusCode};
use http_body_util::BodyExt;
use serde_json::Value;
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

fn config() -> Config {
    Config {
        port: 0,
        database_url: None,
        public_origin: None,
        pepper: None,
        noindex: false,
        command: Command::Serve,
    }
}

async fn insert_user(pool: &PgPool, username: &str) -> Uuid {
    let id = Uuid::new_v4();
    sqlx::query("INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3)")
        .bind(id)
        .bind(username)
        .bind("$argon2id$v=19$m=19456,t=2,p=1$c2FsdA$aGFzaA")
        .execute(pool)
        .await
        .expect("a user can be inserted");
    id
}

#[sqlx::test]
async fn migrations_create_every_table(pool: PgPool) {
    for table in ["users", "sessions", "progress", "auth_attempts"] {
        let exists: bool = sqlx::query_scalar(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables \
             WHERE table_schema = 'public' AND table_name = $1)",
        )
        .bind(table)
        .fetch_one(&pool)
        .await
        .expect("a readable schema");
        assert!(exists, "the migrations should create `{table}`");
    }
}

#[sqlx::test]
async fn deleting_a_user_removes_everything_that_user_owns(pool: PgPool) {
    let id = insert_user(&pool, "testkid").await;

    sqlx::query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now())")
        .bind(vec![0u8; 32])
        .bind(id)
        .execute(&pool)
        .await
        .expect("a session can be inserted");

    sqlx::query("INSERT INTO progress (user_id, record_key, payload) VALUES ($1, $2, $3)")
        .bind(id)
        .bind("soundLabyrinth:gallery")
        .bind(r#"{"version":1,"gallery":{"seen":[0],"round":[0]}}"#)
        .execute(&pool)
        .await
        .expect("a progress record can be inserted");

    // `DELETE /api/account` is one statement against `users`, and this is what
    // makes that true: the rest goes with it.
    sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(id)
        .execute(&pool)
        .await
        .expect("a user can be deleted");

    // sqlx 0.9 refuses a query built from a runtime string (`SqlSafeStr`), which
    // is why each table is paired with its own literal statement.
    for (table, statement) in [
        ("users", "SELECT count(*) FROM users"),
        ("sessions", "SELECT count(*) FROM sessions"),
        ("progress", "SELECT count(*) FROM progress"),
    ] {
        let remaining: i64 = sqlx::query_scalar(statement)
            .fetch_one(&pool)
            .await
            .expect("a countable table");
        assert_eq!(remaining, 0, "`{table}` should be empty after the delete");
    }
}

#[sqlx::test]
async fn one_username_belongs_to_one_account_whatever_the_case(pool: PgPool) {
    insert_user(&pool, "TestKid").await;

    let clash = sqlx::query("INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3)")
        .bind(Uuid::new_v4())
        .bind("testkid")
        .bind("$argon2id$v=19$m=19456,t=2,p=1$c2FsdA$aGFzaA")
        .execute(&pool)
        .await;

    assert!(
        clash.is_err(),
        "`testkid` and `TestKid` must be the same account name"
    );
}

#[sqlx::test]
async fn the_database_refuses_an_oversized_progress_record(pool: PgPool) {
    let id = insert_user(&pool, "testkid").await;
    let too_big = "x".repeat(65_537);

    let result =
        sqlx::query("INSERT INTO progress (user_id, record_key, payload) VALUES ($1, $2, $3)")
            .bind(id)
            .bind("wordFishing:journal")
            .bind(too_big)
            .execute(&pool)
            .await;

    assert!(
        result.is_err(),
        "the 64 KB cap is a database constraint, not only a handler check"
    );
}

#[sqlx::test]
async fn a_progress_record_starts_at_revision_one(pool: PgPool) {
    let id = insert_user(&pool, "testkid").await;

    sqlx::query("INSERT INTO progress (user_id, record_key, payload) VALUES ($1, $2, $3)")
        .bind(id)
        .bind("cardBattle:album")
        .bind(r#"{"version":1,"album":{"discovered":[]}}"#)
        .execute(&pool)
        .await
        .expect("a progress record can be inserted");

    let revision: i64 =
        sqlx::query_scalar("SELECT revision FROM progress WHERE user_id = $1 AND record_key = $2")
            .bind(id)
            .bind("cardBattle:album")
            .fetch_one(&pool)
            .await
            .expect("a stored revision");

    assert_eq!(revision, 1);
}

#[sqlx::test]
async fn health_reports_the_database_as_up_once_a_pool_is_configured(pool: PgPool) {
    let state = AppState::for_tests(config(), pool).expect("usable test state");
    let app = build_app_with_state(state);

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .expect("the router answers");

    assert_eq!(response.status(), StatusCode::OK);
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    let body: Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(body, serde_json::json!({ "ok": true, "db": "up" }));
}
