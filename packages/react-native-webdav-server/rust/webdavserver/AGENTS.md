# AGENTS.md — webdavserver

Rust crate that implements a WebDAV HTTP server exposed to React Native via UniFFI.

---

## Crate layout

```
src/
  lib.rs           — crate root: module declarations, uniffi::setup_scaffolding!()
  webdav_server.rs — WebDavServer object, StartOptions, server lifecycle
  routing.rs       — axum Router and all HTTP/WebDAV method handlers
  middleware.rs     — auth, base_path injection, WebDAV header, debug-logging middlewares
  helpers.rs        — path resolution, PROPFIND XML building, HTTP response helpers
  logging.rs        — one-shot tracing init (Android vs non-Android branches)
```

No `build.rs`, no `tests/` directory, no `examples/`, no `.cargo/config.toml`.

---

## Commands

```sh
# from this directory
cargo test                   # run all tests
cargo test <name>            # single test
cargo test -- --nocapture    # show stdout/stderr

# from repo root
pnpm rust:test               # same as cargo test above
pnpm rust:server             # cargo run --example start_server (no example exists yet — will fail)
```

---

## Crate types — do not simplify

```toml
crate-type = ["cdylib", "staticlib", "lib"]
```

All three are required: `cdylib` → Android `.so`, `staticlib` → iOS `.a`, `lib` → `cargo test`. Removing any breaks one of the three targets.

---

## UniFFI — proc-macro, no .udl file

Uses `uniffi::setup_scaffolding!()` in `lib.rs` (proc-macro approach). There is no `.udl` file. All FFI-exposed types are annotated inline:

```rust
#[derive(uniffi::Object)]   WebDavServer
#[uniffi::export]           impl WebDavServer { new(), start(), stop() }
#[derive(uniffi::Record)]   StartOptions, StartResponse, Auth
#[derive(uniffi::Error)]    ServerError
```

**Binding generation** (TypeScript/Kotlin) is done externally by `uniffi-bindgen-react-native`:
```sh
pnpm ubrn:android   # cross-compile + regenerate src/generated/ in the parent package
```
Never edit `packages/react-native-webdav-server/src/generated/` manually.

---

## Public API (what JS sees)

```
WebDavServer::new() -> WebDavServer
WebDavServer.start(StartOptions) -> Result<StartResponse, ServerError>
WebDavServer.stop()              -> Result<String, ServerError>

StartOptions { port: Option<u16>, base_path: String, auth: Option<Auth> }
StartResponse { ip: String, port: u16 }
Auth { username: String, password: String }

ServerError: AlreadyRunning | NotRunning | BindFailed(u16) | RuntimeError { message }
```

All internals (router, handlers, middleware, helpers) are `pub(crate)` or private.

---

## Architecture notes

- **Synchronous FFI, internal async.** `start()` and `stop()` are blocking FFI calls. Internally, `start()` creates a `tokio::Runtime` (multi-thread) and stores it in `Mutex<Option<Runtime>>`. `stop()` drops it. The caller never sees async.
- **`base_path` is smuggled via query string.** `prefix_middleware` appends `?base_path=<value>` to every request URI before routing. `helpers::extract_base_path()` reads it back. Every handler sees this synthetic query param even on requests with no original query. Forgetting this causes path resolution confusion.
- **LAN IP detection** uses a UDP connect-trick (UDP socket to `8.8.8.8:80`, no data sent). Falls back to `"0.0.0.0"` silently if no network.
- **PROPFIND** responses are built via raw string formatting in `helpers.rs`. Only `Depth: 0` and `Depth: 1` are supported; `Depth: infinity` returns 400.
- **Logging** uses `tracing-android` + logcat on Android (`#[cfg(target_os = "android")]`), `tracing-subscriber::fmt` to stderr elsewhere. Initialized once via `std::sync::Once` inside `start()` — does not fire in unit tests unless `start()` is called.

---

## Gotchas

- **Edition 2024** (`edition = "2024"`). Requires Rust 1.85+.
- **`xml-rs` is a dependency but unused.** PROPFIND request body XML parsing is not implemented; responses use raw string formatting.
- **`async-std`, `rand`, `chrono`** appear in `Cargo.toml` but are not observably used in current source. Treat as vestigial.
- **`uniffi = { features = ["build"] }` as dev-dep with no `build.rs`** is inert. The proc-macro path replaced the build-script approach.
- **No tests exist today.** Dev-deps (`reqwest`, `tower`, `quick-xml`) indicate the intended pattern is integration tests using `tower::ServiceExt` directly against the axum router without real TCP. Use `#[tokio::test]` when adding tests.
- **Android target is `arm64-v8a` only** (set in `ubrn.config.yaml` in the parent package). No other architectures are configured.
