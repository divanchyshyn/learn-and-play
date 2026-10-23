use axum::{
    Json,
    http::{HeaderValue, StatusCode},
    response::{IntoResponse, Response},
};
use serde_json::json;

/// Everything that can go wrong in a handler, in one type.
///
/// The codes that leave this service are stable, machine-readable strings. What
/// a child reads is Norwegian copy the account page chooses for itself - a
/// server message is never shown to a child, and never says whether a username
/// exists or a password was close.
#[derive(Debug)]
pub enum ApiError {
    /// The request was understood and refused: `code` names why.
    BadRequest(&'static str),
    /// No session, or one that no longer exists.
    Unauthorized,
    /// A session exists but the request may not be made from where it came.
    Forbidden(&'static str),
    /// A username that is already taken.
    Conflict(&'static str),
    /// Too many failed attempts; the client should wait.
    TooManyRequests,
    /// The service is running without something it needs (no database, no
    /// pepper). Not a client error, and not a crash either.
    NotConfigured,
    /// Something unexpected. Logged with its cause, reported without it.
    Internal(anyhow::Error),
}

impl ApiError {
    pub fn internal(error: impl Into<anyhow::Error>) -> Self {
        Self::Internal(error.into())
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(error: sqlx::Error) -> Self {
        Self::Internal(error.into())
    }
}

impl From<anyhow::Error> for ApiError {
    fn from(error: anyhow::Error) -> Self {
        Self::Internal(error)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, code) = match &self {
            Self::BadRequest(code) => (StatusCode::BAD_REQUEST, *code),
            Self::Unauthorized => (StatusCode::UNAUTHORIZED, "invalid_credentials"),
            Self::Forbidden(code) => (StatusCode::FORBIDDEN, *code),
            Self::Conflict(code) => (StatusCode::CONFLICT, *code),
            Self::TooManyRequests => (StatusCode::TOO_MANY_REQUESTS, "too_many_attempts"),
            Self::NotConfigured => (StatusCode::SERVICE_UNAVAILABLE, "not_configured"),
            Self::Internal(error) => {
                tracing::error!(?error, "request failed");
                (StatusCode::INTERNAL_SERVER_ERROR, "internal")
            }
        };

        let mut response = (status, Json(json!({ "error": code }))).into_response();
        // An account response is never a thing to keep: it may carry a session
        // cookie, and a cached one would outlive the session it belongs to.
        response
            .headers_mut()
            .insert("cache-control", HeaderValue::from_static("no-store"));
        response
    }
}
