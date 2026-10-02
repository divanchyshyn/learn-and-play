use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::post;
use axum::{Json, Router};
use serde::Deserialize;

use crate::auth::CurrentUser;
use crate::domain::password;
use crate::error::ApiError;
use crate::state::AppState;
use crate::store;

use super::password_error;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangePassword {
    pub current_password: String,
    pub new_password: String,
}

pub fn router() -> Router<AppState> {
    Router::new().route("/api/password", post(change))
}

/// Change the password of the signed-in account.
///
/// The current password is required even though the caller is already signed in:
/// on a shared tablet, a session alone should not be enough to lock a sibling
/// out of their own account, and it is the only credential operation this
/// service has (there is no reset — PLAN D8).
///
/// Every *other* session is dropped. Whoever changed the password keeps playing;
/// anybody else's browser has to sign in again.
async fn change(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(body): Json<ChangePassword>,
) -> Result<impl IntoResponse, ApiError> {
    let pool = state.pool()?;
    let passwords = state.passwords()?;

    password::validate(&body.new_password).map_err(password_error)?;

    let row = store::users::find_by_id(pool, user.id)
        .await?
        .ok_or(ApiError::Unauthorized)?;

    if !passwords.verify(&body.current_password, &row.password_hash) {
        return Err(ApiError::Unauthorized);
    }

    let hash = passwords.hash(&body.new_password)?;
    store::users::update_password(pool, user.id, &hash).await?;
    let signed_out = store::sessions::delete_others(pool, user.id, &user.token_hash).await?;

    tracing::info!(username = %row.username, signed_out, "password changed");

    Ok(StatusCode::NO_CONTENT)
}
