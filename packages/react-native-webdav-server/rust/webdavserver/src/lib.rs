use thiserror::Error;
mod server;

uniffi::setup_scaffolding!();

/// =======================
/// Errors exposed to JS
/// =======================

#[derive(Debug, Error, uniffi::Error)]
pub enum ServerError {
    #[error("server already running")]
    AlreadyRunning,
    #[error("server not running")]
    NotRunning,
    #[error("failed to bind server on port {0}")]
    BindFailed(u16),
    #[error("server runtime error: {message}")]
    RuntimeError { message: String },
}

pub use server::{StartOptions, WebDavServer};
