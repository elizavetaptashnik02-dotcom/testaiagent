use std::path::Path;

use sqlx::SqlitePool;
use tracing::info;

pub async fn init_db() -> anyhow::Result<SqlitePool> {
    let database_url =
        std::env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite://auramatch.db".to_string());
    if database_url.starts_with("sqlite://") {
        if let Some(path) = database_url.strip_prefix("sqlite://") {
            if let Some(parent) = Path::new(path).parent() {
                tokio::fs::create_dir_all(parent).await.ok();
            }
        }
    }

    let pool = SqlitePool::connect(&database_url).await?;
    info!("migrating database at {database_url}");
    sqlx::migrate!("migrations").run(&pool).await?;

    Ok(pool)
}
