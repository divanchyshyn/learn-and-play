use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::routing::post;
use axum::{Json, Router};
use chrono::Utc;
use serde::Deserialize;

use crate::auth::{self, CurrentUser};
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
/// service has — there is no reset, because the account has no email address.
///
/// Every *other* session is dropped. Whoever changed the password keeps playing;
/// anybody else's browser has to sign in again.
async fn change(
    State(state): State<AppState>,
    user: CurrentUser,
    headers: HeaderMap,
    Json(body): Json<ChangePassword>,
) -> Result<impl IntoResponse, ApiError> {
    let pool = state.pool()?;
    let passwords = state.passwords()?;

    password::validate(&body.new_password).map_err(password_error)?;

    // Confirming the current password is a credential check, so it shares the
    // same counters as sign-in: a session left open must not become an unlimited
    // argon2 guessing surface.
    let now = Utc::now();
    let ip = auth::client_ip(&headers);
    let keys = auth::attempt_keys(&ip, Some(&user.username));
    auth::guard_blocked(pool, &keys, now).await?;

    if body.current_password.is_empty() || body.current_password.len() > password::MAX_BYTES {
        auth::note_failure(pool, &keys, now).await?;
        return Err(ApiError::Unauthorized);
    }

    let row = store::users::find_by_id(pool, user.id)
        .await?
        .ok_or(ApiError::Unauthorized)?;

    if !passwords.verify(&body.current_password, &row.password_hash) {
        auth::note_failure(pool, &keys, now).await?;
        return Err(ApiError::Unauthorized);
    }

    // The password was proved, so the username counter starts clean again; the
    // address counter still expires on its own.
    auth::clear_user_failures(pool, &row.username).await?;

    let hash = passwords.hash(&body.new_password)?;
    store::users::update_password(pool, user.id, &hash).await?;
    let signed_out = store::sessions::delete_others(pool, user.id, &user.token_hash).await?;

    tracing::info!(username = %row.username, signed_out, "password changed");

    Ok(StatusCode::NO_CONTENT)
}
