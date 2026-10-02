use anyhow::{Context, Result};
use api::{AppState, Command, Config, build_app_with_state, config::parse_command, db};
use tokio::net::TcpListener;
use tracing_subscriber::{EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<()> {
    let mut config = Config::from_env()?;
    config.command = parse_command(&std::env::args().skip(1).collect::<Vec<_>>())?;
    init_tracing();

    match config.command {
        Command::Serve => serve(config).await,
        Command::Migrate => migrate(config).await,
    }
}

async fn serve(config: Config) -> Result<()> {
    // A pool that connects lazily, and a pepper that is only needed to hash
    // passwords: the process must start even when the database is asleep or not
    // reachable at all, because the games never depend on this service and
    // `/api/health` should still answer.
    let state = AppState::from_config(config)?;
    let port = state.config.port;
    let database_configured = state.pool.is_some();
    let accounts_configured = state.passwords.is_some();

    // 0.0.0.0, not 127.0.0.1: the front door and the container runtime reach
    // this process over the container's network, not over the loopback of a
    // developer's laptop.
    let listener = TcpListener::bind(("0.0.0.0", port))
        .await
        .with_context(|| format!("could not bind port {port}"))?;

    tracing::info!(port, database_configured, accounts_configured, "listening");

    axum::serve(listener, build_app_with_state(state))
        .with_graceful_shutdown(shutdown_signal())
        .await
        .context("the HTTP server stopped with an error")
}

/// Apply the migrations and exit. Run by the deploy workflows **before** the
/// deploy, so a bad migration fails the job instead of shipping code that
/// expects a schema which is not there.
async fn migrate(config: Config) -> Result<()> {
    let url = config
        .database_url
        .as_deref()
        .context("DATABASE_URL is required for `migrate`")?;

    let pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(1)
        .connect(url)
        .await
        .context("could not reach the database to migrate it")?;

    db::migrate(&pool).await?;
    tracing::info!("migrations applied");
    Ok(())
}

/// Cloudflare sends SIGTERM when a container instance is put to sleep and waits
/// up to fifteen minutes before SIGKILL, so a request that is already running
/// gets to finish. Locally, Ctrl-C does the same thing.
async fn shutdown_signal() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };

    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut signal) => {
                signal.recv().await;
            }
            Err(error) => {
                tracing::warn!(%error, "could not listen for SIGTERM");
                std::future::pending::<()>().await;
            }
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => tracing::info!("interrupted, shutting down"),
        _ = terminate => tracing::info!("SIGTERM received, shutting down"),
    }
}

fn init_tracing() {
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    let _ = tracing_subscriber::registry()
        .with(filter)
        .with(tracing_subscriber::fmt::layer())
        .try_init();
}
