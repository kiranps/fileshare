import { parseWebDAVPropfindResponse } from "./parseWebDAVPropfindResponse";

// Configure WebDAV host and credentials here
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
