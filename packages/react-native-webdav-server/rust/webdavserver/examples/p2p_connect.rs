//! # p2p_connect — example: establish a P2P connection backed by p2p_handler
//!
//! This example shows how to wire [`Peer`] together with the P2P handler via
//! [`webdavserver::p2p_connect::run`], which handles both JSON responses and
//! streaming downloads (with WebRTC `bufferedAmount` back-pressure).
//!
//! ## Running
//!
//! You need a running HTTP signalling server at `http://localhost:9000` (or the
//! URL you pass via `--signal`).  The initiator side (e.g. a browser using
//! PeerJS) posts an SDP offer to `POST /session/<id>/offer`; this binary polls
//! for it, answers, and then handles file-system requests over the data channel.
//!
//! ```sh
//! cargo run --example p2p_connect -- --session my-session-id --base /tmp/files
//! ```
//!
//! Optional flags (all have defaults):
//! - `--session <id>`   session id to connect to (default: `demo-session`)
//! - `--base <path>`    filesystem root to serve (default: `/tmp/p2p_files`)
//! - `--signal <url>`   signalling server base URL (default: `http://localhost:9000`)

use std::path::PathBuf;
use std::sync::Arc;

use rustls::crypto::CryptoProvider;
use webdavserver::p2p_connect;
use webdavserver::peer::{Peer, PeerConfig};

#[tokio::main]
async fn main() {
    //CryptoProvider::install_default(rustls::crypto::aws_lc_rs::default_provider())
    //.expect("crypto init failed");
    let _ = CryptoProvider::install_default(rustls::crypto::ring::default_provider());
    //.expect("crypto init failed");
    // ── Parse minimal CLI args ────────────────────────────────────────────────
    let args: Vec<String> = std::env::args().collect();

    let session_id = flag_value(&args, "--session").unwrap_or_else(|| "demo-session".to_string());
    let base_path =
        PathBuf::from(flag_value(&args, "--base").unwrap_or_else(|| "/home/kiran".to_string()));
    let signal_base =
        flag_value(&args, "--signal").unwrap_or_else(|| "http://localhost:9000".to_string());
    //let signal_base = flag_value(&args, "--signal").unwrap_or_else(|| {
    //"https://vhlkksm25fy4nvj3zz4ruoao7i0ewjoa.lambda-url.ap-south-1.on.aws/".to_string()
    //});

    // ── Ensure the base directory exists ─────────────────────────────────────
    std::fs::create_dir_all(&base_path).expect("could not create base directory");

    println!("[p2p_connect] session  : {session_id}");
    println!("[p2p_connect] base path: {}", base_path.display());
    println!("[p2p_connect] signal   : {signal_base}");
    println!("[p2p_connect] press Ctrl-C to exit");

    // ── Build peer ────────────────────────────────────────────────────────────
    let peer = Peer::new(PeerConfig {
        signal_base,
        ..PeerConfig::default()
    });

    peer.on_open(|_peer| async move {
        println!("[p2p_connect] ✅ data channel open — ready to serve files");
    })
    .await;

    peer.on_close(|| async move {
        println!("[p2p_connect] 🔴 data channel closed");
    })
    .await;

    peer.on_error(|err| async move {
        eprintln!("[p2p_connect] ⚠️  error: {err}");
    })
    .await;

    // ── Connect (runs until Ctrl-C) ───────────────────────────────────────────
    println!("[p2p_connect] ⏳ connecting to session '{session_id}'…");
    tokio::select! {
        // `p2p_connect::run` registers on_data and calls peer.connect internally.
        _ = p2p_connect::run(Arc::clone(&peer), &session_id, base_path) => {
            println!("[p2p_connect] done");
        }
        _ = tokio::signal::ctrl_c() => {
            println!("[p2p_connect] 🛑 Ctrl-C received — exiting");
        }
    }
}

// ---------------------------------------------------------------------------
// Minimal CLI helper
// ---------------------------------------------------------------------------

/// Return the value that follows `flag` in `args`, or `None`.
fn flag_value(args: &[String], flag: &str) -> Option<String> {
    args.windows(2).find(|w| w[0] == flag).map(|w| w[1].clone())
}
