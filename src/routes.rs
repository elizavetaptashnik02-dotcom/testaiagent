use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use tower_cookies::Cookies;

use crate::{
    auth::{clear_session, create_session, current_user, hash_password, verify_password},
    models::{AuthResponse, LoginRequest, RegisterRequest, SharedState, User},
};

pub fn router() -> Router {
    Router::new()
        .route("/api/health", get(health))
        .route("/api/register", post(register))
        .route("/api/login", post(login))
        .route("/api/logout", post(logout))
        .route("/api/me", get(me))
}

async fn health() -> &'static str {
    "ok"
}

async fn register(
    State(state): State<SharedState>,
    mut cookies: Cookies,
    Json(payload): Json<RegisterRequest>,
) -> Result<(StatusCode, Json<AuthResponse>), StatusCode> {
    if payload.password.len() < 8 {
        return Err(StatusCode::BAD_REQUEST);
    }

    let hashed = hash_password(&payload.password).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let user_id = uuid::Uuid::new_v4().to_string();
    let profile_id = uuid::Uuid::new_v4().to_string();

    let result = sqlx::query!(
        "INSERT INTO users (id, email, password_hash, display_name) VALUES (?1, ?2, ?3, ?4)",
        user_id,
        payload.email,
        hashed,
        payload.display_name
    )
    .execute(&mut *tx)
    .await;

    if let Err(err) = result {
        tracing::error!(?err, "failed to create user");
        return Err(StatusCode::CONFLICT);
    }

    sqlx::query!(
        "INSERT INTO profiles (id, user_id, bio, interests, avatar_url) VALUES (?1, ?2, '', '', '')",
        profile_id,
        user_id
    )
    .execute(&mut *tx)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    tx.commit()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let user = sqlx::query_as!(
        User,
        "SELECT id, email, display_name, created_at FROM users WHERE id = ?1",
        user_id
    )
    .fetch_one(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    create_session(&state.pool, &user.id, &cookies)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((StatusCode::CREATED, Json(AuthResponse { user })))
}

async fn login(
    State(state): State<SharedState>,
    mut cookies: Cookies,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, StatusCode> {
    let record = sqlx::query!(
        "SELECT id, email, display_name, created_at, password_hash FROM users WHERE email = ?1",
        payload.email
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let Some(row) = record else {
        return Err(StatusCode::UNAUTHORIZED);
    };

    verify_password(&payload.password, &row.password_hash).map_err(|_| StatusCode::UNAUTHORIZED)?;

    let user = User {
        id: row.id,
        email: row.email,
        display_name: row.display_name,
        created_at: row.created_at,
    };

    create_session(&state.pool, &user.id, &cookies)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(AuthResponse { user }))
}

async fn logout(
    State(state): State<SharedState>,
    cookies: Cookies,
) -> Result<StatusCode, StatusCode> {
    clear_session(&state.pool, &cookies)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn me(
    State(state): State<SharedState>,
    cookies: Cookies,
) -> Result<Json<AuthResponse>, StatusCode> {
    let Some(user) = current_user(&state, &cookies)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    else {
        return Err(StatusCode::UNAUTHORIZED);
    };

    Ok(Json(AuthResponse { user }))
}
