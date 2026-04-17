//! HTTP routing for the WebDAV server.
//!
//! ## Endpoints
//!
//! All routes match `/*path` (including `/`). The method determines the WebDAV
//! operation performed. Authentication (Basic) and the `base_path` query param
//! are injected by middleware before reaching these handlers.
//!
//! | Method    | Path      | Description                                                                 |
//! |-----------|-----------|-----------------------------------------------------------------------------|
//! | OPTIONS   | any       | Returns DAV capability headers (`DAV: 1`, `Allow`, `MS-Author-Via`).        |
//! | GET       | file      | Stream file contents inline (`Content-Length` set).                         |
//! | GET       | file      | `?download=true` — serve file as attachment (`Content-Disposition`).        |
//! | GET       | directory | `?download=true` — stream directory as a `.zip` attachment.                 |
//! | GET       | directory | Without `?download=true` — returns 403 Forbidden.                          |
//! | HEAD      | file      | Returns `Content-Length`, `Last-Modified`, `ETag` with no body.             |
//! | HEAD      | directory | Returns 403 Forbidden.                                                      |
//! | PUT       | file      | Create (201) or update (204) a file. Body is the new file content.          |
//! | DELETE    | file/dir  | Delete a file or directory tree (204 on success).                           |
//! | PROPFIND  | any       | WebDAV property retrieval. `Depth: 0` or `Depth: 1` supported (207).       |
//! | MKCOL     | path      | Create a collection (directory). Body must be empty (201 on success).       |
//! | COPY      | file/dir  | Copy resource to `Destination` header URL. Supports `Overwrite` + `Depth`. |
//! | MOVE      | file/dir  | Move/rename resource to `Destination` header URL. Supports `Overwrite`.    |
//!
//! ### Request headers used
//! - `Authorization` — Basic auth credentials (if auth is configured).
//! - `Depth` — Used by PROPFIND (`0` or `1`) and COPY (`0`, `1`, or `infinity`).
//! - `Destination` — Absolute URL of the target resource for COPY and MOVE.
//! - `Overwrite` — `T` (default) or `F`; controls overwrite behaviour for COPY/MOVE.
//!
//! ### Response status codes
//! - `200 OK` — GET/HEAD success.
//! - `201 Created` — PUT/MKCOL/COPY/MOVE created a new resource.
//! - `204 No Content` — OPTIONS, DELETE, or PUT/COPY/MOVE that replaced an existing resource.
//! - `207 Multi-Status` — PROPFIND response (XML body).
//! - `400 Bad Request` — Malformed or unsupported request (e.g. Depth: infinity for PROPFIND).
//! - `401 Unauthorized` — Missing or invalid Basic auth credentials.
//! - `403 Forbidden` — Operation not permitted (e.g. GET on a directory).
//! - `404 Not Found` — Resource does not exist.
//! - `409 Conflict` — Parent does not exist or resource already exists (MKCOL/PUT).
//! - `412 Precondition Failed` — Destination exists and `Overwrite: F` was set.
//! - `415 Unsupported Media Type` — MKCOL received a non-empty request body.
//! - `507 Insufficient Storage` — Filesystem full (MKCOL).
//! - `500 Internal Server Error` — Unexpected I/O failure.

use crate::helpers::{
    absolute_destination_path, bad_request, forbidden, multistatus, not_found, ok,
    propfind_response, resolve_path, server_error, unsupported_media_type,
};
use crate::middleware::{add_webdav_headers, auth_middleware, prefix_middleware};
use crate::webdav_service::{
    CopyMoveResult, DeleteResult, GetFileResult, GetResult, HeadOutcome, MkcolResult,
    PropfindResult, PutResult, WebDavService,
};
use axum::body::Body;
use axum::http::StatusCode;
use axum::http::header::{CONTENT_DISPOSITION, CONTENT_LENGTH, CONTENT_TYPE};
use axum::http::{HeaderName, Method, Request, Uri, header};
use axum::response::Response;
use axum::{Router, middleware, routing::any};
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tower_http::trace::{DefaultMakeSpan, DefaultOnResponse, TraceLayer};
use tracing::info;
use url::form_urlencoded;

pub fn router(base_path: String, auth: Arc<Option<(String, String)>>) -> Router {
    let propfind = Method::from_bytes(b"PROPFIND").unwrap();
    let move_file = Method::from_bytes(b"MOVE").unwrap();
    let copy_file = Method::from_bytes(b"COPY").unwrap();
    let make_dir = Method::from_bytes(b"MKCOL").unwrap();
    let download = Method::from_bytes(b"DOWNLOAD").unwrap();
    let depth = HeaderName::from_static("depth");
    let destination = HeaderName::from_static("destination");
    let overwrite = HeaderName::from_static("overwrite");

    Router::new()
        .route("/", any(route_request))
        .route("/{*path}", any(route_request))
        .layer(
            CorsLayer::new()
                .allow_origin(tower_http::cors::AllowOrigin::mirror_request())
                .allow_methods([
                    propfind,
                    copy_file,
                    move_file,
                    make_dir,
                    download,
                    Method::OPTIONS,
                    Method::DELETE,
                    Method::GET,
                    Method::PUT,
                ])
                .allow_headers([
                    header::AUTHORIZATION,
                    header::CONTENT_TYPE,
                    header::ACCEPT,
                    header::ORIGIN,
                    depth,
                    destination,
                    overwrite,
                ])
                .allow_credentials(true),
        )
        .layer(middleware::from_fn(add_webdav_headers))
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(DefaultMakeSpan::new().level(tracing::Level::DEBUG))
                .on_response(DefaultOnResponse::new().level(tracing::Level::DEBUG)),
        )
        .layer(middleware::from_fn_with_state(auth.clone(), auth_middleware))
        .layer(middleware::from_fn_with_state(base_path, prefix_middleware))
}

async fn route_request(req: Request<Body>) -> Response<Body> {
    info!("{:#?}", req);
    match req.method() {
        &Method::OPTIONS => options_response(),
        &Method::GET => handle_get(req).await,
        &Method::HEAD => handle_head(req).await,
        &Method::DELETE => handle_delete(req).await,
        &Method::PUT => handle_put(req).await,
        m if m.as_str() == "PROPFIND" => handle_propfind(req).await,
        m if m.as_str() == "MKCOL" => handle_mkcol(req).await,
        m if m.as_str() == "COPY" => handle_copy(req).await,
        m if m.as_str() == "MOVE" => handle_move(req).await,
        _ => ok("WebDAV server is running\n"),
    }
}

fn options_response() -> Response<Body> {
    Response::builder()
        .status(StatusCode::NO_CONTENT)
        .header("DAV", "1")
        .header("Allow", "OPTIONS, GET, HEAD, PUT, DELETE, PROPFIND, MKCOL, COPY")
        .header("MS-Author-Via", "DAV")
        .body(Body::empty())
        .unwrap()
}

fn has_download(uri: &Uri) -> bool {
    uri.query()
        .map(|q| form_urlencoded::parse(q.as_bytes()).any(|(k, v)| k == "download" && v == "true"))
        .unwrap_or(false)
}

async fn handle_get(req: Request<Body>) -> Response<Body> {
    let path = resolve_path(req.uri());
    let want_download = has_download(req.uri());

    match WebDavService::get(path, want_download).await {
        GetResult::File(GetFileResult::Stream { content_length, stream }) => Response::builder()
            .status(StatusCode::OK)
            .header(CONTENT_LENGTH, content_length.to_string())
            .body(Body::from_stream(stream))
            .unwrap(),

        GetResult::File(GetFileResult::Download { content_length, filename, stream }) => {
            Response::builder()
                .status(StatusCode::OK)
                .header(CONTENT_TYPE, "application/octet-stream")
                .header(CONTENT_LENGTH, content_length.to_string())
                .header(
                    CONTENT_DISPOSITION,
                    format!("attachment; filename=\"{}\"", filename),
                )
                .body(Body::from_stream(stream))
                .unwrap()
        }

        GetResult::ZipStream { filename, stream } => Response::builder()
            .status(StatusCode::OK)
            .header(CONTENT_TYPE, "application/zip")
            .header(
                CONTENT_DISPOSITION,
                format!("attachment; filename=\"{}\"", filename),
            )
            .body(Body::from_stream(stream))
            .unwrap(),

        GetResult::IsDirectory => forbidden("Cannot GET a directory"),
        GetResult::NotFound => not_found(),
    }
}

async fn handle_head(req: Request<Body>) -> Response<Body> {
    let path = resolve_path(req.uri());
    match WebDavService::head(path).await {
        HeadOutcome::Ok(result) => Response::builder()
            .status(StatusCode::OK)
            .header("Content-Length", result.content_length)
            .header("Last-Modified", httpdate::fmt_http_date(result.last_modified))
            .header("ETag", result.etag)
            .body(Body::empty())
            .unwrap(),
        HeadOutcome::IsDirectory => forbidden("Cannot HEAD a directory"),
        HeadOutcome::NotFound => not_found(),
    }
}

async fn handle_propfind(req: Request<Body>) -> Response<Body> {
    let depth = req
        .headers()
        .get("Depth")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("0");

    let path = resolve_path(req.uri());
    let request_path = req.uri().path().to_string();

    match WebDavService::propfind(path, &request_path, depth).await {
        PropfindResult::UnsupportedDepth => bad_request("Only Depth: 0 or 1 supported"),
        PropfindResult::NotFound => not_found(),
        PropfindResult::Ok(entries) => {
            let responses: Vec<String> = entries
                .iter()
                .map(|e| propfind_response(&e.href, &e.metadata))
                .collect();
            multistatus(responses)
        }
    }
}

async fn handle_delete(req: Request<Body>) -> Response<Body> {
    let path = resolve_path(req.uri());
    match WebDavService::delete(path).await {
        DeleteResult::Deleted => Response::builder()
            .status(StatusCode::NO_CONTENT)
            .body(Body::empty())
            .unwrap(),
        DeleteResult::NotFound => not_found(),
        DeleteResult::PermissionDenied => forbidden("PermissionDenied"),
        DeleteResult::IoError => server_error(),
    }
}

async fn handle_mkcol(req: Request<Body>) -> Response<Body> {
    let path = resolve_path(req.uri());
    let body_bytes = match axum::body::to_bytes(req.into_body(), usize::MAX).await {
        Ok(b) => b,
        Err(_) => return bad_request("Failed to read request body"),
    };

    match WebDavService::mkcol(path, body_bytes.len()).await {
        MkcolResult::Created => Response::builder()
            .status(StatusCode::CREATED)
            .body(Body::empty())
            .unwrap(),
        MkcolResult::BodyNotSupported => unsupported_media_type("MKCOL request body not supported"),
        MkcolResult::AlreadyExists => Response::builder()
            .status(StatusCode::CONFLICT)
            .body(Body::from("Resource already exists"))
            .unwrap(),
        MkcolResult::ParentNotFound => Response::builder()
            .status(StatusCode::CONFLICT)
            .body(Body::from("Parent directory does not exist"))
            .unwrap(),
        MkcolResult::ParentNotDirectory => Response::builder()
            .status(StatusCode::CONFLICT)
            .body(Body::from("Parent is not a directory"))
            .unwrap(),
        MkcolResult::InvalidPath => Response::builder()
            .status(StatusCode::CONFLICT)
            .body(Body::from("Invalid path: no parent directory"))
            .unwrap(),
        MkcolResult::PermissionDenied => forbidden("Permission Denied"),
        MkcolResult::InsufficientStorage => Response::builder()
            .status(StatusCode::INSUFFICIENT_STORAGE)
            .body(Body::from("Insufficient Storage"))
            .unwrap(),
        MkcolResult::IoError => server_error(),
    }
}

async fn handle_put(req: Request<Body>) -> Response<Body> {
    let path = resolve_path(req.uri());
    let body_bytes = match axum::body::to_bytes(req.into_body(), usize::MAX).await {
        Ok(b) => b,
        Err(_) => return bad_request("Failed to read request body"),
    };

    match WebDavService::put(path, &body_bytes).await {
        PutResult::Created => Response::builder()
            .status(StatusCode::CREATED)
            .body(Body::empty())
            .unwrap(),
        PutResult::Updated => Response::builder()
            .status(StatusCode::NO_CONTENT)
            .body(Body::empty())
            .unwrap(),
        PutResult::IsDirectory => Response::builder()
            .status(StatusCode::CONFLICT)
            .body(Body::from("Cannot PUT to a collection"))
            .unwrap(),
        PutResult::ParentNotFound => Response::builder()
            .status(StatusCode::CONFLICT)
            .body(Body::from("Parent directory does not exist"))
            .unwrap(),
        PutResult::ParentNotDirectory => Response::builder()
            .status(StatusCode::CONFLICT)
            .body(Body::from("Parent is not a directory"))
            .unwrap(),
        PutResult::InvalidPath => Response::builder()
            .status(StatusCode::CONFLICT)
            .body(Body::from("Invalid path: no parent directory"))
            .unwrap(),
        PutResult::PermissionDenied => forbidden("Permission Denied"),
        PutResult::IoError => server_error(),
    }
}

async fn handle_copy(req: Request<Body>) -> Response<Body> {
    let destination = match req.headers().get("Destination") {
        Some(v) => match v.to_str() {
            Ok(s) => s,
            Err(_) => return bad_request("Invalid Destination header"),
        },
        None => return bad_request("Missing Destination header"),
    };

    let overwrite = req
        .headers()
        .get("Overwrite")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("T");

    let depth = req
        .headers()
        .get("Depth")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("infinity");

    if depth != "0" && depth != "1" && depth != "infinity" {
        return bad_request("Invalid Depth header");
    }

    let src = resolve_path(req.uri());
    let dest_uri: Uri = match destination.parse() {
        Ok(u) => u,
        Err(_) => return bad_request("Invalid Destination URI"),
    };
    let dst = absolute_destination_path(dest_uri.path(), req.uri());

    info!("COPY {:?} -> {:?}", src, dst);

    match WebDavService::copy(src, dst, overwrite != "F", depth).await {
        CopyMoveResult::Created => Response::builder()
            .status(StatusCode::CREATED)
            .body(Body::empty())
            .unwrap(),
        CopyMoveResult::Replaced => Response::builder()
            .status(StatusCode::NO_CONTENT)
            .body(Body::empty())
            .unwrap(),
        CopyMoveResult::SameSourceDest => forbidden("Cannot COPY resource onto itself"),
        CopyMoveResult::SourceNotFound => not_found(),
        CopyMoveResult::DestExistsNoOverwrite => Response::builder()
            .status(StatusCode::PRECONDITION_FAILED)
            .body(Body::from("Destination exists and Overwrite is F"))
            .unwrap(),
        CopyMoveResult::ParentNotFound => Response::builder()
            .status(StatusCode::CONFLICT)
            .body(Body::from("Parent directory does not exist"))
            .unwrap(),
        CopyMoveResult::PermissionDenied => forbidden("Permission Denied"),
        CopyMoveResult::IoError => server_error(),
    }
}

async fn handle_move(req: Request<Body>) -> Response<Body> {
    let destination = match req.headers().get("Destination") {
        Some(v) => match v.to_str() {
            Ok(s) => s,
            Err(_) => return bad_request("Invalid Destination header"),
        },
        None => return bad_request("Missing Destination header"),
    };

    let overwrite = req
        .headers()
        .get("Overwrite")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("T");

    let src = resolve_path(req.uri());
    let dest_uri: Uri = match destination.parse() {
        Ok(u) => u,
        Err(_) => return bad_request("Invalid Destination URI"),
    };
    let dst = absolute_destination_path(dest_uri.path(), req.uri());

    match WebDavService::move_resource(src, dst, overwrite != "F").await {
        CopyMoveResult::Created => Response::builder()
            .status(StatusCode::CREATED)
            .body(Body::empty())
            .unwrap(),
        CopyMoveResult::Replaced => Response::builder()
            .status(StatusCode::NO_CONTENT)
            .body(Body::empty())
            .unwrap(),
        CopyMoveResult::SameSourceDest => forbidden("Cannot MOVE resource onto itself"),
        CopyMoveResult::SourceNotFound => not_found(),
        CopyMoveResult::DestExistsNoOverwrite => Response::builder()
            .status(StatusCode::PRECONDITION_FAILED)
            .body(Body::from("Destination exists and Overwrite is F"))
            .unwrap(),
        CopyMoveResult::ParentNotFound => Response::builder()
            .status(StatusCode::CONFLICT)
            .body(Body::from("Parent directory does not exist"))
            .unwrap(),
        CopyMoveResult::PermissionDenied => forbidden("Permission Denied"),
        CopyMoveResult::IoError => server_error(),
    }
}
