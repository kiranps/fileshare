////! # P2P presentation layer — request dispatcher
////!
////! Call [`handle`] from your `peer.on_data` callback.  It deserialises the
////! incoming JSON message, delegates to [`WebDavService`], and returns a
////! [`P2pHandleResult`] which is either a complete JSON string or a byte stream.
////!
////! ## Usage
////!
////! ```rust,no_run
////! use std::path::PathBuf;
////! use std::sync::Arc;
////! use crate::peer::{Peer, PeerConfig};
////! use crate::p2p_handler::handle;
////! use crate::p2p_types::P2pHandleResult;
////!
////! #[tokio::main]
////! async fn main() {
////!     let base_path = PathBuf::from("/srv/files");
////!     let peer = Peer::new(PeerConfig::default());
////!
////!     peer.on_data(move |msg, peer| {
////!         let bp = base_path.clone();
////!         Box::pin(async move {
////!             match handle(&msg, &bp).await {
////!                 P2pHandleResult::Json(json) => {
////!                     if let Err(e) = peer.send(&json).await {
////!                         eprintln!("[p2p] send error: {e}");
////!                     }
////!                 }
////!                 P2pHandleResult::Stream { header_json, stream } => {
////!                     // send header on control channel, then stream chunks
////!                 }
////!             }
////!         })
////!     })
////!     .await;
////!
////!     peer.connect("my-session-id").await;
////! }
////! ```

use std::path::PathBuf;

use crate::helpers::file_timestamps;
use crate::p2p_types::{
    DownloadHeader, EntryInfo, GetData, HeadData, OptionsData, P2pHandleResult, P2pRequest,
    P2pResponse,
};
use crate::webdav_service::{
    CopyMoveResult, DeleteResult, GetFileResult, GetResult, HeadOutcome, MkcolResult,
    PropfindResult, PutResult, WebDavService,
};
use axum::body::Bytes;
use base64::{Engine, engine::general_purpose::STANDARD as BASE64};
use futures_util::StreamExt;
use serde_json::json;

/// Entry point: parse `msg`, dispatch to service, return a [`P2pHandleResult`].
///
/// Most operations return `P2pHandleResult::Json` — a complete serialised
/// response ready to be sent on the control data channel.
///
/// `fs.download` returns `P2pHandleResult::Stream`; the caller must send the
/// `header_json` on the control channel and then pump the stream as binary
/// chunks on the dedicated file data channel with WebRTC `bufferedAmount`
/// back-pressure.
pub async fn handle(msg: &str, base_path: &PathBuf) -> P2pHandleResult {
    // ── Parse ─────────────────────────────────────────────────────────────────
    let req = match P2pRequest::from_str(msg) {
        Ok(r) => r,
        Err(e) => {
            return P2pHandleResult::Json(
                P2pResponse::err("", "unknown", "parse_error", e).to_json(),
            );
        }
    };

    let id = req.id().to_string();
    let op = req.op();

    // Convenience: wrap a complete JSON string in the Json variant.
    macro_rules! j {
        ($expr:expr) => {
            P2pHandleResult::Json($expr)
        };
    }

    // ── Dispatch ──────────────────────────────────────────────────────────────
    match req {
        // -------------------------------------------------------------------
        // fs.options
        // -------------------------------------------------------------------
        P2pRequest::Options { .. } => {
            let data = OptionsData {
                dav: "1",
                ops: vec![
                    "fs.options",
                    "fs.ping",
                    "fs.stat",
                    "fs.list",
                    "fs.get",
                    "fs.download",
                    "fs.head",
                    "fs.put",
                    "fs.delete",
                    "fs.mkdir",
                    "fs.copy",
                    "fs.move",
                ],
            };
            j!(P2pResponse::ok(id, op, "ok", json!(data)).to_json())
        }

        // -------------------------------------------------------------------
        // fs.ping  — health-check / keep-alive
        // -------------------------------------------------------------------
        P2pRequest::Ping { id, .. } => {
            j!(P2pResponse::ok(id, op, "pong", "pong".into()).to_json())
        }

        // -------------------------------------------------------------------
        // fs.stat  (depth=0)
        // -------------------------------------------------------------------
        P2pRequest::Stat { id, payload } => {
            let path = payload.path;
            let abs = resolve(base_path, &path);
            j!(match WebDavService::propfind(abs, &path, "0").await {
                PropfindResult::Ok(entries) => {
                    let entry = entry_info_from_propfind(&entries[0].href, &entries[0].metadata);
                    P2pResponse::ok(id, op, "ok", json!(entry)).to_json()
                }
                PropfindResult::NotFound => {
                    P2pResponse::err(id, op, "not_found", format!("path not found: {path}"))
                        .to_json()
                }
                PropfindResult::UnsupportedDepth => {
                    P2pResponse::err(id, op, "unsupported_depth", "depth not supported").to_json()
                }
            })
        }

        // -------------------------------------------------------------------
        // fs.list  (depth=1)
        // -------------------------------------------------------------------
        P2pRequest::List { id, payload } => {
            let path = payload.path;
            let abs = resolve(base_path, &path);
            j!(match WebDavService::propfind(abs, &path, "1").await {
                PropfindResult::Ok(entries) => {
                    let list: Vec<EntryInfo> = entries
                        .iter()
                        .map(|e| entry_info_from_propfind(&e.href, &e.metadata))
                        .collect();
                    P2pResponse::ok(id, op, "ok", json!(list)).to_json()
                }
                PropfindResult::NotFound => {
                    P2pResponse::err(id, op, "not_found", format!("path not found: {path}"))
                        .to_json()
                }
                PropfindResult::UnsupportedDepth => {
                    P2pResponse::err(id, op, "unsupported_depth", "depth not supported").to_json()
                }
            })
        }

        // -------------------------------------------------------------------
        // fs.get
        // -------------------------------------------------------------------
        P2pRequest::Get { id, payload } => {
            let path = payload.path;
            let abs = resolve(base_path, &path);
            j!(match WebDavService::get(abs, false).await {
                GetResult::File(GetFileResult::Stream {
                    content_length,
                    stream,
                }) => match stream_to_bytes(stream).await {
                    Ok(bytes) => {
                        let filename = filename_from_path(&path);
                        let data = GetData {
                            filename,
                            body_b64: BASE64.encode(&bytes),
                            content_length,
                        };
                        P2pResponse::ok(id, op, "ok", json!(data)).to_json()
                    }
                    Err(e) => P2pResponse::err(id, op, "io_error", e).to_json(),
                },
                GetResult::File(GetFileResult::Download { .. }) => {
                    // unreachable with want_download=false, but handle defensively
                    P2pResponse::err(id, op, "io_error", "unexpected download result").to_json()
                }
                GetResult::IsDirectory => P2pResponse::err(
                    id,
                    op,
                    "is_directory",
                    "use fs.download to download a directory",
                )
                .to_json(),
                GetResult::ZipStream { .. } => P2pResponse::err(
                    id,
                    op,
                    "is_directory",
                    "use fs.download to download a directory",
                )
                .to_json(),
                GetResult::NotFound => {
                    P2pResponse::err(id, op, "not_found", format!("path not found: {path}"))
                        .to_json()
                }
            })
        }

        // -------------------------------------------------------------------
        // fs.download — stream a file or directory zip over a dedicated DC
        // -------------------------------------------------------------------
        P2pRequest::Download { id, payload } => {
            let path = payload.path;
            let abs = resolve(base_path, &path);
            match WebDavService::get(abs, true).await {
                GetResult::ZipStream { filename, stream } => {
                    // Convert ReaderStream<impl AsyncRead> to Stream<Item=Result<Bytes, io::Error>>
                    let byte_stream = stream.map(|r| {
                        r.map(|b| Bytes::from(b.to_vec()))
                            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))
                    });
                    let header = DownloadHeader {
                        filename,
                        total_size: None, // zip size unknown until fully generated
                    };
                    P2pHandleResult::Stream {
                        req_id: id,
                        header_payload_json: serde_json::to_string(&header)
                            .unwrap_or_else(|_| "{}".to_string()),
                        stream: Box::new(byte_stream),
                    }
                }
                GetResult::File(GetFileResult::Download {
                    content_length,
                    filename,
                    stream,
                }) => {
                    // Single-file download
                    let byte_stream = stream.map(|r| {
                        r.map(|b| Bytes::from(b.to_vec()))
                            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))
                    });
                    let header = DownloadHeader {
                        filename,
                        total_size: Some(content_length),
                    };
                    P2pHandleResult::Stream {
                        req_id: id,
                        header_payload_json: serde_json::to_string(&header)
                            .unwrap_or_else(|_| "{}".to_string()),
                        stream: Box::new(byte_stream),
                    }
                }
                GetResult::File(GetFileResult::Stream { .. }) => {
                    j!(P2pResponse::err(id, op, "io_error", "unexpected stream result").to_json())
                }
                GetResult::IsDirectory => {
                    j!(
                        P2pResponse::err(id, op, "is_directory", "cannot zip — check path")
                            .to_json()
                    )
                }
                GetResult::NotFound => {
                    j!(
                        P2pResponse::err(id, op, "not_found", format!("path not found: {path}"))
                            .to_json()
                    )
                }
            }
        }

        // -------------------------------------------------------------------
        // fs.head
        // -------------------------------------------------------------------
        P2pRequest::Head { id, payload } => {
            let path = payload.path;
            let abs = resolve(base_path, &path);
            j!(match WebDavService::head(abs).await {
                HeadOutcome::Ok(r) => {
                    let data = HeadData {
                        content_length: r.content_length,
                        last_modified: httpdate::fmt_http_date(r.last_modified),
                        etag: r.etag,
                    };
                    P2pResponse::ok(id, op, "ok", json!(data)).to_json()
                }
                HeadOutcome::IsDirectory => {
                    P2pResponse::err(id, op, "is_directory", "use fs.stat for directory metadata")
                        .to_json()
                }
                HeadOutcome::NotFound => {
                    P2pResponse::err(id, op, "not_found", format!("path not found: {path}"))
                        .to_json()
                }
            })
        }

        // -------------------------------------------------------------------
        // fs.put
        // -------------------------------------------------------------------
        P2pRequest::Put { id, payload } => {
            let body_bytes = match BASE64.decode(&payload.body_b64) {
                Ok(b) => b,
                Err(e) => {
                    return j!(P2pResponse::err(
                        id,
                        op,
                        "parse_error",
                        format!("invalid base64: {e}")
                    )
                    .to_json());
                }
            };
            let abs = resolve(base_path, &payload.path);
            j!(match WebDavService::put(abs, &body_bytes).await {
                PutResult::Created => P2pResponse::ok(id, op, "created", json!({})).to_json(),
                PutResult::Updated => P2pResponse::ok(id, op, "ok", json!({})).to_json(),
                PutResult::IsDirectory => {
                    P2pResponse::err(id, op, "is_directory", "cannot PUT to a directory").to_json()
                }
                PutResult::ParentNotFound | PutResult::ParentNotDirectory => P2pResponse::err(
                    id,
                    op,
                    "parent_not_found",
                    "parent directory does not exist",
                )
                .to_json(),
                PutResult::InvalidPath => {
                    P2pResponse::err(id, op, "io_error", "invalid path").to_json()
                }
                PutResult::PermissionDenied => {
                    P2pResponse::err(id, op, "permission_denied", "permission denied").to_json()
                }
                PutResult::IoError => {
                    P2pResponse::err(id, op, "io_error", "I/O error writing file").to_json()
                }
            })
        }

        // -------------------------------------------------------------------
        // fs.delete
        // -------------------------------------------------------------------
        P2pRequest::Delete { id, payload } => {
            let path = payload.path;
            let abs = resolve(base_path, &path);
            j!(match WebDavService::delete(abs).await {
                DeleteResult::Deleted => P2pResponse::ok(id, op, "ok", json!({})).to_json(),
                DeleteResult::NotFound => {
                    P2pResponse::err(id, op, "not_found", format!("path not found: {path}"))
                        .to_json()
                }
                DeleteResult::PermissionDenied => {
                    P2pResponse::err(id, op, "permission_denied", "permission denied").to_json()
                }
                DeleteResult::IoError => {
                    P2pResponse::err(id, op, "io_error", "I/O error during delete").to_json()
                }
            })
        }

        // -------------------------------------------------------------------
        // fs.mkdir
        // -------------------------------------------------------------------
        P2pRequest::Mkdir { id, payload } => {
            let path = payload.path;
            let abs = resolve(base_path, &path);
            j!(match WebDavService::mkcol(abs, 0).await {
                MkcolResult::Created => P2pResponse::ok(id, op, "created", json!({})).to_json(),
                MkcolResult::AlreadyExists => {
                    P2pResponse::err(id, op, "already_exists", "directory already exists").to_json()
                }
                MkcolResult::ParentNotFound | MkcolResult::ParentNotDirectory => P2pResponse::err(
                    id,
                    op,
                    "parent_not_found",
                    "parent directory does not exist",
                )
                .to_json(),
                MkcolResult::InvalidPath => {
                    P2pResponse::err(id, op, "io_error", "invalid path").to_json()
                }
                MkcolResult::BodyNotSupported => {
                    P2pResponse::err(id, op, "body_not_supported", "body not allowed").to_json()
                }
                MkcolResult::PermissionDenied => {
                    P2pResponse::err(id, op, "permission_denied", "permission denied").to_json()
                }
                MkcolResult::InsufficientStorage => {
                    P2pResponse::err(id, op, "insufficient_storage", "filesystem full").to_json()
                }
                MkcolResult::IoError => {
                    P2pResponse::err(id, op, "io_error", "I/O error creating directory").to_json()
                }
            })
        }

        // -------------------------------------------------------------------
        // fs.copy
        // -------------------------------------------------------------------
        P2pRequest::Copy { id, payload } => {
            let abs_src = resolve(base_path, &payload.src);
            let abs_dst = resolve(base_path, &payload.dst);
            let src = payload.src.clone();
            j!(
                match WebDavService::copy(abs_src, abs_dst, payload.overwrite, &payload.depth).await
                {
                    CopyMoveResult::Created =>
                        P2pResponse::ok(id, op, "created", json!({})).to_json(),
                    CopyMoveResult::Replaced => P2pResponse::ok(id, op, "ok", json!({})).to_json(),
                    CopyMoveResult::SameSourceDest => P2pResponse::err(
                        id,
                        op,
                        "same_source_dest",
                        "source and destination are the same",
                    )
                    .to_json(),
                    CopyMoveResult::SourceNotFound => {
                        P2pResponse::err(id, op, "not_found", format!("source not found: {src}"))
                            .to_json()
                    }
                    CopyMoveResult::DestExistsNoOverwrite => P2pResponse::err(
                        id,
                        op,
                        "dest_exists_no_overwrite",
                        "destination exists and overwrite is false",
                    )
                    .to_json(),
                    CopyMoveResult::ParentNotFound => P2pResponse::err(
                        id,
                        op,
                        "parent_not_found",
                        "destination parent does not exist",
                    )
                    .to_json(),
                    CopyMoveResult::PermissionDenied => {
                        P2pResponse::err(id, op, "permission_denied", "permission denied").to_json()
                    }
                    CopyMoveResult::IoError => {
                        P2pResponse::err(id, op, "io_error", "I/O error during copy").to_json()
                    }
                }
            )
        }

        // -------------------------------------------------------------------
        // fs.move
        // -------------------------------------------------------------------
        P2pRequest::Move { id, payload } => {
            let abs_src = resolve(base_path, &payload.src);
            let abs_dst = resolve(base_path, &payload.dst);
            let src = payload.src.clone();
            j!(
                match WebDavService::move_resource(abs_src, abs_dst, payload.overwrite).await {
                    CopyMoveResult::Created =>
                        P2pResponse::ok(id, op, "created", json!({})).to_json(),
                    CopyMoveResult::Replaced => P2pResponse::ok(id, op, "ok", json!({})).to_json(),
                    CopyMoveResult::SameSourceDest => P2pResponse::err(
                        id,
                        op,
                        "same_source_dest",
                        "source and destination are the same",
                    )
                    .to_json(),
                    CopyMoveResult::SourceNotFound => {
                        P2pResponse::err(id, op, "not_found", format!("source not found: {src}"))
                            .to_json()
                    }
                    CopyMoveResult::DestExistsNoOverwrite => P2pResponse::err(
                        id,
                        op,
                        "dest_exists_no_overwrite",
                        "destination exists and overwrite is false",
                    )
                    .to_json(),
                    CopyMoveResult::ParentNotFound => P2pResponse::err(
                        id,
                        op,
                        "parent_not_found",
                        "destination parent does not exist",
                    )
                    .to_json(),
                    CopyMoveResult::PermissionDenied => {
                        P2pResponse::err(id, op, "permission_denied", "permission denied").to_json()
                    }
                    CopyMoveResult::IoError => {
                        P2pResponse::err(id, op, "io_error", "I/O error during move").to_json()
                    }
                }
            )
        }
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Resolve a relative request path against the server base path.
fn resolve(base: &PathBuf, req_path: &str) -> PathBuf {
    base.join(req_path.trim_start_matches('/'))
}

fn filename_from_path(path: &str) -> String {
    std::path::Path::new(path)
        .file_name()
        .and_then(|f| f.to_str())
        .unwrap_or("download")
        .to_string()
}

fn entry_info_from_propfind(href: &str, meta: &std::fs::Metadata) -> EntryInfo {
    let (modified, etag) = file_timestamps(meta);
    EntryInfo {
        path: href.to_string(),
        is_dir: meta.is_dir(),
        size: if meta.is_dir() { 0 } else { meta.len() },
        last_modified: httpdate::fmt_http_date(modified),
        etag,
    }
}

/// Drain a `ReaderStream` into a `Vec<u8>`.
async fn stream_to_bytes<R: tokio::io::AsyncRead + Unpin>(
    mut stream: tokio_util::io::ReaderStream<R>,
) -> Result<Vec<u8>, String> {
    let mut buf = Vec::new();
    while let Some(chunk) = stream.next().await {
        match chunk {
            Ok(b) => buf.extend_from_slice(&b),
            Err(e) => return Err(e.to_string()),
        }
    }
    Ok(buf)
}
