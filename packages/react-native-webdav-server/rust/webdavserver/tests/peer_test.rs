//! Unit / integration tests for `peer::Peer`.
//!
//! These tests exercise the public API of `Peer` that can be tested without a
//! live signalling server or real WebRTC network.  Tests that require a real
//! STUN/TURN network are skipped unless the `INTEGRATION` env-var is set.
//!
//! # What is covered
//! - Construction and default config values
//! - Handler registration (`on_open`, `on_data`, `on_close`, `on_error`)
//! - `send()` before a data channel is open returns a descriptive error
//! - `PeerConfig` builder / clone semantics

use std::sync::{Arc, Mutex};
use webdavserver::peer::{Peer, PeerConfig};

// ---------------------------------------------------------------------------
// PeerConfig
// ---------------------------------------------------------------------------

#[test]
fn default_config_has_expected_values() {
    let cfg = PeerConfig::default();
    assert_eq!(cfg.signal_base, "http://localhost:9000");
    assert_eq!(cfg.poll_interval_ms, 1_000);
    assert_eq!(cfg.poll_timeout_secs, 120);
    assert!(!cfg.ice_servers.is_empty(), "should have at least one ICE server");
    assert!(
        cfg.ice_servers[0].starts_with("stun:"),
        "default ICE server should be a STUN URL"
    );
}

#[test]
fn config_is_cloneable() {
    let cfg = PeerConfig {
        signal_base: "http://my-signal:1234".to_string(),
        poll_interval_ms: 500,
        poll_timeout_secs: 30,
        ice_servers: vec!["stun:example.com:3478".to_string()],
        ..PeerConfig::default()
    };
    let cloned = cfg.clone();
    assert_eq!(cloned.signal_base, cfg.signal_base);
    assert_eq!(cloned.poll_interval_ms, cfg.poll_interval_ms);
    assert_eq!(cloned.poll_timeout_secs, cfg.poll_timeout_secs);
    assert_eq!(cloned.ice_servers, cfg.ice_servers);
}

#[test]
fn config_debug_does_not_panic() {
    let cfg = PeerConfig::default();
    let _ = format!("{cfg:?}");
}

// ---------------------------------------------------------------------------
// Peer::new
// ---------------------------------------------------------------------------

#[test]
fn peer_new_returns_arc() {
    let peer = Peer::new(PeerConfig::default());
    // Verify we can clone the Arc without panic
    let _clone = Arc::clone(&peer);
}

// ---------------------------------------------------------------------------
// send() before data channel is ready
// ---------------------------------------------------------------------------

#[tokio::test]
async fn send_before_connect_returns_error() {
    let peer = Peer::new(PeerConfig::default());
    let result = peer.send("hello").await;
    assert!(result.is_err(), "send before connect should be an error");
    let msg = result.unwrap_err();
    assert!(
        msg.contains("not open"),
        "error message should mention 'not open', got: {msg}"
    );
}

// ---------------------------------------------------------------------------
// Handler registration — on_open
// ---------------------------------------------------------------------------

#[tokio::test]
async fn on_open_handler_can_be_registered() {
    let peer = Peer::new(PeerConfig::default());
    let called = Arc::new(Mutex::new(false));
    let called_clone = Arc::clone(&called);

    peer.on_open(move |_p| {
        let c = Arc::clone(&called_clone);
        async move {
            *c.lock().unwrap() = true;
        }
    })
    .await;

    // We cannot fire on_open without a real data channel, but we verify
    // the registration does not panic and the peer is still usable.
    assert!(!*called.lock().unwrap(), "handler should not fire at registration time");
}

// ---------------------------------------------------------------------------
// Handler registration — on_data
// ---------------------------------------------------------------------------

#[tokio::test]
async fn on_data_handler_can_be_registered() {
    let peer = Peer::new(PeerConfig::default());
    let last_msg: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));
    let last_msg_clone = Arc::clone(&last_msg);

    peer.on_data(move |msg, _p| {
        let lm = Arc::clone(&last_msg_clone);
        async move {
            *lm.lock().unwrap() = Some(msg);
        }
    })
    .await;

    assert!(last_msg.lock().unwrap().is_none());
}

// ---------------------------------------------------------------------------
// Handler registration — on_close
// ---------------------------------------------------------------------------

#[tokio::test]
async fn on_close_handler_can_be_registered() {
    let peer = Peer::new(PeerConfig::default());
    peer.on_close(|| async {}).await;
    // No panic = success
}

// ---------------------------------------------------------------------------
// Handler registration — on_error
// ---------------------------------------------------------------------------

#[tokio::test]
async fn on_error_handler_can_be_registered() {
    let peer = Peer::new(PeerConfig::default());
    let errors: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(vec![]));
    let errors_clone = Arc::clone(&errors);

    peer.on_error(move |e| {
        let errs = Arc::clone(&errors_clone);
        async move {
            errs.lock().unwrap().push(e);
        }
    })
    .await;

    assert!(errors.lock().unwrap().is_empty());
}

// ---------------------------------------------------------------------------
// Multiple peers can be created independently
// ---------------------------------------------------------------------------

#[tokio::test]
async fn multiple_peers_are_independent() {
    let peer_a = Peer::new(PeerConfig {
        signal_base: "http://signal-a:9000".to_string(),
        ..PeerConfig::default()
    });
    let peer_b = Peer::new(PeerConfig {
        signal_base: "http://signal-b:9000".to_string(),
        ..PeerConfig::default()
    });

    // Both can have different handlers without interfering with each other
    let flag_a = Arc::new(Mutex::new(false));
    let flag_b = Arc::new(Mutex::new(false));

    let fa = Arc::clone(&flag_a);
    peer_a.on_close(move || { let f = Arc::clone(&fa); async move { *f.lock().unwrap() = true; } }).await;

    let fb = Arc::clone(&flag_b);
    peer_b.on_close(move || { let f = Arc::clone(&fb); async move { *f.lock().unwrap() = true; } }).await;

    // send() on both returns the same "not open" error
    assert!(peer_a.send("x").await.is_err());
    assert!(peer_b.send("x").await.is_err());
}

// ---------------------------------------------------------------------------
// connect() times out quickly with an unreachable signal server
// (only runs when INTEGRATION env-var is NOT set to avoid CI hangs)
// ---------------------------------------------------------------------------

#[tokio::test]
async fn connect_fails_fast_with_unreachable_signal_server() {
    if std::env::var("INTEGRATION").is_ok() {
        return;
    }

    let peer = Peer::new(PeerConfig {
        signal_base: "http://127.0.0.1:1".to_string(),
        poll_timeout_secs: 2,
        poll_interval_ms: 100,
        ice_servers: vec![],
        ..PeerConfig::default()
    });

    let result = peer.connect("test-session").await;
    assert!(result.is_err(), "connect to unreachable server should fail");
}

// ---------------------------------------------------------------------------
// Reconnect / health-check config fields
// ---------------------------------------------------------------------------

#[test]
fn default_config_has_reconnect_fields() {
    let cfg = PeerConfig::default();
    assert!(cfg.health_check_interval_ms > 0, "health_check_interval_ms should be > 0");
    assert!(cfg.health_check_timeout_ms > 0, "health_check_timeout_ms should be > 0");
    assert!(cfg.reconnect_delay_ms > 0, "reconnect_delay_ms should be > 0");
    assert_eq!(cfg.max_reconnect_attempts, 0, "default should be unlimited (0)");
}

#[test]
fn config_with_health_check_disabled() {
    let cfg = PeerConfig {
        health_check_interval_ms: 0,
        ..PeerConfig::default()
    };
    assert_eq!(cfg.health_check_interval_ms, 0);
}

#[test]
fn config_with_limited_reconnects() {
    let cfg = PeerConfig {
        max_reconnect_attempts: 3,
        reconnect_delay_ms: 500,
        ..PeerConfig::default()
    };
    assert_eq!(cfg.max_reconnect_attempts, 3);
    assert_eq!(cfg.reconnect_delay_ms, 500);
}

#[test]
fn config_reconnect_fields_are_cloneable() {
    let cfg = PeerConfig {
        health_check_interval_ms: 5_000,
        health_check_timeout_ms: 2_000,
        reconnect_delay_ms: 1_000,
        max_reconnect_attempts: 5,
        ..PeerConfig::default()
    };
    let cloned = cfg.clone();
    assert_eq!(cloned.health_check_interval_ms, cfg.health_check_interval_ms);
    assert_eq!(cloned.health_check_timeout_ms, cfg.health_check_timeout_ms);
    assert_eq!(cloned.reconnect_delay_ms, cfg.reconnect_delay_ms);
    assert_eq!(cloned.max_reconnect_attempts, cfg.max_reconnect_attempts);
}

#[tokio::test]
async fn connect_with_reconnect_exhausts_max_attempts() {
    if std::env::var("INTEGRATION").is_ok() {
        return;
    }

    let errors: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(vec![]));
    let errors_clone = Arc::clone(&errors);

    let peer = Peer::new(PeerConfig {
        signal_base: "http://127.0.0.1:1".to_string(),
        poll_timeout_secs: 1,
        poll_interval_ms: 50,
        max_reconnect_attempts: 2,
        reconnect_delay_ms: 50,
        health_check_interval_ms: 0,
        ..PeerConfig::default()
    });

    peer.on_error(move |e| {
        let errs = Arc::clone(&errors_clone);
        async move { errs.lock().unwrap().push(e); }
    })
    .await;

    peer.connect_with_reconnect("test-session").await;

    let errs = errors.lock().unwrap();
    assert!(!errs.is_empty(), "should have received at least one error");
    // Final error should mention max attempts
    let last = errs.last().unwrap();
    assert!(
        last.contains("max reconnect"),
        "last error should mention max reconnect, got: {last}"
    );
}
