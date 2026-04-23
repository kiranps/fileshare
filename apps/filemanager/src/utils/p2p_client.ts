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
};

type Handler = (payload: any) => Promise<any> | any;

type RPCRequest = {
	id: string;
	op: string;
	payload: any;
};

type RPCResponse = {
	id: string;
	status: string;
	data?: any;
	error?: string;
};

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
   RPC Layer
========================= */

class PeerRPC {
	private peer: SimplePeerInstance;
	private handlers = new Map<string, Handler>();
	private pending = new Map<string, { resolve: Function; reject: Function; timeout: any }>();

	constructor(peer: SimplePeerInstance) {
		this.peer = peer;

		peer.on("data", (raw: Buffer | string) => {
			const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);

			const msg: RPCMessage = JSON.parse(text);
			this.handleMessage(msg);
		});
	}

	request(op: string, payload: any, timeoutMs = 10000): Promise<any> {
		const id = crypto.randomUUID();

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.pending.delete(id);
				reject(new Error("timeout"));
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

	private async handleMessage(msg: RPCMessage) {
		const p = this.pending.get(msg.id);
		if (!p) return;

		clearTimeout(p.timeout);
		this.pending.delete(msg.id);

		if ("status" in msg) {
			msg.error ? p.reject(new Error(msg.error)) : p.resolve(msg.data);
		}
		return;
	}

	private send(msg: RPCMessage) {
		this.peer.send(JSON.stringify(msg));
	}
}

/* =========================
   Connection Object
========================= */

class P2PConnection extends Emitter {
	sid: string | null = null;
	private rpc: PeerRPC | null = null;

	attachRPC(rpc: PeerRPC) {
		this.rpc = rpc;
	}

	request(op: string, payload: any) {
		if (!this.rpc) throw new Error("not ready");
		return this.rpc.request(op, payload);
	}

	handle(op: string, handler: Handler) {
		this.rpc?.handle(op, handler);
	}
}

/* =========================
   Singleton Service
========================= */

class P2PService {
	private static instance: P2PService;

	static getInstance() {
		if (!this.instance) this.instance = new P2PService();
		return this.instance;
	}

	private peer: SimplePeerInstance | null = null;
	private rpc: PeerRPC | null = null;
	private conn: P2PConnection | null = null;

	startSession(): P2PConnection {
		if (this.conn) {
			return this.conn;
		}
		this.cleanup();

		const conn = new P2PConnection();
		this.conn = conn;

		(async () => {
			try {
				const sid = await createSession();

				conn.sid = sid;
				conn.emit("session", sid);

				await this.connectPeer(sid, conn);
			} catch (err: any) {
				conn.emit("error", err);
			}
		})();

		return conn;
	}

	private async connectPeer(sid: string, conn: P2PConnection) {
		const peer = new SimplePeer({ initiator: true, trickle: false });
		this.peer = peer;

		peer.on("signal", async (data) => {
			await postOffer(sid, JSON.stringify(data));
			const answer = await pollAnswer(sid);
			peer.signal(answer);
		});

		peer.on("connect", () => {
			this.rpc = new PeerRPC(peer);
			conn.attachRPC(this.rpc);

			conn.emit("ready");
		});

		peer.on("close", () => {
			this.rpc?.cleanup();
			conn.emit("close");
		});

		peer.on("error", (err) => {
			conn.emit("error", err);
		});
	}

	private cleanup() {
		this.rpc?.cleanup();

		if (this.peer) {
			this.peer.removeAllListeners();
			try {
				this.peer.destroy();
			} catch {}
		}

		this.peer = null;
		this.rpc = null;
	}
}

/* =========================
   Export
========================= */

export const p2p = P2PService.getInstance();
