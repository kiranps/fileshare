//! E2E tests for `p2p_handler::handle`.
//!
//! These tests call `handle()` directly with JSON strings and assert on the
//! returned JSON response — no real WebRTC/network connection is needed.
//!
//! # Setup / teardown
//! - `before_all` (via `#[ctor]`) creates a temporary directory and populates
//!   it with a small fixture tree.
//! - `after_all` (via `#[dtor]`) removes the temporary directory.
//! - Individual tests may call the `setup_*` helpers to add files they need.

use base64::{Engine, engine::general_purpose::STANDARD as BASE64};
use ctor::{ctor, dtor};
use serde_json::Value;
use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;
use std::sync::OnceLock;

use webdavserver::p2p_handler::handle;

// ---------------------------------------------------------------------------
// Shared base directory
// ---------------------------------------------------------------------------

static BASE_DIR: OnceLock<PathBuf> = OnceLock::new();

fn base() -> &'static PathBuf {
    BASE_DIR.get().expect("before_all not called")
}

// ---------------------------------------------------------------------------
// before_all / after_all
// ---------------------------------------------------------------------------

#[ctor]
fn before_all() {
    BASE_DIR.get_or_init(|| {
        let dir = PathBuf::from("data/p2p_e2e");
        fs::create_dir_all(&dir).expect("create base dir");
        dir
    });
}

#[dtor]
fn after_all() {
    let _ = fs::remove_dir_all("data/p2p_e2e");
}

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

fn setup_file(rel: &str, content: &str) -> PathBuf {
    let path = base().join(rel);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).unwrap();
    }
    let mut f = File::create(&path).unwrap();
    f.write_all(content.as_bytes()).unwrap();
    path
}

fn setup_dir(rel: &str) -> PathBuf {
    let path = base().join(rel);
    fs::create_dir_all(&path).unwrap();
    path
}

fn remove(rel: &str) {
    let path = base().join(rel);
    let _ = fs::remove_file(&path);
    let _ = fs::remove_dir_all(&path);
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

fn parse(json: &str) -> Value {
    serde_json::from_str(json).expect("response is not valid JSON")
}

fn assert_ok(v: &Value) {
    assert_eq!(v["ok"], true, "expected ok=true, got: {v}");
}

fn assert_err(v: &Value, code: &str) {
    assert_eq!(v["ok"], false, "expected ok=false, got: {v}");
    assert_eq!(v["code"], code, "wrong error code, got: {v}");
}

// ---------------------------------------------------------------------------
// fs.options
// ---------------------------------------------------------------------------

#[tokio::test]
async fn options_returns_supported_ops() {
    let resp = handle(r#"{"id":"1","op":"fs.options"}"#, base()).await;
    let v = parse(&resp);
    assert_ok(&v);
    assert_eq!(v["code"], "ok");
    let ops = v["data"]["ops"].as_array().expect("ops array");
    let op_strs: Vec<&str> = ops.iter().map(|o| o.as_str().unwrap()).collect();
    assert!(op_strs.contains(&"fs.options"));
    assert!(op_strs.contains(&"fs.get"));
    assert!(op_strs.contains(&"fs.put"));
    assert!(op_strs.contains(&"fs.delete"));
}

// ---------------------------------------------------------------------------
// fs.stat
// ---------------------------------------------------------------------------

#[tokio::test]
async fn stat_existing_file() {
    setup_file("stat_me.txt", "hello");
    let req = r#"{"id":"s1","op":"fs.stat","path":"stat_me.txt"}"#;
    let resp = handle(req, base()).await;
    let v = parse(&resp);
    assert_ok(&v);
    assert_eq!(v["data"]["is_dir"], false);
    assert_eq!(v["data"]["size"], 5);
}

#[tokio::test]
async fn stat_existing_directory() {
    setup_dir("stat_dir");
    let req = r#"{"id":"s2","op":"fs.stat","path":"stat_dir"}"#;
    let resp = handle(req, base()).await;
    let v = parse(&resp);
    assert_ok(&v);
    assert_eq!(v["data"]["is_dir"], true);
}

#[tokio::test]
async fn stat_nonexistent_returns_not_found() {
    remove("no_such_stat.txt");
    let req = r#"{"id":"s3","op":"fs.stat","path":"no_such_stat.txt"}"#;
    let resp = handle(req, base()).await;
    let v = parse(&resp);
    assert_err(&v, "not_found");
}

// ---------------------------------------------------------------------------
// fs.list
// ---------------------------------------------------------------------------

#[tokio::test]
async fn list_directory() {
    setup_file("listdir/a.txt", "A");
    setup_file("listdir/b.txt", "B");
    let req = r#"{"id":"l1","op":"fs.list","path":"listdir"}"#;
    let resp = handle(req, base()).await;
    let v = parse(&resp);
    assert_ok(&v);
    let entries = v["data"].as_array().expect("entries array");
    assert!(entries.len() >= 2);
    let paths: Vec<&str> = entries
        .iter()
        .map(|e| e["path"].as_str().unwrap())
        .collect();
    assert!(paths.iter().any(|p| p.contains("a.txt")));
    assert!(paths.iter().any(|p| p.contains("b.txt")));
}

#[tokio::test]
async fn list_nonexistent_returns_not_found() {
    remove("no_such_list_dir");
    let req = r#"{"id":"l2","op":"fs.list","path":"no_such_list_dir"}"#;
    let resp = handle(req, base()).await;
    let v = parse(&resp);
    assert_err(&v, "not_found");
}

// ---------------------------------------------------------------------------
// fs.get
// ---------------------------------------------------------------------------

#[tokio::test]
async fn get_file_returns_base64_body() {
    setup_file("get_me.txt", "webdav p2p");
    let req = r#"{"id":"g1","op":"fs.get","path":"get_me.txt"}"#;
    let resp = handle(req, base()).await;
    let v = parse(&resp);
    assert_ok(&v);
    let b64 = v["data"]["body_b64"].as_str().expect("body_b64");
    let bytes = BASE64.decode(b64).expect("valid base64");
    assert_eq!(String::from_utf8(bytes).unwrap(), "webdav p2p");
    assert_eq!(v["data"]["content_length"], 10);
}

#[tokio::test]
async fn get_directory_returns_is_directory_error() {
    setup_dir("get_dir");
    let req = r#"{"id":"g2","op":"fs.get","path":"get_dir"}"#;
    let resp = handle(req, base()).await;
    let v = parse(&resp);
    assert_err(&v, "is_directory");
}

#[tokio::test]
async fn get_nonexistent_returns_not_found() {
    remove("nope.txt");
    let req = r#"{"id":"g3","op":"fs.get","path":"nope.txt"}"#;
    let resp = handle(req, base()).await;
    let v = parse(&resp);
    assert_err(&v, "not_found");
}

// ---------------------------------------------------------------------------
// fs.head
// ---------------------------------------------------------------------------

#[tokio::test]
async fn head_file_returns_metadata() {
    setup_file("head_me.txt", "headcontent");
    let req = r#"{"id":"h1","op":"fs.head","path":"head_me.txt"}"#;
    let resp = handle(req, base()).await;
    let v = parse(&resp);
    assert_ok(&v);
    assert_eq!(v["data"]["content_length"], 11);
    assert!(v["data"]["etag"].is_string());
    assert!(v["data"]["last_modified"].is_string());
}

#[tokio::test]
async fn head_directory_returns_is_directory_error() {
    setup_dir("head_dir");
    let req = r#"{"id":"h2","op":"fs.head","path":"head_dir"}"#;
    let resp = handle(req, base()).await;
    let v = parse(&resp);
    assert_err(&v, "is_directory");
}

#[tokio::test]
async fn head_nonexistent_returns_not_found() {
    remove("no_head.txt");
    let req = r#"{"id":"h3","op":"fs.head","path":"no_head.txt"}"#;
    let resp = handle(req, base()).await;
    let v = parse(&resp);
    assert_err(&v, "not_found");
}

// ---------------------------------------------------------------------------
// fs.put
// ---------------------------------------------------------------------------

#[tokio::test]
async fn put_creates_new_file() {
    remove("put_new.txt");
    let b64 = BASE64.encode(b"new content");
    let req = format!(r#"{{"id":"p1","op":"fs.put","path":"put_new.txt","body_b64":"{b64}"}}"#);
    let resp = handle(&req, base()).await;
    let v = parse(&resp);
    assert_ok(&v);
    assert_eq!(v["code"], "created");
    let content = fs::read_to_string(base().join("put_new.txt")).unwrap();
    assert_eq!(content, "new content");
}

#[tokio::test]
async fn put_overwrites_existing_file() {
    setup_file("put_overwrite_target.txt", "old");
    let content = fs::read_to_string(base().join("put_overwrite_target.txt")).unwrap();
    println!("before ---------{}", content);
    let b64 = BASE64.encode(b"updated");
    let req = format!(
        r#"{{"id":"p2","op":"fs.put","path":"put_overwrite_target.txt","body_b64":"{b64}"}}"#
    );
    let resp = handle(&req, base()).await;
    let v = parse(&resp);
    assert_ok(&v);
    println!("---------{}", v);
    assert_eq!(v["code"], "ok");
    let content = fs::read_to_string(base().join("put_overwrite_target.txt")).unwrap();
    println!("after ---------{}", content);
    assert_eq!(content, "updated");
}

#[tokio::test]
async fn put_to_directory_returns_is_directory_error() {
    setup_dir("put_as_dir");
    let b64 = BASE64.encode(b"nope");
    let req = format!(r#"{{"id":"p3","op":"fs.put","path":"put_as_dir","body_b64":"{b64}"}}"#);
    let resp = handle(&req, base()).await;
    let v = parse(&resp);
    assert_err(&v, "is_directory");
}

#[tokio::test]
async fn put_missing_parent_returns_parent_not_found() {
    remove("missing_parent_put");
    let b64 = BASE64.encode(b"x");
    let req = format!(
        r#"{{"id":"p4","op":"fs.put","path":"missing_parent_put/file.txt","body_b64":"{b64}"}}"#
    );
    let resp = handle(&req, base()).await;
    let v = parse(&resp);
    assert_err(&v, "parent_not_found");
}

#[tokio::test]
async fn put_invalid_base64_returns_parse_error() {
    let req = r#"{"id":"p5","op":"fs.put","path":"x.txt","body_b64":"!!!not-base64!!!"}"#;
    let resp = handle(req, base()).await;
    let v = parse(&resp);
    assert_err(&v, "parse_error");
}

// ---------------------------------------------------------------------------
// fs.delete
// ---------------------------------------------------------------------------

#[tokio::test]
async fn delete_existing_file() {
    setup_file("del_me.txt", "bye");
    let req = r#"{"id":"d1","op":"fs.delete","path":"del_me.txt"}"#;
    let resp = handle(req, base()).await;
    let v = parse(&resp);
    assert_ok(&v);
    assert!(fs::metadata(base().join("del_me.txt")).is_err());
}

#[tokio::test]
async fn delete_existing_directory_recursive() {
    setup_file("del_dir/sub/f.txt", "x");
    let req = r#"{"id":"d2","op":"fs.delete","path":"del_dir"}"#;
    let resp = handle(req, base()).await;
    let v = parse(&resp);
    assert_ok(&v);
    assert!(fs::metadata(base().join("del_dir")).is_err());
}

#[tokio::test]
async fn delete_nonexistent_returns_not_found() {
    remove("no_del.txt");
    let req = r#"{"id":"d3","op":"fs.delete","path":"no_del.txt"}"#;
    let resp = handle(req, base()).await;
    let v = parse(&resp);
    assert_err(&v, "not_found");
}

// ---------------------------------------------------------------------------
// fs.mkdir
// ---------------------------------------------------------------------------

#[tokio::test]
async fn mkdir_creates_directory() {
    remove("newdir");
    let req = r#"{"id":"m1","op":"fs.mkdir","path":"newdir"}"#;
    let resp = handle(req, base()).await;
    let v = parse(&resp);
    assert_ok(&v);
    assert_eq!(v["code"], "created");
    assert!(fs::metadata(base().join("newdir")).unwrap().is_dir());
}

#[tokio::test]
async fn mkdir_already_exists_returns_already_exists() {
    setup_dir("existing_mkdir");
    let req = r#"{"id":"m2","op":"fs.mkdir","path":"existing_mkdir"}"#;
    let resp = handle(req, base()).await;
    let v = parse(&resp);
    assert_err(&v, "already_exists");
}

#[tokio::test]
async fn mkdir_missing_parent_returns_parent_not_found() {
    remove("no_parent_mkdir");
    let req = r#"{"id":"m3","op":"fs.mkdir","path":"no_parent_mkdir/child"}"#;
    let resp = handle(req, base()).await;
    let v = parse(&resp);
    assert_err(&v, "parent_not_found");
}

// ---------------------------------------------------------------------------
// fs.copy
// ---------------------------------------------------------------------------

#[tokio::test]
async fn copy_file_creates_destination() {
    setup_file("copy_src.txt", "copy me");
    remove("copy_dst.txt");
    let req = r#"{"id":"c1","op":"fs.copy","src":"copy_src.txt","dst":"copy_dst.txt"}"#;
    let resp = handle(req, base()).await;
    let v = parse(&resp);
    assert_ok(&v);
    assert_eq!(v["code"], "created");
    let content = fs::read_to_string(base().join("copy_dst.txt")).unwrap();
    assert_eq!(content, "copy me");
    // Source still there
    assert!(fs::metadata(base().join("copy_src.txt")).is_ok());
}

#[tokio::test]
async fn copy_source_not_found_returns_not_found() {
    remove("copy_no_src.txt");
    let req = r#"{"id":"c2","op":"fs.copy","src":"copy_no_src.txt","dst":"copy_no_dst.txt"}"#;
    let resp = handle(req, base()).await;
    let v = parse(&resp);
    assert_err(&v, "not_found");
}

#[tokio::test]
async fn copy_no_overwrite_dest_exists_returns_error() {
    setup_file("copy_ovr_src.txt", "src");
    setup_file("copy_ovr_dst.txt", "dst");
    let req = r#"{"id":"c3","op":"fs.copy","src":"copy_ovr_src.txt","dst":"copy_ovr_dst.txt","overwrite":false}"#;
    let resp = handle(req, base()).await;
    let v = parse(&resp);
    assert_err(&v, "dest_exists_no_overwrite");
}

// ---------------------------------------------------------------------------
// fs.move
// ---------------------------------------------------------------------------

#[tokio::test]
async fn move_file_renames_it() {
    setup_file("mv_src.txt", "move me");
    remove("mv_dst.txt");
    let req = r#"{"id":"mv1","op":"fs.move","src":"mv_src.txt","dst":"mv_dst.txt"}"#;
    let resp = handle(req, base()).await;
    let v = parse(&resp);
    assert_ok(&v);
    assert_eq!(v["code"], "created");
    let content = fs::read_to_string(base().join("mv_dst.txt")).unwrap();
    assert_eq!(content, "move me");
    assert!(fs::metadata(base().join("mv_src.txt")).is_err());
}

#[tokio::test]
async fn move_source_not_found_returns_not_found() {
    remove("mv_no_src.txt");
    let req = r#"{"id":"mv2","op":"fs.move","src":"mv_no_src.txt","dst":"mv_no_dst.txt"}"#;
    let resp = handle(req, base()).await;
    let v = parse(&resp);
    assert_err(&v, "not_found");
}

#[tokio::test]
async fn move_no_overwrite_dest_exists_returns_error() {
    setup_file("mv_ovr_src.txt", "src");
    setup_file("mv_ovr_dst.txt", "dst");
    let req = r#"{"id":"mv3","op":"fs.move","src":"mv_ovr_src.txt","dst":"mv_ovr_dst.txt","overwrite":false}"#;
    let resp = handle(req, base()).await;
    let v = parse(&resp);
    assert_err(&v, "dest_exists_no_overwrite");
}

// ---------------------------------------------------------------------------
// Parse errors
// ---------------------------------------------------------------------------

#[tokio::test]
async fn invalid_json_returns_parse_error() {
    let resp = handle("not json", base()).await;
    let v = parse(&resp);
    assert_err(&v, "parse_error");
}

#[tokio::test]
async fn unknown_op_returns_parse_error() {
    let resp = handle(r#"{"id":"x","op":"fs.unknown"}"#, base()).await;
    let v = parse(&resp);
    assert_err(&v, "parse_error");
}

// ---------------------------------------------------------------------------
// Response envelope shape
// ---------------------------------------------------------------------------

#[tokio::test]
async fn response_always_contains_id_and_op() {
    let req = r#"{"id":"envelope-test","op":"fs.options"}"#;
    let resp = handle(req, base()).await;
    let v = parse(&resp);
    assert_eq!(v["id"], "envelope-test");
    assert_eq!(v["op"], "fs.options");
}
