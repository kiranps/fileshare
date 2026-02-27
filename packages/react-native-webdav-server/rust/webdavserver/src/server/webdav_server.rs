use super::logging::init_logging;
use crate::ServerError;
use std::sync::{
    Mutex,
    atomic::{AtomicBool, Ordering},
};
use tokio::runtime::{Builder, Runtime};
use tokio::sync::oneshot;

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

#[derive(uniffi::Object)]
pub struct StartResponse {
    pub ip: String,
    pub port: u16,
    pub running: bool,
    pub error: Option<String>,
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

    pub fn start(&self) -> Result<StartResponse, ServerError> {
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

        // Get a safe string representation of the local LAN IP; fallback to "0.0.0.0" if unknown.
        let lan_ip = local_lan_ip()
            .map(|ip| ip.to_string())
            .unwrap_or_else(|| "0.0.0.0".to_string());

        let startup_message = format!("server started on {}:{}", lan_ip, self.port);
        eprintln!("{}", startup_message);

        Ok(StartResponse {
            ip: lan_ip,
            port: self.port,
            running: true,
            error: None,
        })
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

fn local_lan_ip() -> Option<std::net::IpAddr> {
    use std::net::UdpSocket;

    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    socket.local_addr().ok().map(|addr| addr.ip())
}
