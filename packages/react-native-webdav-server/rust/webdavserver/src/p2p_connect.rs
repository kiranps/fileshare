//! # P2P connection glue
//!
//! [`run`] wires a [`Peer`] to the [`p2p_handler`]:
//!
//! - On every control-channel message it calls [`handle`] and dispatches the
//!   result:
//!   - `P2pHandleResult::Json` → sent back on the control channel.
//!   - `P2pHandleResult::Stream` → all frames are sent on the file data
//!     channel using the binary framing protocol below.
//!
//! ## Binary framing protocol (file data channel)
//!
//! Every message on the `"file"` RTCDataChannel is a raw `ArrayBuffer`:
//!
//! ```text
//! [ 1 byte: frame_type ][ 36 bytes: ASCII UUID (correlation id) ][ N bytes: payload ]
//! ```
//!
//! | frame_type | hex  | payload                                          |
//! |------------|------|--------------------------------------------------|
//! | HEADER     | 0x01 | UTF-8 JSON `{ "filename": "…", "total_size": N }` |
//! | CHUNK      | 0x02 | Raw binary file bytes (up to `CHUNK_SIZE`)        |
//! | EOF        | 0x03 | Empty                                            |
//! | ERROR      | 0x04 | UTF-8 error message string                       |
//!
//! The correlation id matches the RPC request `id` so concurrent downloads
//! are demuxed to the right `ReadableStream` on the client.
//!
//! ## Back-pressure strategy
//!
//! The WebRTC data channel exposes a `bufferedAmount` counter that tracks how
//! many bytes have been queued but not yet sent.  When this exceeds
//! `BUFFER_HIGH_WATER` we stop reading from the stream and poll until it
//! drops below `BUFFER_LOW_WATER`.  This prevents unbounded memory growth
//! when the remote peer is slower than the filesystem.

use std::{path::PathBuf, sync::Arc, time::Duration};
use tracing::info;

use futures_util::StreamExt;
use tokio::time::sleep;
use tokio_util::bytes;

use crate::{p2p_handler::handle, p2p_types::P2pHandleResult, peer::Peer};

// ── Frame type bytes ──────────────────────────────────────────────────────────
const FRAME_HEADER: u8 = 0x01;
const FRAME_CHUNK: u8 = 0x02;
const FRAME_EOF: u8 = 0x03;
const FRAME_ERROR: u8 = 0x04;

/// Length of the ASCII UUID correlation id prefix in every frame.
const ID_LEN: usize = 36;

/// Maximum bytes queued in the file data channel before we pause reading.
const BUFFER_HIGH_WATER: u64 = 4 * 1024 * 1024; // 4 MiB
/// Resume reading once buffered bytes drop below this threshold.
const BUFFER_LOW_WATER: u64 = 1 * 1024 * 1024; // 1 MiB
/// Maximum bytes per binary CHUNK frame on the file data channel.
const CHUNK_SIZE: usize = 64 * 1024; // 64 KiB

/// Wire `peer` to the P2P handler using `base_path` as the filesystem root.
///
/// This function registers an `on_data` callback on `peer` and then calls
/// `peer.connect(session_id)`, blocking until the peer disconnects (or
/// exhausts reconnect attempts).
pub async fn run(peer: Arc<Peer>, session_id: &str, base_path: PathBuf) {
    let bp = Arc::new(base_path);

    peer.on_data(move |msg, peer| {
        let bp = Arc::clone(&bp);
        Box::pin(async move {
            dispatch(msg, peer, &bp).await;
        })
    })
    .await;

    peer.connect(session_id).await;
}

// ── Frame helpers ─────────────────────────────────────────────────────────────

/// Build a framed binary message: `[type_byte][id_bytes][payload]`.
///
/// `id` must be exactly [`ID_LEN`] ASCII bytes (a standard UUID string).
#[inline]
fn build_frame(frame_type: u8, id: &str, payload: &[u8]) -> Vec<u8> {
    let id_bytes = id.as_bytes();
    debug_assert_eq!(
        id_bytes.len(),
        ID_LEN,
        "correlation id must be a 36-byte UUID"
    );
    let mut frame = Vec::with_capacity(1 + ID_LEN + payload.len());
    frame.push(frame_type);
    frame.extend_from_slice(id_bytes);
    frame.extend_from_slice(payload);
    frame
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

/// Handle a single inbound control-channel message.
async fn dispatch(msg: String, peer: Arc<Peer>, base_path: &PathBuf) {
    match handle(&msg, base_path).await {
        // ── Normal JSON response ──────────────────────────────────────────────
        P2pHandleResult::Json(json) => {
            info!("[peer] response {:#?}", json);
            info!("[peer] response length {:#?}", json.len());
            if let Err(e) = peer.send(&json).await {
                eprintln!("[p2p_connect] control send error: {e}");
            }
        }

        // ── Streaming download ────────────────────────────────────────────────
        P2pHandleResult::Stream {
            req_id,
            header_payload_json,
            mut stream,
        } => {
            // 1. Send HEADER frame on the file data channel.
            //    [ 0x01 ][ 36-byte UUID ][ UTF-8 JSON payload ]
            let header_frame = build_frame(FRAME_HEADER, &req_id, header_payload_json.as_bytes());
            if let Err(e) = peer.send_binary(&header_frame).await {
                eprintln!("[p2p_connect] HEADER frame send error: {e}");
                // Send an ERROR frame so the client doesn't hang.
                let err_frame = build_frame(FRAME_ERROR, &req_id, e.as_bytes());
                let _ = peer.send_binary(&err_frame).await;
                return;
            }

            // 2. Pump binary CHUNK frames with back-pressure.
            loop {
                // Back-pressure: wait for the buffer to drain before reading more.
                loop {
                    let buffered = peer.file_buffered_amount().await;
                    if buffered < BUFFER_HIGH_WATER {
                        break;
                    }
                    sleep(Duration::from_millis(10)).await;
                }

                match stream.next().await {
                    None => {
                        // End of stream — send EOF frame.
                        // [ 0x03 ][ 36-byte UUID ][ (empty) ]
                        let eof_frame = build_frame(FRAME_EOF, &req_id, &[]);
                        if let Err(e) = peer.send_binary(&eof_frame).await {
                            eprintln!("[p2p_connect] EOF frame send error: {e}");
                        }
                        break;
                    }
                    Some(Ok(chunk)) => {
                        let chunk: bytes::Bytes = chunk;
                        // Send in sub-slices of at most CHUNK_SIZE bytes.
                        let mut offset = 0usize;
                        while offset < chunk.len() {
                            let end = (offset + CHUNK_SIZE).min(chunk.len());
                            let slice = &chunk[offset..end];

                            // Wait for low-water mark before each sub-frame.
                            loop {
                                let buffered = peer.file_buffered_amount().await;
                                if buffered < BUFFER_LOW_WATER {
                                    break;
                                }
                                sleep(Duration::from_millis(10)).await;
                            }

                            // [ 0x02 ][ 36-byte UUID ][ raw bytes ]
                            let chunk_frame = build_frame(FRAME_CHUNK, &req_id, slice);
                            if let Err(e) = peer.send_binary(&chunk_frame).await {
                                eprintln!("[p2p_connect] CHUNK frame send error: {e}");
                                let err_frame = build_frame(FRAME_ERROR, &req_id, e.as_bytes());
                                let _ = peer.send_binary(&err_frame).await;
                                return;
                            }
                            offset = end;
                        }
                    }
                    Some(Err(e)) => {
                        let e: std::io::Error = e;
                        eprintln!("[p2p_connect] stream read error: {e}");
                        // [ 0x04 ][ 36-byte UUID ][ UTF-8 error message ]
                        let err_frame = build_frame(FRAME_ERROR, &req_id, e.to_string().as_bytes());
                        let _ = peer.send_binary(&err_frame).await;
                        break;
                    }
                }
            }
        }
    }
}
