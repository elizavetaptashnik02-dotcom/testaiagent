use std::sync::Arc;

use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use time::{Duration, OffsetDateTime};
use uuid::Uuid;

#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct User {
    pub id: String,
    pub email: String,
    pub display_name: String,
    pub created_at: OffsetDateTime,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct Session {
    pub token: String,
    pub user_id: String,
    pub expires_at: OffsetDateTime,
}

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    pub display_name: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub user: User,
}

impl Session {
    pub fn new(user_id: String, ttl_hours: i64) -> Self {
        Self {
            token: Uuid::new_v4().to_string(),
            user_id,
            expires_at: OffsetDateTime::now_utc() + Duration::hours(ttl_hours),
        }
    }
}

pub type SharedState = Arc<AppState>;
