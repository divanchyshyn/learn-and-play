//! The account lifecycle, driven through the real router against a real
//! database: sign up, sign in, change the password, sign out, delete.
//!
//! These tests are slower than the domain unit tests on purpose — every failed
//! sign-in does the work of a real password verification — and that is the
//! behaviour they exist to pin.

use api::{AppState, Command, Config, build_app_with_state};
use axum::{Router, body::Body, http::Request, http::StatusCode, response::Response};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use sqlx::PgPool;
use tower::ServiceExt;

const ORIGIN: &str = "https://test.play2learn.divanchyshyn.com";

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

async fn post(
    app: &Router,
    path: &str,
    body: Value,
    cookie: Option<&str>,
    origin: Option<&str>,
) -> Response {
    let mut builder = Request::builder()
        .method("POST")
        .uri(path)
        .header("content-type", "application/json");
    if let Some(origin) = origin {
        builder = builder.header("origin", origin);
    }
    if let Some(cookie) = cookie {
        builder = builder.header("cookie", cookie);
    }
    send(
        app,
        builder
            .body(Body::from(body.to_string()))
            .expect("a valid request"),
    )
    .await
}

async fn request(app: &Router, method: &str, path: &str, cookie: Option<&str>) -> Response {
    // The origin header is always sent here: every browser sends it, and a
    // state-changing request without one is refused on purpose (which the
    // dedicated origin test covers by building its own request).
    let mut builder = Request::builder()
        .method(method)
        .uri(path)
        .header("origin", ORIGIN);
    if let Some(cookie) = cookie {
        builder = builder.header("cookie", cookie);
    }
    send(app, builder.body(Body::empty()).expect("a valid request")).await
}

async fn json(response: Response) -> Value {
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    serde_json::from_slice(&bytes).unwrap_or(Value::Null)
}

/// The session cookie a response handed out, in the form a browser would send
/// it back.
fn session_cookie(response: &Response) -> String {
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

fn has_session_cookie(response: &Response) -> bool {
    response
        .headers()
        .get_all("set-cookie")
        .iter()
        .filter_map(|value| value.to_str().ok())
        .any(|value| value.starts_with("__Host-lap_sid="))
}

#[sqlx::test]
async fn signing_up_creates_an_account_and_signs_it_in(pool: PgPool) {
    let app = app(pool.clone());

    let response = post(
        &app,
        "/api/account",
        json!({ "username": "TestKid", "password": "et-langt-passord" }),
        None,
        Some(ORIGIN),
    )
    .await;

    assert_eq!(response.status(), StatusCode::CREATED);
    assert!(has_session_cookie(&response));
    assert_eq!(json(response).await, json!({ "username": "TestKid" }));

    let users: i64 = sqlx::query_scalar("SELECT count(*) FROM users")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(users, 1);

    // The stored value is a hash, and the password is nowhere in it.
    let stored: String = sqlx::query_scalar("SELECT password_hash FROM users")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(stored.starts_with("$argon2id$"), "{stored}");
    assert!(!stored.contains("et-langt-passord"));
}

#[sqlx::test]
async fn the_session_cookie_carries_the_attributes_the_prefix_requires(pool: PgPool) {
    let app = app(pool);

    let response = post(
        &app,
        "/api/account",
        json!({ "username": "TestKid", "password": "et-langt-passord" }),
        None,
        Some(ORIGIN),
    )
    .await;

    let header = response
        .headers()
        .get_all("set-cookie")
        .iter()
        .filter_map(|value| value.to_str().ok())
        .find(|value| value.starts_with("__Host-lap_sid="))
        .expect("a session cookie")
        .to_ascii_lowercase();

    assert!(header.contains("httponly"), "{header}");
    assert!(header.contains("secure"), "{header}");
    assert!(header.contains("samesite=lax"), "{header}");
    assert!(header.contains("path=/"), "{header}");
    assert!(!header.contains("domain="), "{header}");
}

#[sqlx::test]
async fn a_wrong_password_and_an_unknown_username_are_indistinguishable(pool: PgPool) {
    let app = app(pool);

    post(
        &app,
        "/api/account",
        json!({ "username": "TestKid", "password": "et-langt-passord" }),
        None,
        Some(ORIGIN),
    )
    .await;

    let wrong_password = post(
        &app,
        "/api/session",
        json!({ "username": "TestKid", "password": "feil-passord-her" }),
        None,
        Some(ORIGIN),
    )
    .await;

    let unknown_user = post(
        &app,
        "/api/session",
        json!({ "username": "Nobody", "password": "feit-passord-her" }),
        None,
        Some(ORIGIN),
    )
    .await;

    assert_eq!(wrong_password.status(), StatusCode::UNAUTHORIZED);
    assert_eq!(unknown_user.status(), wrong_password.status());
    assert_eq!(
        json(unknown_user).await,
        json(wrong_password).await,
        "the same body for both, so a response never says which half was wrong"
    );
}

#[sqlx::test]
async fn signing_in_and_out_moves_the_session(pool: PgPool) {
    let app = app(pool);

    post(
        &app,
        "/api/account",
        json!({ "username": "TestKid", "password": "et-langt-passord" }),
        None,
        Some(ORIGIN),
    )
    .await;

    let signed_in = post(
        &app,
        "/api/session",
        json!({ "username": "testkid", "password": "et-langt-passord" }),
        None,
        Some(ORIGIN),
    )
    .await;
    assert_eq!(
        signed_in.status(),
        StatusCode::OK,
        "the name is case-insensitive"
    );
    let cookie = session_cookie(&signed_in);

    let me = request(&app, "GET", "/api/me", Some(&cookie)).await;
    assert_eq!(
        json(me).await,
        json!({ "signedIn": true, "username": "TestKid" })
    );

    let signed_out = request(&app, "DELETE", "/api/session", Some(&cookie)).await;
    assert_eq!(signed_out.status(), StatusCode::NO_CONTENT);

    let me = request(&app, "GET", "/api/me", Some(&cookie)).await;
    assert_eq!(json(me).await, json!({ "signedIn": false }));
}

#[sqlx::test]
async fn changing_the_password_keeps_this_session_and_ends_the_others(pool: PgPool) {
    let app = app(pool);

    let first = post(
        &app,
        "/api/account",
        json!({ "username": "TestKid", "password": "et-langt-passord" }),
        None,
        Some(ORIGIN),
    )
    .await;
    let tablet = session_cookie(&first);

    let second = post(
        &app,
        "/api/session",
        json!({ "username": "TestKid", "password": "et-langt-passord" }),
        None,
        Some(ORIGIN),
    )
    .await;
    let laptop = session_cookie(&second);

    let changed = post(
        &app,
        "/api/password",
        json!({ "currentPassword": "et-langt-passord", "newPassword": "et-enda-lengre-passord" }),
        Some(&tablet),
        Some(ORIGIN),
    )
    .await;
    assert_eq!(changed.status(), StatusCode::NO_CONTENT);

    let still_here = request(&app, "GET", "/api/me", Some(&tablet)).await;
    assert_eq!(json(still_here).await["signedIn"], json!(true));

    let dropped = request(&app, "GET", "/api/me", Some(&laptop)).await;
    assert_eq!(json(dropped).await, json!({ "signedIn": false }));

    // The old password no longer works; the new one does.
    let old = post(
        &app,
        "/api/session",
        json!({ "username": "TestKid", "password": "et-langt-passord" }),
        None,
        Some(ORIGIN),
    )
    .await;
    assert_eq!(old.status(), StatusCode::UNAUTHORIZED);

    let new = post(
        &app,
        "/api/session",
        json!({ "username": "TestKid", "password": "et-enda-lengre-passord" }),
        None,
        Some(ORIGIN),
    )
    .await;
    assert_eq!(new.status(), StatusCode::OK);
}

#[sqlx::test]
async fn changing_the_password_needs_the_current_one(pool: PgPool) {
    let app = app(pool);

    let created = post(
        &app,
        "/api/account",
        json!({ "username": "TestKid", "password": "et-langt-passord" }),
        None,
        Some(ORIGIN),
    )
    .await;
    let cookie = session_cookie(&created);

    let refused = post(
        &app,
        "/api/password",
        json!({ "currentPassword": "noe-annet-helt", "newPassword": "et-enda-lengre-passord" }),
        Some(&cookie),
        Some(ORIGIN),
    )
    .await;

    assert_eq!(refused.status(), StatusCode::UNAUTHORIZED);
}

#[sqlx::test]
async fn deleting_the_account_removes_everything_it_owned(pool: PgPool) {
    let app = app(pool.clone());

    let created = post(
        &app,
        "/api/account",
        json!({ "username": "TestKid", "password": "et-langt-passord" }),
        None,
        Some(ORIGIN),
    )
    .await;
    let cookie = session_cookie(&created);

    sqlx::query("INSERT INTO progress (user_id, record_key, payload) SELECT id, 'cardBattle:album', '{}' FROM users")
        .execute(&pool)
        .await
        .unwrap();

    let deleted = send(
        &app,
        Request::builder()
            .method("DELETE")
            .uri("/api/account")
            .header("origin", ORIGIN)
            .header("cookie", &cookie)
            .header("content-type", "application/json")
            .body(Body::from(
                json!({ "password": "et-langt-passord" }).to_string(),
            ))
            .unwrap(),
    )
    .await;
    assert_eq!(deleted.status(), StatusCode::NO_CONTENT);

    for (table, statement) in [
        ("users", "SELECT count(*) FROM users"),
        ("sessions", "SELECT count(*) FROM sessions"),
        ("progress", "SELECT count(*) FROM progress"),
    ] {
        let remaining: i64 = sqlx::query_scalar(statement)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(remaining, 0, "`{table}` should be empty");
    }

    // And the cookie is worthless now.
    let me = request(&app, "GET", "/api/me", Some(&cookie)).await;
    assert_eq!(json(me).await, json!({ "signedIn": false }));
}

#[sqlx::test]
async fn a_state_changing_request_has_to_come_from_this_site(pool: PgPool) {
    let app = app(pool);
    let body = json!({ "username": "TestKid", "password": "et-langt-passord" });

    let no_origin = post(&app, "/api/account", body.clone(), None, None).await;
    assert_eq!(no_origin.status(), StatusCode::FORBIDDEN);
    assert_eq!(json(no_origin).await, json!({ "error": "origin_missing" }));

    let elsewhere = post(
        &app,
        "/api/account",
        body.clone(),
        None,
        Some("https://evil.example"),
    )
    .await;
    assert_eq!(elsewhere.status(), StatusCode::FORBIDDEN);
    assert_eq!(json(elsewhere).await, json!({ "error": "origin_mismatch" }));

    let ours = post(&app, "/api/account", body, None, Some(ORIGIN)).await;
    assert_eq!(ours.status(), StatusCode::CREATED);
}

#[sqlx::test]
async fn reading_is_never_blocked_by_the_origin_check(pool: PgPool) {
    let app = app(pool);

    let me = send(
        &app,
        Request::builder()
            .uri("/api/me")
            .body(Body::empty())
            .unwrap(),
    )
    .await;

    assert_eq!(me.status(), StatusCode::OK);
}

#[sqlx::test]
async fn repeated_failures_are_slowed_down(pool: PgPool) {
    let app = app(pool);

    post(
        &app,
        "/api/account",
        json!({ "username": "TestKid", "password": "et-langt-passord" }),
        None,
        Some(ORIGIN),
    )
    .await;

    let mut last = StatusCode::UNAUTHORIZED;
    for _ in 0..9 {
        last = post(
            &app,
            "/api/session",
            json!({ "username": "TestKid", "password": "galt-passord-her" }),
            None,
            Some(ORIGIN),
        )
        .await
        .status();
    }

    assert_eq!(
        last,
        StatusCode::TOO_MANY_REQUESTS,
        "once the counter is blocked the answer is a wait, not another guess"
    );

    // Even the right password has to wait: the counter is checked before the
    // hash runs, which is what keeps guessing from costing the service.
    let correct = post(
        &app,
        "/api/session",
        json!({ "username": "TestKid", "password": "et-langt-passord" }),
        None,
        Some(ORIGIN),
    )
    .await;
    assert_eq!(correct.status(), StatusCode::TOO_MANY_REQUESTS);
}

#[sqlx::test]
async fn invalid_names_and_passwords_are_refused_with_a_reason(pool: PgPool) {
    let app = app(pool);

    let short_name = post(
        &app,
        "/api/account",
        json!({ "username": "ab", "password": "et-langt-passord" }),
        None,
        Some(ORIGIN),
    )
    .await;
    assert_eq!(short_name.status(), StatusCode::BAD_REQUEST);
    assert_eq!(
        json(short_name).await,
        json!({ "error": "username_too_short" })
    );

    let reserved = post(
        &app,
        "/api/account",
        json!({ "username": "admin", "password": "et-langt-passord" }),
        None,
        Some(ORIGIN),
    )
    .await;
    assert_eq!(reserved.status(), StatusCode::BAD_REQUEST);
    assert_eq!(
        json(reserved).await,
        json!({ "error": "username_reserved" })
    );

    let short_password = post(
        &app,
        "/api/account",
        json!({ "username": "TestKid", "password": "kort" }),
        None,
        Some(ORIGIN),
    )
    .await;
    assert_eq!(short_password.status(), StatusCode::BAD_REQUEST);
    assert_eq!(
        json(short_password).await,
        json!({ "error": "password_too_short" })
    );
}

#[sqlx::test]
async fn a_username_that_is_already_taken_is_refused(pool: PgPool) {
    let app = app(pool);

    let first = post(
        &app,
        "/api/account",
        json!({ "username": "TestKid", "password": "et-langt-passord" }),
        None,
        Some(ORIGIN),
    )
    .await;
    assert_eq!(first.status(), StatusCode::CREATED);

    let second = post(
        &app,
        "/api/account",
        json!({ "username": "testkid", "password": "et-annet-langt-passord" }),
        None,
        Some(ORIGIN),
    )
    .await;
    assert_eq!(second.status(), StatusCode::CONFLICT);
    assert_eq!(json(second).await, json!({ "error": "username_taken" }));
}

#[sqlx::test]
async fn account_endpoints_say_so_when_the_deployment_is_not_configured(pool: PgPool) {
    // A state with a database but no pepper: the deployment is half-configured,
    // and creating an account must fail rather than store an unpeppered hash.
    let mut unconfigured = config();
    unconfigured.pepper = None;
    let state = AppState::for_tests(unconfigured, pool).unwrap();
    let state = AppState {
        passwords: None,
        ..state
    };
    let app = build_app_with_state(state);

    let response = post(
        &app,
        "/api/account",
        json!({ "username": "TestKid", "password": "et-langt-passord" }),
        None,
        Some(ORIGIN),
    )
    .await;

    assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(json(response).await, json!({ "error": "not_configured" }));
}
