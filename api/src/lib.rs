#![forbid(unsafe_code)]
//! The Learn and Play API: accounts and cross-device progress.
//!
//! The service runs as a normal Linux binary inside a Cloudflare Container, and
//! a Worker front door forwards `/api/*` to it (see `docs/backend/PLAN.md`).
//! Nothing in here is allowed to become a dependency of a game: the games are
//! static assets and must work with this service stopped.
//!
//! The router lives in [`app::build_app`] so tests drive the real HTTP surface
//! instead of a hand-built one, and the pure rules live in `domain` modules
//! that need no database and no server.

pub mod app;
pub mod config;
pub mod db;
pub mod routes;
pub mod state;

pub use app::{build_app, build_app_with_state};
pub use config::{Command, Config};
pub use state::AppState;
