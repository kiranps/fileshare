# p2p_client.ts — Technical Documentation

## Overview

`p2p_client.ts` implements the browser-side WebRTC peer-to-peer layer for the FileShare application. It establishes a WebRTC connection to the desktop agent (server peer), provides a JSON-RPC control channel, and supports opening any number of named `RTCDataChannel`s for additional transports (e.g. binary file streaming).

Download logic (binary framing, `DownloadChannel`, `DownloadStream`) lives in `src/hooks/useFileSystem.ts`, which consumes the raw `RTCDataChannel` exposed by this module.

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                     P2PService                         │  Singleton
│  ┌──────────────────────────────────────────────────┐  │
│  │                   SimplePeer                     │  │  WebRTC peer (initiator)
│  │  ┌──────────────┐   ┌──────────┐  ┌──────────┐  │  │
│  │  │ default DC   │   │ "file"   │  │ "other"  │  │  │
│  │  │ (JSON / RPC) │   │ channel  │  │ channel  │  │  │
│  │  └──────┬───────┘   └────┬─────┘  └────┬─────┘  │  │
│  └─────────┼────────────────┼─────────────┼────────┘  │
│            │                │             │            │
│         PeerRPC       RTCDataChannel  RTCDataChannel   │
│            │         (via getChannel)                  │
│            └────────────────┬─────────────┘            │
│                       P2PConnection                    │  Public API
└────────────────────────────────────────────────────────┘
```

### Classes

| Class | Visibility | Responsibility |
|---|---|---|
| `Emitter` | Private | Typed event emitter for connection lifecycle events |
| `PeerRPC` | Private | JSON-RPC layer over the default SimplePeer data channel |
| `P2PConnection` | **Public** | Facade exposing RPC + named channel registry; returned by `startSession` |
| `P2PService` | Private (singleton) | Manages peer lifecycle, health checks, reconnection, and channel setup |

---

## Public API

### `p2p` (singleton export)

```ts
import { p2p } from "@utils/p2p_client";
```

### `p2p.startSession(sid?, channelLabels?): P2PConnection`

Initiates a WebRTC session.

| Parameter | Type | Description |
|---|---|---|
| `sid` | `string \| undefined` | Existing session ID to reconnect to. Omit to create a new session. |
| `channelLabels` | `string[]` | Labels of additional `RTCDataChannel`s to open on connect. Default `[]`. |

- If `sid` is omitted, a new session is created via the signalling server and the `session` event fires with the new ID.
- If `sid` is provided, the existing session is reset and the peer reconnects.
- Returns a `P2PConnection` immediately; readiness is signalled via the `ready` event.
- Calling `startSession()` while already `starting` or `connected` is a no-op and returns the existing connection.

```ts
// Open the connection and request a "file" binary channel for downloads.
const conn = p2p.startSession(undefined, ["file"]);

conn.on("session", (sid) => {
  // Display QR code / share this sid with the mobile peer
});

conn.on("ready", () => {
  // All channels are open; safe to call conn.request() / conn.getChannel()
});

conn.on("close", () => { /* peer disconnected */ });
conn.on("error", (err) => { /* handle error */ });
conn.on("reconnecting", () => { /* reconnect in progress */ });
```

**In `App.tsx` the session is started with the `"file"` channel:**

```ts
const conn = p2p.startSession(sessionId ?? undefined, ["file"]);
```

---

### `P2PConnection`

#### `conn.request(op: string, payload: any): Promise<any>`

Sends a JSON-RPC request on the control channel. Resolves with `data` on success or rejects with an `Error` on failure or timeout (default 10 s).

```ts
const entries = await conn.request("fs.list", { path: "/Documents" });
```

#### `conn.requestWithId(id: string, op: string, payload: any): Promise<any>`

Like `request()` but uses a caller-supplied `id`. Used to tie an RPC call to a binary transfer on a named channel (e.g. the download flow in `useFileSystem.ts` shares the id with the `"file"` channel so frames can be demuxed by correlation id).

#### `conn.getChannel(label: string): RTCDataChannel | null`

Returns the `RTCDataChannel` registered under `label`, or `null` if it has not been opened yet.

```ts
const dc = conn.getChannel("file"); // RTCDataChannel for binary streaming
```

#### `conn.attachChannel(dc: RTCDataChannel): RTCDataChannel`

Register a named channel manually. Idempotent — if a channel with the same label is already registered the existing one is returned unchanged. Normally called internally by `P2PService` on connect.

#### `conn.cleanupChannels()`

Close and deregister all named channels. Called automatically on peer close/reconnect.

#### `conn.handle(op: string, handler: Handler)`

Register a server-initiated RPC handler (currently unused by the server but supported by the layer).

---

## Named Channels

`P2PService` creates `RTCDataChannel`s for every label in `channelLabels` as soon as the peer connects. Callers retrieve them via `conn.getChannel(label)` and interpret the data themselves.

The `"file"` channel is used by `useFileSystem.ts` for binary-framed file streaming. See `src/hooks/useFileSystem.ts` for the framing protocol documentation.

---

## Signalling Flow

```
Browser                     Signalling Server           Desktop Agent
  │                               │                          │
  ├─ POST /session ───────────────►│                          │
  │◄── { session_id } ────────────┤                          │
  │                               │                          │
  ├─ POST /session/:id/offer ─────►│                          │
  │                               ├─ (agent polls offer) ────►│
  │                               │◄── POST /answer ──────────┤
  │◄── GET /answer (poll) ────────┤                          │
  │                               │                          │
  ├─ peer.signal(answer) ─────────────────────────────────────►│
  │◄──────────────── RTCDataChannel "connect" ────────────────┤
```

On reconnect, `resetSession(sid)` is called first to clear stale signalling state, then the peer and all channels are re-established.

---

## Health Check

After the `ready` event, `P2PService` sends `fs.ping` RPC requests every **15 seconds**. If a ping fails (e.g. timeout or disconnection), the health check timer is cleared. A peer `error` event triggers automatic reconnection via `triggerReconnect`, which re-opens all originally requested channels.

---

## Event Reference

| Event | Payload | When |
|---|---|---|
| `session` | `sid: string` | New session created; share this ID with the remote peer |
| `ready` | — | WebRTC connection and all requested channels are open |
| `close` | — | Peer connection closed cleanly |
| `error` | `err: Error` | Error from peer or signalling |
| `reconnecting` | — | Peer error detected; reconnection attempt in progress |

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| RPC request timeout (10 s default) | Promise rejects with `RPC timeout: <op>` |
| Peer disconnects with pending RPC requests | All pending requests reject with `disconnected` |
| `createSession` / `resetSession` throws | `error` event emitted on the connection |
| RPC error response (`ok: false`) | Promise rejects with `error` field (or `status` if absent) |

---

## Related Files

| File | Purpose |
|---|---|
| `src/utils/signalling.ts` | HTTP signalling helpers (`createSession`, `postOffer`, `pollAnswer`, `resetSession`) |
| `src/hooks/useFileSystem.ts` | Owns `DownloadChannel`, binary framing, and the `useDownloadFile` hook |
| `src/utils/p2p_client.test.ts` | Unit / integration tests for this module |
| `src/App.tsx` | Entry point; calls `p2p.startSession(sid, ["file"])` |
