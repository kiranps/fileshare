use axum::http::{Method, StatusCode};
use reqwest::header;
use std::fs::{self, File};
use std::io::Write;
use std::net::TcpStream;
use std::sync::OnceLock;
use std::time::{Duration, Instant};

fn setup_test_dir(path: &str) {
    let dir = std::path::Path::new("data/test").join(path);
    fs::create_dir_all(&dir).unwrap();
}

fn setup_test_file(path: &str, content: &str) {
    let dir = std::path::Path::new("data").join("test");
    fs::create_dir_all(&dir).unwrap();
    let mut file = File::create(dir.join(path)).unwrap();
    file.write_all(content.as_bytes()).unwrap();
}

fn wait_for_port(port: u16, timeout: Duration) {
    let start = Instant::now();

    loop {
        if TcpStream::connect(("127.0.0.1", port)).is_ok() {
            return;
        }

        if start.elapsed() > timeout {
            panic!("server did not start within {:?}", timeout);
        }

        std::thread::sleep(Duration::from_millis(50));
    }
}

const PORT: u16 = 8080;
const BASE_URL: &str = "http://localhost:8080";

static SERVER: OnceLock<webdavserver::WebDavServer> = OnceLock::new();

fn setup() {
    SERVER.get_or_init(|| {
        let server = webdavserver::WebDavServer::new(PORT);
        server.start().unwrap();
        wait_for_port(PORT, Duration::from_secs(5));
        server
    });
}

#[tokio::test]
async fn options_root() {
    setup();
    let client = reqwest::Client::new();
    let res = client
        .request(reqwest::Method::OPTIONS, BASE_URL)
        .send()
        .await
        .expect("request failed");

    let status = res.status();
    let headers = res.headers().clone();

    let body = res.text().await.unwrap();

    assert!(status.is_success());
    assert!(headers.contains_key(header::ALLOW));
    let allow = headers
        .get(header::ALLOW)
        .expect("Allow header missing")
        .to_str()
        .expect("Allow header not UTF-8");

    assert!(body.is_empty());
    assert!(allow.contains("OPTIONS"));
    assert!(allow.contains("PROPFIND"));
}

#[tokio::test]
async fn get_file() {
    setup();
    setup_test_file("hello.txt", "Hello World");
    let client = reqwest::Client::new();
    let res = client
        .request(reqwest::Method::GET, format!("{}/test/hello.txt", BASE_URL))
        .send()
        .await
        .expect("request failed");

    assert!(res.status().is_success());
    let body = res.text().await.unwrap();
    assert_eq!(body, "Hello World");
}

#[tokio::test]
async fn get_dir_forbidden() {
    setup();
    setup_test_dir("somedir");
    let client = reqwest::Client::new();
    let res = client
        .request(reqwest::Method::GET, format!("{}/test/somedir", BASE_URL))
        .send()
        .await
        .expect("request failed");

    assert_eq!(res.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn head_file() {
    setup();
    setup_test_file("foo.txt", "foo");
    let client = reqwest::Client::new();
    let res = client
        .request(reqwest::Method::HEAD, format!("{}/test/foo.txt", BASE_URL))
        .send()
        .await
        .expect("request failed");

    let headers = res.headers().clone();
    assert_eq!(res.status(), StatusCode::OK);
    assert_eq!(headers.get("content-length").unwrap(), "3");
    assert!(headers.get(header::ETAG).is_some());
}

#[tokio::test]
async fn propfile_depth_0() {
    setup();
    setup_test_file("foo.txt", "foo");
    let client = reqwest::Client::new();
    let res = client
        .request(
            Method::from_bytes(b"PROPFIND").unwrap(),
            format!("{}/test/", BASE_URL),
        )
        .header("depth", "0")
        .send()
        .await
        .expect("request failed");

    assert_eq!(res.status(), StatusCode::MULTI_STATUS);
    let body = res.text().await.unwrap();
    assert!(body.contains("<D:collection/>"))
}

#[tokio::test]
async fn propfile_depth_1() {
    setup();
    setup_test_file("dir1/a.txt", "A");
    setup_test_file("dir1/b.txt", "B");

    let client = reqwest::Client::new();
    let res = client
        .request(
            Method::from_bytes(b"PROPFIND").unwrap(),
            format!("{}/test/dir1", BASE_URL),
        )
        .header("depth", "1")
        .send()
        .await
        .expect("request failed");

    assert_eq!(res.status(), StatusCode::MULTI_STATUS);
    let body = res.text().await.unwrap();
    assert!(body.contains("dir1"));
    assert!(body.contains("a.txt"));
    assert!(body.contains("b.txt"));
}

#[tokio::test]
async fn get_not_found() {
    setup();
    let client = reqwest::Client::new();
    let res = client
        .request(reqwest::Method::GET, format!("{}/test/404.txt", BASE_URL))
        .send()
        .await
        .expect("request failed");

    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}
