//! The service's HTTP surface, driven through the real router. These tests need
//! no database and no network, which is what makes them cheap enough to be the
//! first thing CI runs.

use api::{Command, Config, build_app};
use axum::{Router, body::Body, http::Request, http::StatusCode, response::Response};
use http_body_util::BodyExt;
use tower::ServiceExt;

fn config(noindex: bool, door_secret: Option<&str>) -> Config {
    Config {
        port: 0,
        database_url: None,
        public_origin: None,
        pepper: None,
        door_secret: door_secret.map(str::to_owned),
        noindex,
        command: Command::Serve,
    }
}

async fn get(app: Router, uri: &str) -> Response {
    request(app, uri, None).await
}

async fn request(app: Router, uri: &str, door_secret: Option<&str>) -> Response {
    let mut builder = Request::builder().uri(uri);
    if let Some(value) = door_secret {
        builder = builder.header("x-door-secret", value);
    }

    app.oneshot(builder.body(Body::empty()).expect("a valid request"))
        .await
        .expect("the router always answers")
}

async fn body_json(response: Response) -> serde_json::Value {
    let bytes = response
        .into_body()
        .collect()
        .await
        .expect("a readable body")
        .to_bytes();
    serde_json::from_slice(&bytes).expect("a JSON body")
}

#[tokio::test]
async fn health_reports_ok_without_a_database() {
    let response = get(build_app(config(false, None)), "/api/health").await;

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response
            .headers()
            .get("content-type")
            .and_then(|value| value.to_str().ok()),
        Some("application/json")
    );
    assert_eq!(
        body_json(response).await,
        serde_json::json!({ "ok": true, "db": "unconfigured" })
    );
}

#[tokio::test]
async fn an_unknown_path_is_json_not_found() {
    let response = get(build_app(config(false, None)), "/api/nothing-here").await;

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    assert_eq!(
        body_json(response).await,
        serde_json::json!({ "error": "not_found" })
    );
}

#[tokio::test]
async fn noindex_is_put_on_the_headers_when_the_deployment_asks_for_it() {
    let asked = get(build_app(config(true, None)), "/api/health").await;
    assert_eq!(
        asked
            .headers()
            .get("x-robots-tag")
            .and_then(|value| value.to_str().ok()),
        Some("noindex")
    );

    let not_asked = get(build_app(config(false, None)), "/api/health").await;
    assert!(not_asked.headers().get("x-robots-tag").is_none());
}

#[tokio::test]
async fn a_request_from_outside_the_front_door_is_refused() {
    let response = get(
        build_app(config(false, Some("the-front-door"))),
        "/api/health",
    )
    .await;

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
    assert_eq!(
        body_json(response).await,
        serde_json::json!({ "error": "front_door_required" })
    );
}

#[tokio::test]
async fn a_wrong_door_secret_is_refused() {
    let response = request(
        build_app(config(false, Some("the-front-door"))),
        "/api/health",
        Some("a-guess"),
    )
    .await;

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn the_front_door_is_believed_when_it_presents_the_secret() {
    let response = request(
        build_app(config(false, Some("the-front-door"))),
        "/api/health",
        Some("the-front-door"),
    )
    .await;

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn without_a_configured_door_secret_requests_are_allowed() {
    let response = get(build_app(config(false, None)), "/api/health").await;

    assert_eq!(response.status(), StatusCode::OK);
}
