use anyhow::{Context, Result};
use api::{Config, build_app};
use tokio::net::TcpListener;
use tracing_subscriber::{EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<()> {
    let mut config = Config::from_env()?;
    config.command = api::config::parse_command(&std::env::args().skip(1).collect::<Vec<_>>())?;
    init_tracing();

    match config.command {
        api::Command::Serve => serve(config).await,
    }
}

async fn serve(config: Config) -> Result<()> {
    let port = config.port;
    let database_configured = config.database_url.is_some();

    // 0.0.0.0, not 127.0.0.1: the front door and the container runtime reach
    // this process over the container's network, not over the loopback of a
    // developer's laptop.
    let listener = TcpListener::bind(("0.0.0.0", port))
        .await
        .with_context(|| format!("could not bind port {port}"))?;

    tracing::info!(port, database_configured, "listening");

    axum::serve(listener, build_app(config))
        .with_graceful_shutdown(shutdown_signal())
        .await
        .context("the HTTP server stopped with an error")
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
