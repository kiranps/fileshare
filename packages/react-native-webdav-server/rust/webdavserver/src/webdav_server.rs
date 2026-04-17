use crate::ServerError;
use crate::logging::init_logging;
use crate::routing;
use std::sync::{
    Arc, Mutex,
    atomic::{AtomicBool, Ordering},
};
use tokio::runtime::{Builder, Runtime};
use tokio::sync::oneshot;

type JoinHandleResult = tokio::task::JoinHandle<Result<(), ServerError>>;

#[derive(uniffi::Object)]
pub struct WebDavServer {
    shutdown_tx: Mutex<Option<oneshot::Sender<()>>>,
    handle: Mutex<Option<JoinHandleResult>>,
    runtime: Mutex<Option<Runtime>>,
    running: AtomicBool,
}

impl Default for WebDavServer {
    fn default() -> Self {
        Self {
            shutdown_tx: Mutex::new(None),
            handle: Mutex::new(None),
            runtime: Mutex::new(None),
            running: AtomicBool::new(false),
        }
    }
}

#[derive(uniffi::Record)]
pub struct StartResponse {
    pub ip: String,
    pub port: u16,
}

#[derive(uniffi::Record)]
pub struct Auth {
    pub username: String,
    pub password: String,
}

#[derive(uniffi::Record)]
pub struct StartOptions {
    pub port: Option<u16>,
    pub base_path: String,
    pub auth: Option<Auth>,
}

#[uniffi::export]
impl WebDavServer {
    #[uniffi::constructor]
    pub fn new() -> Self {
        Self::default()
    }

    pub fn start(&self, opts: StartOptions) -> Result<StartResponse, ServerError> {
        init_logging();
        let port = opts.port.unwrap_or(8080);
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
        let addr = format!("0.0.0.0:{}", port);

        let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

        {
            let mut tx_guard = self.shutdown_tx.lock().unwrap();
            *tx_guard = Some(shutdown_tx);
        }
        let base_path = if opts.base_path.is_empty() {
            "data".to_string()
        } else {
            opts.base_path
        };

        // Convert optional Auth record into shared Arc<Option<(user, pass)>>
        let auth_state: Arc<Option<(String, String)>> = match opts.auth {
            Some(a) if !a.username.is_empty() && !a.password.is_empty() => {
                Arc::new(Some((a.username, a.password)))
            }
            _ => Arc::new(None),
        };
        let handle = {
            let runtime_guard = self.runtime.lock().unwrap();
            let auth_state = auth_state.clone();
            runtime_guard.as_ref().unwrap().spawn(async move {
                let listener = tokio::net::TcpListener::bind(&addr)
                    .await
                    .map_err(|_| ServerError::BindFailed(port))?;

                let app = routing::router(base_path, auth_state);

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

        let startup_message = format!("server started on {}:{}", lan_ip, port);
        eprintln!("{}", startup_message);

        Ok(StartResponse { ip: lan_ip, port })
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
