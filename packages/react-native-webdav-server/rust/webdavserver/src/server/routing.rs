use super::helpers::*;
use super::middleware::prefix_middleware;
use axum::body::Body;
use axum::http::StatusCode;
use axum::http::{Method, Request, Uri};
use axum::response::Response;
use axum::{Router, middleware, routing::any};
use std::string::String;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tower_http::trace::{DefaultMakeSpan, DefaultOnResponse, TraceLayer};
use tracing::error;

pub fn router(base_path: String) -> Router {
    Router::new()
        .route("/", any(route_request))
        .route("/{*path}", any(route_request))
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(DefaultMakeSpan::new().level(tracing::Level::INFO))
                .on_response(DefaultOnResponse::new().level(tracing::Level::INFO)),
        )
        .layer(middleware::from_fn_with_state(base_path, prefix_middleware))
}

async fn route_request(req: Request<Body>) -> Response<Body> {
    match req.method() {
        &Method::OPTIONS => options_response(),
        &Method::GET => serve_file(req).await,
        &Method::HEAD => serve_file_head(req).await,
        &Method::DELETE => handle_delete(req).await,
        &Method::PUT => handle_put(req).await,
        m if m.as_str() == "PROPFIND" => propfind(req).await,
        m if m.as_str() == "MKCOL" => handle_mkcol(req).await,
        _ => ok("WebDAV server is running\n"),
    }
}

fn options_response() -> Response<Body> {
    Response::builder()
        .status(StatusCode::OK)
        .header("DAV", "1")
        .header("Allow", "OPTIONS, GET, HEAD, PUT, DELETE, PROPFIND, MKCOL")
        .header("MS-Author-Via", "DAV")
        .body(Body::empty())
        .unwrap()
}

async fn serve_file(req: Request<Body>) -> Response<Body> {
    match file_metadata(req.uri()).await {
        Ok((path, meta)) if meta.is_file() => read_file(req.uri()).await,
        Ok(_) => forbidden("Cannot GET a directory"),
        Err(e) => e,
    }
}

async fn serve_file_head(req: Request<Body>) -> Response<Body> {
    match file_metadata(req.uri()).await {
        Ok((_, meta)) if meta.is_file() => head_response(&meta),
        Ok(_) => forbidden("Cannot HEAD a directory"),
        Err(e) => e,
    }
}

async fn read_file(uri: &Uri) -> Response<Body> {
    let path = resolve_path(uri);
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

async fn handle_delete(req: Request<Body>) -> Response<Body> {
    let (path, metadata) = match file_metadata(req.uri()).await {
        Ok(v) => v,
        Err(e) => return e,
    };

    let result = if metadata.is_dir() {
        tokio::fs::remove_dir_all(&path).await
    } else {
        tokio::fs::remove_file(&path).await
    };

    match result {
        Ok(_) => Response::builder()
            .status(StatusCode::NO_CONTENT)
            .body(Body::empty())
            .unwrap(),

        Err(err) => match err.kind() {
            std::io::ErrorKind::NotFound => not_found(),
            std::io::ErrorKind::PermissionDenied => forbidden("PermissionDenied"),
            _ => server_error(),
        },
    }
}

async fn handle_mkcol(req: Request<Body>) -> Response<Body> {
    let target_path = resolve_path(req.uri());

    let body_bytes = match axum::body::to_bytes(req.into_body(), usize::MAX).await {
        Ok(b) => b,
        Err(_) => return bad_request("Failed to read request body"),
    };
    let body_len = body_bytes.len();
    if body_len > 0 {
        return unsupported_media_type("MKCOL request body not supported");
    }

    match tokio::fs::metadata(&target_path).await {
        Ok(_) => {
            return Response::builder()
                .status(StatusCode::CONFLICT)
                .body(Body::from("Resource already exists"))
                .unwrap();
        }
        Err(e) => {
            if e.kind() != std::io::ErrorKind::NotFound {
                return server_error();
            }
        }
    }

    if let Some(parent) = target_path.parent() {
        match tokio::fs::metadata(parent).await {
            Ok(meta) => {
                if !meta.is_dir() {
                    return Response::builder()
                        .status(StatusCode::CONFLICT)
                        .body(Body::from("Parent is not a directory"))
                        .unwrap();
                }
            }
            Err(_) => {
                return Response::builder()
                    .status(StatusCode::CONFLICT)
                    .body(Body::from("Parent directory does not exist"))
                    .unwrap();
            }
        }
    } else {
        return Response::builder()
            .status(StatusCode::CONFLICT)
            .body(Body::from("Invalid path: no parent directory"))
            .unwrap();
    }

    match tokio::fs::create_dir(&target_path).await {
        Ok(_) => Response::builder()
            .status(StatusCode::CREATED)
            .body(Body::empty())
            .unwrap(),
        Err(e) => match e.kind() {
            std::io::ErrorKind::PermissionDenied => forbidden("Permission Denied"),
            std::io::ErrorKind::AlreadyExists => Response::builder()
                .status(StatusCode::CONFLICT)
                .body(Body::from("Resource already exists"))
                .unwrap(),
            std::io::ErrorKind::NotFound => Response::builder()
                .status(StatusCode::CONFLICT)
                .body(Body::from("Parent directory does not exist"))
                .unwrap(),
            std::io::ErrorKind::Other => Response::builder()
                .status(StatusCode::INSUFFICIENT_STORAGE)
                .body(Body::from("Insufficient Storage"))
                .unwrap(),
            _ => server_error(),
        },
    }
}

// Implementation for WebDAV PUT
async fn handle_put(req: Request<Body>) -> Response<Body> {
    let target_path = resolve_path(req.uri());
    let body_bytes = match axum::body::to_bytes(req.into_body(), usize::MAX).await {
        Ok(b) => b,
        Err(_) => return bad_request("Failed to read request body"),
    };

    // Check if target is not a directory
    let existed = match tokio::fs::metadata(&target_path).await {
        Ok(meta) => {
            if meta.is_dir() {
                return Response::builder()
                    .status(StatusCode::CONFLICT)
                    .body(Body::from("Cannot PUT to a collection"))
                    .unwrap();
            }
            true
        }
        Err(e) => {
            if e.kind() == std::io::ErrorKind::NotFound {
                false
            } else {
                return server_error();
            }
        }
    };

    // Ensure parent exists and is a directory
    if let Some(parent) = target_path.parent() {
        match tokio::fs::metadata(parent).await {
            Ok(meta) => {
                if !meta.is_dir() {
                    return Response::builder()
                        .status(StatusCode::CONFLICT)
                        .body(Body::from("Parent is not a directory"))
                        .unwrap();
                }
            }
            Err(e) => {
                if e.kind() == std::io::ErrorKind::NotFound {
                    return Response::builder()
                        .status(StatusCode::CONFLICT)
                        .body(Body::from("Parent directory does not exist"))
                        .unwrap();
                } else {
                    return server_error();
                }
            }
        }
    } else {
        return Response::builder()
            .status(StatusCode::CONFLICT)
            .body(Body::from("Invalid path: no parent directory"))
            .unwrap();
    }
    // Open (create/truncate) and write the file
    let mut file = match tokio::fs::OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&target_path)
        .await
    {
        Ok(f) => f,
        Err(e) => match e.kind() {
            std::io::ErrorKind::PermissionDenied => return forbidden("Permission Denied"),
            _ => return server_error(),
        },
    };

    if file.write_all(&body_bytes).await.is_err() {
        return server_error();
    }
    if existed {
        Response::builder()
            .status(StatusCode::NO_CONTENT)
            .body(Body::empty())
            .unwrap()
    } else {
        Response::builder()
            .status(StatusCode::CREATED)
            .body(Body::empty())
            .unwrap()
    }
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
    let (base_path, base_meta) = match file_metadata(req.uri()).await {
        Ok(v) => v,
        Err(e) => return e,
    };
    let mut responses = Vec::new();
    responses.push(propfind_response(req.uri().path(), &base_meta));
    if depth == "1" && base_meta.is_dir() {
        let mut entries = match tokio::fs::read_dir(&base_path).await {
            Ok(e) => e,
            Err(e) => {
                error!("read_dir failed: {}", e);
                return Default::default();
            }
        };
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
