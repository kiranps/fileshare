use std::sync::{Mutex, atomic::{AtomicBool, Ordering}};
use tokio::sync::oneshot;
use tokio::runtime::{Builder, Runtime};
use axum::body::Body;
use std::path::PathBuf;
use crate::ServerError;
use super::logging::init_logging;

type JoinHandleResult = tokio::task::JoinHandle<Result<(), ServerError>>;

#[derive(uniffi::Object)]
pub struct WebDavServer {
    pub port: u16,
    base_path: String,
    shutdown_tx: Mutex<Option<oneshot::Sender<()>>>,
    handle: Mutex<Option<JoinHandleResult>>,
    runtime: Mutex<Option<Runtime>>,
    running: AtomicBool, // ✅ IMPORTANT
}

#[uniffi::export]
impl WebDavServer {
    #[uniffi::constructor]
    pub fn new(port: u16, base_path: String) -> Self {
        WebDavServer {
            port,
            base_path: if base_path.is_empty() {
                "data".to_string()
            } else {
                base_path
            },
            shutdown_tx: Mutex::new(None),
            handle: Mutex::new(None),
            runtime: Mutex::new(None),
            running: AtomicBool::new(false),
        }
    }

    pub fn start(&self) -> Result<String, ServerError> {
        init_logging();
        if self.running.swap(true, Ordering::SeqCst) {
            return Err(ServerError::AlreadyRunning);
        }
        let rt = Builder::new_multi_thread()
            .enable_all()
            .build()
            .expect("failed to create tokio runtime");
        {
            let mut runtime_guard = self.runtime.lock().unwrap();
            *runtime_guard = Some(rt);
        }
        let addr = format!("0.0.0.0:{}", self.port);
        let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

        {
            let mut tx_guard = self.shutdown_tx.lock().unwrap();
            *tx_guard = Some(shutdown_tx);
        }
        let port = self.port;
        let base_path = self.base_path.clone();
        let handle = {
            let runtime_guard = self.runtime.lock().unwrap();
            runtime_guard.as_ref().unwrap().spawn(async move {
                let listener = tokio::net::TcpListener::bind(&addr)
                    .await
                    .map_err(|_| ServerError::BindFailed(port))?;

                let app = super::routing::router(base_path);

                axum::serve(listener, app)
                    .with_graceful_shutdown(async {
                        let _ = shutdown_rx.await;
                    })
                    .await
                    .map_err(|e| ServerError::RuntimeError {
                        message: e.to_string(),
                    })?;

                Ok::<(), ServerError>(())
            })
        };
        {
            let mut handle_guard = self.handle.lock().unwrap();
            *handle_guard = Some(handle);
        }
        Ok(format!("server started on port {}", self.port))
    }

    pub fn stop(&self) -> Result<String, ServerError> {
        if !self.running.swap(false, Ordering::SeqCst) {
            return Err(ServerError::NotRunning);
        }

        if let Some(tx) = self.shutdown_tx.lock().unwrap().take() {
            let _ = tx.send(());
        }

        if let Some(handle) = self.handle.lock().unwrap().take()
            && let Some(rt) = self.runtime.lock().unwrap().as_ref()
        {
            let _ = rt.block_on(handle);
        }

        Ok("server stopped successfully".to_string())
    }
}
