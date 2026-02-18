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
}

/// UniFFI-exported start
#[uniffi::export]
pub async fn start_server(port: u16) -> Result<String, ServerError> {
    server::start(port).await
}

/// UniFFI-exported stop
#[uniffi::export]
pub async fn stop_server() -> Result<String, ServerError> {
    server::stop().await
}
