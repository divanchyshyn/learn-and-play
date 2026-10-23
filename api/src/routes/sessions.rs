use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use axum_extra::extract::cookie::CookieJar;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

use crate::auth::{self, CurrentUser};
use crate::domain::{password, session, username};
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

    let now = Utc::now();
    let ip = auth::client_ip(&headers);

    // Never let an unbounded username become a counter key or a database lookup,
    // and never let an unbounded password reach argon2. The shape is the one
    // sign-up enforces, so every existing account passes it; a malformed attempt
    // gets the same uniform 401 as a wrong password and is still counted against
    // the address, so it is not a free CPU or table lever.
    let username = match username::validate(&body.username) {
        Ok(username) => username,
        Err(_) => return Err(refuse_malformed(pool, &ip, now).await),
    };
    if body.password.is_empty() || body.password.len() > password::MAX_BYTES {
        return Err(refuse_malformed(pool, &ip, now).await);
    }

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

    // Only the username counter is forgotten. Clearing the address counter too
    // would let one valid account reset an attacker's address budget between
    // guesses at somebody else's password.
    auth::clear_user_failures(pool, &user.username).await?;

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

/// The uniform answer for a credential outside the accepted shape.
///
/// It still counts against the address (and honours an existing block), so the
/// cheap rejection cannot be used to spray oversized requests; the body and
/// status are the same as a wrong password, so it reveals nothing.
async fn refuse_malformed(pool: &PgPool, ip: &str, now: DateTime<Utc>) -> ApiError {
    let keys = auth::attempt_keys(ip, None);
    if let Err(error) = auth::guard_blocked(pool, &keys, now).await {
        return error;
    }
    if let Err(error) = auth::note_failure(pool, &keys, now).await {
        return error;
    }
    ApiError::Unauthorized
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
