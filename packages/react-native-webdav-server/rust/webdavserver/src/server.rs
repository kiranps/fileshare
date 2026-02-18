use crate::ServerError;
use android_logger::Config;
use axum::{
    Router,
    body::Body,
    http::{Method, Request, Response, StatusCode, header},
    routing::any,
};
use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use log::LevelFilter;
use std::panic;
use std::path::{Path, PathBuf};
use std::sync::Once;
use std::sync::{Mutex, OnceLock};
use tokio::io::AsyncReadExt;
use tokio::net::TcpListener;
use tokio::runtime::{Builder, Runtime};
use tokio::sync::oneshot;
use tower_http::trace::{self, TraceLayer};
use tracing::Level;
use tracing::{error, info}; // ✅ % support
/* ======================== bootstrap ======================== */

static SERVER: OnceLock<Mutex<Option<ServerState>>> = OnceLock::new();

struct ServerState {
    shutdown_tx: oneshot::Sender<()>,
    handle: tokio::task::JoinHandle<Result<(), ServerError>>,
}

static TOKIO: OnceLock<Runtime> = OnceLock::new();

pub fn init_tokio() -> &'static Runtime {
    TOKIO.get_or_init(|| {
        Builder::new_multi_thread()
            .enable_all() // ← REQUIRED for net + timers
            .build()
            .expect("failed to create tokio runtime")
    })
}

static INIT_LOGGING: Once = Once::new();

pub fn install_panic_hook() {
    panic::set_hook(Box::new(|panic_info| {
        let payload = panic_info
            .payload()
            .downcast_ref::<&str>()
            .copied()
            .or_else(|| {
                panic_info
                    .payload()
                    .downcast_ref::<String>()
                    .map(String::as_str)
            })
            .unwrap_or("unknown panic payload");

        let location = panic_info
            .location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_else(|| "unknown location".to_string());

        error!(
            panic = %payload,
            location = %location,
            "RUST PANIC"
        );
    }));
}

pub fn init_logging() {
    INIT_LOGGING.call_once(|| {
        use tracing_subscriber::prelude::*;
        #[cfg(target_os = "android")]
        {
            let android_layer =
                tracing_android::layer("RustServer").expect("android tracing layer");

            tracing_subscriber::registry()
                .with(android_layer)
                .with(tracing_subscriber::fmt::layer())
                .init();
        }

        #[cfg(not(target_os = "android"))]
        {
            tracing_subscriber::registry()
                .with(tracing_subscriber::fmt::layer())
                .init();
        }
    });
}

pub fn start(port: u16) -> Result<String, ServerError> {
    let server = SERVER.get_or_init(|| Mutex::new(None));
    //init_logging();
    //install_panic_hook();
    let rt = init_tokio();
    info!("kiran Things are going fine.");

    // ---- check running ----
    info!("before guard");
    {
        let guard = server.lock().unwrap();
        if guard.is_some() {
            return Err(ServerError::AlreadyRunning);
        }
    }

    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

    info!("before handle");
    let handle = rt.spawn(async move {
        let addr = format!("0.0.0.0:{port}");
        info!("addr {}", addr);
        info!("before listener");
        let listener = TcpListener::bind(&addr)
            .await
            .inspect_err(|e| {
                error!(
                    error = %e,
                    port = port,
                    addr = %addr,
                    "failed to bind TCP listener"
                );
            })
            .map_err(|_| ServerError::BindFailed(port))?;

        info!("after listener");
        let app = router();

        info!("before axum serve");
        axum::serve(listener, app)
            .with_graceful_shutdown(async {
                let _ = shutdown_rx.await;
            })
            .await
            .map_err(|e| ServerError::RuntimeError {
                message: e.to_string(),
            })?;
        info!("after axum serve");

        Ok::<(), ServerError>(())
    });

    // ---- store running server ----
    {
        let mut guard = server.lock().unwrap();
        *guard = Some(ServerState {
            shutdown_tx,
            handle,
        });
    }

    Ok(format!("server started on xxx"))
}

pub async fn stop() -> Result<String, ServerError> {
    let server = SERVER.get().ok_or(ServerError::NotRunning)?;

    let state = {
        let mut guard = server.lock().unwrap();
        guard.take().ok_or(ServerError::NotRunning)?
    };

    // trigger graceful shutdown
    let _ = state.shutdown_tx.send(());

    // wait for axum server to exit
    let _ = state.handle.await;

    Ok("server stopped successfully".to_string())
}

fn router() -> Router {
    Router::new()
        .route("/", any(route_request))
        .route("/{*path}", any(route_request))
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(trace::DefaultMakeSpan::new().level(Level::INFO))
                .on_response(trace::DefaultOnResponse::new().level(Level::INFO)),
        )
}

/* ======================== routing ======================== */

async fn route_request(req: Request<Body>) -> Response<Body> {
    //authenticate(&req).unwrap_or_else(|r| return r);

    match req.method() {
        &Method::OPTIONS => options_response(),
        &Method::GET => serve_file(req).await,
        &Method::HEAD => serve_file_head(req).await,
        m if m.as_str() == "PROPFIND" => propfind(req).await,
        _ => ok("WebDAV server is running\n"),
    }
}

/* ======================== auth ======================== */

fn authenticate(req: &Request<Body>) -> Result<(), Response<Body>> {
    let header = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .ok_or_else(unauthorized)?;

    let encoded = header.strip_prefix("Basic ").ok_or_else(unauthorized)?;
    let decoded = BASE64
        .decode(encoded)
        .ok()
        .and_then(|b| String::from_utf8(b).ok())
        .ok_or_else(unauthorized)?;

    let (user, password) = decoded.split_once(':').ok_or_else(unauthorized)?;

    if user == "a" && password == "a" {
        Ok(())
    } else {
        Err(unauthorized())
    }
}

fn unauthorized() -> Response<Body> {
    Response::builder()
        .status(StatusCode::UNAUTHORIZED)
        .header(header::WWW_AUTHENTICATE, r#"Basic realm="WebDAV""#)
        .body(Body::empty())
        .unwrap()
}

/* ======================== OPTIONS ======================== */

fn options_response() -> Response<Body> {
    Response::builder()
        .status(StatusCode::OK)
        .header("DAV", "1")
        .header("Allow", "OPTIONS, GET, HEAD, PUT, DELETE, PROPFIND")
        .header("MS-Author-Via", "DAV")
        .body(Body::empty())
        .unwrap()
}

/* ======================== GET / HEAD ======================== */

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

/* ======================== PROPFIND ======================== */

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

/* ======================== WebDAV XML ======================== */

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

/* ======================== shared utils ======================== */

fn resolve_path(uri_path: &str) -> PathBuf {
    //let base_path = "/storage/emulated/0";
    let base_path = "data";
    Path::new(base_path).join(uri_path.trim_start_matches('/'))
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

/* ======================== responses ======================== */

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
