/**
 * Tests for p2p_client.ts
 *
 * Strategy:
 *  - Emitter and guard tests operate directly on P2PConnection (no mocking needed).
 *  - PeerRPC / P2PService tests mock SimplePeer (as a class) and the signalling
 *    module, then manually trigger peer lifecycle events to drive state transitions.
 *
 * SimplePeer must be mocked as a class (not vi.fn()) so that `new SimplePeer()`
 * returns a controllable instance. A module-level `_peerTemplate` object holds
 * the vi.fn() stubs; the mock class copies them onto `this` at construction time
 * and then reassigns `_peerTemplate` to `this` so tests can reference the live
 * instance.
 *
 * Because P2PService is a singleton, each test resets its private state via
 * a cast to `any` in the afterEach hook.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { P2PConnection } from "./p2p_client";
import * as signalling from "./signalling";

/* =========================
   SimplePeer class mock
========================= */

let _peerTemplate: {
	on: ReturnType<typeof vi.fn>;
	send: ReturnType<typeof vi.fn>;
	removeAllListeners: ReturnType<typeof vi.fn>;
	destroy: ReturnType<typeof vi.fn>;
	_pc: any;
	_listeners: Record<string, ((...args: any[]) => void)[]>;
	_emit(event: string, ...args: any[]): void;
};

vi.mock("simple-peer", () => {
	class MockSimplePeer {
		constructor(_opts: any) {
			Object.assign(this, _peerTemplate);
			_peerTemplate = this as any;
		}
	}
	return { default: MockSimplePeer };
});

vi.mock("./signalling", () => ({
	createSession: vi.fn(),
	postOffer: vi.fn(),
	pollAnswer: vi.fn(),
	resetSession: vi.fn(),
}));

/* =========================
   Helpers
========================= */

function makeMockDC(label = "file") {
	return {
		label,
		binaryType: "arraybuffer" as BinaryType,
		onmessage: null as ((ev: MessageEvent) => void) | null,
		onerror: null as ((ev: Event) => void) | null,
		onclose: null as ((ev: Event) => void) | null,
		close: vi.fn(),
		send: vi.fn(),
	};
}

function makePeerTemplate() {
	const listeners: Record<string, ((...args: any[]) => void)[]> = {};

	_peerTemplate = {
		_listeners: listeners,
		on: vi.fn((event: string, cb: (...args: any[]) => void) => {
			if (!listeners[event]) listeners[event] = [];
			listeners[event].push(cb);
		}),
		send: vi.fn(),
		removeAllListeners: vi.fn(),
		destroy: vi.fn(),
		_pc: null,
		_emit(event: string, ...args: any[]) {
			(listeners[event] ?? []).forEach((cb) => cb(...args));
		},
	};
}

/* =========================
   Import singleton (after mocks are hoisted)
========================= */

import { p2p } from "./p2p_client";

/* =========================
   Lifecycle hooks
========================= */

beforeEach(() => {
	vi.clearAllMocks();
	makePeerTemplate();
	vi.mocked(signalling.createSession).mockResolvedValue("test-session-id");
	vi.mocked(signalling.postOffer).mockResolvedValue(undefined);
	vi.mocked(signalling.pollAnswer).mockResolvedValue({ sdp: "v=0\r\n" });
	vi.mocked(signalling.resetSession).mockResolvedValue(undefined);
});

afterEach(() => {
	(p2p as any).state = "idle";
	(p2p as any).conn = null;
	(p2p as any).peer = null;
	(p2p as any).rpc = null;
	(p2p as any).reconnecting = false;
	if ((p2p as any).healthCheckTimer !== null) {
		clearInterval((p2p as any).healthCheckTimer);
		(p2p as any).healthCheckTimer = null;
	}
});

async function setupConnected(channelLabels: string[] = []) {
	(p2p as any).state = "idle";
	(p2p as any).conn = null;
	(p2p as any).peer = null;

	const mockDCs: Record<string, ReturnType<typeof makeMockDC>> = {};
	for (const label of channelLabels) {
		mockDCs[label] = makeMockDC(label);
	}

	const conn = p2p.startSession(undefined, channelLabels);

	await vi.waitFor(() => expect(_peerTemplate.on).toHaveBeenCalled(), { timeout: 2000 });

	_peerTemplate._pc = {
		createDataChannel: vi.fn((label: string) => mockDCs[label] ?? makeMockDC(label)),
	};
	_peerTemplate._emit("connect");

	return { conn, mockDCs };
}

/* =========================
   P2PConnection – Emitter
========================= */

describe("P2PConnection – Emitter", () => {
	it("emits and receives a session event", () => {
		const conn = new P2PConnection();
		const handler = vi.fn();
		conn.on("session", handler);
		conn.emit("session", "sid-abc");
		expect(handler).toHaveBeenCalledWith("sid-abc");
	});

	it("emits ready, close, and error events", () => {
		const conn = new P2PConnection();
		const onReady = vi.fn();
		const onClose = vi.fn();
		const onError = vi.fn();

		conn.on("ready", onReady);
		conn.on("close", onClose);
		conn.on("error", onError);

		conn.emit("ready");
		conn.emit("close");
		conn.emit("error", new Error("boom"));

		expect(onReady).toHaveBeenCalledOnce();
		expect(onClose).toHaveBeenCalledOnce();
		expect(onError).toHaveBeenCalledWith(expect.any(Error));
	});

	it("only registers one listener per event (idempotent on)", () => {
		const conn = new P2PConnection();
		const cb1 = vi.fn();
		const cb2 = vi.fn();
		conn.on("ready", cb1);
		conn.on("ready", cb2);
		conn.emit("ready");
		expect(cb1).toHaveBeenCalledOnce();
		expect(cb2).not.toHaveBeenCalled();
	});

	it("clear() removes all listeners", () => {
		const conn = new P2PConnection();
		const handler = vi.fn();
		conn.on("ready", handler);
		conn.clear();
		conn.emit("ready");
		expect(handler).not.toHaveBeenCalled();
	});
});

/* =========================
   P2PConnection – channel management
========================= */

describe("P2PConnection – channel management", () => {
	it("attachChannel() stores and getChannel() retrieves by label", () => {
		const conn = new P2PConnection();
		const dc = makeMockDC("upload") as unknown as RTCDataChannel;
		conn.attachChannel(dc);
		expect(conn.getChannel("upload")).toBe(dc);
	});

	it("attachChannel() is idempotent — returns the first registration", () => {
		const conn = new P2PConnection();
		const dc1 = makeMockDC("upload") as unknown as RTCDataChannel;
		const dc2 = makeMockDC("upload") as unknown as RTCDataChannel;
		conn.attachChannel(dc1);
		const returned = conn.attachChannel(dc2);
		expect(returned).toBe(dc1);
		expect(conn.getChannel("upload")).toBe(dc1);
	});

	it("getChannel() returns null for unknown label", () => {
		const conn = new P2PConnection();
		expect(conn.getChannel("nope")).toBeNull();
	});

	it("cleanupChannels() closes all registered channels", () => {
		const conn = new P2PConnection();
		const dc1 = makeMockDC("a") as unknown as RTCDataChannel & { close: ReturnType<typeof vi.fn> };
		const dc2 = makeMockDC("b") as unknown as RTCDataChannel & { close: ReturnType<typeof vi.fn> };
		conn.attachChannel(dc1);
		conn.attachChannel(dc2);
		conn.cleanupChannels();
		expect((dc1 as any).close).toHaveBeenCalledOnce();
		expect((dc2 as any).close).toHaveBeenCalledOnce();
		expect(conn.getChannel("a")).toBeNull();
		expect(conn.getChannel("b")).toBeNull();
	});
});

/* =========================
   P2PConnection – guards
========================= */

describe("P2PConnection – guards when not ready", () => {
	it("request() throws if RPC not attached", () => {
		const conn = new P2PConnection();
		expect(() => conn.request("fs.ping", {})).toThrow("P2P not ready");
	});

	it("requestWithId() throws if RPC not attached", () => {
		const conn = new P2PConnection();
		expect(() => conn.requestWithId("some-id", "fs.ping", {})).toThrow("P2P not ready");
	});
});

/* =========================
   PeerRPC – via P2PConnection.request()
========================= */

describe("PeerRPC – request / response round-trip", () => {
	it("sends a JSON message and resolves on ok response", async () => {
		const { conn } = await setupConnected();

		const resultPromise = conn.request("fs.ls", { path: "/" });

		expect(_peerTemplate.send).toHaveBeenCalledOnce();
		const sentMsg = JSON.parse(_peerTemplate.send.mock.calls[0][0]);
		expect(sentMsg.op).toBe("fs.ls");
		expect(sentMsg.payload).toEqual({ path: "/" });

		_peerTemplate._emit(
			"data",
			Buffer.from(
				JSON.stringify({ id: sentMsg.id, op: "fs.ls", ok: true, status: "ok", data: ["a.txt"] }),
			),
		);

		await expect(resultPromise).resolves.toEqual(["a.txt"]);
	});

	it("rejects on error response with error field", async () => {
		const { conn } = await setupConnected();

		const resultPromise = conn.request("fs.ls", { path: "/forbidden" });
		const sentMsg = JSON.parse(_peerTemplate.send.mock.calls[0][0]);

		_peerTemplate._emit(
			"data",
			Buffer.from(
				JSON.stringify({
					id: sentMsg.id,
					op: "fs.ls",
					ok: false,
					status: "forbidden",
					error: "access denied",
				}),
			),
		);

		await expect(resultPromise).rejects.toThrow("access denied");
	});

	it("rejects with status when error field is absent", async () => {
		const { conn } = await setupConnected();

		const resultPromise = conn.request("fs.stat", { path: "/x" });
		const sentMsg = JSON.parse(_peerTemplate.send.mock.calls[0][0]);

		_peerTemplate._emit(
			"data",
			Buffer.from(
				JSON.stringify({ id: sentMsg.id, op: "fs.stat", ok: false, status: "not_found" }),
			),
		);

		await expect(resultPromise).rejects.toThrow("not_found");
	});

	it("ignores responses with unknown id", async () => {
		const { conn } = await setupConnected();

		expect(() => {
			_peerTemplate._emit(
				"data",
				Buffer.from(JSON.stringify({ id: "unknown-id", op: "fs.ls", ok: true, status: "ok", data: [] })),
			);
		}).not.toThrow();

		const p = conn.request("fs.ping", {});
		const sentMsg = JSON.parse(_peerTemplate.send.mock.calls[0][0]);
		_peerTemplate._emit(
			"data",
			Buffer.from(JSON.stringify({ id: sentMsg.id, op: "fs.ping", ok: true, status: "ok", data: {} })),
		);
		await expect(p).resolves.toBeDefined();
	});

	it("requestWithId() uses the supplied id", async () => {
		const { conn } = await setupConnected();

		const myId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
		const p = conn.requestWithId(myId, "fs.stat", { path: "/foo" });

		const sentMsg = JSON.parse(_peerTemplate.send.mock.calls[0][0]);
		expect(sentMsg.id).toBe(myId);

		_peerTemplate._emit(
			"data",
			Buffer.from(JSON.stringify({ id: myId, op: "fs.stat", ok: true, status: "ok", data: { size: 42 } })),
		);
		await expect(p).resolves.toEqual({ size: 42 });
	});
});

/* =========================
   P2PService – multi-channel support
========================= */

describe("P2PService – multi-channel support", () => {
	it("opens requested channels on connect and makes them available via getChannel()", async () => {
		const { conn } = await setupConnected(["file", "upload"]);

		expect(_peerTemplate._pc.createDataChannel).toHaveBeenCalledWith("file", { ordered: true });
		expect(_peerTemplate._pc.createDataChannel).toHaveBeenCalledWith("upload", { ordered: true });
		expect(conn.getChannel("file")).not.toBeNull();
		expect(conn.getChannel("upload")).not.toBeNull();
	});

	it("no extra channels are created when channelLabels is empty", async () => {
		await setupConnected([]);
		expect(_peerTemplate._pc.createDataChannel).not.toHaveBeenCalled();
	});

	it("cleanupChannels() is called on peer close", async () => {
		const { conn } = await setupConnected(["file"]);
		const cleanupSpy = vi.spyOn(conn, "cleanupChannels");

		_peerTemplate._emit("close");

		expect(cleanupSpy).toHaveBeenCalledOnce();
	});
});

/* =========================
   P2PService – startSession lifecycle
========================= */

describe("P2PService – startSession", () => {
	it("returns the existing conn if already starting/connected", () => {
		(p2p as any).state = "idle";
		(p2p as any).conn = null;

		const conn1 = p2p.startSession();
		const conn2 = p2p.startSession();

		expect(conn1).toBe(conn2);
	});

	it("emits session event with the new session id", async () => {
		vi.mocked(signalling.createSession).mockResolvedValue("new-sid-42");

		(p2p as any).state = "idle";
		(p2p as any).conn = null;

		const conn = p2p.startSession();
		const onSession = vi.fn();
		conn.on("session", onSession);

		await vi.waitFor(() => expect(onSession).toHaveBeenCalled(), { timeout: 2000 });
		expect(onSession).toHaveBeenCalledWith("new-sid-42");
	});

	it("transitions to connected state after peer emits connect", async () => {
		await setupConnected();
		expect((p2p as any).state).toBe("connected");
	});

	it("emits close when peer closes", async () => {
		const { conn } = await setupConnected();
		const onClose = vi.fn();
		conn.on("close", onClose);

		_peerTemplate._emit("close");

		expect(onClose).toHaveBeenCalledOnce();
	});

	it("emits error if createSession rejects", async () => {
		vi.mocked(signalling.createSession).mockRejectedValue(new Error("network error"));

		(p2p as any).state = "idle";
		(p2p as any).conn = null;

		const conn = p2p.startSession();
		const onError = vi.fn();
		conn.on("error", onError);

		await vi.waitFor(() => expect(onError).toHaveBeenCalled(), { timeout: 2000 });
		expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "network error" }));
	});

	it("sets conn.sid to the new session id", async () => {
		vi.mocked(signalling.createSession).mockResolvedValue("sid-for-conn");

		(p2p as any).state = "idle";
		(p2p as any).conn = null;

		const conn = p2p.startSession();
		await vi.waitFor(() => expect(conn.sid).toBe("sid-for-conn"), { timeout: 2000 });
	});

	it("uses provided sid and calls resetSession instead of createSession", async () => {
		(p2p as any).state = "idle";
		(p2p as any).conn = null;

		const conn = p2p.startSession("existing-sid");
		await vi.waitFor(() => expect(_peerTemplate.on).toHaveBeenCalled(), { timeout: 2000 });

		expect(signalling.createSession).not.toHaveBeenCalled();
		expect(signalling.resetSession).toHaveBeenCalledWith("existing-sid");
		expect(conn.sid).toBe("existing-sid");
	});
});
