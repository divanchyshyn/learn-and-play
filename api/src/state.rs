use std::sync::Arc;

use sqlx::PgPool;

use crate::config::Config;
use crate::domain::password::Passwords;
use crate::error::ApiError;

/// What every handler is given. Cheap to clone (an `Arc`, a pool handle and an
/// `Arc`), which is what axum wants.
#[derive(Debug, Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    /// `None` when no `DATABASE_URL` is configured. That is a supported state
    /// rather than a broken one: the service has to boot and answer
    /// `/api/health` before a database exists, and the games never call it.
    pub pool: Option<PgPool>,
    /// `None` when no `PEPPER` is configured. Sign-up and sign-in report
    /// `not_configured` rather than hashing with no pepper at all.
    pub passwords: Option<Arc<Passwords>>,
}

impl AppState {
    /// State with neither a database nor a pepper: enough for `/api/health`,
    /// and what the routing tests use.
    pub fn new(config: Config) -> Self {
        Self {
            config: Arc::new(config),
            pool: None,
            passwords: None,
        }
    }

    /// Everything the service needs, wired from configuration.
    ///
    /// The pool connects lazily, so a database that is asleep (or missing) does
    /// not stop the process from starting. A malformed URL or an unusable pepper
    /// is a configuration mistake and does fail here.
    pub fn from_config(config: Config) -> anyhow::Result<Self> {
        let pool = match config.database_url.as_deref() {
            Some(url) => Some(crate::db::lazy_pool(url)?),
            None => None,
        };
        let passwords = match config.pepper.as_deref() {
            Some(pepper) => Some(Arc::new(Passwords::new(pepper.as_bytes())?)),
            None => None,
        };
        Ok(Self {
            config: Arc::new(config),
            pool,
            passwords,
        })
    }

    /// The database, or the honest answer that there is not one.
    pub fn pool(&self) -> Result<&PgPool, ApiError> {
        self.pool.as_ref().ok_or(ApiError::NotConfigured)
    }

    /// The password hasher, or the honest answer that the deployment has not
    /// been given a pepper.
    pub fn passwords(&self) -> Result<&Passwords, ApiError> {
        self.passwords.as_deref().ok_or(ApiError::NotConfigured)
    }

    /// Build state for a test that brings its own database.
    ///
    /// Not the production path: if the configuration carries no pepper, this
    /// uses a fixed throwaway one so a test never has to invent a secret.
    pub fn for_tests(mut config: Config, pool: PgPool) -> anyhow::Result<Self> {
        if config.pepper.is_none() {
            config.pepper = Some("a test pepper, never used anywhere real".to_owned());
        }
        let passwords = match config.pepper.as_deref() {
            Some(pepper) => Some(Arc::new(Passwords::new(pepper.as_bytes())?)),
            None => None,
        };
        Ok(Self {
            config: Arc::new(config),
            pool: Some(pool),
            passwords,
        })
    }
}
