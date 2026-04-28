//! # P2pConnection — UniFFI-exposed P2P server object
//!
//! Mirrors the lifecycle of [`WebDavServer`] but for the WebRTC / P2P path.
//!
//! ## Usage (from JS/Kotlin/Swift via generated bindings)
//!
//! ```ts
//! const conn = new P2pConnection();
//! const resp = conn.start({ signallingEndpoint: "https://signal.example.com/", basePath: "/data", sessionId: "my-session" });
//! // …
//! conn.stop();
//! ```

use rustls::crypto::CryptoProvider;
use std::{
    path::PathBuf,
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
    },
};

//use rustls::crypto::CryptoProvider;
use tokio::runtime::{Builder, Runtime};
use tracing::{debug, error, info, warn};

use crate::{
    ServerError,
    logging::init_logging,
    p2p_connect,
    peer::{Peer, PeerConfig},
};

// ── Options & Response ────────────────────────────────────────────────────────

/// Options passed to [`P2pConnection::start`].
#[derive(Debug, uniffi::Record)]
pub struct P2pStartOptions {
    /// Base URL of the HTTP signalling server, e.g. `"https://signal.example.com/"`.
    pub signalling_endpoint: String,
    /// Filesystem root to serve over the P2P data channel.
    pub base_path: String,
    /// Session id to register with the signalling server.
    pub session_id: String,
}

/// Returned by a successful [`P2pConnection::start`].
#[derive(Debug, uniffi::Record)]
pub struct P2pStartResponse {
    /// The session id that was registered (echoed back for convenience).
    pub session_id: String,
}

// ── P2pConnection object ──────────────────────────────────────────────────────

/// Long-lived P2P server object.  Create once, call `start` / `stop`.
#[derive(uniffi::Object)]
pub struct P2pConnection {
    /// Tokio runtime that owns the async P2P tasks.
    runtime: Mutex<Option<Runtime>>,
    /// Set to `true` while the connection is active.
    running: AtomicBool,
    /// Used to request a graceful shutdown.
    stop_tx: Mutex<Option<tokio::sync::oneshot::Sender<()>>>,
}

impl Default for P2pConnection {
    fn default() -> Self {
        Self {
            runtime: Mutex::new(None),
            running: AtomicBool::new(false),
            stop_tx: Mutex::new(None),
        }
    }
}

#[uniffi::export]
impl P2pConnection {
    /// Create a new (idle) `P2pConnection`.
    #[uniffi::constructor]
    pub fn new() -> Self {
        debug!("[P2pConnection] created (idle)");
        Self::default()
    }

    /// Start the P2P server.
    ///
    /// Spins up an internal Tokio runtime, builds a [`Peer`], and calls
    /// [`p2p_connect::run`] in the background.  Returns immediately once the
    /// runtime is running; the P2P handshake continues asynchronously.
    ///
    /// Returns `Err(ServerError::AlreadyRunning)` if called while already
    /// connected.
    pub fn start(&self, opts: P2pStartOptions) -> Result<P2pStartResponse, ServerError> {
        init_logging();

        info!(
            session_id = %opts.session_id,
            signalling_endpoint = %opts.signalling_endpoint,
            base_path = %opts.base_path,
            "[P2pConnection] start requested"
        );

        if self.running.swap(true, Ordering::SeqCst) {
            warn!(
                session_id = %opts.session_id,
                "[P2pConnection] start rejected — already running"
            );
            return Err(ServerError::AlreadyRunning);
        }

        // Install a default rustls crypto provider if none is set yet.
        // This is idempotent — repeated calls are a no-op.
        //let _ = CryptoProvider::install_default(rustls::crypto::aws_lc_rs::default_provider());
        //let _ = CryptoProvider::install_default(rustls::crypto::ring::default_provider())
        //.expect("crypto init failed");

        let base_path = PathBuf::from(&opts.base_path);
        let session_id = opts.session_id.clone();
        let signalling_endpoint = opts.signalling_endpoint.clone();

        let rt = Builder::new_multi_thread()
            .enable_all()
            .build()
            .map_err(|e| {
                error!("[P2pConnection] failed to build tokio runtime: {e}");
                ServerError::RuntimeError {
                    message: format!("failed to build tokio runtime: {e}"),
                }
            })?;

        debug!("[P2pConnection] tokio runtime created");

        let (stop_tx, stop_rx) = tokio::sync::oneshot::channel::<()>();
        *self.stop_tx.lock().unwrap() = Some(stop_tx);

        // `Peer::connect` is not `Send`, so we cannot use `rt.spawn`.
        // Instead, run the LocalSet on its own OS thread via `rt.block_on`.
        let handle = rt.handle().clone();
        let thread_session_id = session_id.clone();
        std::thread::spawn(move || {
            let _ = CryptoProvider::install_default(rustls::crypto::ring::default_provider());
            // Keep a copy for the post-`block_on` log line (the async block
            // moves `thread_session_id` so we snapshot it beforehand).
            let sid_for_exit_log = thread_session_id.clone();
            debug!(
                session_id = %thread_session_id,
                "[P2pConnection] background thread started"
            );
            let local = tokio::task::LocalSet::new();
            handle.block_on(local.run_until(async move {
                let peer = Peer::new(PeerConfig {
                    signal_base: signalling_endpoint.clone(),
                    ..PeerConfig::default()
                });

                peer.on_open(|_peer| async move {
                    info!("[p2p_connect] ✅ data channel open — ready to serve files");
                })
                .await;

                peer.on_close(|| async move {
                    info!("[p2p_connect] 🔴 data channel closed");
                })
                .await;

                peer.on_error(|err| async move {
                    info!("[p2p_connect] ⚠️  error: {err}");
                })
                .await;

                info!(
                    session_id = %thread_session_id,
                    signalling_endpoint = %signalling_endpoint,
                    "[P2pConnection] peer created, connecting…"
                );

                tokio::task::spawn_local(async move {
                    tokio::select! {
                        _ = p2p_connect::run(Arc::clone(&peer), &thread_session_id, base_path) => {
                            info!(
                                session_id = %thread_session_id,
                                "[P2pConnection] p2p_connect::run returned"
                            );
                        }
                        _ = stop_rx => {
                            info!(
                                session_id = %thread_session_id,
                                "[P2pConnection] stop signal received — shutting down"
                            );
                        }
                    }
                })
                .await
                .ok();
            }));
            debug!(
                session_id = %sid_for_exit_log,
                "[P2pConnection] background thread exiting"
            );
        });

        *self.runtime.lock().unwrap() = Some(rt);

        info!(
            session_id = %opts.session_id,
            "[P2pConnection] started successfully"
        );

        Ok(P2pStartResponse {
            session_id: opts.session_id,
        })
    }

    /// Stop the P2P server and release the runtime.
    ///
    /// Returns `Err(ServerError::NotRunning)` if called while not running.
    pub fn stop(&self) -> Result<String, ServerError> {
        info!("[P2pConnection] stop requested");

        if !self.running.swap(false, Ordering::SeqCst) {
            warn!("[P2pConnection] stop called but not running");
            return Err(ServerError::NotRunning);
        }

        // Signal the background task to exit.
        if let Some(tx) = self.stop_tx.lock().unwrap().take() {
            debug!("[P2pConnection] sending stop signal to background task");
            let _ = tx.send(());
        }

        // Drop the runtime (waits for all tasks to finish).
        debug!("[P2pConnection] dropping tokio runtime");
        self.runtime.lock().unwrap().take();

        info!("[P2pConnection] stopped successfully");
        Ok("p2p connection stopped".to_string())
    }
}
