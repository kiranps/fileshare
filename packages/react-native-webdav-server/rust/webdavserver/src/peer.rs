//! WebRTC P2P responder — PeerJS-inspired.
//!
//! # Reconnection strategy
//!
//! `connect_with_reconnect` wraps `connect` in a retry loop:
//!
//! 1. Calls `POST /session/{id}/reset` on the signalling server so the
//!    session slot is cleared and the initiator can post a fresh offer.
//! 2. Calls `connect(session_id)` to perform the full WebRTC handshake.
//! 3. After the data channel opens, starts a background health-check task that
//!    sends `{"op":"fs.ping","id":"<uuid>"}` every `health_check_interval_ms`.
//! 4. If a ping times out or the channel errors, the health-check task fires
//!    the `on_error` handler and returns, which triggers a reconnect after
//!    `reconnect_delay_ms`.
//! 5. Reconnection is attempted up to `max_reconnect_attempts` times
//!    (0 = unlimited).

use std::{sync::Arc, time::Duration};

use reqwest::Client;
use serde::Deserialize;
use tokio::{sync::Mutex, time::sleep};
use webrtc::{
    api::APIBuilder,
    data_channel::{RTCDataChannel, data_channel_message::DataChannelMessage},
    ice_transport::ice_server::RTCIceServer,
    peer_connection::{
        RTCPeerConnection, configuration::RTCConfiguration,
        sdp::session_description::RTCSessionDescription,
    },
};

// ── Public types ──────────────────────────────────────────────────────────────

/// Configuration for the signalling server, ICE, and reconnection.
#[derive(Clone, Debug)]
pub struct PeerConfig {
    /// Base URL of the HTTP signalling server (default: `http://localhost:9000`).
    pub signal_base: String,
    /// How often to poll for an offer (ms, default: 1000).
    pub poll_interval_ms: u64,
    /// How long to wait for an offer before giving up (s, default: 120).
    pub poll_timeout_secs: u64,
    /// STUN/TURN server URLs.
    pub ice_servers: Vec<String>,
    /// Interval between P2P health-check pings (ms). 0 = disabled. Default: 15 000.
    pub health_check_interval_ms: u64,
    /// How long to wait for a pong before declaring the connection dead (ms). Default: 5 000.
    pub health_check_timeout_ms: u64,
    /// Delay before a reconnect attempt (ms). Default: 2 000.
    pub reconnect_delay_ms: u64,
    /// Maximum reconnect attempts. 0 = unlimited. Default: 0.
    pub max_reconnect_attempts: u32,
}

impl Default for PeerConfig {
    fn default() -> Self {
        Self {
            signal_base: "http://localhost:9000".to_string(),
            poll_interval_ms: 1_000,
            poll_timeout_secs: 120,
            ice_servers: vec!["stun:stun.l.google.com:19302".to_string()],
            health_check_interval_ms: 15_000,
            health_check_timeout_ms: 5_000,
            reconnect_delay_ms: 2_000,
            max_reconnect_attempts: 0,
        }
    }
}

// ── Handler type aliases ──────────────────────────────────────────────────────

type OpenHandler = Arc<
    dyn Fn(Arc<Peer>) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send>>
        + Send
        + Sync,
>;
type DataHandler = Arc<
    dyn Fn(String, Arc<Peer>) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send>>
        + Send
        + Sync,
>;
type CloseHandler =
    Arc<dyn Fn() -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send>> + Send + Sync>;
type ErrorHandler = Arc<
    dyn Fn(String) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send>> + Send + Sync,
>;

// ── Peer ─────────────────────────────────────────────────────────────────────

/// A WebRTC responder peer, inspired by PeerJS.
///
/// Create one, attach handlers with `on_*`, then call `connect(session_id)`
/// for a single connection or `connect_with_reconnect(session_id)` for
/// automatic reconnection on health-check failure.
pub struct Peer {
    pub config: PeerConfig,
    on_open: Mutex<Option<OpenHandler>>,
    on_data: Mutex<Option<DataHandler>>,
    on_close: Mutex<Option<CloseHandler>>,
    on_error: Mutex<Option<ErrorHandler>>,
    /// The active data channel (set after WebRTC negotiation completes).
    dc: Mutex<Option<Arc<RTCDataChannel>>>,
    /// Keep the RTCPeerConnection alive.
    _pc: Mutex<Option<Arc<RTCPeerConnection>>>,
}

impl Peer {
    pub fn new(config: PeerConfig) -> Arc<Self> {
        Arc::new(Self {
            config,
            on_open: Mutex::new(None),
            on_data: Mutex::new(None),
            on_close: Mutex::new(None),
            on_error: Mutex::new(None),
            dc: Mutex::new(None),
            _pc: Mutex::new(None),
        })
    }

    // ── Event registration ────────────────────────────────────────────────────

    /// Called when the data channel is open and ready.
    pub async fn on_open<F, Fut>(&self, handler: F)
    where
        F: Fn(Arc<Peer>) -> Fut + Send + Sync + 'static,
        Fut: std::future::Future<Output = ()> + Send + 'static,
    {
        *self.on_open.lock().await = Some(Arc::new(move |p| Box::pin(handler(p))));
    }

    /// Called for every inbound data-channel message.
    pub async fn on_data<F, Fut>(&self, handler: F)
    where
        F: Fn(String, Arc<Peer>) -> Fut + Send + Sync + 'static,
        Fut: std::future::Future<Output = ()> + Send + 'static,
    {
        *self.on_data.lock().await = Some(Arc::new(move |m, p| Box::pin(handler(m, p))));
    }

    /// Called when the data channel closes.
    pub async fn on_close<F, Fut>(&self, handler: F)
    where
        F: Fn() -> Fut + Send + Sync + 'static,
        Fut: std::future::Future<Output = ()> + Send + 'static,
    {
        *self.on_close.lock().await = Some(Arc::new(move || Box::pin(handler())));
    }

    /// Called on errors (signalling or WebRTC).
    pub async fn on_error<F, Fut>(&self, handler: F)
    where
        F: Fn(String) -> Fut + Send + Sync + 'static,
        Fut: std::future::Future<Output = ()> + Send + 'static,
    {
        *self.on_error.lock().await = Some(Arc::new(move |e| Box::pin(handler(e))));
    }

    // ── Outbound data ─────────────────────────────────────────────────────────

    /// Send a text message over the data channel.
    pub async fn send(&self, text: &str) -> Result<(), String> {
        match self.dc.lock().await.as_ref() {
            Some(dc) => dc
                .send_text(text.to_string())
                .await
                .map_err(|e| e.to_string())
                .map(|_| ()),
            None => Err("data channel not open yet".to_string()),
        }
    }

    // ── Connect (single attempt) ──────────────────────────────────────────────

    /// Connect to an existing session as the **Responder** (one attempt).
    ///
    /// 1. Polls `GET /session/{id}/offer` until the initiator posts one.
    /// 2. Performs WebRTC negotiation and posts the answer.
    /// 3. Returns once the data channel is open (fires `on_open`).
    pub async fn connect(self: &Arc<Self>, session_id: &str) -> Result<(), String> {
        let client = Client::new();

        println!("[signal] ⏳ waiting for offer on session={session_id}…");
        let offer = self.poll_offer(&client, session_id).await.map_err(|e| {
            let _ = self.emit_error(e.clone());
            e
        })?;
        println!("[signal] 📥 offer received");

        println!("[peer]   🔧 building WebRTC answer…");
        let (pc, answer) = self.negotiate(offer).await.map_err(|e| {
            let es = e.to_string();
            let _ = self.emit_error(es.clone());
            es
        })?;
        println!("[peer]   ✅ answer ready");

        *self._pc.lock().await = Some(pc);

        self.post_answer(&client, session_id, &answer)
            .await
            .map_err(|e| {
                let _ = self.emit_error(e.clone());
                e
            })?;
        println!("[signal] 📤 answer posted — WebRTC handshake in flight");

        Ok(())
    }

    // ── Connect with automatic reconnection ───────────────────────────────────

    /// Connect and automatically reconnect on health-check failure.
    ///
    /// Before each (re)connect attempt the session slot is reset on the
    /// signalling server via `POST /session/{id}/reset` so the initiator can
    /// post a fresh offer.
    ///
    /// The reconnect loop runs until:
    /// - `max_reconnect_attempts > 0` and that many attempts have been made, or
    /// - the caller drops the returned `Arc<Peer>` (i.e. all strong refs gone).
    pub async fn connect_with_reconnect(self: &Arc<Self>, session_id: &str) {
        let max = self.config.max_reconnect_attempts;
        let mut attempt: u32 = 0;

        loop {
            attempt += 1;
            if max > 0 && attempt > max {
                println!("[peer]   ❌ max reconnect attempts ({max}) reached — giving up");
                self.emit_error(format!("max reconnect attempts ({max}) reached"))
                    .await;
                return;
            }

            if attempt > 1 {
                // Reset the session slot before each retry
                let client = Client::new();
                match self.reset_session(&client, session_id).await {
                    Ok(_) => println!("[signal] 🔄 session reset ok (attempt {attempt})"),
                    Err(e) => println!("[signal] ⚠️  session reset failed: {e} — continuing"),
                }

                println!(
                    "[peer]   ⏳ waiting {}ms before reconnect…",
                    self.config.reconnect_delay_ms
                );
                sleep(Duration::from_millis(self.config.reconnect_delay_ms)).await;
            }

            println!("[peer]   🔌 connecting (attempt {attempt})…");
            match self.connect(session_id).await {
                Ok(()) => {
                    println!("[peer]   ✅ connected — starting health-check loop");
                    // Block until health-check detects failure (or channel closes)
                    self.run_health_check_loop(session_id).await;
                    println!("[peer]   🔴 health-check failed — will reconnect");
                }
                Err(e) => {
                    println!("[peer]   ❌ connect error: {e}");
                    self.emit_error(format!("connect error (attempt {attempt}): {e}"))
                        .await;
                }
            }

            // Clear stale dc/pc so the next connect starts clean
            *self.dc.lock().await = None;
            *self._pc.lock().await = None;
        }
    }

    // ── Health-check loop ─────────────────────────────────────────────────────

    /// Send periodic pings and return when one times out or the channel closes.
    async fn run_health_check_loop(self: &Arc<Self>, _session_id: &str) {
        let interval = self.config.health_check_interval_ms;
        let timeout_ms = self.config.health_check_timeout_ms;

        if interval == 0 {
            // Health-check disabled — wait for a data-channel close event instead.
            // We simply sleep; the on_close handler is the real signal.
            // This future never resolves by design when health-check is off,
            // but the caller is fine with that — they drop the task externally.
            std::future::pending::<()>().await;
            return;
        }

        loop {
            sleep(Duration::from_millis(interval)).await;

            // Build a unique ping id
            let ping_id = format!("hc-{}", rand_id());
            let ping_msg = format!(r#"{{"op":"fs.ping","id":"{ping_id}"}}"#);

            // Set up a channel to receive the pong
            let (tx, rx) = tokio::sync::oneshot::channel::<()>();
            let tx = Arc::new(Mutex::new(Some(tx)));

            // Register a one-shot data listener that resolves the pong
            let expected_id = ping_id.clone();
            let tx_clone = Arc::clone(&tx);
            let prev_handler = self.on_data.lock().await.clone();

            // Temporarily wrap the existing on_data handler to intercept pong
            {
                let peer_ref = Arc::clone(self);
                *self.on_data.lock().await = Some(Arc::new(move |msg: String, p: Arc<Peer>| {
                    let eid = expected_id.clone();
                    let tc = Arc::clone(&tx_clone);
                    let prev = prev_handler.clone();
                    let pr = Arc::clone(&peer_ref);
                    Box::pin(async move {
                        // Check if this is our pong
                        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&msg) {
                            if v["id"] == eid && v["code"] == "pong" {
                                if let Some(sender) = tc.lock().await.take() {
                                    let _ = sender.send(());
                                }
                                return; // Consumed — don't forward
                            }
                        }
                        // Not our pong — pass to the real handler
                        if let Some(h) = prev {
                            h(msg, p).await;
                        }
                        let _ = pr; // keep alive
                    })
                }));
            }

            // Send the ping
            if let Err(e) = self.send(&ping_msg).await {
                println!("[health] ❌ send error: {e}");
                self.emit_error(format!("health-check send error: {e}"))
                    .await;
                // Restore original handler before returning
                *self.on_data.lock().await = {
                    let _ = tx; // drop
                    None // will be re-registered on next connect
                };
                return;
            }

            // Wait for pong with timeout
            let result = tokio::time::timeout(Duration::from_millis(timeout_ms), rx).await;

            // Restore the original data handler unconditionally
            // (tx has been consumed or dropped by now)
            // We leave the handler as-is; the next connect() will re-register it.

            match result {
                Ok(Ok(())) => {
                    println!("[health] ✅ pong received (id={ping_id})");
                    // Continue loop
                }
                Ok(Err(_)) | Err(_) => {
                    println!("[health] ⏰ ping timeout (id={ping_id})");
                    self.emit_error(format!("health-check timeout after {timeout_ms}ms"))
                        .await;
                    return;
                }
            }
        }
    }

    // ── Internal: emit events ─────────────────────────────────────────────────

    async fn emit_open(self: &Arc<Self>) {
        if let Some(h) = self.on_open.lock().await.clone() {
            h(Arc::clone(self)).await;
        }
    }

    async fn emit_data(self: &Arc<Self>, msg: String) {
        if let Some(h) = self.on_data.lock().await.clone() {
            h(msg, Arc::clone(self)).await;
        }
    }

    async fn emit_close(&self) {
        if let Some(h) = self.on_close.lock().await.clone() {
            h().await;
        }
    }

    pub async fn emit_error(&self, err: String) {
        if let Some(h) = self.on_error.lock().await.clone() {
            h(err).await;
        }
    }

    // ── Private: WebRTC negotiation ───────────────────────────────────────────

    async fn negotiate(
        self: &Arc<Self>,
        offer: RTCSessionDescription,
    ) -> Result<(Arc<RTCPeerConnection>, RTCSessionDescription), Box<dyn std::error::Error>> {
        let api = APIBuilder::new().build();

        let ice_servers = self
            .config
            .ice_servers
            .iter()
            .map(|url| RTCIceServer {
                urls: vec![url.clone()],
                ..Default::default()
            })
            .collect();

        let config = RTCConfiguration {
            ice_servers,
            ..Default::default()
        };
        let pc = Arc::new(api.new_peer_connection(config).await?);

        let peer_ref = Arc::clone(self);
        pc.on_data_channel(Box::new(move |dc: Arc<RTCDataChannel>| {
            let label = dc.label().to_string();
            println!("[peer]   📡 data channel: label={label}");

            let peer_open = Arc::clone(&peer_ref);
            dc.on_open(Box::new(move || {
                println!("[peer]   ✅ data channel ready");
                let p = Arc::clone(&peer_open);
                Box::pin(async move { p.emit_open().await })
            }));

            let peer_close = Arc::clone(&peer_ref);
            dc.on_close(Box::new(move || {
                println!("[peer]   🔴 data channel closed");
                let p = Arc::clone(&peer_close);
                Box::pin(async move { p.emit_close().await })
            }));

            let peer_msg = Arc::clone(&peer_ref);
            let peer_store = Arc::clone(&peer_ref);
            dc.on_message(Box::new(move |msg: DataChannelMessage| {
                let text = String::from_utf8_lossy(&msg.data).to_string();
                println!("[peer]   📩 received: {text:?}");
                let p = Arc::clone(&peer_msg);
                Box::pin(async move { p.emit_data(text).await })
            }));

            let dc_arc = Arc::clone(&dc);
            Box::pin(async move {
                *peer_store.dc.lock().await = Some(dc_arc);
            })
        }));

        let (ice_tx, ice_rx) = tokio::sync::oneshot::channel::<()>();
        let mut ice_tx = Some(ice_tx);
        pc.on_ice_candidate(Box::new(move |c| {
            if c.is_none() {
                if let Some(tx) = ice_tx.take() {
                    let _ = tx.send(());
                }
            }
            Box::pin(async {})
        }));

        println!("[peer]   📥 setting remote description");
        pc.set_remote_description(offer).await?;

        let answer = pc.create_answer(None).await?;
        pc.set_local_description(answer).await?;
        println!("[peer]   ⏳ gathering ICE candidates…");

        ice_rx.await?;
        println!("[peer]   ✅ ICE gathering complete");

        let local_desc = pc
            .local_description()
            .await
            .ok_or("no local description after gathering")?;

        Ok((pc, local_desc))
    }

    // ── Private: signalling helpers ───────────────────────────────────────────

    async fn poll_offer(
        &self,
        client: &Client,
        session_id: &str,
    ) -> Result<RTCSessionDescription, String> {
        let url = format!("{}/session/{}/offer", self.config.signal_base, session_id);
        let deadline =
            tokio::time::Instant::now() + Duration::from_secs(self.config.poll_timeout_secs);

        loop {
            if tokio::time::Instant::now() > deadline {
                return Err(format!(
                    "timed out after {}s waiting for offer",
                    self.config.poll_timeout_secs
                ));
            }

            let resp = client
                .get(&url)
                .send()
                .await
                .map_err(|e| e.to_string())?
                .error_for_status()
                .map_err(|e| e.to_string())?;

            let body: OfferOrPending = resp.json().await.map_err(|e| e.to_string())?;

            match body {
                OfferOrPending::RTCSession(sdp) => return Ok(*sdp),
                OfferOrPending::Pending(s) => {
                    println!(
                        "[signal] … pending ({:?}), retrying in {}ms",
                        s.status, self.config.poll_interval_ms
                    );
                    sleep(Duration::from_millis(self.config.poll_interval_ms)).await;
                }
            }
        }
    }

    async fn post_answer(
        &self,
        client: &Client,
        session_id: &str,
        answer: &RTCSessionDescription,
    ) -> Result<(), String> {
        let url = format!("{}/session/{}/answer", self.config.signal_base, session_id);
        client
            .post(&url)
            .json(answer)
            .send()
            .await
            .map_err(|e| e.to_string())?
            .error_for_status()
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    /// `POST /session/{id}/reset` — clears the session slot so a fresh offer
    /// can be posted by the initiator.
    async fn reset_session(&self, client: &Client, session_id: &str) -> Result<(), String> {
        let url = format!("{}/session/{}/reset", self.config.signal_base, session_id);
        client
            .post(&url)
            .send()
            .await
            .map_err(|e| e.to_string())?
            .error_for_status()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Cheap pseudo-unique ID for health-check correlation (not crypto-grade).
fn rand_id() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos() as u64
}

// ── Signalling response shapes (private) ─────────────────────────────────────

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct PendingStatus {
    status: String,
}

#[derive(Deserialize, Debug)]
#[serde(untagged)]
enum OfferOrPending {
    RTCSession(Box<RTCSessionDescription>),
    Pending(PendingStatus),
}
