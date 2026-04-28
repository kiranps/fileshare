//! Tests for `P2pConnection` — the UniFFI-exposed P2P lifecycle object.
//!
//! # Strategy
//!
//! Tests that require a live signalling server / real WebRTC network are
//! deliberately avoided here.  Instead, we exercise all observable behaviour
//! that can be validated without network access:
//!
//! - Construction
//! - `start()` returns the echoed session id
//! - `start()` while already running returns `AlreadyRunning`
//! - `stop()` while not running returns `NotRunning`
//! - `start()` → `stop()` round-trip succeeds
//! - Multiple `start` / `stop` cycles work correctly
//! - `start()` with an unreachable signalling endpoint returns `Ok` immediately
//!   (the error surfaces asynchronously in the background thread, not from `start`)
//! - The returned `session_id` matches the one supplied in `P2pStartOptions`

use std::time::Duration;

use webdavserver::{
    P2pConnection,
    P2pStartOptions,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Build a minimal `P2pStartOptions` pointing at a non-routable address so
/// the background thread exits quickly without blocking tests.
fn fast_fail_opts(session_id: &str) -> P2pStartOptions {
    P2pStartOptions {
        signalling_endpoint: "http://127.0.0.1:1".to_string(), // immediately refused
        base_path: std::env::temp_dir()
            .join("p2p_conn_test")
            .to_string_lossy()
            .to_string(),
        session_id: session_id.to_string(),
    }
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

#[test]
fn new_returns_idle_connection() {
    let _conn = P2pConnection::new();
    // construction must not panic
}

// ---------------------------------------------------------------------------
// start() basic behaviour
// ---------------------------------------------------------------------------

#[test]
fn start_returns_echoed_session_id() {
    let conn = P2pConnection::new();
    let opts = fast_fail_opts("echo-session");
    let resp = conn.start(opts).expect("start should succeed");
    assert_eq!(resp.session_id, "echo-session");
    let _ = conn.stop();
}

#[test]
fn start_with_empty_session_id_is_accepted() {
    let conn = P2pConnection::new();
    let opts = fast_fail_opts("");
    let resp = conn.start(opts).expect("start should succeed even with empty session id");
    assert_eq!(resp.session_id, "");
    let _ = conn.stop();
}

#[test]
fn start_while_already_running_returns_already_running() {
    let conn = P2pConnection::new();
    conn.start(fast_fail_opts("s1")).expect("first start should succeed");

    let err = conn
        .start(fast_fail_opts("s2"))
        .expect_err("second start should fail");

    assert!(
        matches!(err, webdavserver::ServerError::AlreadyRunning),
        "expected AlreadyRunning, got: {err:?}"
    );

    let _ = conn.stop();
}

// ---------------------------------------------------------------------------
// stop() basic behaviour
// ---------------------------------------------------------------------------

#[test]
fn stop_while_not_running_returns_not_running() {
    let conn = P2pConnection::new();
    let err = conn.stop().expect_err("stop before start should fail");
    assert!(
        matches!(err, webdavserver::ServerError::NotRunning),
        "expected NotRunning, got: {err:?}"
    );
}

#[test]
fn stop_after_start_succeeds() {
    let conn = P2pConnection::new();
    conn.start(fast_fail_opts("stop-test")).expect("start should succeed");
    conn.stop().expect("stop should succeed");
}

#[test]
fn double_stop_returns_not_running() {
    let conn = P2pConnection::new();
    conn.start(fast_fail_opts("double-stop")).expect("start should succeed");
    conn.stop().expect("first stop should succeed");
    let err = conn.stop().expect_err("second stop should fail");
    assert!(
        matches!(err, webdavserver::ServerError::NotRunning),
        "expected NotRunning on second stop, got: {err:?}"
    );
}

// ---------------------------------------------------------------------------
// Round-trip: multiple start / stop cycles
// ---------------------------------------------------------------------------

#[test]
fn multiple_start_stop_cycles_succeed() {
    let conn = P2pConnection::new();

    for i in 0..3 {
        let session = format!("cycle-{i}");
        let resp = conn.start(fast_fail_opts(&session)).expect("start should succeed");
        assert_eq!(resp.session_id, session);

        // Give the background thread a moment to reach the signalling poll
        // before we stop, so the stop-signal path is exercised.
        std::thread::sleep(Duration::from_millis(50));

        conn.stop().expect("stop should succeed");
    }
}

// ---------------------------------------------------------------------------
// start() is non-blocking even with an unreachable signalling server
// ---------------------------------------------------------------------------

#[test]
fn start_returns_immediately_with_unreachable_signal_server() {
    let conn = P2pConnection::new();
    let before = std::time::Instant::now();

    conn.start(fast_fail_opts("nonblocking")).expect("start should succeed");

    let elapsed = before.elapsed();
    assert!(
        elapsed < Duration::from_secs(5),
        "start() should return almost instantly, took {elapsed:?}"
    );

    let _ = conn.stop();
}

// ---------------------------------------------------------------------------
// Session id is correctly propagated
// ---------------------------------------------------------------------------

#[test]
fn session_id_with_special_characters_is_preserved() {
    let conn = P2pConnection::new();
    let session = "session/with-special_chars.and:colons";
    let resp = conn
        .start(fast_fail_opts(session))
        .expect("start should succeed");
    assert_eq!(resp.session_id, session);
    let _ = conn.stop();
}

// ---------------------------------------------------------------------------
// base_path is accepted even if the directory doesn't exist yet
// ---------------------------------------------------------------------------

#[test]
fn start_with_nonexistent_base_path_does_not_error_at_start() {
    let conn = P2pConnection::new();
    let opts = P2pStartOptions {
        signalling_endpoint: "http://127.0.0.1:1".to_string(),
        base_path: "/tmp/p2p_conn_test_nonexistent_xyz_12345".to_string(),
        session_id: "path-test".to_string(),
    };
    // start() itself should not validate the path — it's the handler's job
    conn.start(opts).expect("start should succeed regardless of base_path existence");
    let _ = conn.stop();
}
