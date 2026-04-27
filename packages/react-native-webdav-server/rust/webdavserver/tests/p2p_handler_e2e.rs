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
use webdavserver::p2p_types::P2pHandleResult;

/// Call `handle` and unwrap the `Json` variant.  Panics for stream results.
async fn handle_json(msg: &str) -> String {
    match handle(msg, base()).await {
        P2pHandleResult::Json(s) => s,
        P2pHandleResult::Stream { .. } => {
            panic!("expected Json result but got Stream for msg: {msg}")
        }
    }
}

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

fn assert_err(v: &Value, status: &str) {
    assert_eq!(v["ok"], false, "expected ok=false, got: {v}");
    assert_eq!(v["status"], status, "wrong error status, got: {v}");
}

// ---------------------------------------------------------------------------
// fs.options
// ---------------------------------------------------------------------------

#[tokio::test]
async fn options_returns_supported_ops() {
    let resp = handle_json(r#"{"id":"1","op":"fs.options"}"#).await;
    let v = parse(&resp);
    assert_ok(&v);
    assert_eq!(v["status"], "ok");
    let ops = v["data"]["ops"].as_array().expect("ops array");
    let op_strs: Vec<&str> = ops.iter().map(|o| o.as_str().unwrap()).collect();
    assert!(op_strs.contains(&"fs.options"));
    assert!(op_strs.contains(&"fs.ping"));
    assert!(op_strs.contains(&"fs.get"));
    assert!(op_strs.contains(&"fs.put"));
    assert!(op_strs.contains(&"fs.delete"));
}

// ---------------------------------------------------------------------------
// fs.ping  (health-check / keep-alive)
// ---------------------------------------------------------------------------

#[tokio::test]
async fn ping_returns_pong_status() {
    let resp = handle_json(r#"{"id":"ping1","op":"fs.ping"}"#).await;
    let v = parse(&resp);
    assert_ok(&v);
    assert_eq!(v["op"], "fs.ping");
    assert_eq!(v["status"], "pong");
}

#[tokio::test]
async fn ping_without_payload_field() {
    let resp = handle_json(r#"{"id":"ping3","op":"fs.ping"}"#).await;
    let v = parse(&resp);
    assert_ok(&v);
    assert_eq!(v["status"], "pong");
}

#[tokio::test]
async fn ping_echoes_request_id() {
    let resp = handle_json(r#"{"id":"my-unique-id","op":"fs.ping"}"#).await;
    let v = parse(&resp);
    assert_eq!(v["id"], "my-unique-id");
}

// ---------------------------------------------------------------------------
// fs.stat
// ---------------------------------------------------------------------------

#[tokio::test]
async fn stat_existing_file() {
    setup_file("stat_me.txt", "hello");
    let req = r#"{"id":"s1","op":"fs.stat","payload":{"path":"stat_me.txt"}}"#;
    let resp = handle_json(req).await;
    let v = parse(&resp);
    assert_ok(&v);
    assert_eq!(v["data"]["is_dir"], false);
    assert_eq!(v["data"]["size"], 5);
}

#[tokio::test]
async fn stat_existing_directory() {
    setup_dir("stat_dir");
    let req = r#"{"id":"s2","op":"fs.stat","payload":{"path":"stat_dir"}}"#;
    let resp = handle_json(req).await;
    let v = parse(&resp);
    assert_ok(&v);
    assert_eq!(v["data"]["is_dir"], true);
}

#[tokio::test]
async fn stat_nonexistent_returns_not_found() {
    remove("no_such_stat.txt");
    let req = r#"{"id":"s3","op":"fs.stat","payload":{"path":"no_such_stat.txt"}}"#;
    let resp = handle_json(req).await;
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
    let req = r#"{"id":"l1","op":"fs.list","payload":{"path":"listdir"}}"#;
    let resp = handle_json(req).await;
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
    let req = r#"{"id":"l2","op":"fs.list","payload":{"path":"no_such_list_dir"}}"#;
    let resp = handle_json(req).await;
    let v = parse(&resp);
    assert_err(&v, "not_found");
}

// ---------------------------------------------------------------------------
// fs.get
// ---------------------------------------------------------------------------

#[tokio::test]
async fn get_file_returns_base64_body() {
    setup_file("get_me.txt", "webdav p2p");
    let req = r#"{"id":"g1","op":"fs.get","payload":{"path":"get_me.txt"}}"#;
    let resp = handle_json(req).await;
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
    let req = r#"{"id":"g2","op":"fs.get","payload":{"path":"get_dir"}}"#;
    let resp = handle_json(req).await;
    let v = parse(&resp);
    assert_err(&v, "is_directory");
}

#[tokio::test]
async fn get_nonexistent_returns_not_found() {
    remove("nope.txt");
    let req = r#"{"id":"g3","op":"fs.get","payload":{"path":"nope.txt"}}"#;
    let resp = handle_json(req).await;
    let v = parse(&resp);
    assert_err(&v, "not_found");
}

// ---------------------------------------------------------------------------
// fs.head
// ---------------------------------------------------------------------------

#[tokio::test]
async fn head_file_returns_metadata() {
    setup_file("head_me.txt", "headcontent");
    let req = r#"{"id":"h1","op":"fs.head","payload":{"path":"head_me.txt"}}"#;
    let resp = handle_json(req).await;
    let v = parse(&resp);
    assert_ok(&v);
    assert_eq!(v["data"]["content_length"], 11);
    assert!(v["data"]["etag"].is_string());
    assert!(v["data"]["last_modified"].is_string());
}

#[tokio::test]
async fn head_directory_returns_is_directory_error() {
    setup_dir("head_dir");
    let req = r#"{"id":"h2","op":"fs.head","payload":{"path":"head_dir"}}"#;
    let resp = handle_json(req).await;
    let v = parse(&resp);
    assert_err(&v, "is_directory");
}

#[tokio::test]
async fn head_nonexistent_returns_not_found() {
    remove("no_head.txt");
    let req = r#"{"id":"h3","op":"fs.head","payload":{"path":"no_head.txt"}}"#;
    let resp = handle_json(req).await;
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
    let req = format!(
        r#"{{"id":"p1","op":"fs.put","payload":{{"path":"put_new.txt","body_b64":"{b64}"}}}}"#
    );
    let resp = handle_json(&req).await;
    let v = parse(&resp);
    assert_ok(&v);
    assert_eq!(v["status"], "created");
    let content = fs::read_to_string(base().join("put_new.txt")).unwrap();
    assert_eq!(content, "new content");
}

#[tokio::test]
async fn put_overwrites_existing_file() {
    setup_file("put_overwrite_target.txt", "old");
    let b64 = BASE64.encode(b"updated");
    let req = format!(
        r#"{{"id":"p2","op":"fs.put","payload":{{"path":"put_overwrite_target.txt","body_b64":"{b64}"}}}}"#
    );
    let resp = handle_json(&req).await;
    let v = parse(&resp);
    assert_ok(&v);
    assert_eq!(v["status"], "ok");
    let content = fs::read_to_string(base().join("put_overwrite_target.txt")).unwrap();
    assert_eq!(content, "updated");
}

#[tokio::test]
async fn put_to_directory_returns_is_directory_error() {
    setup_dir("put_as_dir");
    let b64 = BASE64.encode(b"nope");
    let req = format!(
        r#"{{"id":"p3","op":"fs.put","payload":{{"path":"put_as_dir","body_b64":"{b64}"}}}}"#
    );
    let resp = handle_json(&req).await;
    let v = parse(&resp);
    assert_err(&v, "is_directory");
}

#[tokio::test]
async fn put_missing_parent_returns_parent_not_found() {
    remove("missing_parent_put");
    let b64 = BASE64.encode(b"x");
    let req = format!(
        r#"{{"id":"p4","op":"fs.put","payload":{{"path":"missing_parent_put/file.txt","body_b64":"{b64}"}}}}"#
    );
    let resp = handle_json(&req).await;
    let v = parse(&resp);
    assert_err(&v, "parent_not_found");
}

#[tokio::test]
async fn put_invalid_base64_returns_parse_error() {
    let req =
        r#"{"id":"p5","op":"fs.put","payload":{"path":"x.txt","body_b64":"!!!not-base64!!!"}}"#;
    let resp = handle_json(req).await;
    let v = parse(&resp);
    assert_err(&v, "parse_error");
}

// ---------------------------------------------------------------------------
// fs.delete
// ---------------------------------------------------------------------------

#[tokio::test]
async fn delete_existing_file() {
    setup_file("del_me.txt", "bye");
    let req = r#"{"id":"d1","op":"fs.delete","payload":{"path":"del_me.txt"}}"#;
    let resp = handle_json(req).await;
    let v = parse(&resp);
    assert_ok(&v);
    assert!(fs::metadata(base().join("del_me.txt")).is_err());
}

#[tokio::test]
async fn delete_existing_directory_recursive() {
    setup_file("del_dir/sub/f.txt", "x");
    let req = r#"{"id":"d2","op":"fs.delete","payload":{"path":"del_dir"}}"#;
    let resp = handle_json(req).await;
    let v = parse(&resp);
    assert_ok(&v);
    assert!(fs::metadata(base().join("del_dir")).is_err());
}

#[tokio::test]
async fn delete_nonexistent_returns_not_found() {
    remove("no_del.txt");
    let req = r#"{"id":"d3","op":"fs.delete","payload":{"path":"no_del.txt"}}"#;
    let resp = handle_json(req).await;
    let v = parse(&resp);
    assert_err(&v, "not_found");
}

// ---------------------------------------------------------------------------
// fs.mkdir
// ---------------------------------------------------------------------------

#[tokio::test]
async fn mkdir_creates_directory() {
    remove("newdir");
    let req = r#"{"id":"m1","op":"fs.mkdir","payload":{"path":"newdir"}}"#;
    let resp = handle_json(req).await;
    let v = parse(&resp);
    assert_ok(&v);
    assert_eq!(v["status"], "created");
    assert!(fs::metadata(base().join("newdir")).unwrap().is_dir());
}

#[tokio::test]
async fn mkdir_already_exists_returns_already_exists() {
    setup_dir("existing_mkdir");
    let req = r#"{"id":"m2","op":"fs.mkdir","payload":{"path":"existing_mkdir"}}"#;
    let resp = handle_json(req).await;
    let v = parse(&resp);
    assert_err(&v, "already_exists");
}

#[tokio::test]
async fn mkdir_missing_parent_returns_parent_not_found() {
    remove("no_parent_mkdir");
    let req = r#"{"id":"m3","op":"fs.mkdir","payload":{"path":"no_parent_mkdir/child"}}"#;
    let resp = handle_json(req).await;
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
    let req = r#"{"id":"c1","op":"fs.copy","payload":{"src":"copy_src.txt","dst":"copy_dst.txt"}}"#;
    let resp = handle_json(req).await;
    let v = parse(&resp);
    assert_ok(&v);
    assert_eq!(v["status"], "created");
    let content = fs::read_to_string(base().join("copy_dst.txt")).unwrap();
    assert_eq!(content, "copy me");
    // Source still there
    assert!(fs::metadata(base().join("copy_src.txt")).is_ok());
}

#[tokio::test]
async fn copy_source_not_found_returns_not_found() {
    remove("copy_no_src.txt");
    let req = r#"{"id":"c2","op":"fs.copy","payload":{"src":"copy_no_src.txt","dst":"copy_no_dst.txt"}}"#;
    let resp = handle_json(req).await;
    let v = parse(&resp);
    assert_err(&v, "not_found");
}

#[tokio::test]
async fn copy_no_overwrite_dest_exists_returns_error() {
    setup_file("copy_ovr_src.txt", "src");
    setup_file("copy_ovr_dst.txt", "dst");
    let req = r#"{"id":"c3","op":"fs.copy","payload":{"src":"copy_ovr_src.txt","dst":"copy_ovr_dst.txt","overwrite":false}}"#;
    let resp = handle_json(req).await;
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
    let req = r#"{"id":"mv1","op":"fs.move","payload":{"src":"mv_src.txt","dst":"mv_dst.txt"}}"#;
    let resp = handle_json(req).await;
    let v = parse(&resp);
    assert_ok(&v);
    assert_eq!(v["status"], "created");
    let content = fs::read_to_string(base().join("mv_dst.txt")).unwrap();
    assert_eq!(content, "move me");
    assert!(fs::metadata(base().join("mv_src.txt")).is_err());
}

#[tokio::test]
async fn move_source_not_found_returns_not_found() {
    remove("mv_no_src.txt");
    let req = r#"{"id":"mv2","op":"fs.move","payload":{"src":"mv_no_src.txt","dst":"mv_no_dst.txt"}}"#;
    let resp = handle_json(req).await;
    let v = parse(&resp);
    assert_err(&v, "not_found");
}

#[tokio::test]
async fn move_no_overwrite_dest_exists_returns_error() {
    setup_file("mv_ovr_src.txt", "src");
    setup_file("mv_ovr_dst.txt", "dst");
    let req = r#"{"id":"mv3","op":"fs.move","payload":{"src":"mv_ovr_src.txt","dst":"mv_ovr_dst.txt","overwrite":false}}"#;
    let resp = handle_json(req).await;
    let v = parse(&resp);
    assert_err(&v, "dest_exists_no_overwrite");
}

// ---------------------------------------------------------------------------
// Parse errors
// ---------------------------------------------------------------------------

#[tokio::test]
async fn invalid_json_returns_parse_error() {
    let resp = handle_json("not json").await;
    let v = parse(&resp);
    assert_err(&v, "parse_error");
}

#[tokio::test]
async fn unknown_op_returns_parse_error() {
    let resp = handle_json(r#"{"id":"x","op":"fs.unknown"}"#).await;
    let v = parse(&resp);
    assert_err(&v, "parse_error");
}

// ---------------------------------------------------------------------------
// Response envelope shape
// ---------------------------------------------------------------------------

#[tokio::test]
async fn response_always_contains_id_and_op() {
    let req = r#"{"id":"envelope-test","op":"fs.options"}"#;
    let resp = handle_json(req).await;
    let v = parse(&resp);
    assert_eq!(v["id"], "envelope-test");
    assert_eq!(v["op"], "fs.options");
}

#[tokio::test]
async fn error_response_contains_error_field() {
    remove("err_envelope.txt");
    let req = r#"{"id":"err-test","op":"fs.stat","payload":{"path":"err_envelope.txt"}}"#;
    let resp = handle_json(req).await;
    let v = parse(&resp);
    assert_eq!(v["ok"], false);
    assert!(v["error"].is_string(), "error field should be a string: {v}");
    assert!(v["data"].is_null(), "data should be absent on error: {v}");
}
