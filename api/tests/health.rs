//! The service's HTTP surface, driven through the real router. These tests need
//! no database and no network, which is what makes them cheap enough to be the
//! first thing CI runs.

use api::{Command, Config, build_app};
use axum::{Router, body::Body, http::Request, http::StatusCode, response::Response};
use http_body_util::BodyExt;
use tower::ServiceExt;

fn config(noindex: bool) -> Config {
    Config {
        port: 0,
        database_url: None,
        public_origin: None,
        noindex,
        command: Command::Serve,
    }
}

async fn get(app: Router, uri: &str) -> Response {
    app.oneshot(
        Request::builder()
            .uri(uri)
            .body(Body::empty())
            .expect("a valid request"),
    )
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
    let response = get(build_app(config(false)), "/api/health").await;

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
    let response = get(build_app(config(false)), "/api/nothing-here").await;

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    assert_eq!(
        body_json(response).await,
        serde_json::json!({ "error": "not_found" })
    );
}

#[tokio::test]
async fn the_test_environment_gets_a_noindex_header_and_production_does_not() {
    let test_env = get(build_app(config(true)), "/api/health").await;
    assert_eq!(
        test_env
            .headers()
            .get("x-robots-tag")
            .and_then(|value| value.to_str().ok()),
        Some("noindex")
    );

    let production = get(build_app(config(false)), "/api/health").await;
    assert!(production.headers().get("x-robots-tag").is_none());
}
