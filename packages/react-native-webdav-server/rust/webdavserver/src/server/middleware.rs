use axum::http::Uri;
use axum::middleware::Next;
use axum::{body::Body, extract::State, http::Request, response::Response};
use std::sync::Arc;
use axum::http::StatusCode;
use base64::engine::general_purpose;
use base64::Engine as _;

// Constant-time equality to avoid leaking timing information
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
                Some(existing) => {
                    format!("{path}?{existing}&base_path={base_path}")
                }
                None => {
                    format!("{path}?base_path={base_path}")
                }
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
    // If no auth configured, skip authentication
    if auth.is_none() {
        return next.run(req).await;
    }

    // Require Authorization header
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
        let expected_user = &creds.0;
        let expected_pass = &creds.1;
        if constant_time_eq(user, expected_user) && constant_time_eq(pass, expected_pass) {
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
