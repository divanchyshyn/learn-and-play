//! The progress API: what a signed-in browser may store, and what happens when
//! two of them disagree.

use api::{AppState, Command, Config, build_app_with_state};
use axum::{Router, body::Body, http::Request, http::StatusCode, response::Response};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use sqlx::PgPool;
use tower::ServiceExt;

const ORIGIN: &str = "https://test.play2learn.divanchyshyn.com";
const GALLERY: &str = r#"{"version":1,"gallery":{"seen":[0,1],"round":[0,1]}}"#;

fn config() -> Config {
    Config {
        port: 0,
        database_url: None,
        public_origin: Some(ORIGIN.to_owned()),
        pepper: None,
        noindex: false,
        command: Command::Serve,
    }
}

fn app(pool: PgPool) -> Router {
    build_app_with_state(AppState::for_tests(config(), pool).expect("usable test state"))
}

async fn send(app: &Router, request: Request<Body>) -> Response {
    app.clone()
        .oneshot(request)
        .await
        .expect("the router always answers")
}

async fn json(response: Response) -> Value {
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    serde_json::from_slice(&bytes).unwrap_or(Value::Null)
}

/// Create an account and return its session cookie.
async fn signed_in(app: &Router, username: &str) -> String {
    let response = send(
        app,
        Request::builder()
            .method("POST")
            .uri("/api/account")
            .header("origin", ORIGIN)
            .header("content-type", "application/json")
            .body(Body::from(
                json!({ "username": username, "password": "et-langt-passord" }).to_string(),
            ))
            .unwrap(),
    )
    .await;
    assert_eq!(response.status(), StatusCode::CREATED);

    response
        .headers()
        .get_all("set-cookie")
        .iter()
        .filter_map(|value| value.to_str().ok())
        .find_map(|value| {
            let pair = value.split(';').next()?;
            pair.starts_with("__Host-lap_sid=").then(|| pair.to_owned())
        })
        .expect("a session cookie")
}

async fn get_progress(app: &Router, cookie: Option<&str>) -> Response {
    let mut builder = Request::builder().method("GET").uri("/api/progress");
    if let Some(cookie) = cookie {
        builder = builder.header("cookie", cookie);
    }
    send(app, builder.body(Body::empty()).unwrap()).await
}

async fn put_progress(app: &Router, cookie: Option<&str>, records: Value) -> Response {
    let mut builder = Request::builder()
        .method("PUT")
        .uri("/api/progress")
        .header("origin", ORIGIN)
        .header("content-type", "application/json");
    if let Some(cookie) = cookie {
        builder = builder.header("cookie", cookie);
    }
    send(
        app,
        builder
            .body(Body::from(json!({ "records": records }).to_string()))
            .unwrap(),
    )
    .await
}

#[sqlx::test]
async fn a_round_trip_returns_what_was_stored(pool: PgPool) {
    let app = app(pool);
    let cookie = signed_in(&app, "TestKid").await;

    let saved = put_progress(
        &app,
        Some(&cookie),
        json!([{ "key": "soundLabyrinth:gallery", "payload": GALLERY, "baseRevision": 0 }]),
    )
    .await;
    assert_eq!(saved.status(), StatusCode::OK);
    assert_eq!(
        json(saved).await,
        json!({ "accepted": [{ "key": "soundLabyrinth:gallery", "revision": 1 }], "conflicts": [] })
    );

    let listed = get_progress(&app, Some(&cookie)).await;
    assert_eq!(
        json(listed).await,
        json!({ "records": [{ "key": "soundLabyrinth:gallery", "payload": GALLERY, "revision": 1 }] })
    );
}

#[sqlx::test]
async fn naming_the_revision_you_saw_is_what_lets_a_write_through(pool: PgPool) {
    let app = app(pool);
    let cookie = signed_in(&app, "TestKid").await;

    put_progress(
        &app,
        Some(&cookie),
        json!([{ "key": "cardBattle:album", "payload": "{\"first\":true}", "baseRevision": 0 }]),
    )
    .await;

    let second = put_progress(
        &app,
        Some(&cookie),
        json!([{ "key": "cardBattle:album", "payload": "{\"second\":true}", "baseRevision": 1 }]),
    )
    .await;

    assert_eq!(
        json(second).await,
        json!({ "accepted": [{ "key": "cardBattle:album", "revision": 2 }], "conflicts": [] })
    );
}

#[sqlx::test]
async fn a_stale_write_comes_back_as_a_conflict_and_changes_nothing(pool: PgPool) {
    let app = app(pool);
    let cookie = signed_in(&app, "TestKid").await;

    put_progress(
        &app,
        Some(&cookie),
        json!([{ "key": "wordFishing:journal", "payload": "{\"trips\":5}", "baseRevision": 0 }]),
    )
    .await;
    put_progress(
        &app,
        Some(&cookie),
        json!([{ "key": "wordFishing:journal", "payload": "{\"trips\":6}", "baseRevision": 1 }]),
    )
    .await;

    // A device that has not looked since revision 0 tries to write.
    let stale = put_progress(
        &app,
        Some(&cookie),
        json!([{ "key": "wordFishing:journal", "payload": "{\"trips\":1}", "baseRevision": 0 }]),
    )
    .await;

    assert_eq!(
        json(stale).await,
        json!({
            "accepted": [],
            "conflicts": [{ "key": "wordFishing:journal", "payload": "{\"trips\":6}", "revision": 2 }]
        }),
        "the server answers with what it holds, so the client can merge and retry"
    );

    let listed = json(get_progress(&app, Some(&cookie)).await).await;
    assert_eq!(listed["records"][0]["payload"], json!("{\"trips\":6}"));
}

#[sqlx::test]
async fn writing_a_record_that_is_already_there_is_a_conflict_not_an_overwrite(pool: PgPool) {
    let app = app(pool);
    let cookie = signed_in(&app, "TestKid").await;

    put_progress(
        &app,
        Some(&cookie),
        json!([{ "key": "cardBattle:album", "payload": "{\"discovered\":[\"fox\"]}", "baseRevision": 0 }]),
    )
    .await;

    // baseRevision 0 again: "I have nothing" — but the server has something.
    let again = put_progress(
        &app,
        Some(&cookie),
        json!([{ "key": "cardBattle:album", "payload": "{\"discovered\":[]}", "baseRevision": 0 }]),
    )
    .await;

    let body = json(again).await;
    assert_eq!(body["accepted"], json!([]));
    assert_eq!(body["conflicts"][0]["revision"], json!(1));
}

#[sqlx::test]
async fn an_unknown_record_key_is_refused(pool: PgPool) {
    let app = app(pool);
    let cookie = signed_in(&app, "TestKid").await;

    for key in [
        "soundLabyrinth:game",
        "soundLabyrinth:muted",
        "anything:at:all",
    ] {
        let refused = put_progress(
            &app,
            Some(&cookie),
            json!([{ "key": key, "payload": "{}", "baseRevision": 0 }]),
        )
        .await;

        assert_eq!(refused.status(), StatusCode::BAD_REQUEST, "{key}");
        assert_eq!(
            json(refused).await,
            json!({ "error": "unknown_record_key" })
        );
    }
}

#[sqlx::test]
async fn an_oversized_payload_is_refused(pool: PgPool) {
    let app = app(pool);
    let cookie = signed_in(&app, "TestKid").await;

    let refused = put_progress(
        &app,
        Some(&cookie),
        json!([{ "key": "cardBattle:album", "payload": "x".repeat(65_537), "baseRevision": 0 }]),
    )
    .await;

    assert_eq!(refused.status(), StatusCode::BAD_REQUEST);
    assert_eq!(json(refused).await, json!({ "error": "payload_too_large" }));
}

#[sqlx::test]
async fn a_negative_revision_is_refused(pool: PgPool) {
    let app = app(pool);
    let cookie = signed_in(&app, "TestKid").await;

    let refused = put_progress(
        &app,
        Some(&cookie),
        json!([{ "key": "cardBattle:album", "payload": "{}", "baseRevision": -1 }]),
    )
    .await;

    assert_eq!(refused.status(), StatusCode::BAD_REQUEST);
    assert_eq!(json(refused).await, json!({ "error": "invalid_revision" }));
}

#[sqlx::test]
async fn one_account_never_sees_another_accounts_progress(pool: PgPool) {
    let app = app(pool);
    let first = signed_in(&app, "TestKid").await;
    let second = signed_in(&app, "Sibling").await;

    put_progress(
        &app,
        Some(&first),
        json!([{ "key": "soundLabyrinth:gallery", "payload": GALLERY, "baseRevision": 0 }]),
    )
    .await;

    let theirs = json(get_progress(&app, Some(&second)).await).await;
    assert_eq!(theirs, json!({ "records": [] }));
}

#[sqlx::test]
async fn progress_needs_a_session(pool: PgPool) {
    let app = app(pool);

    let listed = get_progress(&app, None).await;
    assert_eq!(listed.status(), StatusCode::UNAUTHORIZED);

    let written = put_progress(
        &app,
        None,
        json!([{ "key": "cardBattle:album", "payload": "{}", "baseRevision": 0 }]),
    )
    .await;
    assert_eq!(written.status(), StatusCode::UNAUTHORIZED);
}

#[sqlx::test]
async fn a_signed_out_browser_with_a_dead_cookie_is_refused(pool: PgPool) {
    let app = app(pool);

    let stale = "any-token-that-was-never-issued";
    let listed = get_progress(&app, Some(&format!("__Host-lap_sid={stale}"))).await;
    assert_eq!(listed.status(), StatusCode::UNAUTHORIZED);
}
