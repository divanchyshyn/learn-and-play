use std::sync::Arc;

use sqlx::PgPool;

use crate::config::Config;

/// What every handler is given. Cheap to clone (an `Arc` and a pool handle),
/// which is what axum wants.
#[derive(Debug, Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    /// `None` when no `DATABASE_URL` is configured. That is a supported state
    /// rather than a broken one: the service has to boot and answer
    /// `/api/health` before a database exists, and the games never call it.
    pub pool: Option<PgPool>,
}

impl AppState {
    pub fn new(config: Config) -> Self {
        Self {
            config: Arc::new(config),
            pool: None,
        }
    }

    pub fn with_pool(config: Config, pool: PgPool) -> Self {
        Self {
            config: Arc::new(config),
            pool: Some(pool),
        }
    }
}
