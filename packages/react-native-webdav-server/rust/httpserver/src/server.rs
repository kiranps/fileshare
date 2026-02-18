use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex, OnceLock,
};
use std::thread::JoinHandle;
use std::time::Duration;

use async_std::channel;
use tiny_http::{Response, Server};

use crate::ServerError;

/// Internal server state
pub struct ServerState {
    pub stop: Arc<AtomicBool>,
    pub handle: JoinHandle<()>,
}

/// Global server holder
static SERVER: OnceLock<Mutex<Option<ServerState>>> = OnceLock::new();

/// Start the server (internal API)
pub async fn start(port: u16) -> Result<String, ServerError> {
    let server = SERVER.get_or_init(|| Mutex::new(None));

    // ---- check running (no await while holding lock) ----
    {
        let guard = server.lock().unwrap();
        if guard.is_some() {
            return Err(ServerError::AlreadyRunning);
        }
    }

    let stop = Arc::new(AtomicBool::new(false));
    let stop_clone = stop.clone();

    let (tx, rx) = channel::bounded::<Result<String, ServerError>>(1);

    let handle = std::thread::spawn(move || {
        let addr = format!("0.0.0.0:{port}");

        let server = match Server::http(&addr) {
            Ok(s) => {
                let _ = tx.send_blocking(Ok(format!("server started on {addr}")));
                s
            }
            Err(_) => {
                let _ = tx.send_blocking(Err(ServerError::BindFailed(port)));
                return;
            }
        };

        while !stop_clone.load(Ordering::Relaxed) {
            match server.recv_timeout(Duration::from_millis(100)) {
                Ok(Some(req)) => {
                    let _ = req.respond(Response::from_string("Hello from tiny_http"));
                }
                Ok(None) => {} // timeout
                Err(_) => {}   // ignore
            }
        }
    });

    // ---- wait for startup result ----
    let result = rx
        .recv()
        .await
        .unwrap_or(Err(ServerError::BindFailed(port)))?;

    // ---- store running server ----
    {
        let mut guard = server.lock().unwrap();
        *guard = Some(ServerState { stop, handle });
    }

    Ok(result)
}

/// Stop the server (internal API)
pub async fn stop() -> Result<String, ServerError> {
    let server = SERVER.get().ok_or(ServerError::NotRunning)?;

    let state = {
        let mut guard = server.lock().unwrap();
        guard.take().ok_or(ServerError::NotRunning)?
    };

    state.stop.store(true, Ordering::Relaxed);
    let _ = state.handle.join();

    Ok("server stopped successfully".to_string())
}
