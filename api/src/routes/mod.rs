pub mod accounts;
pub mod health;
pub mod password;
pub mod progress;
pub mod sessions;

use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::json;

use crate::domain::password::PasswordError;
use crate::domain::username::UsernameError;
use crate::error::ApiError;

/// Every error leaves this service as JSON with the same shape, so the browser
/// code never has to guess. The message is for a developer reading a log, never
/// for a child: the account page maps a status to its own Norwegian copy.
pub async fn not_found() -> Response {
    (StatusCode::NOT_FOUND, Json(json!({ "error": "not_found" }))).into_response()
}

/// A username rule, as the stable code the browser code switches on.
pub fn username_error(error: UsernameError) -> ApiError {
    ApiError::BadRequest(match error {
        UsernameError::TooShort => "username_too_short",
        UsernameError::TooLong => "username_too_long",
        UsernameError::MustStartWithLetter => "username_must_start_with_letter",
        UsernameError::InvalidCharacter => "username_invalid_characters",
        UsernameError::Reserved => "username_reserved",
    })
}

/// A password rule, as the stable code the browser code switches on.
pub fn password_error(error: PasswordError) -> ApiError {
    ApiError::BadRequest(match error {
        PasswordError::TooShort => "password_too_short",
        PasswordError::TooLong => "password_too_long",
    })
}
