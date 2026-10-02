#![forbid(unsafe_code)]
//! The Learn and Play API: accounts and cross-device progress.
//!
//! The service runs as a normal Linux binary inside a Cloudflare Container, and
//! a Worker front door forwards `/api/*` to it (see `docs/backend/PLAN.md`).
//! Nothing in here is allowed to become a dependency of a game: the games are
//! static assets and must work with this service stopped.
//!
//! The layout follows one rule: **rules live in `domain`, storage lives in
//! `store`, and `routes` only wires the two together.** A rule that a test
//! cannot reach without a database belongs in a handler that is too fat.

pub mod app;
pub mod auth;
pub mod config;
pub mod db;
pub mod domain;
pub mod error;
pub mod routes;
pub mod state;
pub mod store;
pub mod sync_keys;

pub use app::{build_app, build_app_with_state};
pub use config::{Command, Config};
pub use error::ApiError;
pub use state::AppState;
