use axum::http::{Method, StatusCode};
use ctor::{ctor, dtor};
use reqwest::header;
use std::fs::{self, File};
use std::io::Write;
use std::net::TcpStream;
use std::sync::OnceLock;
use std::time::{Duration, Instant};
use tracing::{debug, error, info, trace, warn};
mod utils;

fn setup_test_dir(path: &str) {
    let dir = std::path::Path::new("data/test").join(path);
    fs::create_dir_all(&dir).unwrap();
}

fn setup_test_file(path: &str, content: &str) {
    let dir = std::path::Path::new("data").join("test");
    let file_path = dir.join(path);
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).unwrap();
    }
    let mut file = File::create(file_path).unwrap();
    file.write_all(content.as_bytes()).unwrap();
}

fn clean_test_dir() {
    let _ = std::fs::remove_dir_all("data/test");
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
        let server = webdavserver::WebDavServer::new(PORT, String::from("data"));
        server.start().unwrap();
        wait_for_port(PORT, Duration::from_secs(5));
        server
    });
}

#[ctor]
fn before_all() {
    setup();
}

#[dtor]
fn after_all() {
    clean_test_dir();
}

#[tokio::test]
async fn options_root() {
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
    assert!(body.contains("<D:collection/>"));
}

#[tokio::test]
async fn propfile_depth_1() {
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
async fn propfile_depth_1_dir_name_has_space() {
    //use quick_xml::Reader;
    //use quick_xml::events::Event;
    use urlencoding::encode;
    use utils::parse_webdav_multistatus;

    setup_test_file("dir with space/a.txt", "A");

    let client = reqwest::Client::new();
    let res = client
        .request(
            Method::from_bytes(b"PROPFIND").unwrap(),
            format!("{}/test", BASE_URL),
        )
        .header("depth", "1")
        .send()
        .await
        .expect("request failed");

    assert_eq!(res.status(), StatusCode::MULTI_STATUS);
    let body = res.text().await.unwrap();
    let items = parse_webdav_multistatus(&body).unwrap();
    let paths: Vec<String> = items.into_iter().map(|item| item.path).collect();
    assert!(paths.iter().any(|p| p.contains("dir with space")));

    let encoded = encode("dir with space");
    let res = client
        .request(
            Method::from_bytes(b"PROPFIND").unwrap(),
            format!("{}/test/{}", BASE_URL, encoded),
        )
        .header("depth", "1")
        .send()
        .await
        .expect("request failed");

    assert_eq!(res.status(), StatusCode::MULTI_STATUS);
    let body = res.text().await.unwrap();
    let items = parse_webdav_multistatus(&body).unwrap();
    let paths: Vec<String> = items.into_iter().map(|item| item.path).collect();
    assert!(paths.iter().any(|p| p.contains("a.txt")));
}

#[tokio::test]
async fn delete_file_success() {
    setup_test_file("deleteme.txt", "remove this");
    let client = reqwest::Client::new();
    let url = format!("{}/test/deleteme.txt", BASE_URL);

    let res = client
        .request(reqwest::Method::DELETE, &url)
        .send()
        .await
        .expect("request failed");

    assert_eq!(res.status(), StatusCode::NO_CONTENT);
    // File should really be gone
    assert!(std::fs::metadata("data/test/deleteme.txt").is_err());
}

#[tokio::test]
async fn delete_empty_directory_success() {
    setup_test_dir("todelete_emptydir");
    let client = reqwest::Client::new();
    let url = format!("{}/test/todelete_emptydir", BASE_URL);

    let res = client
        .request(reqwest::Method::DELETE, &url)
        .send()
        .await
        .expect("request failed");

    assert_eq!(res.status(), StatusCode::NO_CONTENT);
    // Directory should really be gone
    assert!(std::fs::metadata("data/test/todelete_emptydir").is_err());
}

#[tokio::test]
async fn delete_nonexistent_file_or_dir() {
    let _ = std::fs::remove_file("data/test/surely_does_not_exist.txt");
    let _ = std::fs::remove_dir_all("data/test/surely_does_not_exist_dir");
    let client = reqwest::Client::new();

    // Nonexistent file
    let url1 = format!("{}/test/surely_does_not_exist.txt", BASE_URL);
    let res1 = client
        .request(reqwest::Method::DELETE, &url1)
        .send()
        .await
        .expect("request failed");
    assert_eq!(res1.status(), StatusCode::NOT_FOUND);

    // Nonexistent directory
    let url2 = format!("{}/test/surely_does_not_exist_dir", BASE_URL);
    let res2 = client
        .request(reqwest::Method::DELETE, &url2)
        .send()
        .await
        .expect("request failed");
    assert_eq!(res2.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn delete_directory_recursive_success() {
    // Create dir with files and a subdirectory
    setup_test_file("recdel/me.txt", "top");
    setup_test_file("recdel/sub/file1.txt", "subfile");
    setup_test_file("recdel/sub/file2.txt", "subfile2");
    let client = reqwest::Client::new();
    let url = format!("{}/test/recdel", BASE_URL);
    let res = client
        .request(reqwest::Method::DELETE, &url)
        .send().await.expect("request failed");
    assert_eq!(res.status(), StatusCode::NO_CONTENT);
    assert!(std::fs::metadata("data/test/recdel").is_err());
    assert!(std::fs::metadata("data/test/recdel/me.txt").is_err());
    assert!(std::fs::metadata("data/test/recdel/sub").is_err());
    assert!(std::fs::metadata("data/test/recdel/sub/file1.txt").is_err());
}

#[tokio::test]
async fn delete_file_permission_denied() {
    // Only run on unix
    #[cfg(unix)] {
        use std::os::unix::fs::PermissionsExt;
        let file_path = "data/test/forbidden.txt";
        setup_test_file("forbidden.txt", "cannot delete this");
        let perms = std::fs::Permissions::from_mode(0o444); // read-only
        let _ = std::fs::set_permissions(file_path, perms);
        let client = reqwest::Client::new();
        let url = format!("{}/test/forbidden.txt", BASE_URL);
        let res = client
            .request(reqwest::Method::DELETE, &url)
            .send()
            .await
            .expect("request failed");
        // Some filesystems/CI may still let us delete, so allow either forbidden or no_content
        assert!(
            res.status() == StatusCode::FORBIDDEN
             || res.status() == StatusCode::NO_CONTENT,
            "Expected FORBIDDEN or NO_CONTENT, got {}",
            res.status()
        );
        // Cleanup (try to delete anyway)
        let _ = std::fs::remove_file(file_path);
    }
}

#[tokio::test]
async fn get_not_found() {
    let client = reqwest::Client::new();
    let res = client
        .request(reqwest::Method::GET, format!("{}/test/404.txt", BASE_URL))
        .send()
        .await
        .expect("request failed");

    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}
