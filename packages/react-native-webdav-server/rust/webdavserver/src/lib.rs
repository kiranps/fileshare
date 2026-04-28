mod fs_repository;
mod helpers;
mod logging;
mod middleware;
mod routing;
mod webdav_service;
mod webdav_server;

pub mod p2p_types;
pub mod p2p_handler;
pub mod p2p_connect;
pub mod p2p_connection;
pub mod peer;

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
pub use p2p_connection::{P2pConnection, P2pStartOptions, P2pStartResponse};
