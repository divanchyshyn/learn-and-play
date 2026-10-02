use axum::{Json, Router, extract::State, routing::get};
use serde::Serialize;

use crate::{db, state::AppState};

/// The database's state as this service sees it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum DbState {
    /// Configured and answering.
    Up,
    /// Configured but not answering.
    Down,
    /// No `DATABASE_URL`: the service is running without a database, which is a
    /// valid state — the container has to boot before the database exists, and
    /// the games never call this service anyway.
    Unconfigured,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct Health {
    pub ok: bool,
    pub db: DbState,
}

pub fn router() -> Router<AppState> {
    Router::new().route("/api/health", get(health))
}

/// Liveness, not readiness: this answers `ok` whenever the process is up, and
/// says separately what the database is doing. A container that could not start
/// because Neon is asleep would be a container that cannot serve the pages that
/// never needed Neon in the first place.
async fn health(State(state): State<AppState>) -> Json<Health> {
    let db = match &state.pool {
        None => DbState::Unconfigured,
        Some(pool) => {
            if db::ping(pool).await {
                DbState::Up
            } else {
                DbState::Down
            }
        }
    };

    Json(Health { ok: true, db })
}
