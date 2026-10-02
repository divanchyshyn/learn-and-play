# The Rust service, built into the image Cloudflare runs as a container.
#
# The build context is `api/` — the crate and the `sync-keys.json` it reads at
# compile time live together, so the image needs nothing from outside this
# directory.
#
# Two things this file is careful about:
#   * the dependency layer is cached by cargo-chef, so a source-only change does
#     not rebuild axum/tokio/sqlx from scratch on every deploy;
#   * the runtime image is distroless, which means no shell, no package manager,
#     and a non-root user by default — the smallest thing that can still run a
#     dynamically linked Linux binary.

# syntax=docker/dockerfile:1

FROM rust:1-bookworm AS chef
WORKDIR /app
RUN cargo install cargo-chef --locked --version ^0.1

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
# Only the dependency graph, so this layer is reused until Cargo.toml changes.
RUN cargo chef cook --release --locked --recipe-path recipe.json
COPY . .
RUN cargo build --release --locked --bin api

FROM gcr.io/distroless/cc-debian12:nonroot
COPY --from=builder /app/target/release/api /usr/local/bin/api

ENV PORT=8080
ENV RUST_LOG=info
EXPOSE 8080
USER nonroot

# Exec form on purpose: distroless has no shell to interpret a string command.
ENTRYPOINT ["/usr/local/bin/api", "serve"]
