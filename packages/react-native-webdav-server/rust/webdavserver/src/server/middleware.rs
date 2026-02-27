use axum::http::Uri;
use axum::middleware::Next;
use axum::{body::Body, extract::State, http::Request, response::Response};

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
