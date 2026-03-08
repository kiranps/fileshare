// src/api/webdavPropfind.ts
import { parseWebDAVPropfindResponse } from "../utils/webdav";

export async function webdavGet(
  path: string,
  options?: { signal?: AbortSignal },
): Promise<{ blob: Blob; response: Response }> {
  const url = WEBDAV_HOST + path;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      signal: options?.signal,
      credentials: "include",
    });
  } catch (error: any) {
    throw new Error(
      `WebDAV GET request failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `WebDAV GET failed: ${response.status} ${response.statusText}`,
    );
  }
  const blob = await response.blob();
  return { blob, response };
}

const WEBDAV_HOST = "http://192.168.29.216:8080";
const WEBDAV_DEPTH = "1";

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
  const url = WEBDAV_HOST + path;
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
