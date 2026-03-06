// src/api/webdavPropfind.ts
import { parseWebDAVPropfindResponse } from "../utils/webdav";

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

/**
 * Delete a resource via WebDAV.
 * Returns status/result, throws on network or non-ok responses.
 */
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
