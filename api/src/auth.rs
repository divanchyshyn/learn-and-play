use axum::extract::{FromRequestParts, OptionalFromRequestParts, Request, State};
use axum::http::HeaderMap;
use axum::http::request::Parts;
use axum::http::{Method, header::ORIGIN};
use axum::middleware::Next;
use axum::response::Response;
use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite};
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::{rate_limit, session};
use crate::error::ApiError;
use crate::state::AppState;
use crate::store;

/// The signed-in user behind a request.
///
/// Used as a handler argument, so an endpoint that needs an account simply asks
/// for one and cannot forget to check.
#[derive(Debug, Clone)]
pub struct CurrentUser {
    pub id: Uuid,
    pub username: String,
    /// The digest of this session's cookie, which is what `sessions` is keyed
    /// by. Kept so a password change can keep this session and drop the rest.
    pub token_hash: Vec<u8>,
}

async fn resolve(parts: &Parts, state: &AppState) -> Result<Option<CurrentUser>, ApiError> {
    let token = CookieJar::from_headers(&parts.headers)
        .get(session::COOKIE_NAME)
        .map(|cookie| cookie.value().to_owned());

    let Some(token) = token else {
        return Ok(None);
    };

    let pool = state.pool.as_ref().ok_or(ApiError::NotConfigured)?;
    let token_hash = session::hash_token(&token);
    let Some(user) = store::sessions::find(pool, &token_hash).await? else {
        return Ok(None);
    };

    // Keep the year rolling while the session is in use. Best effort: a failure
    // here must not fail the request it belongs to.
    if let Err(error) = store::sessions::touch(pool, &token_hash).await {
        tracing::warn!(?error, "could not refresh the session");
    }

    Ok(Some(CurrentUser {
        id: user.id,
        username: user.username,
        token_hash,
    }))
}

impl FromRequestParts<AppState> for CurrentUser {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        resolve(parts, state).await?.ok_or(ApiError::Unauthorized)
    }
}

impl OptionalFromRequestParts<AppState> for CurrentUser {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Option<Self>, Self::Rejection> {
        resolve(parts, state).await
    }
}

/// Refuse a state-changing request that did not come from this site.
///
/// `SameSite=Lax` already stops another origin's `fetch` from carrying the
/// session cookie; this check is the second lock on the same door, and it does
/// not rely on the browser getting `SameSite` right.
pub async fn require_origin(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Result<Response, ApiError> {
    let changes_state = matches!(
        *request.method(),
        Method::POST | Method::PUT | Method::PATCH | Method::DELETE
    );

    if changes_state {
        let expected = state
            .config
            .public_origin
            .as_deref()
            .ok_or(ApiError::NotConfigured)?;

        let origin = request
            .headers()
            .get(ORIGIN)
            .and_then(|value| value.to_str().ok())
            .ok_or(ApiError::Forbidden("origin_missing"))?;

        if origin.trim_end_matches('/') != expected {
            return Err(ApiError::Forbidden("origin_mismatch"));
        }
    }

    Ok(next.run(request).await)
}

/// The client address, as the front door reported it.
/// Only `X-Client-IP` is trusted, and the front door deletes any value a caller
/// sent before setting it from `CF-Connecting-IP`. `X-Forwarded-For` is never
/// read: it is trivially spoofable and a rate limiter that believes it is worse
/// than no rate limiter.
pub fn client_ip(headers: &HeaderMap) -> String {
    headers
        .get("x-client-ip")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("unknown")
        .to_owned()
}

/// The counters one failed attempt is counted under, with their limits.
pub fn attempt_keys(ip: &str, username: Option<&str>) -> Vec<(String, i32)> {
    let mut keys = vec![(rate_limit::ip_key(ip), rate_limit::MAX_IP_FAILURES)];
    if let Some(username) = username {
        keys.push((
            rate_limit::user_key(username),
            rate_limit::MAX_USER_FAILURES,
        ));
    }
    keys
}

/// Is any of these counters currently blocked?
pub async fn guard_blocked(
    pool: &PgPool,
    keys: &[(String, i32)],
    now: DateTime<Utc>,
) -> Result<(), ApiError> {
    for (key, _) in keys {
        let blocked = match store::attempts::load(pool, key).await? {
            Some(state) => state.is_blocked(now),
            None => false,
        };
        if blocked {
            return Err(ApiError::TooManyRequests);
        }
    }
    Ok(())
}

/// Count one failed attempt against every counter it belongs to.
pub async fn note_failure(
    pool: &PgPool,
    keys: &[(String, i32)],
    now: DateTime<Utc>,
) -> Result<(), ApiError> {
    for (key, limit) in keys {
        let previous = store::attempts::load(pool, key).await?;
        let next = rate_limit::record_failure(previous, *limit, now);
        store::attempts::save(pool, key, next).await?;
    }
    Ok(())
}

/// Forget the failures: a successful sign-in starts from a clean slate.
pub async fn clear_failures(pool: &PgPool, keys: &[(String, i32)]) -> Result<(), ApiError> {
    for (key, _) in keys {
        store::attempts::clear(pool, key).await?;
    }
    Ok(())
}

/// The session cookie, exactly as it is handed to a browser.
///
/// `__Host-` requires `Secure`, `Path=/` and no `Domain`, all of which are set
/// here; `HttpOnly` keeps it away from scripts; `SameSite=Lax` keeps another
/// site's `fetch` from carrying it while still letting a plain link into the
/// site arrive signed in.
pub fn session_cookie(token: String) -> Cookie<'static> {
    let mut cookie = Cookie::new(session::COOKIE_NAME, token);
    cookie.set_path("/");
    cookie.set_http_only(true);
    cookie.set_secure(true);
    cookie.set_same_site(SameSite::Lax);
    cookie.set_max_age(time::Duration::days(session::SESSION_DAYS));
    cookie
}

/// The same cookie with no value: how a sign-out is spelled. The path has to
/// match what was set, or the browser keeps the original.
pub fn expired_session_cookie() -> Cookie<'static> {
    let mut cookie = Cookie::from(session::COOKIE_NAME);
    cookie.set_path("/");
    cookie
}
