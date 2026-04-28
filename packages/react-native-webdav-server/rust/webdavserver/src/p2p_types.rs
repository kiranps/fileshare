//! # P2P presentation-layer types
//!
//! Every message over the WebRTC data channel is a UTF-8 JSON string.
//!
//! ## Request envelope
//!
//! ```json
//! {
//!   "id":      "client-generated correlation id (string, required)",
//!   "op":      "<operation name>",
//!   "payload": { ...op-specific fields... }
//! }
//! ```
//!
//! `payload` is required for operations that carry parameters; it may be
//! omitted (or `null`) for operations with no parameters (e.g. `fs.options`).
//!
//! ## Response envelope
//!
//! ```json
//! {
//!   "id":     "<echoed from request>",
//!   "op":     "<echoed from request>",
//!   "ok":     true | false,
//!   "status": "<status string — see codes below>",
//!   "data":   { ...op-specific payload... }   // present when ok=true
//! }
//! ```
//!
//! **Error response:**
//! ```json
//! {
//!   "id":     "<echoed>",
//!   "op":     "<echoed>",
//!   "ok":     false,
//!   "status": "<error code>",
//!   "error":  "human readable message"
//! }
//! ```
//!
//! ## Operation names & codes
//!
//! | op            | description                                         |
//! |---------------|-----------------------------------------------------|
//! | `fs.options`  | Server capability query                             |
//! | `fs.ping`     | Health-check ping — server replies with pong        |
//! | `fs.stat`     | Metadata for a single path (depth=0 PROPFIND)       |
//! | `fs.list`     | List a directory (depth=1 PROPFIND)                 |
//! | `fs.get`      | Read a file; body returned as base64                |
//! | `fs.download` | Download a file or directory as zip; streamed in chunks|
//! | `fs.head`     | File size / mtime / etag (no body)                  |
//! | `fs.put`      | Create or update a file; body sent as base64        |
//! | `fs.delete`   | Delete a file or directory tree                     |
//! | `fs.mkdir`    | Create a directory (collection)                     |
//! | `fs.copy`     | Copy a resource to a new path                       |
//! | `fs.move`     | Move / rename a resource                            |
//!
//! ## Status codes (response `status` field)
//!
//! | status                  | meaning                                       |
//! |-------------------------|-----------------------------------------------|
//! | `ok`                    | Success                                       |
//! | `created`               | Resource was created                          |
//! | `not_found`             | Path does not exist                           |
//! | `is_directory`          | Operation not valid on a directory            |
//! | `parent_not_found`      | Parent directory does not exist               |
//! | `already_exists`        | Resource already exists (e.g. MKCOL)          |
//! | `dest_exists_no_overwrite` | Destination exists and overwrite=false     |
//! | `same_source_dest`      | Source and destination are identical          |
//! | `unsupported_depth`     | Depth value not supported                     |
//! | `body_not_supported`    | Request body not allowed for this op          |
//! | `permission_denied`     | Filesystem permission error                   |
//! | `insufficient_storage`  | Filesystem full                               |
//! | `io_error`              | Unexpected I/O failure                        |
//! | `parse_error`           | Incoming message could not be parsed          |
//! | `unknown_op`            | `op` field is not recognised                  |

use serde::{Deserialize, Serialize};
use tokio_util::bytes;

// ---------------------------------------------------------------------------
// Payload types (one per operation that carries parameters)
// ---------------------------------------------------------------------------

/// Payload for `fs.ping`.
#[derive(Debug, Deserialize, Default)]
pub struct PingPayload {
    pub payload: Option<String>,
}

/// Payload for `fs.stat`, `fs.list`, `fs.get`, `fs.get_zip`, `fs.head`,
/// `fs.delete`, `fs.mkdir` — operations that only need a single `path`.
#[derive(Debug, Deserialize)]
pub struct PathPayload {
    pub path: String,
}

/// Payload for `fs.put`.
#[derive(Debug, Deserialize)]
pub struct PutPayload {
    pub path: String,
    pub body_b64: String,
}

/// Payload for `fs.copy`.
#[derive(Debug, Deserialize)]
pub struct CopyPayload {
    pub src: String,
    pub dst: String,
    #[serde(default = "default_true")]
    pub overwrite: bool,
    #[serde(default = "default_depth")]
    pub depth: String,
}

/// Payload for `fs.move`.
#[derive(Debug, Deserialize)]
pub struct MovePayload {
    pub src: String,
    pub dst: String,
    #[serde(default = "default_true")]
    pub overwrite: bool,
}

fn default_true() -> bool {
    true
}
fn default_depth() -> String {
    "infinity".to_string()
}

// ---------------------------------------------------------------------------
// Request envelope
// ---------------------------------------------------------------------------

/// Raw envelope — deserialise first to extract `id` and `op`, then parse
/// `payload` based on `op`.
#[derive(Debug, Deserialize)]
struct RawRequest {
    pub id: String,
    pub op: String,
    #[serde(default)]
    pub payload: Option<serde_json::Value>,
}

/// Top-level inbound message. Deserialise with `P2pRequest::from_str`.
#[derive(Debug)]
pub enum P2pRequest {
    /// `fs.options` — no payload.
    Options { id: String },

    /// `fs.ping` — health-check; echoes the optional `payload` string.
    Ping { id: String, payload: PingPayload },

    /// `fs.stat` — depth-0 metadata for a single path.
    Stat { id: String, payload: PathPayload },

    /// `fs.list` — depth-1 directory listing.
    List { id: String, payload: PathPayload },

    /// `fs.get` — read a file; returned body is base64-encoded.
    Get { id: String, payload: PathPayload },

    /// `fs.download` — stream a file or directory as a zip; chunked over a dedicated data channel.
    Download { id: String, payload: PathPayload },

    /// `fs.head` — content-length / last-modified / etag for a file.
    Head { id: String, payload: PathPayload },

    /// `fs.put` — create or replace a file.
    Put { id: String, payload: PutPayload },

    /// `fs.delete` — delete a file or directory tree.
    Delete { id: String, payload: PathPayload },

    /// `fs.mkdir` — create a collection (directory).
    Mkdir { id: String, payload: PathPayload },

    /// `fs.copy` — copy a resource.
    Copy { id: String, payload: CopyPayload },

    /// `fs.move` — move / rename a resource.
    Move { id: String, payload: MovePayload },
}

impl P2pRequest {
    /// Parse from a raw data-channel string.
    pub fn from_str(s: &str) -> Result<Self, String> {
        let raw: RawRequest = serde_json::from_str(s).map_err(|e| format!("invalid JSON: {e}"))?;

        let payload_val = raw.payload.unwrap_or(serde_json::Value::Null);

        let parse_payload = |v: serde_json::Value| -> Result<serde_json::Value, String> { Ok(v) };
        let _ = parse_payload; // suppress unused warning

        fn parse<T: serde::de::DeserializeOwned>(v: serde_json::Value) -> Result<T, String> {
            serde_json::from_value(v).map_err(|e| format!("invalid payload: {e}"))
        }

        let req = match raw.op.as_str() {
            "fs.options" => P2pRequest::Options { id: raw.id },
            "fs.ping" => {
                let p: PingPayload = if payload_val.is_null() {
                    PingPayload::default()
                } else {
                    parse(payload_val)?
                };
                P2pRequest::Ping {
                    id: raw.id,
                    payload: p,
                }
            }
            "fs.stat" => P2pRequest::Stat {
                id: raw.id,
                payload: parse(payload_val)?,
            },
            "fs.list" => P2pRequest::List {
                id: raw.id,
                payload: parse(payload_val)?,
            },
            "fs.get" => P2pRequest::Get {
                id: raw.id,
                payload: parse(payload_val)?,
            },
            "fs.download" => P2pRequest::Download {
                id: raw.id,
                payload: parse(payload_val)?,
            },
            "fs.head" => P2pRequest::Head {
                id: raw.id,
                payload: parse(payload_val)?,
            },
            "fs.put" => P2pRequest::Put {
                id: raw.id,
                payload: parse(payload_val)?,
            },
            "fs.delete" => P2pRequest::Delete {
                id: raw.id,
                payload: parse(payload_val)?,
            },
            "fs.mkdir" => P2pRequest::Mkdir {
                id: raw.id,
                payload: parse(payload_val)?,
            },
            "fs.copy" => P2pRequest::Copy {
                id: raw.id,
                payload: parse(payload_val)?,
            },
            "fs.move" => P2pRequest::Move {
                id: raw.id,
                payload: parse(payload_val)?,
            },
            other => return Err(format!("unknown op: {other}")),
        };

        Ok(req)
    }

    /// Return the correlation `id` regardless of variant.
    pub fn id(&self) -> &str {
        match self {
            P2pRequest::Options { id }
            | P2pRequest::Ping { id, .. }
            | P2pRequest::Stat { id, .. }
            | P2pRequest::List { id, .. }
            | P2pRequest::Get { id, .. }
            | P2pRequest::Download { id, .. }
            | P2pRequest::Head { id, .. }
            | P2pRequest::Put { id, .. }
            | P2pRequest::Delete { id, .. }
            | P2pRequest::Mkdir { id, .. }
            | P2pRequest::Copy { id, .. }
            | P2pRequest::Move { id, .. } => id.as_str(),
        }
    }

    /// Return the `op` string for the variant.
    pub fn op(&self) -> &'static str {
        match self {
            P2pRequest::Options { .. } => "fs.options",
            P2pRequest::Ping { .. } => "fs.ping",
            P2pRequest::Stat { .. } => "fs.stat",
            P2pRequest::List { .. } => "fs.list",
            P2pRequest::Get { .. } => "fs.get",
            P2pRequest::Download { .. } => "fs.download",
            P2pRequest::Head { .. } => "fs.head",
            P2pRequest::Put { .. } => "fs.put",
            P2pRequest::Delete { .. } => "fs.delete",
            P2pRequest::Mkdir { .. } => "fs.mkdir",
            P2pRequest::Copy { .. } => "fs.copy",
            P2pRequest::Move { .. } => "fs.move",
        }
    }
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

/// Serialise with `serde_json::to_string`.
#[derive(Debug, Serialize)]
pub struct P2pResponse {
    /// Echoed from the request.
    pub id: String,
    /// Echoed op name.
    pub op: &'static str,
    /// `true` on success, `false` on any error.
    pub ok: bool,
    /// Machine-readable status string.
    pub status: &'static str,
    /// Present on success; shape depends on `op`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
    /// Present on failure — human-readable description.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl P2pResponse {
    pub fn ok(
        id: impl Into<String>,
        op: &'static str,
        status: &'static str,
        data: serde_json::Value,
    ) -> Self {
        Self {
            id: id.into(),
            op,
            ok: true,
            status,
            data: Some(data),
            error: None,
        }
    }

    pub fn err(
        id: impl Into<String>,
        op: &'static str,
        status: &'static str,
        msg: impl Into<String>,
    ) -> Self {
        Self {
            id: id.into(),
            op,
            ok: false,
            status,
            data: None,
            error: Some(msg.into()),
        }
    }

    pub fn to_json(&self) -> String {
        serde_json::to_string(self).unwrap_or_else(|e| {
            format!(r#"{{"id":"","op":"internal","ok":false,"status":"io_error","error":"{e}"}}"#)
        })
    }
}

// ---------------------------------------------------------------------------
// Response data shapes (used by the handler to build `data`)
// ---------------------------------------------------------------------------

/// `fs.options` data
#[derive(Serialize)]
pub struct OptionsData {
    pub dav: &'static str,
    pub ops: Vec<&'static str>,
}

/// `fs.stat` / `fs.list` entry
#[derive(Serialize)]
pub struct EntryInfo {
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    /// RFC 2822 / HTTP date string
    pub last_modified: String,
    pub etag: String,
}

/// `fs.head` data
#[derive(Serialize)]
pub struct HeadData {
    pub content_length: u64,
    /// RFC 2822 / HTTP date string
    pub last_modified: String,
    pub etag: String,
}

/// `fs.get` / `fs.get_zip` data
#[derive(Serialize)]
pub struct GetData {
    pub filename: String,
    /// Base64-encoded file (or zip) content
    pub body_b64: String,
    pub content_length: u64,
}

// ---------------------------------------------------------------------------
// Handle result — returned by p2p_handler::handle()
// ---------------------------------------------------------------------------

// Returned by [`crate::p2p_handler::handle`].
//
// - `Json`   — a complete JSON response string; send it directly over the
//              control data channel.
// - `Stream` — a streaming download.  All frames (HEADER, CHUNK, EOF, ERROR)
//              are sent on the dedicated file data channel using the binary
//              framing protocol:
//
//              `[ 1 byte: frame_type ][ 36 bytes: ASCII UUID ][ N bytes: payload ]`
//
//              frame_type values:
//              - `0x01` HEADER — payload is UTF-8 JSON `{ filename, total_size }`
//              - `0x02` CHUNK  — payload is raw binary file bytes
//              - `0x03` EOF    — payload empty; transfer complete
//              - `0x04` ERROR  — payload is UTF-8 error message
pub enum P2pHandleResult {
    /// A complete serialised [`P2pResponse`] ready to send.
    Json(String),

    /// A streaming download.  The caller must send all frames on the file
    /// data channel using the binary framing protocol described above.
    Stream {
        /// Correlation id (UUID) echoed from the request.  Used as the 36-byte
        /// id field in every binary frame so the client can demux concurrent
        /// downloads.
        req_id: String,
        /// Serialised [`DownloadHeader`] JSON to embed in the HEADER frame
        /// payload (`{ filename, total_size }`).
        header_payload_json: String,
        /// The byte stream to pump as CHUNK frames.
        stream: Box<
            dyn futures_util::Stream<Item = Result<bytes::Bytes, std::io::Error>> + Send + Unpin,
        >,
    },
}

/// Metadata header sent as the HEADER frame payload on the file data channel.
#[derive(Serialize)]
pub struct DownloadHeader {
    pub filename: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_size: Option<u64>,
}
