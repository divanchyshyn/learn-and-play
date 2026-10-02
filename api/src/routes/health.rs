use axum::{Json, Router, extract::State, routing::get};
use serde::Serialize;

use crate::state::AppState;

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

async fn health(State(state): State<AppState>) -> Json<Health> {
    Json(Health {
        ok: true,
        db: db_state(&state),
    })
}

/// Until the database layer lands, the only honest answer is "there is none".
/// When `AppState` carries a pool this becomes a real check.
fn db_state(_state: &AppState) -> DbState {
    DbState::Unconfigured
}
