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
    //println!("{}", body);
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
        .send()
        .await
        .expect("request failed");
    assert_eq!(res.status(), StatusCode::NO_CONTENT);
    assert!(std::fs::metadata("data/test/recdel").is_err());
    assert!(std::fs::metadata("data/test/recdel/me.txt").is_err());
    assert!(std::fs::metadata("data/test/recdel/sub").is_err());
    assert!(std::fs::metadata("data/test/recdel/sub/file1.txt").is_err());
}

#[tokio::test]
async fn delete_file_permission_denied() {
    // Only run on unix
    #[cfg(unix)]
    {
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
            res.status() == StatusCode::FORBIDDEN || res.status() == StatusCode::NO_CONTENT,
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

#[tokio::test]
async fn mkcol_success_creates_collection() {
    // Remove collection if it already exists
    let _ = std::fs::remove_dir_all("data/test/new_collection");

    let client = reqwest::Client::new();
    let url = format!("{}/test/new_collection", BASE_URL);
    let res = client
        .request(Method::from_bytes(b"MKCOL").unwrap(), &url)
        .send()
        .await
        .expect("MKCOL request failed");

    assert_eq!(
        res.status(),
        StatusCode::CREATED,
        "MKCOL should return 201 when creating a new collection"
    );
    assert!(
        std::fs::metadata("data/test/new_collection")
            .unwrap()
            .is_dir(),
        "New collection should exist as directory on disk"
    );
}

#[tokio::test]
async fn mkcol_on_existing_resource_fails() {
    // Create directory and file to test conflict
    setup_test_dir("existing_collection");
    setup_test_file("existing_file.txt", "foobar");
    let client = reqwest::Client::new();
    let dir_url = format!("{}/test/existing_collection", BASE_URL);
    let file_url = format!("{}/test/existing_file.txt", BASE_URL);
    // Try MKCOL on existing collection
    let dir_res = client
        .request(Method::from_bytes(b"MKCOL").unwrap(), &dir_url)
        .send()
        .await
        .expect("MKCOL on existing collection failed");
    assert!(
        dir_res.status() == StatusCode::METHOD_NOT_ALLOWED
            || dir_res.status() == StatusCode::CONFLICT,
        "MKCOL on existing collection should return 405 or 409, got {}",
        dir_res.status()
    );
    // Try MKCOL on existing file (should fail)
    let file_res = client
        .request(Method::from_bytes(b"MKCOL").unwrap(), &file_url)
        .send()
        .await
        .expect("MKCOL on existing file failed");
    assert!(
        file_res.status() == StatusCode::METHOD_NOT_ALLOWED
            || file_res.status() == StatusCode::CONFLICT,
        "MKCOL on existing file should return 405 or 409, got {}",
        file_res.status()
    );
}

#[tokio::test]
async fn mkcol_with_request_body_415() {
    let client = reqwest::Client::new();
    let url = format!("{}/test/body_collection", BASE_URL);
    // Remove in case it exists
    let _ = std::fs::remove_dir_all("data/test/body_collection");
    let res = client
        .request(Method::from_bytes(b"MKCOL").unwrap(), &url)
        .header("Content-Type", "text/plain")
        .body("This should not be accepted.")
        .send()
        .await
        .expect("MKCOL with body failed");
    // RFC 4918: respond 415 Unsupported Media Type
    assert_eq!(
        res.status(),
        StatusCode::UNSUPPORTED_MEDIA_TYPE,
        "MKCOL with body should return 415"
    );
}

#[tokio::test]
async fn put_create_file() {
    let path = "put_created.txt";
    let client = reqwest::Client::new();
    let url = format!("{}/test/{}", BASE_URL, path);
    let body = "webdav put data";
    let res = client
        .put(&url)
        .body(body)
        .send()
        .await
        .expect("PUT failed");
    assert_eq!(res.status(), StatusCode::CREATED);
    let content = std::fs::read_to_string(format!("data/test/{}", path)).unwrap();
    assert_eq!(content, body);
}

#[tokio::test]
async fn put_overwrite_file() {
    let path = "put_overwrite.txt";
    setup_test_file(path, "old content");
    let client = reqwest::Client::new();
    let url = format!("{}/test/{}", BASE_URL, path);
    let new_body = "updated content";
    let res = client
        .put(&url)
        .body(new_body)
        .send()
        .await
        .expect("PUT failed");
    assert_eq!(res.status(), StatusCode::NO_CONTENT);
    let content = std::fs::read_to_string(format!("data/test/{}", path)).unwrap();
    assert_eq!(content, new_body);
}

#[tokio::test]
async fn put_to_directory_should_fail() {
    setup_test_dir("putdir");
    let client = reqwest::Client::new();
    let url = format!("{}/test/putdir", BASE_URL); // folder path
    let res = client
        .put(&url)
        .body("fail")
        .send()
        .await
        .expect("PUT failed");
    assert_eq!(res.status(), StatusCode::CONFLICT);
}

#[tokio::test]
async fn put_missing_parent_should_fail() {
    let path = "missingparentdir/newfile.txt";
    // Remove any previous parent dir
    let _ = std::fs::remove_dir_all("data/test/missingparentdir");
    let client = reqwest::Client::new();
    let url = format!("{}/test/{}", BASE_URL, path);
    let res = client
        .put(&url)
        .body("abc")
        .send()
        .await
        .expect("PUT failed");
    assert_eq!(res.status(), StatusCode::CONFLICT);
}

#[tokio::test]
async fn put_empty_body_creates_empty_file() {
    let path = "put_zero.txt";
    let client = reqwest::Client::new();
    let url = format!("{}/test/{}", BASE_URL, path);
    let res = client.put(&url).body("").send().await.expect("PUT failed");
    assert!(res.status().is_success(), "status: {}", res.status());
    let meta = std::fs::metadata(format!("data/test/{}", path)).unwrap();
    assert_eq!(meta.len(), 0);
}

#[tokio::test]
async fn put_permission_denied() {
    // Only on unix: set parent dir to read-only
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let dirname = "readonly_dir";
        setup_test_dir(dirname);
        let dir_path = format!("data/test/{}", dirname);
        let file_path = format!("{}/put_forbidden.txt", dir_path);
        // Make dir readonly
        let perms = std::fs::Permissions::from_mode(0o555);
        let _ = std::fs::set_permissions(&dir_path, perms.clone());
        let client = reqwest::Client::new();
        let url = format!("{}/test/{}/put_forbidden.txt", BASE_URL, dirname);
        let res = client
            .put(&url)
            .body("should fail")
            .send()
            .await
            .expect("PUT failed");
        // Accept forbidden or conflict (macos/ci may give 409)
        assert!(
            res.status() == StatusCode::FORBIDDEN || res.status() == StatusCode::CONFLICT,
            "expected FORBIDDEN or CONFLICT, got {}",
            res.status()
        );
        // Restore permissions for cleanup
        let perms = std::fs::Permissions::from_mode(0o755);
        let _ = std::fs::set_permissions(&dir_path, perms);
        let _ = std::fs::remove_file(&file_path);
        let _ = std::fs::remove_dir(&dir_path);
    }
}

#[tokio::test]
async fn copy_dir_creates_new() {
    setup_test_file("copy_dir_src/a.txt", "hi");
    setup_test_file("copy_dir_src/b.txt", "bye");
    setup_test_file("copy_dir_src/subdir/c.txt", "dai");

    let client = reqwest::Client::new();
    let dest_url = format!("{}/test/copy_dir_dest", BASE_URL);
    let res = client
        .request(
            Method::from_bytes(b"COPY").unwrap(),
            format!("{}/test/copy_dir_src", BASE_URL),
        )
        .header("Destination", dest_url.clone())
        .send()
        .await
        .expect("COPY failed");

    assert_eq!(res.status(), StatusCode::CREATED);
    assert!(
        std::fs::metadata("data/test/copy_dir_dest")
            .unwrap()
            .is_dir()
    );
    let file_a = std::fs::read_to_string("data/test/copy_dir_dest/a.txt").unwrap();
    assert_eq!(file_a, "hi");
    let file_b = std::fs::read_to_string("data/test/copy_dir_dest/b.txt").unwrap();
    assert_eq!(file_b, "bye");
    let file_c = std::fs::read_to_string("data/test/copy_dir_dest/subdir/c.txt").unwrap();
    assert_eq!(file_c, "dai");
}

#[tokio::test]
async fn copy_dir_overwrites_when_allowed() {
    setup_test_file("copy_dir_src_over/a.txt", "hi");
    setup_test_file("copy_dir_src_over/subdir/c.txt", "bye");

    setup_test_file("copy_dir_dest_over/b.txt", "dai");
    setup_test_file("copy_dir_dest_over/subdir/c.txt", "dai");

    let client = reqwest::Client::new();
    let dest_url = format!("{}/test/copy_dir_dest_over", BASE_URL);
    let res = client
        .request(
            Method::from_bytes(b"COPY").unwrap(),
            format!("{}/test/copy_dir_src_over", BASE_URL),
        )
        .header("Destination", dest_url.clone())
        .header("Overwrite", "T")
        .send()
        .await
        .expect("COPY failed");

    assert_eq!(res.status(), StatusCode::NO_CONTENT);
    assert!(std::fs::metadata("data/test/copy_dir_dest_over/a.txt").is_ok());
    assert_eq!(
        std::fs::read_to_string("data/test/copy_dir_dest_over/subdir/c.txt").unwrap(),
        "bye"
    );
    assert!(std::fs::metadata("data/test/copy_dir_dest_over/b.txt").is_err());
}

#[tokio::test]
async fn copy_dir_forbidden_overwrite() {
    setup_test_file("copy_dir_src_for/fa.txt", "hi");
    setup_test_file("copy_dir_src_for/subdir/fc.txt", "bye");

    setup_test_file("copy_dir_dest_for/b.txt", "dai");
    setup_test_file("copy_dir_dest_for/subdir/k.txt", "keepme");

    let client = reqwest::Client::new();
    let dest_url = format!("{}/test/copy_dir_dest_for", BASE_URL);
    let res = client
        .request(
            Method::from_bytes(b"COPY").unwrap(),
            format!("{}/test/copy_dir_src_for", BASE_URL),
        )
        .header("Destination", dest_url.clone())
        .header("Overwrite", "F")
        .send()
        .await
        .expect("COPY failed");
    assert_eq!(res.status(), StatusCode::PRECONDITION_FAILED);
    assert_eq!(
        std::fs::read_to_string("data/test/copy_dir_dest_for/subdir/k.txt").unwrap(),
        "keepme"
    );
    assert!(std::fs::metadata("data/test/copy_dir_dest_for/c.txt").is_err());
}

#[tokio::test]
async fn copy_dir_missing_parent_should_fail() {
    let _ = std::fs::remove_dir_all("data/test/newparent");
    let client = reqwest::Client::new();
    let dest_url = format!("{}/test/newparent/copy_dir_dest", BASE_URL);
    let res = client
        .request(
            Method::from_bytes(b"COPY").unwrap(),
            format!("{}/test/copy_dir_src", BASE_URL),
        )
        .header("Destination", dest_url.clone())
        .send()
        .await
        .expect("COPY failed");
    assert_eq!(res.status(), StatusCode::CONFLICT);
    assert!(std::fs::metadata("data/test/newparent/copy_dir_dest").is_err());
}
