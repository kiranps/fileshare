use axum::http::Uri;
use axum::{body::Body, response::Response};
use std::collections::HashMap;
use std::path::PathBuf;
use urlencoding::decode;

pub async fn file_metadata(
    uri: &Uri,
) -> Result<(std::path::PathBuf, std::fs::Metadata), Response<Body>> {
    let path = resolve_path(uri);
    let meta = tokio::fs::metadata(&path).await.map_err(|_| not_found())?;
    Ok((path, meta))
}

pub fn propfind_response(uri: &str, meta: &std::fs::Metadata) -> String {
    let (modified, etag) = file_timestamps(meta);
    let href = uri;
    let resourcetype = if meta.is_dir() { "<D:collection/>" } else { "" };
    let contentlength = if meta.is_dir() { 0 } else { meta.len() };

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
        resourcetype,
        contentlength,
        httpdate::fmt_http_date(modified),
        etag
    )
}

pub fn multistatus(responses: Vec<String>) -> Response<Body> {
    let body = format!(
        r#"<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
{}
</D:multistatus>"#,
        responses.join("\n")
    );
    Response::builder()
        .status(axum::http::StatusCode::MULTI_STATUS)
        .header("Content-Type", "application/xml; charset=utf-8")
        .body(Body::from(body))
        .unwrap()
}

pub fn resolve_path(uri: &Uri) -> PathBuf {
    let path: String = extract_base_path(uri);
    let decoded = decode(uri.path())
        .expect("invalid percent encoding")
        .into_owned();
    PathBuf::from(path).join(decoded.trim_start_matches('/'))
}

pub fn ensure_trailing_slash(path: &str) -> String {
    if path.ends_with('/') {
        path.to_owned()
    } else {
        format!("{}/", path)
    }
}

pub fn file_timestamps(meta: &std::fs::Metadata) -> (std::time::SystemTime, String) {
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

pub fn head_response(meta: &std::fs::Metadata) -> Response<Body> {
    let (modified, etag) = file_timestamps(meta);
    Response::builder()
        .status(axum::http::StatusCode::OK)
        .header("Content-Length", meta.len())
        .header("Last-Modified", httpdate::fmt_http_date(modified))
        .header("ETag", etag)
        .body(Body::empty())
        .unwrap()
}

pub fn extract_base_path(uri: &Uri) -> String {
    uri.query()
        .and_then(|q| serde_urlencoded::from_str::<HashMap<String, String>>(q).ok())
        .and_then(|params| params.get("base_path").cloned())
        .unwrap_or_else(|| "/".to_string())
}

pub fn ok(body: impl Into<Body>) -> Response<Body> {
    Response::builder()
        .status(axum::http::StatusCode::OK)
        .body(body.into())
        .unwrap()
}

pub fn not_found() -> Response<Body> {
    Response::builder()
        .status(axum::http::StatusCode::NOT_FOUND)
        .body(Body::empty())
        .unwrap()
}

pub fn forbidden(body: impl Into<Body>) -> Response<Body> {
    Response::builder()
        .status(axum::http::StatusCode::FORBIDDEN)
        .body(body.into())
        .unwrap()
}

pub fn bad_request(body: impl Into<Body>) -> Response<Body> {
    Response::builder()
        .status(axum::http::StatusCode::BAD_REQUEST)
        .body(body.into())
        .unwrap()
}

pub fn server_error() -> Response<Body> {
    Response::builder()
        .status(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
        .body(Body::from("Internal server error"))
        .unwrap()
}

pub fn unsupported_media_type(body: impl Into<Body>) -> Response<Body> {
    Response::builder()
        .status(axum::http::StatusCode::UNSUPPORTED_MEDIA_TYPE)
        .body(body.into())
        .unwrap()
}
