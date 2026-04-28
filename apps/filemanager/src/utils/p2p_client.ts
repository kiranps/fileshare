import SimplePeer from "simple-peer";
import type { Instance as SimplePeerInstance } from "simple-peer";
import { createSession, pollAnswer, postOffer, resetSession } from "./signalling";

/* =========================
   Types
========================= */

type Events = {
	session: (sid: string) => void;
	ready: () => void;
	close: () => void;
	error: (err: Error) => void;
	reconnecting: () => void;
};

type Handler = (payload: any) => Promise<any> | any;

type RPCRequest = {
	id: string;
	op: string;
	payload: any;
};

type RPCResponse = {
	id: string;
	op: string;
	ok: boolean;
	status: string;
	data?: any;
	error?: string;
};

type State = "idle" | "starting" | "connected";

type RPCMessage = RPCRequest | RPCResponse;

/* =========================
   Event Emitter
========================= */

class Emitter {
	private listeners: { [K in keyof Events]?: Events[K][] } = {};

	on<K extends keyof Events>(event: K, cb: Events[K]) {
		if (this.listeners[event]) return;
		this.listeners[event] = [];
		const list = this.listeners[event]!;
		list.push(cb);
	}

	emit<K extends keyof Events>(event: K, ...args: Parameters<Events[K]>) {
		this.listeners[event]?.forEach((cb) => (cb as any)(...args));
	}

	clear() {
		this.listeners = {};
	}
}

/* =========================
   RPC Layer  (control channel — JSON messages)
========================= */

class PeerRPC {
	private peer: SimplePeerInstance;
	private handlers = new Map<string, Handler>();
	private pending = new Map<string, { resolve: Function; reject: Function; timeout: ReturnType<typeof setTimeout> }>();

	constructor(peer: SimplePeerInstance) {
		this.peer = peer;

		peer.on("data", (raw: Buffer | string) => {
			const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
			console.log(text);
			const msg: RPCMessage = JSON.parse(text);
			this.handleMessage(msg);
		});
	}

	request(op: string, payload: any, timeoutMs = 90000): Promise<any> {
		const id = crypto.randomUUID();
		return this.requestWithId(id, op, payload, timeoutMs);
	}

	requestWithId(id: string, op: string, payload: any, timeoutMs = 90000): Promise<any> {
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.pending.delete(id);
				reject(new Error(`RPC timeout: ${op}`));
			}, timeoutMs);

			this.pending.set(id, { resolve, reject, timeout });
			this.send({ id, op, payload });
		});
	}

	handle(op: string, handler: Handler) {
		this.handlers.set(op, handler);
	}

	cleanup() {
		this.pending.forEach((p) => {
			clearTimeout(p.timeout);
			p.reject(new Error("disconnected"));
		});
		this.pending.clear();
	}

	private handleMessage(msg: RPCMessage) {
		const p = this.pending.get(msg.id);
		if (!p) return;

		clearTimeout(p.timeout);
		this.pending.delete(msg.id);

		if ("ok" in msg) {
			msg.ok ? p.resolve(msg.data) : p.reject(new Error(msg.error ?? msg.status));
		}
	}

	private send(msg: RPCMessage) {
		this.peer.send(JSON.stringify(msg));
	}
}

/* =========================
   Connection Object
========================= */

export class P2PConnection extends Emitter {
	sid: string | null = null;
	private rpc: PeerRPC | null = null;

	/** Open RTCDataChannels keyed by their label. */
	private channels = new Map<string, RTCDataChannel>();

	attachRPC(rpc: PeerRPC) {
		this.rpc = rpc;
	}

	/**
	 * Register a named RTCDataChannel on this connection. If a channel with the
	 * same label is already registered the existing one is returned unchanged.
	 */
	attachChannel(dc: RTCDataChannel): RTCDataChannel {
		const existing = this.channels.get(dc.label);
		if (existing) return existing;
		this.channels.set(dc.label, dc);
		return dc;
	}

	/**
	 * Return the RTCDataChannel registered under `label`, or null if none has
	 * been attached yet.
	 */
	getChannel(label: string): RTCDataChannel | null {
		return this.channels.get(label) ?? null;
	}

	/** Send a JSON RPC request on the control channel. */
	request(op: string, payload: any) {
		if (!this.rpc) throw new Error("P2P not ready");
		return this.rpc.request(op, payload);
	}

	/** @internal Used by PeerRPC for correlated requests. */
	requestWithId(id: string, op: string, payload: any) {
		if (!this.rpc) throw new Error("P2P not ready");
		return this.rpc.requestWithId(id, op, payload);
	}

	handle(op: string, handler: Handler) {
		this.rpc?.handle(op, handler);
	}

	cleanupChannels() {
		for (const dc of this.channels.values()) {
			try {
				dc.close();
			} catch {}
		}
		this.channels.clear();
	}
}

/* =========================
   Singleton Service
========================= */

const HEALTH_CHECK_INTERVAL_MS = 15_000;

class P2PService {
	private static instance: P2PService;

	static getInstance() {
		if (!this.instance) this.instance = new P2PService();
		return this.instance;
	}

	private peer: SimplePeerInstance | null = null;
	private rpc: PeerRPC | null = null;
	public conn: P2PConnection | null = null;
	private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
	private reconnecting = false;
	private state: State = "idle";

	/**
	 * Start a P2P session.
	 * @param sid - Optional existing session ID. If provided, skips createSession and reconnects instead.
	 * @param channelLabels - Labels of additional RTCDataChannels to open on connect (e.g. `["file"]`).
	 */
	startSession(sid?: string, channelLabels: string[] = []): P2PConnection {
		if (this.state === "starting" || this.state === "connected") {
			return this.conn!;
		}

		this.state = "starting";

		this.cleanup();

		const conn = new P2PConnection();
		this.conn = conn;

		(async () => {
			try {
				if (sid) {
					conn.sid = sid;
					await resetSession(sid);
					await this.connectPeer(sid, conn, channelLabels);
				} else {
					const newSid = await createSession();
					conn.sid = newSid;
					conn.emit("session", newSid);
					await this.connectPeer(newSid, conn, channelLabels);
				}
			} catch (err: any) {
				conn.emit("error", err);
			}
		})();

		return conn;
	}

	private async connectPeer(sid: string, conn: P2PConnection, channelLabels: string[]) {
		const peer = new SimplePeer({ initiator: true, trickle: false });
		this.peer = peer;

		peer.on("signal", async (data) => {
			try {
				await postOffer(sid, JSON.stringify(data));
				const answer = await pollAnswer(sid);
				peer.signal(answer);
			} catch (err: any) {
				this.state = "idle";
				this.cleanup();
				conn.emit("error", err);
			}
		});

		peer.on("connect", () => {
			this.state = "connected";
			console.log("connected");

			// Control channel — JSON RPC
			this.rpc = new PeerRPC(peer);
			conn.attachRPC(this.rpc);

			// Open any additional RTCDataChannels requested by the caller.
			const rtcPc: RTCPeerConnection = (peer as any)._pc;
			if (rtcPc) {
				for (const label of channelLabels) {
					const dc = rtcPc.createDataChannel(label, { ordered: true });
					conn.attachChannel(dc);
				}
			}

			this.reconnecting = false;
			this.startHealthCheck(conn, channelLabels);
			conn.emit("ready");
		});

		peer.on("close", () => {
			this.rpc?.cleanup();
			conn.cleanupChannels();
			this.stopHealthCheck();
			conn.emit("close");
		});

		peer.on("error", (err) => {
			console.log("error :", err);
			this.stopHealthCheck();
			this.triggerReconnect(conn, channelLabels);
			conn.emit("error", err);
		});
	}

	private startHealthCheck(conn: P2PConnection, channelLabels: string[] = []) {
		this.stopHealthCheck();

		this.healthCheckTimer = setInterval(async () => {
			try {
				await conn.request("fs.ping", {});
			} catch {
				this.stopHealthCheck();
				this.triggerReconnect(conn, channelLabels);
			}
		}, HEALTH_CHECK_INTERVAL_MS);
	}

	private stopHealthCheck() {
		if (this.healthCheckTimer !== null) {
			clearInterval(this.healthCheckTimer);
			this.healthCheckTimer = null;
		}
	}

	private triggerReconnect(conn: P2PConnection, channelLabels: string[]) {
		if (this.reconnecting) return;
		this.reconnecting = true;

		const sid = conn.sid;
		if (!sid) {
			conn.emit("error", new Error("Cannot reconnect: no session ID"));
			return;
		}

		conn.emit("reconnecting");

		(async () => {
			try {
				console.log("reconnecting");
				this.cleanupPeer();
				await resetSession(sid);
				await this.connectPeer(sid, conn, channelLabels);
			} catch (err: any) {
				this.reconnecting = false;
				conn.emit("error", err);
			}
		})();
	}

	private cleanupPeer() {
		this.rpc?.cleanup();
		this.conn?.cleanupChannels();

		if (this.peer) {
			this.peer.removeAllListeners();
			try {
				this.peer.destroy();
			} catch {}
		}

		this.peer = null;
		this.rpc = null;
	}

	/** Tear down the current session and clean up all resources. */
	closeSession() {
		this.state = "idle";
		this.cleanup();
	}

	private cleanup() {
		this.stopHealthCheck();
		this.reconnecting = false;
		this.cleanupPeer();
		this.conn = null;
	}
}

/* =========================
   Export
========================= */

export const p2p = P2PService.getInstance();
