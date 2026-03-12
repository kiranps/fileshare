import type { WebDAVEntry } from "../api/webdav";

export function parseWebDAVPropfindResponse(xml: string): WebDAVEntry[] {
	const parser = new DOMParser();
	const dom = parser.parseFromString(xml, "application/xml");

	const responses = Array.from(dom.getElementsByTagNameNS("*", "response"));

	return responses.map((node) => {
		const getText = (name: string) => node.getElementsByTagNameNS("*", name)[0]?.textContent ?? undefined;

		const href = getText("href") ?? "";
		const propNode = node.getElementsByTagNameNS("*", "propstat")[0]?.getElementsByTagNameNS("*", "prop")[0];

		const displayName = propNode?.getElementsByTagNameNS("*", "displayname")[0]?.textContent ?? undefined;
		const contentType = propNode?.getElementsByTagNameNS("*", "getcontenttype")[0]?.textContent ?? undefined;
		const contentLength = propNode?.getElementsByTagNameNS("*", "getcontentlength")[0]?.textContent;
		const resourceType = propNode?.getElementsByTagNameNS("*", "resourcetype")[0];
		const isCollection = !!resourceType?.getElementsByTagNameNS("*", "collection")[0];

		const lastModifiedText = propNode?.getElementsByTagNameNS("*", "getlastmodified")[0]?.textContent;
		let lastModified: Date | undefined;
		if (lastModifiedText) {
			const parsed = new Date(lastModifiedText);
			if (!isNaN(parsed.getTime())) {
				lastModified = parsed;
			}
		}

		return {
			href,
			displayName,
			contentType,
			contentLength: contentLength ? Number(contentLength) : undefined,
			isCollection,
			lastModified,
		};
	});
}
