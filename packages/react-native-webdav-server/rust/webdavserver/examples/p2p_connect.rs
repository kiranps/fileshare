//! # p2p_connect — example: establish a P2P connection backed by p2p_handler
//!
//! This example shows how to wire [`Peer`] together with [`p2p_handler::handle`]
//! so that every WebRTC data-channel message is dispatched to the filesystem
//! handler and the response is sent back automatically.
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

use webdavserver::p2p_handler::handle;
use webdavserver::peer::{Peer, PeerConfig};

#[tokio::main]
async fn main() {
    // ── Parse minimal CLI args ────────────────────────────────────────────────
    let args: Vec<String> = std::env::args().collect();

    let session_id = flag_value(&args, "--session").unwrap_or_else(|| "demo-session".to_string());
    let base_path = PathBuf::from(
        flag_value(&args, "--base").unwrap_or_else(|| "/tmp/p2p_files".to_string()),
    );
    let signal_base =
        flag_value(&args, "--signal").unwrap_or_else(|| "http://localhost:9000".to_string());

    // ── Ensure the base directory exists ─────────────────────────────────────
    std::fs::create_dir_all(&base_path).expect("could not create base directory");

    println!("[p2p_connect] session  : {session_id}");
    println!("[p2p_connect] base path: {}", base_path.display());
    println!("[p2p_connect] signal   : {signal_base}");

    // ── Build peer ────────────────────────────────────────────────────────────
    let peer = Peer::new(PeerConfig {
        signal_base,
        ..PeerConfig::default()
    });

    // ── Register handlers ─────────────────────────────────────────────────────

    peer.on_open(|_peer| async move {
        println!("[p2p_connect] ✅ data channel open — ready to serve files");
    })
    .await;

    let bp = base_path.clone();
    peer.on_data(move |msg, peer| {
        let base = bp.clone();
        async move {
            println!("[p2p_connect] ← {}", &msg[..msg.len().min(120)]);

            // Dispatch to the p2p_handler; it returns a ready-to-send JSON string.
            let response = handle(&msg, &base).await;

            println!("[p2p_connect] → {}", &response[..response.len().min(120)]);

            if let Err(e) = peer.send(&response).await {
                eprintln!("[p2p_connect] send error: {e}");
            }
        }
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

    // ── Connect (blocks until the data channel is established) ────────────────
    println!("[p2p_connect] ⏳ connecting to session '{session_id}'…");
    match peer.connect(&session_id).await {
        Ok(()) => {
            println!("[p2p_connect] 🤝 WebRTC handshake complete — waiting for messages");
            // Keep the process alive; in a real app you'd await a shutdown signal.
            tokio::signal::ctrl_c()
                .await
                .expect("failed to listen for ctrl-c");
            println!("[p2p_connect] shutting down");
        }
        Err(e) => {
            eprintln!("[p2p_connect] connection failed: {e}");
            std::process::exit(1);
        }
    }
}

// ---------------------------------------------------------------------------
// Minimal CLI helper
// ---------------------------------------------------------------------------

/// Return the value that follows `flag` in `args`, or `None`.
fn flag_value(args: &[String], flag: &str) -> Option<String> {
    args.windows(2)
        .find(|w| w[0] == flag)
        .map(|w| w[1].clone())
}
