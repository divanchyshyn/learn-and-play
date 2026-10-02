use axum::{Router, http::HeaderValue, middleware, response::Response};
use tower_http::trace::TraceLayer;

use crate::{config::Config, routes, state::AppState};

/// The whole HTTP surface of the service.
///
/// It is one function on purpose: tests build the real router, so a route that
/// is wired wrong cannot pass a test that hand-assembled its own.
pub fn build_app(config: Config) -> Router {
    let state = AppState::new(config);
    let noindex = state.config.noindex;

    Router::new()
        .merge(routes::health::router())
        .fallback(routes::not_found)
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
