import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { dirname } from "../utils/files";
import { p2p } from "../utils/p2p_client";
import type { FileItemProps } from "../types";
import { basename, resolveFileType } from "../utils/files";

/* =========================
   Internal helpers
========================= */

function toFileProps(data: any[]): {
	activeDirectory: FileItemProps | undefined;
	files: FileItemProps[];
} {
	const items: FileItemProps[] = data.map((entry) => {
		const name = basename(entry.path);
		const ext = !entry.is_dir && name.includes(".") ? (name.split(".").pop()?.toLowerCase() ?? "") : "";
		const type = resolveFileType(ext, entry.is_dir);

		return {
			id: entry.path,
			name,
			type,
			size: entry.size,
			modified: entry.last_modified ?? new Date(0),
		};
	});

	const [activeDirectory, ...files] = items;
	return { activeDirectory, files };
}

async function listFiles(path: string) {
	const result = await p2p.conn?.request("fs.list", { path });
	return toFileProps(result);
}

/* =========================
   Hooks
========================= */

/** List files in a directory. */
export function useFiles(path: string) {
	return useQuery({
		queryKey: ["files", path],
		queryFn: () => listFiles(path),
	});
}

/** Delete a file or directory tree. */
export function useDeleteFile() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (path: string) => {
			await p2p.conn?.request("fs.delete", { path });
			return { path };
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["files", dirname(data.path)] });
		},
	});
}

/** Move or rename a file or directory. */
export function useMoveFile() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({
			fromPath,
			toPath,
			overwrite = true,
		}: {
			fromPath: string;
			toPath: string;
			overwrite?: boolean;
		}) => {
			await p2p.conn?.request("fs.move", { src: fromPath, dst: toPath, overwrite });
			return { from: fromPath, to: toPath };
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["files", dirname(data.from)] });
			queryClient.invalidateQueries({ queryKey: ["files", dirname(data.to)] });
		},
	});
}

/** Copy a file or directory. */
export function useCopyFile() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({
			fromPath,
			toPath,
			overwrite = true,
		}: {
			fromPath: string;
			toPath: string;
			overwrite?: boolean;
		}) => {
			await p2p.conn?.request("fs.copy", { src: fromPath, dst: toPath, overwrite });
			return { from: fromPath, to: toPath };
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["files", dirname(data.from)] });
			queryClient.invalidateQueries({ queryKey: ["files", dirname(data.to)] });
		},
	});
}

/** Create a directory. */
export function useCreateDirectory() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (path: string) => {
			await p2p.conn?.request("fs.mkdir", { path });
			return { path };
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["files", dirname(data.path)] });
		},
	});
}

/** Upload a file. */
export function useUploadFile() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({ path, file }: { path: string; file: File }) => {
			const arrayBuffer = await file.arrayBuffer();
			const body_b64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
			await p2p.conn?.request("fs.put", { path, body_b64 });
			return { path };
		},
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({ queryKey: ["files", dirname(variables.path)] });
		},
	});
}

/* =========================
   Binary framing — download data channel
   =========================================================
   Every message on the "file" RTCDataChannel is a raw ArrayBuffer:
     [ 1 byte: frame_type ][ 36 bytes: correlation id (ASCII UUID) ][ N bytes: payload ]

   frame_type values:
     0x01  HEADER  — payload is UTF-8 JSON: { filename: string, total_size: number }
     0x02  CHUNK   — payload is raw binary file bytes
     0x03  EOF     — payload is empty; transfer complete
     0x04  ERROR   — payload is UTF-8 error message string

   The correlation id matches the RPC request id so concurrent downloads are
   demuxed to the right ReadableStream.
========================= */

const DOWNLOAD_CHANNEL_LABEL = "file";

const FRAME = {
	HEADER: 0x01,
	CHUNK: 0x02,
	EOF: 0x03,
	ERROR: 0x04,
} as const;

const ID_LEN = 36; // UUID length in ASCII bytes

export interface DownloadHeader {
	filename: string;
	total_size: number;
}

export interface DownloadStream {
	/** Resolved once the server sends the HEADER frame with filename/size. */
	header: Promise<DownloadHeader>;
	/** ReadableStream of raw binary chunks. Pull to drive the transfer. */
	stream: ReadableStream<Uint8Array>;
	/** Abort the download and close the stream. */
	abort(): void;
}

/**
 * Manages the dedicated ordered RTCDataChannel used for streaming file content
 * as raw binary frames. Multiple concurrent downloads are multiplexed by
 * correlation id.
 *
 * The channel is obtained from the P2PConnection via `getChannel()` and reused
 * for the lifetime of the peer connection.
 */
class DownloadChannel {
	private dc: RTCDataChannel;

	private transfers = new Map<
		string,
		{
			headerResolve: (h: DownloadHeader) => void;
			headerReject: (e: Error) => void;
			controller: ReadableStreamDefaultController<Uint8Array>;
		}
	>();

	constructor(dc: RTCDataChannel) {
		this.dc = dc;
		dc.binaryType = "arraybuffer";

		dc.onmessage = (ev: MessageEvent<ArrayBuffer>) => {
			this.handleFrame(new Uint8Array(ev.data));
		};

		dc.onerror = (ev) => {
			const err = new Error(`Download channel error: ${(ev as any).error?.message ?? "unknown"}`);
			this.rejectAll(err);
		};

		dc.onclose = () => {
			this.rejectAll(new Error("Download channel closed unexpectedly"));
		};
	}

	/**
	 * Register a pending transfer and return a DownloadStream. The caller must
	 * fire the corresponding RPC request (`fs.download`) using `requestWithId`
	 * with the same `id` so the backend stamps frames with the matching
	 * correlation id.
	 */
	requestDownload(id: string): DownloadStream {
		let headerResolve!: (h: DownloadHeader) => void;
		let headerReject!: (e: Error) => void;
		const header = new Promise<DownloadHeader>((res, rej) => {
			headerResolve = res;
			headerReject = rej;
		});

		// We need the controller reference before the ReadableStream is created so
		// we can store it in the transfers map.  The ReadableStream spec guarantees
		// that the `start` callback is invoked synchronously during construction,
		// but we use an intermediate object so the map entry is set *after* the
		// controller is captured, avoiding any potential timing ambiguity.
		let streamController!: ReadableStreamDefaultController<Uint8Array>;
		const stream = new ReadableStream<Uint8Array>({
			start: (ctrl) => {
				streamController = ctrl;
			},
			cancel: () => {
				this.transfers.delete(id);
			},
		});

		// `start` is synchronous — streamController is guaranteed to be set here.
		if (!streamController) {
			throw new Error("ReadableStream controller was not set synchronously — environment not supported");
		}

		this.transfers.set(id, { headerResolve, headerReject, controller: streamController });

		const abort = () => {
			const t = this.transfers.get(id);
			if (!t) return;
			this.transfers.delete(id);
			t.headerReject(new Error("aborted"));
			t.controller.error(new Error("aborted"));
		};

		return { header, stream, abort };
	}

	cleanup() {
		this.rejectAll(new Error("disconnected"));
		try {
			this.dc.close();
		} catch {}
	}

	private handleFrame(frame: Uint8Array) {
		if (frame.byteLength < 1 + ID_LEN) {
			console.warn("[DownloadChannel] malformed frame: byteLength", frame.byteLength);
			return;
		}

		const type = frame[0];
		const id = new TextDecoder().decode(frame.subarray(1, 1 + ID_LEN));
		const payload = frame.subarray(1 + ID_LEN);

		const t = this.transfers.get(id);
		if (!t) {
			console.warn("[DownloadChannel] no transfer found for id:", id);
			return;
		}

		switch (type) {
			case FRAME.HEADER: {
				const meta: DownloadHeader = JSON.parse(new TextDecoder().decode(payload));
				t.headerResolve(meta);
				break;
			}
			case FRAME.CHUNK: {
				// Copy so the backing ArrayBuffer can be GC'd after this handler returns.
				t.controller.enqueue(new Uint8Array(payload));
				break;
			}
			case FRAME.EOF: {
				this.transfers.delete(id);
				t.controller.close();
				break;
			}
			case FRAME.ERROR: {
				const msg = new TextDecoder().decode(payload);
				const err = new Error(msg);
				this.transfers.delete(id);
				t.headerReject(err);
				t.controller.error(err);
				break;
			}
		}
	}

	private rejectAll(err: Error) {
		for (const t of this.transfers.values()) {
			t.headerReject(err);
			t.controller.error(err);
		}
		this.transfers.clear();
	}
}

/** Module-level singleton wrapping the current "file" RTCDataChannel. */
let _downloadChannel: DownloadChannel | null = null;

/**
 * Return (or lazily create) the DownloadChannel for the active P2P connection.
 * Throws if the connection or the "file" data channel is not yet available.
 */
function getDownloadChannel(): DownloadChannel {
	const conn = p2p.conn;
	if (!conn) throw new Error("P2P not connected");

	const dc = conn.getChannel(DOWNLOAD_CHANNEL_LABEL);
	if (!dc) throw new Error("Download channel not ready");

	// Re-use the existing wrapper unless the underlying RTCDataChannel changed.
	if (!_downloadChannel || (_downloadChannel as any).dc !== dc) {
		_downloadChannel = new DownloadChannel(dc);
	}
	return _downloadChannel;
}

/**
 * Initiate a file (or directory zip) download over the dedicated binary data
 * channel. Returns a DownloadStream immediately; data starts flowing once the
 * remote peer opens the transfer.
 *
 * @param path - Remote path of the file to download.
 */
function startDownload(path: string): DownloadStream {
	//const conn = p2p.conn;
	//if (!conn) throw new Error("P2P not connected");

	const ch = getDownloadChannel();
	const id = crypto.randomUUID();

	// Register the transfer *before* sending the RPC so no frames are missed.
	const ds = ch.requestDownload(id);

	// Fire the RPC using the same id — the backend stamps every frame with it.
	//
	p2p.conn?.requestWithId(id, "fs.download", { path }).catch((err: Error) => {
		ds.abort();
		throw err;
	});

	return ds;
}

/* =========================
   Download hook
========================= */

export interface DownloadProgress {
	/** Bytes received so far. */
	received: number;
	/** Total file size in bytes (from the HEADER frame). 0 until header arrives. */
	total: number;
	/** 0–1 fraction, or null when total is unknown. */
	fraction: number | null;
}

export interface UseDownloadFileResult {
	/** Start a download. Resolves when the file has been fully saved. */
	download(path: string, zip?: boolean): Promise<void>;
	/** Live progress of the active download, or null when idle. */
	progress: DownloadProgress | null;
	/** True while a download is in progress. */
	downloading: boolean;
	/** Last error, if any. */
	error: Error | null;
	/** Abort the active download. */
	abort(): void;
}

/**
 * Stream a file from the remote peer directly to disk using the binary
 * download data channel.
 *
 * Strategy:
 *   1. **File System Access API** (`showSaveFilePicker`) — chunks are written
 *      to disk as they arrive; the JS heap holds at most one chunk at a time.
 *   2. **Blob fallback** — chunks are accumulated into a `Uint8Array[]` and a
 *      single `Blob` is constructed at the end before triggering `<a download>`.
 *      This keeps the entire file in memory but avoids the b64 decode overhead
 *      of the JSON-based `fs.get` operation.
 */
export function useDownloadFile(): UseDownloadFileResult {
	const [progress, setProgress] = useState<DownloadProgress | null>(null);
	const [downloading, setDownloading] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const abortRef = useRef<(() => void) | null>(null);

	const abort = useCallback(() => {
		abortRef.current?.();
	}, []);

	const download = useCallback(async (path: string, _zip = false): Promise<void> => {
		setError(null);
		setDownloading(true);
		setProgress({ received: 0, total: 0, fraction: null });

		const ds = startDownload(path);
		abortRef.current = ds.abort;

		try {
			const { filename, total_size } = await ds.header;

			setProgress({ received: 0, total: total_size, fraction: total_size > 0 ? 0 : null });

			const supportsFilePicker = typeof window !== "undefined" && "showSaveFilePicker" in window;

			if (supportsFilePicker) {
				await streamToFilePicker(filename, total_size, ds.stream, (received) => {
					setProgress({
						received,
						total: total_size,
						fraction: total_size > 0 ? received / total_size : null,
					});
				});
			} else {
				await streamToBlob(filename, total_size, ds.stream, (received) => {
					setProgress({
						received,
						total: total_size,
						fraction: total_size > 0 ? received / total_size : null,
					});
				});
			}
		} catch (err: unknown) {
			const e = err instanceof Error ? err : new Error(String(err));
			if (e.message !== "aborted") {
				setError(e);
			}
			ds.abort();
		} finally {
			abortRef.current = null;
			setDownloading(false);
			setProgress(null);
		}
	}, []);

	return { download, progress, downloading, error, abort };
}

/* =========================
   Download strategies
========================= */

/**
 * Stream chunks directly to a user-chosen file on disk via the File System
 * Access API. The JS heap holds at most one chunk at a time.
 */
async function streamToFilePicker(
	suggestedName: string,
	_totalSize: number,
	stream: ReadableStream<Uint8Array>,
	onProgress: (received: number) => void,
): Promise<void> {
	const fileHandle = await (window as any).showSaveFilePicker({ suggestedName });
	const writable: FileSystemWritableFileStream = await fileHandle.createWritable();

	let received = 0;
	const reader = stream.getReader();

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			await writable.write(value as unknown as ArrayBuffer);
			received += value.byteLength;
			onProgress(received);
		}
		await writable.close();
	} catch (err) {
		await writable.abort();
		throw err;
	} finally {
		reader.releaseLock();
	}
}

/**
 * Accumulate all chunks into memory, build a Blob, and trigger a browser
 * download via a temporary anchor element. Used when showSaveFilePicker is
 * unavailable (Firefox, Safari).
 */
async function streamToBlob(
	filename: string,
	totalSize: number,
	stream: ReadableStream<Uint8Array>,
	onProgress: (received: number) => void,
): Promise<void> {
	const buffer: Uint8Array = totalSize > 0 ? new Uint8Array(totalSize) : new Uint8Array(0);
	const chunks: Uint8Array[] = totalSize > 0 ? [] : [];

	let received = 0;
	const reader = stream.getReader();

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			if (totalSize > 0) {
				buffer.set(value, received);
			} else {
				chunks.push(new Uint8Array(value));
			}

			received += value.byteLength;
			onProgress(received);
		}
	} finally {
		reader.releaseLock();
	}

	const blob =
		totalSize > 0 ? new Blob([buffer as unknown as ArrayBuffer]) : new Blob(chunks as unknown as ArrayBuffer[]);
	const url = URL.createObjectURL(blob);

	try {
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		a.remove();
	} finally {
		setTimeout(() => URL.revokeObjectURL(url), 10_000);
	}
}
