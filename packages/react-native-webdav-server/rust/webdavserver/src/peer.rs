///// rust_p2p — a PeerJS-inspired WebRTC responder crate.
/////
///// # Quick start
///// ```rust,no_run
///// use rust_p2p::{Peer, PeerConfig};
/////
///// #[tokio::main]
///// async fn main() {
/////     let peer = Peer::new(PeerConfig::default());
/////
/////     peer.on_open(|peer| Box::pin(async move {
/////         println!("data channel open — ready to chat");
/////     }));
/////
/////     peer.on_data(|msg, peer| Box::pin(async move {
/////         println!("< {msg}");
/////         peer.send(&format!("pong: {msg}")).await.ok();
/////     }));
/////
/////     peer.on_close(|| Box::pin(async { println!("closed"); }));
/////
/////     peer.connect("my-session-id").await.unwrap();
///// }
///// ```
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

/// Configuration for the signalling server and ICE.
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
}

impl Default for PeerConfig {
    fn default() -> Self {
        Self {
            signal_base: "http://localhost:9000".to_string(),
            poll_interval_ms: 1_000,
            poll_timeout_secs: 120,
            ice_servers: vec!["stun:stun.l.google.com:19302".to_string()],
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
pub struct Peer {
    config: PeerConfig,
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
    /// Handler receives an `Arc<Peer>` so it can call `.send()`.
    pub async fn on_open<F, Fut>(&self, handler: F)
    where
        F: Fn(Arc<Peer>) -> Fut + Send + Sync + 'static,
        Fut: std::future::Future<Output = ()> + Send + 'static,
    {
        *self.on_open.lock().await = Some(Arc::new(move |p| Box::pin(handler(p))));
    }

    /// Called for every inbound data-channel message.
    /// Handler receives the message text and an `Arc<Peer>` for replying.
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

    /// Send a text message to the remote peer over the data channel.
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

    async fn emit_error(&self, err: String) {
        if let Some(h) = self.on_error.lock().await.clone() {
            h(err).await;
        }
    }

    // ── Connect (responder flow) ──────────────────────────────────────────────

    /// Connect to an existing session as the **Responder**.
    ///
    /// 1. Polls `GET /session/{id}/offer` until the initiator posts one.
    /// 2. Performs WebRTC negotiation and posts the answer.
    /// 3. Returns once the data channel is open (fires `on_open`).
    pub async fn connect(self: &Arc<Self>, session_id: &str) -> Result<(), String> {
        let client = Client::new();

        // ── Poll for offer ────────────────────────────────────────────────────
        println!("[signal] ⏳ waiting for offer on session={session_id}…");
        let offer = self.poll_offer(&client, session_id).await.map_err(|e| {
            let _ = self.emit_error(e.clone());
            e
        })?;
        println!("[signal] 📥 offer received");

        // ── Build WebRTC peer connection ──────────────────────────────────────
        println!("[peer]   🔧 building WebRTC answer…");
        let (pc, answer) = self.negotiate(offer).await.map_err(|e| {
            let es = e.to_string();
            let _ = self.emit_error(es.clone());
            es
        })?;
        println!("[peer]   ✅ answer ready");

        *self._pc.lock().await = Some(pc);

        // ── Post answer ───────────────────────────────────────────────────────
        self.post_answer(&client, session_id, &answer)
            .await
            .map_err(|e| {
                let _ = self.emit_error(e.clone());
                e
            })?;
        println!("[signal] 📤 answer posted — WebRTC handshake in flight");

        Ok(())
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

        // Data channel handler
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

            // Store dc so send() works; also hand it to the message handler
            let peer_msg = Arc::clone(&peer_ref);
            let peer_store = Arc::clone(&peer_ref);
            dc.on_message(Box::new(move |msg: DataChannelMessage| {
                let text = String::from_utf8_lossy(&msg.data).to_string();
                println!("[peer]   📩 received: {text:?}");
                let p = Arc::clone(&peer_msg);
                Box::pin(async move { p.emit_data(text).await })
            }));

            // Store the data channel reference
            let dc_arc = Arc::clone(&dc);
            Box::pin(async move {
                *peer_store.dc.lock().await = Some(dc_arc);
            })
        }));

        // ICE gathering (trickle disabled — wait for null candidate)
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
