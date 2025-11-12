use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use sqlx::SqlitePool;
use thiserror::Error;
use tower_cookies::{Cookie, Cookies};

use crate::models::{Session, SharedState, User};

pub const SESSION_COOKIE: &str = "auramatch_session";
const SESSION_TTL_HOURS: i64 = 24;

#[derive(Debug, Error)]
pub enum AuthError {
    #[error("invalid credentials")]
    InvalidCredentials,
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub fn hash_password(password: &str) -> Result<String, AuthError> {
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|_| AuthError::InvalidCredentials)?
        .to_string();
    Ok(hash)
}

pub fn verify_password(password: &str, hash: &str) -> Result<(), AuthError> {
    let parsed_hash = argon2::PasswordHash::new(hash).map_err(|_| AuthError::InvalidCredentials)?;
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .map_err(|_| AuthError::InvalidCredentials)
}

pub async fn create_session(
    pool: &SqlitePool,
    user_id: &str,
    cookies: &Cookies,
) -> Result<Session, sqlx::Error> {
    let session = Session::new(user_id.to_string(), SESSION_TTL_HOURS);
    sqlx::query!(
        "INSERT INTO sessions (token, user_id, expires_at) VALUES (?1, ?2, ?3)",
        session.token,
        session.user_id,
        session.expires_at
    )
    .execute(pool)
    .await?;

    let mut cookie = Cookie::new(SESSION_COOKIE, session.token.clone());
    cookie.set_path("/");
    cookie.set_http_only(true);
    cookies.add(cookie);

    Ok(session)
}

pub async fn clear_session(pool: &SqlitePool, cookies: &Cookies) -> Result<(), sqlx::Error> {
    if let Some(cookie) = cookies.get(SESSION_COOKIE) {
        sqlx::query!("DELETE FROM sessions WHERE token = ?1", cookie.value())
            .execute(pool)
            .await?;
        cookies.remove(Cookie::named(SESSION_COOKIE));
    }
    Ok(())
}

pub async fn current_user(
    state: &SharedState,
    cookies: &Cookies,
) -> Result<Option<User>, sqlx::Error> {
    if let Some(cookie) = cookies.get(SESSION_COOKIE) {
        let user = sqlx::query_as!(
            User,
            "SELECT u.id, u.email, u.display_name, u.created_at \
             FROM users u INNER JOIN sessions s ON u.id = s.user_id \
             WHERE s.token = ?1 AND s.expires_at > CURRENT_TIMESTAMP",
            cookie.value()
        )
        .fetch_optional(&state.pool)
        .await?;
        return Ok(user);
    }

    Ok(None)
}
