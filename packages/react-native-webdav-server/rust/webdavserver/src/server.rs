use crate::ServerError;
use axum::http::Uri;
use axum::middleware;
use axum::{
    Router,
    body::Body,
    extract::State,
    http::{Method, Request, StatusCode},
    middleware::Next,
    response::Response,
    routing::any,
};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::io::AsyncReadExt;
use tokio::net::TcpListener;
use tokio::runtime::{Builder, Runtime};
use tokio::sync::oneshot;
type JoinHandleResult = tokio::task::JoinHandle<Result<(), ServerError>>;
use std::sync::Once;

static INIT_LOGGING: Once = Once::new();

pub async fn prefix_middleware(
    State(base_path): State<String>,
    mut req: Request<Body>,
    next: Next,
) -> Response {
    let original = req.uri().path_and_query().map(|x| x.as_str()).unwrap_or("");
    let new_path = format!("/{}{}", base_path.trim_start_matches('/'), original);

    *req.uri_mut() = new_path.parse::<Uri>().expect("valid URI");

    next.run(req).await
}

pub fn init_logging() {
    INIT_LOGGING.call_once(|| {
        use tracing_subscriber::prelude::*;

        #[cfg(target_os = "android")]
        {
            let android_layer =
                tracing_android::layer("RustServer").expect("android tracing layer");

            let env_filter = tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));

            tracing_subscriber::registry()
                .with(android_layer)
                .with(env_filter)
                .with(tracing_subscriber::fmt::layer())
                .init();
        }

        #[cfg(not(target_os = "android"))]
        {
            let env_filter = tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));
            tracing_subscriber::registry()
                .with(env_filter)
                .with(tracing_subscriber::fmt::layer())
                .init();
        }
    });
}

/// WebDavServer struct encapsulates server lifecycle

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
                let listener = TcpListener::bind(&addr)
                    .await
                    .map_err(|_| ServerError::BindFailed(port))?;

                let app = router(base_path);

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

// ========== ROUTING AND HELPERS ============

fn router(base_path: String) -> Router {
    Router::new()
        .route("/", any(route_request))
        .route("/{*path}", any(route_request))
        .layer(
            tower_http::trace::TraceLayer::new_for_http()
                .make_span_with(
                    tower_http::trace::DefaultMakeSpan::new().level(tracing::Level::INFO),
                )
                .on_response(
                    tower_http::trace::DefaultOnResponse::new().level(tracing::Level::INFO),
                ),
        )
        .layer(middleware::from_fn_with_state(base_path, prefix_middleware))
}

async fn route_request(req: Request<Body>) -> Response<Body> {
    match req.method() {
        &Method::OPTIONS => options_response(),
        &Method::GET => serve_file(req).await,
        &Method::HEAD => serve_file_head(req).await,
        m if m.as_str() == "PROPFIND" => propfind(req).await,
        _ => ok("WebDAV server is running\n"),
    }
}
fn options_response() -> Response<Body> {
    Response::builder()
        .status(StatusCode::OK)
        .header("DAV", "1")
        .header("Allow", "OPTIONS, GET, HEAD, PUT, DELETE, PROPFIND")
        .header("MS-Author-Via", "DAV")
        .body(Body::empty())
        .unwrap()
}
async fn serve_file(req: Request<Body>) -> Response<Body> {
    match file_metadata(req.uri().path()).await {
        Ok((path, meta)) if meta.is_file() => read_file(&path).await,
        Ok(_) => forbidden("Cannot GET a directory"),
        Err(e) => e,
    }
}
async fn serve_file_head(req: Request<Body>) -> Response<Body> {
    match file_metadata(req.uri().path()).await {
        Ok((_, meta)) if meta.is_file() => head_response(&meta),
        Ok(_) => forbidden("Cannot HEAD a directory"),
        Err(e) => e,
    }
}
async fn file_metadata(uri_path: &str) -> Result<(PathBuf, std::fs::Metadata), Response<Body>> {
    let path = resolve_path(uri_path);
    let meta = tokio::fs::metadata(&path).await.map_err(|_| not_found())?;
    Ok((path, meta))
}
async fn read_file(path: &Path) -> Response<Body> {
    let mut file = tokio::fs::File::open(path)
        .await
        .map_err(|_| not_found())
        .unwrap();
    let mut buf = Vec::new();
    if file.read_to_end(&mut buf).await.is_err() {
        return server_error();
    }
    Response::builder()
        .status(StatusCode::OK)
        .header("Content-Length", buf.len())
        .body(Body::from(buf))
        .unwrap()
}
fn head_response(meta: &std::fs::Metadata) -> Response<Body> {
    let (modified, etag) = file_timestamps(meta);
    Response::builder()
        .status(StatusCode::OK)
        .header("Content-Length", meta.len())
        .header("Last-Modified", httpdate::fmt_http_date(modified))
        .header("ETag", etag)
        .body(Body::empty())
        .unwrap()
}
async fn propfind(req: Request<Body>) -> Response<Body> {
    let depth = req
        .headers()
        .get("Depth")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("0");
    if depth != "0" && depth != "1" {
        return bad_request("Only Depth: 0 or 1 supported");
    }
    let (base_path, base_meta) = match file_metadata(req.uri().path()).await {
        Ok(v) => v,
        Err(e) => return e,
    };
    let mut responses = Vec::new();
    responses.push(propfind_response(req.uri().path(), &base_meta));
    if depth == "1" && base_meta.is_dir() {
        let mut entries = tokio::fs::read_dir(&base_path).await.unwrap();
        while let Ok(Some(entry)) = entries.next_entry().await {
            let meta = match entry.metadata().await {
                Ok(m) => m,
                Err(_) => continue,
            };
            let href = format!(
                "{}{}",
                ensure_trailing_slash(req.uri().path()),
                entry.file_name().to_string_lossy()
            );
            responses.push(propfind_response(&href, &meta));
        }
    }
    multistatus(responses)
}
fn propfind_response(href: &str, meta: &std::fs::Metadata) -> String {
    let (modified, etag) = file_timestamps(meta);
    let href = if meta.is_dir() && !href.ends_with('/') {
        format!("{}/", href)
    } else {
        href.to_string()
    };
    format!(
        r#"<D:response>
<D:href>{}</D:href>
<D:propstat>
<D:prop>
<D:resourcetype>{}</D:resourcetype>
<D:getcontentlength>{}</D:getcontentlength>
<D:getlastmodified>{}</D:getlastmodified>
<D:getetag>{}</D:getetag>
</D:prop>
<D:status>HTTP/1.1 200 OK</D:status>
</D:propstat>
</D:response>"#,
        href,
        if meta.is_dir() { "<D:collection/>" } else { "" },
        if meta.is_dir() { 0 } else { meta.len() },
        httpdate::fmt_http_date(modified),
        etag
    )
}
fn multistatus(responses: Vec<String>) -> Response<Body> {
    let body = format!(
        r#"<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
{}
</D:multistatus>"#,
        responses.join("\n")
    );
    Response::builder()
        .status(StatusCode::MULTI_STATUS)
        .header("Content-Type", "application/xml; charset=utf-8")
        .body(Body::from(body))
        .unwrap()
}
fn resolve_path(uri_path: &str) -> PathBuf {
    //let base_path = "/storage/emulated/0";
    //let base_path = "data";
    //Path::new(base_path).join(uri_path.trim_start_matches('/'))
    Path::new(uri_path.trim_start_matches('/')).to_path_buf()
}

fn ensure_trailing_slash(path: &str) -> String {
    if path.ends_with('/') {
        path.to_owned()
    } else {
        format!("{}/", path)
    }
}
fn file_timestamps(meta: &std::fs::Metadata) -> (std::time::SystemTime, String) {
    let modified = meta
        .modified()
        .unwrap_or_else(|_| std::time::SystemTime::now());
    let etag = format!(
        "\"{}\"",
        modified
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0)
    );
    (modified, etag)
}
fn ok(body: impl Into<Body>) -> Response<Body> {
    Response::builder()
        .status(StatusCode::OK)
        .body(body.into())
        .unwrap()
}
fn not_found() -> Response<Body> {
    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .body(Body::empty())
        .unwrap()
}
fn forbidden(body: impl Into<Body>) -> Response<Body> {
    Response::builder()
        .status(StatusCode::FORBIDDEN)
        .body(body.into())
        .unwrap()
}
fn bad_request(body: impl Into<Body>) -> Response<Body> {
    Response::builder()
        .status(StatusCode::BAD_REQUEST)
        .body(body.into())
        .unwrap()
}
fn server_error() -> Response<Body> {
    Response::builder()
        .status(StatusCode::INTERNAL_SERVER_ERROR)
        .body(Body::from("Internal server error"))
        .unwrap()
}
