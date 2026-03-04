// Utility for parsing a WebDAV PROPFIND XML response
export function parseWebDAVPropfindResponse(xml: string) {
  const parser = new DOMParser();
  const dom = parser.parseFromString(xml, "application/xml");

  const responses = Array.from(dom.getElementsByTagNameNS("*", "response"));

  return responses.map((node) => {
    const get = (name: string) =>
      node.getElementsByTagNameNS("*", name)[0]?.textContent ?? undefined;

    const href = get("href") ?? "";
    const propNode = node
      .getElementsByTagNameNS("*", "propstat")[0]
      ?.getElementsByTagNameNS("*", "prop")[0];
    const displayName = propNode?.getElementsByTagNameNS("*", "displayname")[0]
      ?.textContent;
    const contentType = propNode?.getElementsByTagNameNS(
      "*",
      "getcontenttype",
    )[0]?.textContent;
    const contentLength = propNode?.getElementsByTagNameNS(
      "*",
      "getcontentlength",
    )[0]?.textContent;
    const resourceType = propNode?.getElementsByTagNameNS(
      "*",
      "resourcetype",
    )[0];
    const isCollection = !!resourceType?.getElementsByTagNameNS(
      "*",
      "collection",
    )[0];

    return {
      href,
      displayName,
      contentType,
      contentLength: contentLength ? Number(contentLength) : undefined,
      isCollection,
      raw: node,
    };
  });
}
