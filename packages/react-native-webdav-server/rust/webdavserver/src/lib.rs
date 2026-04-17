mod helpers;
mod logging;
mod presentation;
mod repository;
mod service;
mod webdav_server;

uniffi::setup_scaffolding!();

use thiserror::Error;

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

pub use webdav_server::{StartOptions, WebDavServer};
