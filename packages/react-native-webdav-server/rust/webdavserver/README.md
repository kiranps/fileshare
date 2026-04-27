# webdavserver

Rust crate that implements a **WebDAV HTTP server** and a **P2P WebRTC file-transfer layer**, both exposed to React Native via [UniFFI](https://mozilla.github.io/uniffi-rs/).

---

## Table of contents

- [Architecture overview](#architecture-overview)
- [HTTP (WebDAV) endpoints](#http-webdav-endpoints)
  - [Request headers](#request-headers)
  - [Response status codes](#response-status-codes)
  - [Endpoint reference](#endpoint-reference)
- [P2P (WebRTC data-channel) API](#p2p-webrtc-data-channel-api)
  - [Message envelope](#message-envelope)
  - [P2P operations](#p2p-operations)
  - [Status codes](#status-codes-code-field)
  - [Reconnection & health-check](#reconnection--health-check)
  - [Signalling server endpoints](#signalling-server-endpoints)
- [Building & testing](#building--testing)

---

## Architecture overview

```
React Native / JS
       │
       │  UniFFI (sync FFI)
       ▼
 WebDavServer::start(StartOptions)   ←→   axum HTTP server (async, tokio)
                                               │
                                         WebDavService  ←→  FsRepository (filesystem)
                                               │
                                         (shared logic)
                                               │
 Peer::connect_with_reconnect()  ────────────►│
   WebRTC data channel (p2p_handler)          │
```

- **`WebDavServer`** — starts/stops the HTTP server. Exposes `start()` and `stop()` over UniFFI.
- **`Peer`** — WebRTC responder. Connects to a session on a signalling server, handles the SDP exchange, then routes inbound data-channel JSON messages through `p2p_handler::handle`.
- **`WebDavService`** — pure async business logic (no HTTP, no WebRTC).
- **`FsRepository`** — filesystem I/O (tokio async).

---

## HTTP (WebDAV) endpoints

The server listens on all interfaces at the configured port. All paths are relative to the `base_path` supplied in `StartOptions`.

Optional Basic authentication is enforced when `auth` is set in `StartOptions`.

### Request headers

| Header          | Used by                   | Notes                                                 |
|-----------------|---------------------------|-------------------------------------------------------|
| `Authorization` | All (if auth enabled)     | `Basic <base64(user:pass)>`                          |
| `Depth`         | `PROPFIND`, `COPY`        | `0` or `1` for PROPFIND; `0`, `1`, or `infinity` for COPY |
| `Destination`   | `COPY`, `MOVE`            | Absolute URL of the target resource                   |
| `Overwrite`     | `COPY`, `MOVE`            | `T` (default) or `F`                                  |

### Response status codes

| Code | Meaning                                                                           |
|------|-----------------------------------------------------------------------------------|
| 200  | `GET` / `HEAD` success                                                            |
| 201  | `PUT` / `MKCOL` / `COPY` / `MOVE` created a new resource                         |
| 204  | `OPTIONS`, `DELETE`, or `PUT` / `COPY` / `MOVE` replaced an existing resource    |
| 207  | `PROPFIND` multi-status XML response                                              |
| 400  | Malformed or unsupported request (e.g. `Depth: infinity` for PROPFIND)           |
| 401  | Missing or invalid Basic auth credentials                                         |
| 403  | Operation not permitted (e.g. `GET` on a directory without `?download=true`)     |
| 404  | Resource does not exist                                                           |
| 409  | Conflict — parent does not exist, or resource already exists (MKCOL / PUT)       |
| 412  | Precondition Failed — destination exists and `Overwrite: F` was set              |
| 415  | Unsupported Media Type — MKCOL received a non-empty body                         |
| 507  | Insufficient Storage — filesystem full                                            |
| 500  | Unexpected I/O failure                                                            |

### Endpoint reference

#### `OPTIONS /*path`
Returns DAV capability headers. No authentication required.

**Response headers:**
```
DAV: 1
Allow: OPTIONS, GET, HEAD, PUT, DELETE, PROPFIND, MKCOL, COPY
MS-Author-Via: DAV
```

---

#### `GET /*path`

| Variant | Query param | Description |
|---------|-------------|-------------|
| File inline | _(none)_ | Streams the file body. Sets `Content-Length`. |
| File download | `?download=true` | Serves file as an attachment with `Content-Disposition`. |
| Directory zip | `?download=true` | Streams a `.zip` of the entire directory tree as an attachment. |
| Directory _(no download)_ | _(none)_ | **403 Forbidden** |

---

#### `HEAD /*path` (file only)

Returns `Content-Length`, `Last-Modified`, and `ETag` with no response body.  
Returns **403** if the path is a directory.

---

#### `PUT /*path`

Create (201) or replace (204) a file. The request body is the raw file content.

| Error | Status |
|-------|--------|
| Path is a directory | 409 |
| Parent directory missing | 409 |
| Permission denied | 403 |

---

#### `DELETE /*path`

Delete a file or a directory tree recursively. Returns **204** on success.

| Error | Status |
|-------|--------|
| Not found | 404 |
| Permission denied | 403 |

---

#### `PROPFIND /*path`

WebDAV property listing. Requires `Depth` header (`0` or `1`).

- `Depth: 0` — properties for the resource itself.
- `Depth: 1` — properties for the resource and its immediate children.
- `Depth: infinity` — **400 Bad Request** (not supported).

Response body is an XML `207 Multi-Status` document.

---

#### `MKCOL /*path`

Create a collection (directory). Body must be empty (415 if non-empty).

| Error | Status |
|-------|--------|
| Already exists | 409 |
| Parent missing / not a directory | 409 |
| Filesystem full | 507 |
| Permission denied | 403 |

---

#### `COPY /*path`

Copy resource to `Destination` header URL.

| Header | Default | Notes |
|--------|---------|-------|
| `Destination` | _(required)_ | Absolute URL of target |
| `Overwrite` | `T` | `T` or `F` |
| `Depth` | `infinity` | `0`, `1`, or `infinity` |

| Result | Status |
|--------|--------|
| Created new resource | 201 |
| Replaced existing resource | 204 |
| Source not found | 404 |
| Same source and destination | 403 |
| Destination exists, `Overwrite: F` | 412 |
| Parent directory missing | 409 |

---

#### `MOVE /*path`

Move / rename resource to `Destination` header URL.

| Header | Default | Notes |
|--------|---------|-------|
| `Destination` | _(required)_ | Absolute URL of target |
| `Overwrite` | `T` | `T` or `F` |

Same result/status table as COPY above.

---

## P2P (WebRTC data-channel) API

All messages over the WebRTC data channel are **UTF-8 JSON strings**.

### Message envelope

**Request** (client → server):
```json
{
  "id":      "<client-generated correlation id>",
  "op":      "<operation name>",
  "payload": { ...op-specific fields... }
}
```

`payload` is required for operations that carry parameters; it may be omitted for operations with no parameters (e.g. `fs.options`).

**Response** (server → client):
```json
{
  "id":     "<echoed from request>",
  "op":     "<echoed from request>",
  "ok":     true,
  "status": "<status string>",
  "data":   { ...op-specific payload... }
}
```

**Error response**:
```json
{
  "id":     "<echoed>",
  "op":     "<echoed>",
  "ok":     false,
  "status": "<error code>",
  "error":  "human readable message"
}
```

---

### P2P operations

#### `fs.ping` — health-check / keep-alive

Send a ping; the server replies immediately with a pong.

**Request:**
```json
{ "id": "1", "op": "fs.ping" }
```

`status` is `"pong"`.

---

#### `fs.options` — server capability query

**Request:**
```json
{ "id": "1", "op": "fs.options" }
```

**Response data:**
```json
{
  "dav": "1",
  "ops": ["fs.options", "fs.ping", "fs.stat", "fs.list", "fs.get", "fs.get_zip",
          "fs.head", "fs.put", "fs.delete", "fs.mkdir", "fs.copy", "fs.move"]
}
```

---

#### `fs.stat` — single-path metadata (depth=0)

**Request:**
```json
{ "id": "1", "op": "fs.stat", "payload": { "path": "documents/report.pdf" } }
```

**Response data:**
```json
{
  "path":          "documents/report.pdf",
  "is_dir":        false,
  "size":          204800,
  "last_modified": "Mon, 01 Jan 2024 12:00:00 GMT",
  "etag":          "\"abc123\""
}
```

---

#### `fs.list` — directory listing (depth=1)

**Request:**
```json
{ "id": "1", "op": "fs.list", "payload": { "path": "documents" } }
```

**Response data:** array of entry objects (same shape as `fs.stat`).

---

#### `fs.get` — read a file

**Request:**
```json
{ "id": "1", "op": "fs.get", "payload": { "path": "photo.jpg" } }
```

**Response data:**
```json
{
  "filename":       "photo.jpg",
  "body_b64":       "<base64-encoded content>",
  "content_length": 102400
}
```

Use `fs.get_zip` for directories.

---

#### `fs.get_zip` — download directory as zip

**Request:**
```json
{ "id": "1", "op": "fs.get_zip", "payload": { "path": "documents" } }
```

**Response data:** same shape as `fs.get`; `filename` is `"documents.zip"`.

---

#### `fs.head` — metadata without body

**Request:**
```json
{ "id": "1", "op": "fs.head", "payload": { "path": "video.mp4" } }
```

**Response data:**
```json
{
  "content_length": 5242880,
  "last_modified":  "Mon, 01 Jan 2024 12:00:00 GMT",
  "etag":           "\"def456\""
}
```

---

#### `fs.put` — create or replace a file

**Request:**
```json
{
  "id":  "1",
  "op":  "fs.put",
  "payload": {
    "path":     "notes/todo.txt",
    "body_b64": "<base64-encoded content>"
  }
}
```

`status` is `"created"` (new file) or `"ok"` (existing file updated).

---

#### `fs.delete` — delete file or directory tree

**Request:**
```json
{ "id": "1", "op": "fs.delete", "payload": { "path": "old_folder" } }
```

---

#### `fs.mkdir` — create a directory

**Request:**
```json
{ "id": "1", "op": "fs.mkdir", "payload": { "path": "new_folder" } }
```

`status` is `"created"` on success.

---

#### `fs.copy` — copy resource

**Request:**
```json
{
  "id":  "1",
  "op":  "fs.copy",
  "payload": {
    "src":       "file.txt",
    "dst":       "backup/file.txt",
    "overwrite": true,
    "depth":     "infinity"
  }
}
```

`overwrite` defaults to `true`. `depth` defaults to `"infinity"`.  
`status` is `"created"` (new) or `"ok"` (replaced).

---

#### `fs.move` — move / rename resource

**Request:**
```json
{
  "id":  "1",
  "op":  "fs.move",
  "payload": {
    "src":       "draft.txt",
    "dst":       "final.txt",
    "overwrite": true
  }
}
```

`overwrite` defaults to `true`.

---

### Status codes (`status` field)

| Code                       | Meaning                                           |
|----------------------------|---------------------------------------------------|
| `ok`                       | Success                                           |
| `pong`                     | Response to `fs.ping`                             |
| `created`                  | Resource was created                              |
| `not_found`                | Path does not exist                               |
| `is_directory`             | Operation not valid on a directory                |
| `parent_not_found`         | Parent directory does not exist                   |
| `already_exists`           | Resource already exists (e.g. `fs.mkdir`)         |
| `dest_exists_no_overwrite` | Destination exists and `overwrite=false`          |
| `same_source_dest`         | Source and destination are identical              |
| `unsupported_depth`        | Depth value not supported                         |
| `body_not_supported`       | Request body not allowed for this op              |
| `permission_denied`        | Filesystem permission error                       |
| `insufficient_storage`     | Filesystem full                                   |
| `io_error`                 | Unexpected I/O failure                            |
| `parse_error`              | Incoming message could not be parsed              |
| `unknown_op`               | `op` field is not recognised                      |

---

### Reconnection & health-check

`Peer::connect_with_reconnect(session_id)` wraps the one-shot `connect` in an automatic retry loop:

1. **Session reset** — calls `POST /session/{id}/reset` before each reconnect attempt so the initiator can post a fresh SDP offer.
2. **WebRTC handshake** — polls `GET /session/{id}/offer`, negotiates answer, posts it.
3. **Health-check** — after the data channel opens, a background task sends `fs.ping` every `health_check_interval_ms` and waits up to `health_check_timeout_ms` for the pong.
4. **Reconnect** — if the ping times out or the send fails, the error handler fires and the loop waits `reconnect_delay_ms` before retrying.
5. **Limit** — set `max_reconnect_attempts > 0` to cap retries (0 = unlimited).

**`PeerConfig` fields related to reconnection:**

| Field | Default | Description |
|-------|---------|-------------|
| `health_check_interval_ms` | `15000` | Interval between pings (ms). `0` disables health-check. |
| `health_check_timeout_ms`  | `5000`  | Pong timeout before declaring connection dead (ms). |
| `reconnect_delay_ms`       | `2000`  | Wait before each reconnect attempt (ms). |
| `max_reconnect_attempts`   | `0`     | Max attempts; `0` = unlimited. |

**Example (Rust):**
```rust
use webdavserver::peer::{Peer, PeerConfig};
use webdavserver::p2p_handler::handle;
use std::path::PathBuf;
use std::sync::Arc;

#[tokio::main]
async fn main() {
    let base = Arc::new(PathBuf::from("/srv/files"));

    let peer = Peer::new(PeerConfig {
        signal_base: "http://my-signal-server:9000".to_string(),
        health_check_interval_ms: 10_000,
        max_reconnect_attempts: 0,   // unlimited
        ..PeerConfig::default()
    });

    let base_clone = Arc::clone(&base);
    peer.on_data(move |msg, p| {
        let bp = Arc::clone(&base_clone);
        async move {
            let response = handle(&msg, &bp).await;
            let _ = p.send(&response).await;
        }
    }).await;

    peer.on_error(|e| async move {
        eprintln!("[peer] error: {e}");
    }).await;

    // Blocks forever; reconnects automatically on health-check failure
    peer.connect_with_reconnect("my-session-id").await;
}
```

---

### Signalling server endpoints

The `Peer` client communicates with a lightweight HTTP signalling server. Three endpoints are used:

#### `GET /session/{id}/offer`
Poll for an SDP offer from the initiator. Returns either:
- The SDP offer JSON (`RTCSessionDescription`) when available, or
- `{"status": "pending"}` while waiting.

#### `POST /session/{id}/answer`
Post the responder's SDP answer (JSON body: `RTCSessionDescription`).

#### `POST /session/{id}/reset`
Reset the session slot. Called automatically before each reconnect attempt so the initiator can post a fresh offer. Returns `200 OK` on success.

> **Note:** The signalling server is external to this crate. Implement `POST /session/{id}/reset` in your signalling server to support automatic reconnection.

---

## Building & testing

```sh
# Run all tests (from this directory)
cargo test

# Show stdout/stderr (useful for test debugging)
cargo test -- --nocapture

# Run a single test
cargo test ping_returns_pong_code

# Cross-compile for Android (from repo root)
pnpm ubrn:android
```

### Crate targets

```toml
crate-type = ["cdylib", "staticlib", "lib"]
```

All three are required:
- `cdylib` → Android `.so`
- `staticlib` → iOS `.a`
- `lib` → `cargo test`
