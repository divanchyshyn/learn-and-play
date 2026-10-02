pub mod health;

use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::json;

/// Every error leaves this service as JSON with the same shape, so the browser
/// code never has to guess. The message is for a developer reading a log, never
/// for a child: the account page maps a status to its own Norwegian copy.
pub async fn not_found() -> Response {
    (StatusCode::NOT_FOUND, Json(json!({ "error": "not_found" }))).into_response()
}
