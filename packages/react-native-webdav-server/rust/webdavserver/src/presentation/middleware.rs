use axum::http::StatusCode;
use axum::http::Uri;
use axum::http::{HeaderValue, Method};
use axum::middleware::Next;
use axum::{body::Body, body::Bytes, extract::State, http::Request, response::Response};
use base64::Engine as _;
use base64::engine::general_purpose;
use http_body_util::BodyExt;
use std::sync::Arc;

#[allow(dead_code)]
pub async fn log_response_body(req: Request<Body>, next: Next) -> Response {
    let response = next.run(req).await;
    let (parts, body) = response.into_parts();

    let bytes = body
        .collect()
        .await
        .map(|collected| collected.to_bytes())
        .unwrap_or_else(|_| Bytes::from(""));

    if let Ok(body_str) = std::str::from_utf8(&bytes) {
        tracing::info!("Response body: {}", body_str);
    } else {
        tracing::info!("Response body (non-utf8): {:?}", bytes);
    }

    Response::from_parts(parts, Body::from(bytes))
}

// Constant-time equality to avoid leaking timing information.
fn constant_time_eq(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut res: u8 = 0;
    for (x, y) in a.as_bytes().iter().zip(b.as_bytes().iter()) {
        res |= x ^ y;
    }
    res == 0
}

pub async fn add_webdav_headers(req: Request<axum::body::Body>, next: Next) -> Response {
    let is_options = req.method() == Method::OPTIONS;
    let mut res = next.run(req).await;
    if is_options {
        let headers = res.headers_mut();
        headers.insert("DAV", HeaderValue::from_static("1, 2"));
        headers.insert(
            "Allow",
            HeaderValue::from_static(
                "OPTIONS, GET, HEAD, PUT, DELETE, PROPFIND, MKCOL, COPY, MOVE",
            ),
        );
        headers.insert("MS-Author-Via", HeaderValue::from_static("DAV"));
    }
    res
}

pub async fn prefix_middleware(
    State(base_path): State<String>,
    mut req: Request<Body>,
    next: Next,
) -> Response {
    let uri = req.uri().clone();
    let mut parts = uri.into_parts();

    let new_path_and_query = match parts.path_and_query {
        Some(pq) => {
            let path = pq.path();
            match pq.query() {
                Some(existing) => format!("{path}?{existing}&base_path={base_path}"),
                None => format!("{path}?base_path={base_path}"),
            }
        }
        None => format!("/?base_path={base_path}"),
    };

    parts.path_and_query = Some(new_path_and_query.parse().expect("valid path and query"));
    let new_uri = Uri::from_parts(parts).expect("valid uri");
    *req.uri_mut() = new_uri;

    next.run(req).await
}

pub async fn auth_middleware(
    State(auth): State<Arc<Option<(String, String)>>>,
    req: Request<Body>,
    next: Next,
) -> Response {
    if auth.is_none() {
        return next.run(req).await;
    }

    let header = match req.headers().get("authorization") {
        Some(h) => match h.to_str() {
            Ok(s) => s,
            Err(_) => return unauthorized_response(),
        },
        None => return unauthorized_response(),
    };

    if !header.starts_with("Basic ") {
        return unauthorized_response();
    }
    let b64 = &header[6..];
    let decoded = match general_purpose::STANDARD.decode(b64) {
        Ok(v) => v,
        Err(_) => return unauthorized_response(),
    };
    let cred = match String::from_utf8(decoded) {
        Ok(s) => s,
        Err(_) => return unauthorized_response(),
    };

    let mut parts = cred.splitn(2, ':');
    let user = parts.next().unwrap_or("");
    let pass = parts.next().unwrap_or("");

    if let Some(creds) = auth.as_ref().as_ref() {
        if constant_time_eq(user, &creds.0) && constant_time_eq(pass, &creds.1) {
            return next.run(req).await;
        }
    }

    unauthorized_response()
}

fn unauthorized_response() -> Response {
    Response::builder()
        .status(StatusCode::UNAUTHORIZED)
        .header("WWW-Authenticate", r#"Basic realm="WebDAV""#)
        .body(Body::empty())
        .unwrap()
}
