use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::routing::post;
use axum::{Json, Router};
use axum_extra::extract::cookie::CookieJar;
use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::auth::{self, CurrentUser};
use crate::domain::{password, session, username};
use crate::error::ApiError;
use crate::state::AppState;
use crate::store::{self, users::Created};

use super::{password_error, username_error};

#[derive(Debug, Deserialize)]
pub struct Credentials {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct PasswordOnly {
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct Account {
    pub username: String,
}

pub fn router() -> Router<AppState> {
    Router::new().route("/api/account", post(sign_up).delete(delete_account))
}

/// Create an account and sign it in.
///
/// The session starts immediately: there is nothing to verify (no email, by
/// design), so making a child sign in again right after choosing a password
/// would be pure friction.
async fn sign_up(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Json(body): Json<Credentials>,
) -> Result<impl IntoResponse, ApiError> {
    let pool = state.pool()?;
    let passwords = state.passwords()?;

    let username = username::validate(&body.username).map_err(username_error)?;
    password::validate(&body.password).map_err(password_error)?;

    let now = Utc::now();
    let ip = auth::client_ip(&headers);
    let keys = auth::attempt_keys(&ip, None);
    auth::guard_blocked(pool, &keys, now).await?;

    let hash = passwords.hash(&body.password)?;

    match store::users::create(pool, &username, &hash).await? {
        Created::UsernameTaken => {
            auth::note_failure(pool, &keys, now).await?;
            Err(ApiError::Conflict("username_taken"))
        }
        Created::Yes(user_id) => {
            let token = session::mint_token();
            store::sessions::create(pool, &session::hash_token(&token), user_id, now).await?;
            tracing::info!(%username, "account created");

            Ok((
                StatusCode::CREATED,
                jar.add(auth::session_cookie(token)),
                Json(Account { username }),
            ))
        }
    }
}

/// Delete the account, and with it every session and every progress record.
///
/// The password is required: this is the one endpoint where a stolen session
/// alone should not be enough, because there is no undoing it.
async fn delete_account(
    State(state): State<AppState>,
    user: CurrentUser,
    jar: CookieJar,
    Json(body): Json<PasswordOnly>,
) -> Result<impl IntoResponse, ApiError> {
    let pool = state.pool()?;
    let passwords = state.passwords()?;

    let row = store::users::find_by_id(pool, user.id)
        .await?
        .ok_or(ApiError::Unauthorized)?;

    if !passwords.verify(&body.password, &row.password_hash) {
        return Err(ApiError::Unauthorized);
    }

    store::users::delete(pool, user.id).await?;
    tracing::info!(username = %row.username, "account deleted");

    Ok((
        StatusCode::NO_CONTENT,
        jar.remove(auth::expired_session_cookie()),
    ))
}
