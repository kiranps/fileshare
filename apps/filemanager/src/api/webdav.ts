// src/api/webdavPropfind.ts
import { parseWebDAVPropfindResponse } from "../utils/webdav";
import { encodePath } from "../utils/files";

const WEBDAV_HOST = import.meta.env.VITE_HOST;
const WEBDAV_DEPTH = "1";

export function downloadFile(path: string) {
    const a = document.createElement("a");
    const url =
        WEBDAV_HOST +
        path +
        (path.includes("?") ? "&download=true" : "?download=true");
    a.href = url;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
}

export async function webdavPropfind(
    path: string,
    options?: { signal?: AbortSignal },
): Promise<
    Array<{
        href: string;
        displayName: string;
        contentType: string;
        contentLength?: number;
        isCollection: boolean;
        lastModified: Date | undefined;
        raw: any;
    }>
> {
    const headers: Record<string, string> = {
        Depth: WEBDAV_DEPTH,
        "Content-Type": "text/xml",
    };
    const url = WEBDAV_HOST + path;
    const response = await fetch(url, {
        method: "PROPFIND",
        headers,
        signal: options?.signal,
        credentials: "include",
    });
    if (!response.ok) {
        throw new Error(
            `WebDAV PROPFIND failed: ${response.status} ${response.statusText}`,
        );
    }
    const xml = await response.text();
    const data = parseWebDAVPropfindResponse(xml);
    return data;
}

export type WebDAVDeleteResult = {
    path: string;
    ok: boolean;
    status: number;
    response: Response;
};

export async function webdavDelete(
    path: string,
    options?: { signal?: AbortSignal },
): Promise<WebDAVDeleteResult> {
    const url = WEBDAV_HOST + path;
    let response: Response;
    try {
        response = await fetch(url, {
            method: "DELETE",
            signal: options?.signal,
            credentials: "include",
        });
    } catch (error: any) {
        throw new Error(
            `WebDAV DELETE request failed: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
    if (!response.ok) {
        throw new Error(
            `WebDAV DELETE failed: ${response.status} ${response.statusText}`,
        );
    }
    return {
        path,
        ok: response.ok,
        status: response.status,
        response,
    };
}

export type WebDAVMoveResult = {
    from: string;
    to: string;
    ok: boolean;
    status: number;
    response: Response;
};

export async function webdavMove(
    fromPath: string,
    toPath: string,
    overwrite = false,
    options?: { signal?: AbortSignal },
): Promise<WebDAVMoveResult> {
    const url = WEBDAV_HOST + fromPath;
    const destinationUrl = toPath;

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
    } catch (error: any) {
        throw new Error(
            `WebDAV MOVE request failed: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
    if (!response.ok) {
        throw new Error(
            `WebDAV MOVE failed: ${response.status} ${response.statusText}`,
        );
    }
    return {
        from: fromPath,
        to: toPath,
        ok: response.ok,
        status: response.status,
        response,
    };
}

export async function webdavCopy(
    fromPath: string,
    toPath: string,
    overwrite = false,
    options?: { signal?: AbortSignal },
): Promise<WebDAVMoveResult> {
    const url = WEBDAV_HOST + fromPath;
    const destinationUrl = WEBDAV_HOST + toPath;

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
    } catch (error: any) {
        throw new Error(
            `WebDAV COPY request failed: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
    if (!response.ok) {
        throw new Error(
            `WebDAV COPY failed: ${response.status} ${response.statusText}`,
        );
    }
    return {
        from: fromPath,
        to: toPath,
        ok: response.ok,
        status: response.status,
        response,
    };
}

export type WebDAVMkcolResult = {
    path: string;
    ok: boolean;
    status: number;
    response: Response;
};

export async function webdavMkcol(
    path: string,
    options?: { signal?: AbortSignal },
): Promise<WebDAVMkcolResult> {
    const url = WEBDAV_HOST + encodePath(path);
    let response: Response;
    try {
        response = await fetch(url, {
            method: "MKCOL",
            signal: options?.signal,
            credentials: "include",
        });
    } catch (error: any) {
        throw new Error(
            `WebDAV MKCOL request failed: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
    if (!(response.status === 201 || response.status === 200)) {
        throw new Error(
            `WebDAV MKCOL failed: ${response.status} ${response.statusText}`,
        );
    }
    return {
        path,
        ok: response.status === 201 || response.status === 200,
        status: response.status,
        response,
    };
}

export type WebDAVPutResult = {
    path: string;
    ok: boolean;
    status: number;
    response: Response;
};

export async function webdavPut(
    path: string,
    body: File,
    options?: { signal?: AbortSignal; contentType?: string },
): Promise<WebDAVPutResult> {
    const url = WEBDAV_HOST + path;
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
    } catch (error: any) {
        throw new Error(
            `WebDAV PUT request failed: ${error instanceof Error ? error.message : String(error)}`,
        );
    }

    if (!response.ok) {
        throw new Error(
            `WebDAV PUT failed: ${response.status} ${response.statusText}`,
        );
    }

    return {
        path,
        ok: response.ok,
        status: response.status,
        response,
    };
}
