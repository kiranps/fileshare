import { encodePath } from "../utils/files";
import { parseWebDAVPropfindResponse } from "../utils/webdav";

let _webdavHost: string = import.meta.env.VITE_HOST ?? "";
const WEBDAV_DEPTH = "1";

/** Override the WebDAV host at runtime (called after pairing). */
export function setWebDAVHost(host: string): void {
	_webdavHost = host;
}

/** Returns the currently configured WebDAV host. */
export function getWebDAVHost(): string {
	return _webdavHost;
}

/** Triggers a browser download for the given WebDAV path. */
export function downloadFile(path: string) {
	const a = document.createElement("a");
	const encoded = encodePath(path);
	const url = `${_webdavHost}${encoded}?download=true`;
	a.href = url;
	a.download = "";
	document.body.appendChild(a);
	a.click();
	a.remove();
}

export type WebDAVEntry = {
	href: string;
	displayName: string | undefined;
	contentType: string | undefined;
	contentLength?: number;
	isCollection: boolean;
	lastModified: Date | undefined;
};

export async function webdavPropfind(path: string, options?: { signal?: AbortSignal }): Promise<WebDAVEntry[]> {
	const headers: Record<string, string> = {
		Depth: WEBDAV_DEPTH,
		"Content-Type": "text/xml",
	};
	const url = _webdavHost + encodePath(path);
	const response = await fetch(url, {
		method: "PROPFIND",
		headers,
		signal: options?.signal,
		credentials: "include",
	});
	if (!response.ok) {
		throw new Error(`WebDAV PROPFIND failed: ${response.status} ${response.statusText}`);
	}
	const xml = await response.text();
	return parseWebDAVPropfindResponse(xml);
}

export type WebDAVDeleteResult = {
	path: string;
	ok: boolean;
	status: number;
};

export async function webdavDelete(path: string, options?: { signal?: AbortSignal }): Promise<WebDAVDeleteResult> {
	const url = _webdavHost + encodePath(path);
	let response: Response;
	try {
		response = await fetch(url, {
			method: "DELETE",
			signal: options?.signal,
			credentials: "include",
		});
	} catch (error: unknown) {
		throw new Error(`WebDAV DELETE request failed: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (!response.ok) {
		throw new Error(`WebDAV DELETE failed: ${response.status} ${response.statusText}`);
	}
	return { path, ok: response.ok, status: response.status };
}

export type WebDAVMoveResult = {
	from: string;
	to: string;
	ok: boolean;
	status: number;
};

export async function webdavMove(
	fromPath: string,
	toPath: string,
	overwrite = false,
	options?: { signal?: AbortSignal },
): Promise<WebDAVMoveResult> {
	const url = _webdavHost + encodePath(fromPath);
	const destinationUrl = _webdavHost + encodePath(toPath);

	const headers: Record<string, string> = {
		Destination: destinationUrl,
		Overwrite: overwrite ? "T" : "F",
	};

	let response: Response;
	try {
		response = await fetch(url, {
			method: "MOVE",
			headers,
			signal: options?.signal,
			credentials: "include",
		});
	} catch (error: unknown) {
		throw new Error(`WebDAV MOVE request failed: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (!response.ok) {
		throw new Error(`WebDAV MOVE failed: ${response.status} ${response.statusText}`);
	}
	return { from: fromPath, to: toPath, ok: response.ok, status: response.status };
}

export async function webdavCopy(
	fromPath: string,
	toPath: string,
	overwrite = false,
	options?: { signal?: AbortSignal },
): Promise<WebDAVMoveResult> {
	const url = _webdavHost + encodePath(fromPath);
	const destinationUrl = _webdavHost + encodePath(toPath);

	const headers: Record<string, string> = {
		Destination: destinationUrl,
		Overwrite: overwrite ? "T" : "F",
	};

	let response: Response;
	try {
		response = await fetch(url, {
			method: "COPY",
			headers,
			signal: options?.signal,
			credentials: "include",
		});
	} catch (error: unknown) {
		throw new Error(`WebDAV COPY request failed: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (!response.ok) {
		throw new Error(`WebDAV COPY failed: ${response.status} ${response.statusText}`);
	}
	return { from: fromPath, to: toPath, ok: response.ok, status: response.status };
}

export type WebDAVMkcolResult = {
	path: string;
	ok: boolean;
	status: number;
};

export async function webdavMkcol(path: string, options?: { signal?: AbortSignal }): Promise<WebDAVMkcolResult> {
	const url = _webdavHost + encodePath(path);
	let response: Response;
	try {
		response = await fetch(url, {
			method: "MKCOL",
			signal: options?.signal,
			credentials: "include",
		});
	} catch (error: unknown) {
		throw new Error(`WebDAV MKCOL request failed: ${error instanceof Error ? error.message : String(error)}`);
	}
	if (!(response.status === 201 || response.status === 200)) {
		throw new Error(`WebDAV MKCOL failed: ${response.status} ${response.statusText}`);
	}
	return {
		path,
		ok: response.status === 201 || response.status === 200,
		status: response.status,
	};
}

export type WebDAVPutResult = {
	path: string;
	ok: boolean;
	status: number;
};

export async function webdavPut(
	path: string,
	body: File,
	options?: { signal?: AbortSignal; contentType?: string },
): Promise<WebDAVPutResult> {
	const url = _webdavHost + encodePath(path);
	const headers: Record<string, string> = {};
	if (options?.contentType) headers["Content-Type"] = options.contentType;

	let response: Response;
	try {
		response = await fetch(url, {
			method: "PUT",
			headers,
			body,
			signal: options?.signal,
			credentials: "include",
		});
	} catch (error: unknown) {
		throw new Error(`WebDAV PUT request failed: ${error instanceof Error ? error.message : String(error)}`);
	}

	if (!response.ok) {
		throw new Error(`WebDAV PUT failed: ${response.status} ${response.statusText}`);
	}

	return { path, ok: response.ok, status: response.status };
}
