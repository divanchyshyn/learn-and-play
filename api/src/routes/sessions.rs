use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use axum_extra::extract::cookie::CookieJar;
use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::auth::{self, CurrentUser};
use crate::domain::{session, username};
use crate::error::ApiError;
use crate::state::AppState;
use crate::store;

#[derive(Debug, Deserialize)]
pub struct Credentials {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct Account {
    pub username: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Me {
    pub signed_in: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/session", post(sign_in).delete(sign_out))
        .route("/api/me", get(me))
}

/// Sign in with a username and a password.
///
/// Two things here are deliberately unhelpful to an attacker: an unknown
/// username does the work of a real verification (so both paths take the same
/// time), and every failure answers with the same body and status, so a response
/// never says which half was wrong.
async fn sign_in(
    State(state): State<AppState>,
    jar: CookieJar,
    headers: HeaderMap,
    Json(body): Json<Credentials>,
) -> Result<impl IntoResponse, ApiError> {
    let pool = state.pool()?;
    let passwords = state.passwords()?;

    let username = username::normalize(&body.username);
    let now = Utc::now();
    let ip = auth::client_ip(&headers);
    let keys = auth::attempt_keys(&ip, Some(&username));
    auth::guard_blocked(pool, &keys, now).await?;

    let Some(user) = store::users::find_by_username(pool, &username).await? else {
        passwords.verify_decoy(&body.password);
        auth::note_failure(pool, &keys, now).await?;
        return Err(ApiError::Unauthorized);
    };

    if !passwords.verify(&body.password, &user.password_hash) {
        auth::note_failure(pool, &keys, now).await?;
        return Err(ApiError::Unauthorized);
    }

    auth::clear_failures(pool, &keys).await?;

    // The cost of hashing is a property to keep, not to freeze: when the
    // parameters move, the next successful sign-in carries the account with it.
    if passwords.needs_rehash(&user.password_hash) {
        let fresh = passwords.hash(&body.password)?;
        store::users::update_password(pool, user.id, &fresh).await?;
        tracing::info!(%username, "password hash upgraded");
    }

    let token = session::mint_token();
    store::sessions::create(pool, &session::hash_token(&token), user.id, now).await?;

    Ok((
        StatusCode::OK,
        jar.add(auth::session_cookie(token)),
        Json(Account {
            username: user.username,
        }),
    ))
}

/// Sign out of this browser only. Other devices keep playing.
async fn sign_out(
    State(state): State<AppState>,
    user: CurrentUser,
    jar: CookieJar,
) -> Result<impl IntoResponse, ApiError> {
    store::sessions::delete(state.pool()?, &user.token_hash).await?;

    Ok((
        StatusCode::NO_CONTENT,
        jar.remove(auth::expired_session_cookie()),
    ))
}

/// Who, if anyone, is signed in. Signed out is a normal answer, not an error.
async fn me(user: Option<CurrentUser>) -> Json<Me> {
    Json(Me {
        signed_in: user.is_some(),
        username: user.map(|user| user.username),
    })
}
