use std::{net::SocketAddr, sync::Arc};

use axum::{Extension, Router};
use tower_cookies::CookieManagerLayer;
use tower_http::{cors::CorsLayer, services::ServeDir, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod auth;
mod db;
mod models;
mod routes;

use crate::{db::init_db, routes::router};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let pool = init_db().await?;
    let shared_state = Arc::new(models::AppState { pool });

    let app = Router::new()
        .merge(router())
        .nest_service("/", ServeDir::new("static"))
        .layer(Extension(shared_state))
        .layer(CookieManagerLayer::new())
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());

    let addr: SocketAddr = std::env::var("AURAMATCH_BIND")
        .unwrap_or_else(|_| "0.0.0.0:8080".to_string())
        .parse()?;
    tracing::info!("listening on {addr}");
    axum::serve(tokio::net::TcpListener::bind(addr).await?, app).await?;

    Ok(())
}
