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

/// The header the Worker writes and the service reads.
pub const DOOR_SECRET_HEADER: &str = "x-door-secret";

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

/// Refuse a request that did not come through the Worker front door.
///
/// Cloud Run services are reachable at their own `run.app` address, so without
/// this check a caller could skip Cloudflare, set `X-Client-IP` itself, and the
/// rate limiter would count whatever it was told. The Worker deletes any
/// `X-Door-Secret` a caller sent and writes the deployment's value, so a
/// matching header is evidence the request came through the front door.
///
/// `None` is a supported state (local development and tests): the service boots
/// and works without a front door. Production sets `DOOR_SECRET` for both the
/// Worker and the service.
pub async fn require_door_secret(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Result<Response, ApiError> {
    if let Some(expected) = state.config.door_secret.as_deref() {
        let provided = request
            .headers()
            .get(DOOR_SECRET_HEADER)
            .and_then(|value| value.to_str().ok());

        let allowed =
            provided.is_some_and(|value| constant_time_eq(value.as_bytes(), expected.as_bytes()));

        if !allowed {
            return Err(ApiError::Forbidden("front_door_required"));
        }
    }

    Ok(next.run(request).await)
}

/// Compare two byte strings without letting the comparison stop early.
///
/// The length is compared first, which leaks only the length (a fixed-width
/// secret here), and the byte loop always visits every byte, so a wrong prefix
/// costs the same as a wrong suffix.
fn constant_time_eq(left: &[u8], right: &[u8]) -> bool {
    if left.len() != right.len() {
        return false;
    }

    let mut difference = 0u8;
    for (a, b) in left.iter().zip(right) {
        difference |= a ^ b;
    }
    difference == 0
}

/// The client address, as the front door reported it.
/// Only `X-Client-IP` is trusted, and the front door deletes any value a caller
/// sent before setting it from `CF-Connecting-IP`. `X-Forwarded-For` is never
/// read: it is trivially spoofable and a rate limiter that believes it is worse
/// than no rate limiter. The counters keep only a digest of this value, never
/// the address itself.
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
        // The store increments under a row lock: a parallel batch of guesses must
        // count as a batch, not as one failure.
        store::attempts::record(pool, key, *limit, now).await?;
    }
    prune(pool, now).await?;
    Ok(())
}

/// Count one successful account creation against the address's sign-up budget.
pub async fn note_signup(pool: &PgPool, ip: &str, now: DateTime<Utc>) -> Result<(), ApiError> {
    store::attempts::record(
        pool,
        &rate_limit::signup_key(ip),
        rate_limit::MAX_SIGNUPS,
        now,
    )
    .await?;
    prune(pool, now).await
}

/// The sign-up counters for an address, in the shape `guard_blocked` wants.
pub fn signup_keys(ip: &str) -> Vec<(String, i32)> {
    vec![(rate_limit::signup_key(ip), rate_limit::MAX_SIGNUPS)]
}

/// Delete counters whose window is long past. The address is stored only as a
/// digest, and even that does not stay forever.
async fn prune(pool: &PgPool, now: DateTime<Utc>) -> Result<(), ApiError> {
    let cutoff = now - chrono::Duration::hours(rate_limit::RETENTION_HOURS);
    store::attempts::prune(pool, cutoff).await?;
    Ok(())
}

/// Forget the failures against one username, after it proved the password.
///
/// The address counter is deliberately left alone: clearing it on any successful
/// sign-in would let an attacker with one account reset their own address limit
/// between guesses at somebody else's.
pub async fn clear_user_failures(pool: &PgPool, username: &str) -> Result<(), ApiError> {
    store::attempts::clear(pool, &rate_limit::user_key(username)).await?;
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

/// The same cookie with no value: how a sign-out is spelled.
///
/// It repeats the attributes of the session cookie on purpose. A browser only
/// accepts a `__Host-` cookie (including a deletion) when it carries `Secure`,
/// `Path=/` and no `Domain`; a removal cookie with only `Path=/` would be ignored
/// and the old session token would keep being sent. `CookieJar::remove` adds the
/// expiry on top of these attributes.
pub fn expired_session_cookie() -> Cookie<'static> {
    let mut cookie = Cookie::from(session::COOKIE_NAME);
    cookie.set_path("/");
    cookie.set_http_only(true);
    cookie.set_secure(true);
    cookie.set_same_site(SameSite::Lax);
    cookie
}

#[cfg(test)]
mod tests {
    use super::constant_time_eq;

    #[test]
    fn equal_secrets_match() {
        assert!(constant_time_eq(
            b"a-long-front-door-secret",
            b"a-long-front-door-secret"
        ));
        assert!(constant_time_eq(b"", b""));
    }

    #[test]
    fn a_different_secret_does_not_match() {
        assert!(!constant_time_eq(
            b"a-long-front-door-secret",
            b"b-long-front-door-secret"
        ));
        assert!(!constant_time_eq(
            b"a-long-front-door-secret",
            b"a-long-front-door-secreu"
        ));
    }

    #[test]
    fn a_different_length_does_not_match() {
        assert!(!constant_time_eq(b"abc", b"ab"));
        assert!(!constant_time_eq(b"", b"a"));
    }
}
