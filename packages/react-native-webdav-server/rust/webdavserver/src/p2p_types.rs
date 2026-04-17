//! # P2P presentation-layer types
//!
//! Every message over the WebRTC data channel is a UTF-8 JSON string.
//!
//! ## Request envelope
//!
//! ```json
//! {
//!   "id":  "client-generated correlation id (string, required)",
//!   "op":  "<operation name>",
//!   ...op-specific fields...
//! }
//! ```
//!
//! ## Response envelope
//!
//! ```json
//! {
//!   "id":   "<echoed from request>",
//!   "op":   "<echoed from request>",
//!   "ok":   true | false,
//!   "code": "<status string — see codes below>",
//!   "data": { ...op-specific payload... }   // present when ok=true
//!   "error": "human readable message"       // present when ok=false
//! }
//! ```
//!
//! ## Operation names & codes
//!
//! | op            | description                                         |
//! |---------------|-----------------------------------------------------|
//! | `fs.options`  | Server capability query                             |
//! | `fs.stat`     | Metadata for a single path (depth=0 PROPFIND)       |
//! | `fs.list`     | List a directory (depth=1 PROPFIND)                 |
//! | `fs.get`      | Read a file; body returned as base64                |
//! | `fs.get_zip`  | Download a directory as zip; body returned as base64|
//! | `fs.head`     | File size / mtime / etag (no body)                  |
//! | `fs.put`      | Create or update a file; body sent as base64        |
//! | `fs.delete`   | Delete a file or directory tree                     |
//! | `fs.mkdir`    | Create a directory (collection)                     |
//! | `fs.copy`     | Copy a resource to a new path                       |
//! | `fs.move`     | Move / rename a resource                            |
//!
//! ## Status codes (response `code` field)
//!
//! | code                    | meaning                                       |
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

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

/// Top-level inbound message. Deserialise with `P2pRequest::from_str`.
#[derive(Debug, Deserialize)]
#[serde(tag = "op", rename_all = "snake_case")]
pub enum P2pRequest {
    /// `fs.options` — no extra fields.
    #[serde(rename = "fs.options")]
    Options { id: String },

    /// `fs.stat` — depth-0 metadata for a single path.
    #[serde(rename = "fs.stat")]
    Stat { id: String, path: String },

    /// `fs.list` — depth-1 directory listing.
    #[serde(rename = "fs.list")]
    List { id: String, path: String },

    /// `fs.get` — read a file; returned body is base64-encoded.
    #[serde(rename = "fs.get")]
    Get { id: String, path: String },

    /// `fs.get_zip` — stream a directory as a zip; body is base64-encoded.
    #[serde(rename = "fs.get_zip")]
    GetZip { id: String, path: String },

    /// `fs.head` — content-length / last-modified / etag for a file.
    #[serde(rename = "fs.head")]
    Head { id: String, path: String },

    /// `fs.put` — create or replace a file.
    ///
    /// `body_b64` is the base64-encoded file content.
    #[serde(rename = "fs.put")]
    Put {
        id: String,
        path: String,
        body_b64: String,
    },

    /// `fs.delete` — delete a file or directory tree.
    #[serde(rename = "fs.delete")]
    Delete { id: String, path: String },

    /// `fs.mkdir` — create a collection (directory).
    #[serde(rename = "fs.mkdir")]
    Mkdir { id: String, path: String },

    /// `fs.copy` — copy a resource.
    ///
    /// `overwrite` defaults to `true`. `depth` defaults to `"infinity"`.
    #[serde(rename = "fs.copy")]
    Copy {
        id: String,
        src: String,
        dst: String,
        #[serde(default = "default_true")]
        overwrite: bool,
        #[serde(default = "default_depth")]
        depth: String,
    },

    /// `fs.move` — move / rename a resource.
    ///
    /// `overwrite` defaults to `true`.
    #[serde(rename = "fs.move")]
    Move {
        id: String,
        src: String,
        dst: String,
        #[serde(default = "default_true")]
        overwrite: bool,
    },
}

fn default_true() -> bool {
    true
}
fn default_depth() -> String {
    "infinity".to_string()
}

impl P2pRequest {
    /// Parse from a raw data-channel string.
    pub fn from_str(s: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(s)
    }

    /// Return the correlation `id` regardless of variant.
    pub fn id(&self) -> &str {
        match self {
            P2pRequest::Options { id }
            | P2pRequest::Stat { id, .. }
            | P2pRequest::List { id, .. }
            | P2pRequest::Get { id, .. }
            | P2pRequest::GetZip { id, .. }
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
            P2pRequest::Stat { .. } => "fs.stat",
            P2pRequest::List { .. } => "fs.list",
            P2pRequest::Get { .. } => "fs.get",
            P2pRequest::GetZip { .. } => "fs.get_zip",
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
    /// Machine-readable status code string.
    pub code: &'static str,
    /// Present on success; shape depends on `op`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
    /// Present on failure.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl P2pResponse {
    pub fn ok(id: impl Into<String>, op: &'static str, code: &'static str, data: serde_json::Value) -> Self {
        Self {
            id: id.into(),
            op,
            ok: true,
            code,
            data: Some(data),
            error: None,
        }
    }

    pub fn err(id: impl Into<String>, op: &'static str, code: &'static str, msg: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            op,
            ok: false,
            code,
            data: None,
            error: Some(msg.into()),
        }
    }

    pub fn to_json(&self) -> String {
        serde_json::to_string(self).unwrap_or_else(|e| {
            format!(r#"{{"id":"","op":"internal","ok":false,"code":"io_error","error":"{e}"}}"#)
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
