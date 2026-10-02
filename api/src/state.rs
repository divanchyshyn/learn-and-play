use std::sync::Arc;

use crate::config::Config;

/// What every handler is given. Cheap to clone (one `Arc`), which is what axum
/// wants, and deliberately tiny: anything bigger belongs in its own module.
#[derive(Debug, Clone)]
pub struct AppState {
    pub config: Arc<Config>,
}

impl AppState {
    pub fn new(config: Config) -> Self {
        Self {
            config: Arc::new(config),
        }
    }
}
