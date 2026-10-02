use axum::{Router, http::HeaderValue, middleware, response::Response};
use tower_http::trace::TraceLayer;

use crate::{auth, config::Config, routes, state::AppState};

/// The whole HTTP surface of the service, built from configuration alone.
///
/// It is one function on purpose: tests build the real router, so a route that
/// is wired wrong cannot pass a test that hand-assembled its own.
pub fn build_app(config: Config) -> Router {
    build_app_with_state(AppState::new(config))
}

/// The same router, with everything the service needs already in place. Used by
/// the tests that bring a database with them.
pub fn build_app_with_state(state: AppState) -> Router {
    let noindex = state.config.noindex;

    Router::new()
        .merge(routes::health::router())
        .merge(routes::accounts::router())
        .merge(routes::sessions::router())
        .merge(routes::password::router())
        .merge(routes::progress::router())
        .fallback(routes::not_found)
        // Every state-changing request has to come from this site (see
        // `auth::require_origin`); the games' own pages are the only caller.
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth::require_origin,
        ))
        // The test environment sets NOINDEX; the API's own responses are the
        // one thing Cloudflare's `_headers` file cannot cover.
        .layer(middleware::map_response(
            move |mut response: Response| async move {
                if noindex {
                    response
                        .headers_mut()
                        .insert("x-robots-tag", HeaderValue::from_static("noindex"));
                }
                response
            },
        ))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
