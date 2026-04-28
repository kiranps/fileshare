//! WebRTC P2P responder — PeerJS-inspired.
//!
//! # Reconnection strategy
//!
//! `connect` establishes the WebRTC connection and automatically reconnects
//! when the data channel closes (`on_close`).
//!
//! Reconnection logic:
//! 1. After a close, call `POST /session/{id}/reset` on the signalling server.
//! 2. Poll `GET /session/{id}/offer` until the response contains an offer whose
//!    `version` field **differs** from the version of the last successfully
//!    established connection.  This ensures we never re-use a stale offer.
//! 3. Perform the WebRTC handshake with the new offer and post the answer.
//! 4. Repeat until `max_reconnect_attempts` is reached (0 = unlimited).

use std::{
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};

use axum::body::Bytes;
use reqwest::Client;
use serde::Deserialize;
use tokio::{sync::Mutex, time::sleep};
use tracing::info;
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
/// Create one, attach handlers with `on_*`, then call `connect(session_id)`.
/// `connect` handles the initial connection **and** automatic reconnection on
/// data-channel close.
///
/// ## Data channels
///
/// Two data channels are used:
/// - **`"control"`** (label) — UTF-8 JSON messages; all request/response
///   traffic goes here.  This is the channel that fires `on_data`.
/// - **`"file"`** (label) — raw binary chunks for streaming downloads.  The
///   caller sends binary frames here via [`Peer::send_binary`] and checks
///   back-pressure via [`Peer::file_buffered_amount`].
pub struct Peer {
    pub config: PeerConfig,
    on_open: Mutex<Option<OpenHandler>>,
    on_data: Mutex<Option<DataHandler>>,
    on_close: Mutex<Option<CloseHandler>>,
    on_error: Mutex<Option<ErrorHandler>>,
    /// The active control data channel (set after WebRTC negotiation completes).
    dc: Mutex<Option<Arc<RTCDataChannel>>>,
    /// The active file data channel for binary streaming.
    file_dc: Mutex<Option<Arc<RTCDataChannel>>>,
    /// Keep the RTCPeerConnection alive.
    _pc: Mutex<Option<Arc<RTCPeerConnection>>>,
    /// Signals that the data channel has closed and a reconnect should occur.
    closed_flag: Arc<AtomicBool>,
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
            file_dc: Mutex::new(None),
            _pc: Mutex::new(None),
            closed_flag: Arc::new(AtomicBool::new(false)),
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

    /// Send a text message over the control data channel.
    pub async fn send(&self, text: &str) -> Result<(), String> {
        match self.dc.lock().await.as_ref() {
            Some(dc) => dc
                .send_text(text.to_string())
                .await
                .map_err(|e| e.to_string())
                .map(|_| ()),
            None => Err("control data channel not open yet".to_string()),
        }
    }

    /// Send a binary chunk over the file data channel.
    pub async fn send_binary(&self, data: &[u8]) -> Result<(), String> {
        match self.file_dc.lock().await.as_ref() {
            Some(dc) => dc
                .send(&Bytes::copy_from_slice(data))
                .await
                .map_err(|e| e.to_string())
                .map(|_| ()),
            None => Err("file data channel not open yet".to_string()),
        }
    }

    /// Return the current `bufferedAmount` of the file data channel in bytes.
    ///
    /// Used for back-pressure: pause sending when this exceeds a threshold and
    /// resume once it drains below the threshold.
    pub async fn file_buffered_amount(&self) -> u64 {
        match self.file_dc.lock().await.as_ref() {
            Some(dc) => dc.buffered_amount().await as u64,
            None => 0,
        }
    }

    // ── Connect with automatic reconnection ──────────────────────────────────

    /// Connect to an existing session as the **Responder**, with automatic
    /// reconnection on data-channel close.
    ///
    /// # Reconnection
    ///
    /// After a close the session is reset on the signalling server and the
    /// offer endpoint is polled.  The loop only proceeds once the offer
    /// `version` is **different** from the version of the last successfully
    /// established connection, ensuring the initiator has posted a fresh offer.
    ///
    /// The loop runs until `max_reconnect_attempts > 0` and that many attempts
    /// have been made.
    pub async fn connect(self: &Arc<Self>, session_id: &str) {
        let client = Client::new();
        //let client = reqwest::Client::builder().use_rustls_tls().build().unwrap();
        let max = self.config.max_reconnect_attempts;
        let mut attempt: u32 = 0;
        // Version of the offer used for the last successfully established connection.
        let mut last_established_version: Option<u32> = None;

        loop {
            attempt += 1;
            if max > 0 && attempt > max {
                println!("[peer]   ❌ max reconnect attempts ({max}) reached — giving up");
                self.emit_error(format!("max reconnect attempts ({max}) reached"))
                    .await;
                return;
            }

            if attempt > 1 {
                // Reset the session slot so the initiator can post a fresh offer.
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

            // ── Poll for a *new* offer ────────────────────────────────────────
            info!("[signal] ⏳ waiting for offer on session={session_id}…");
            let versioned_offer = match self
                .poll_offer_new_version(&client, session_id, last_established_version)
                .await
            {
                Ok(v) => v,
                Err(e) => {
                    println!("[peer]   ❌ offer poll error: {e}");
                    self.emit_error(format!("offer poll error (attempt {attempt}): {e}"))
                        .await;
                    continue;
                }
            };
            info!(
                "[signal] 📥 offer received (version={})",
                versioned_offer.version
            );

            // ── WebRTC negotiation ────────────────────────────────────────────
            println!("[peer]   🔧 building WebRTC answer…");
            let (pc, answer) = match self.negotiate(versioned_offer.sdp).await {
                Ok(v) => v,
                Err(e) => {
                    let es = e.to_string();
                    println!("[peer]   ❌ negotiate error: {es}");
                    self.emit_error(format!("negotiate error (attempt {attempt}): {es}"))
                        .await;
                    continue;
                }
            };
            println!("[peer]   ✅ answer ready");

            *self._pc.lock().await = Some(pc);

            if let Err(e) = self.post_answer(&client, session_id, &answer).await {
                println!("[peer]   ❌ post answer error: {e}");
                self.emit_error(format!("post answer error (attempt {attempt}): {e}"))
                    .await;
                *self._pc.lock().await = None;
                continue;
            }
            println!("[signal] 📤 answer posted — WebRTC handshake in flight");

            // Record the version that produced a successful connection.
            last_established_version = Some(versioned_offer.version);

            // Reset the closed flag for this connection.
            self.closed_flag.store(false, Ordering::SeqCst);

            // ── Wait for data-channel close ───────────────────────────────────
            println!("[peer]   ✅ connected — waiting for data-channel close");
            self.wait_for_close().await;

            println!("[peer]   🔴 data channel closed — will reconnect");

            // Clear stale dc/pc so the next iteration starts clean.
            *self.dc.lock().await = None;
            *self.file_dc.lock().await = None;
            *self._pc.lock().await = None;
        }
    }

    // ── Internal: wait for close ──────────────────────────────────────────────

    /// Suspends until the data channel fires its close event (sets `closed_flag`).
    async fn wait_for_close(&self) {
        loop {
            if self.closed_flag.load(Ordering::SeqCst) {
                return;
            }
            sleep(Duration::from_millis(100)).await;
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
        self.closed_flag.store(true, Ordering::SeqCst);
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

            match label.as_str() {
                "file" => {
                    // ── File data channel — binary streaming ──────────────
                    let peer_store = Arc::clone(&peer_ref);
                    let dc_arc = Arc::clone(&dc);
                    Box::pin(async move {
                        println!("[peer]   ✅ file data channel ready");
                        *peer_store.file_dc.lock().await = Some(dc_arc);
                    })
                }
                _ => {
                    // ── Control data channel (label "control" or anything else)
                    let peer_open = Arc::clone(&peer_ref);
                    dc.on_open(Box::new(move || {
                        println!("[peer]   ✅ control data channel ready");
                        let p = Arc::clone(&peer_open);
                        Box::pin(async move { p.emit_open().await })
                    }));

                    let peer_close = Arc::clone(&peer_ref);
                    dc.on_close(Box::new(move || {
                        println!("[peer]   🔴 control data channel closed");
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
                }
            }
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

    /// Poll `GET /session/{id}/offer` until an offer arrives whose `version`
    /// differs from `last_version` (or `last_version` is `None`).
    async fn poll_offer_new_version(
        &self,
        client: &Client,
        session_id: &str,
        last_version: Option<u32>,
    ) -> Result<VersionedOffer, String> {
        let url = format!("{}/session/{}/offer", self.config.signal_base, session_id);
        let deadline =
            tokio::time::Instant::now() + Duration::from_secs(self.config.poll_timeout_secs);

        loop {
            if tokio::time::Instant::now() > deadline {
                info!("timed out {}", self.config.poll_timeout_secs);
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
                OfferOrPending::Offer(offer) => {
                    // Only accept this offer if its version is new.
                    if let Some(lv) = last_version {
                        if offer.version == lv {
                            println!(
                                "[signal] … offer version={} matches last established version — waiting for new offer",
                                offer.version
                            );
                            sleep(Duration::from_millis(self.config.poll_interval_ms)).await;
                            continue;
                        }
                    }
                    return Ok(offer);
                }
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

// ── Signalling response shapes (private) ─────────────────────────────────────

/// An offer with a version tag, as returned by the signalling server.
#[derive(Debug, Deserialize)]
struct VersionedOffer {
    /// Opaque version (monotonic counter) set by the initiator.
    version: u32,
    /// The actual SDP offer.
    #[serde(flatten)]
    sdp: RTCSessionDescription,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct PendingStatus {
    status: String,
}

#[derive(Deserialize, Debug)]
#[serde(untagged)]
enum OfferOrPending {
    Offer(VersionedOffer),
    Pending(PendingStatus),
}
