import { describe, expect, it } from "vitest";
import type { WebDAVEntry } from "../api/webdav";
import { parseWebDAVPropfindResponse } from "./webdav";

describe("parseWebDAVPropfindResponse", () => {
	it("should parse a valid WebDAV response with files and folders", () => {
		const xml = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/folder/</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>folder</D:displayname>
        <D:getcontenttype></D:getcontenttype>
        <D:resourcetype><D:collection/></D:resourcetype>
        <D:getlastmodified>Mon, 15 Jan 2024 10:30:00 GMT</D:getlastmodified>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
  <D:response>
    <D:href>/folder/file.txt</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>file.txt</D:displayname>
        <D:getcontenttype>text/plain</D:getcontenttype>
        <D:getcontentlength>1024</D:getcontentlength>
        <D:resourcetype/>
        <D:getlastmodified>Tue, 16 Jan 2024 14:45:30 GMT</D:getlastmodified>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`;

		const result: WebDAVEntry[] = parseWebDAVPropfindResponse(xml);

		expect(result).toHaveLength(2);

		// Check folder
		expect(result[0]).toEqual({
			href: "/folder/",
			displayName: "folder",
			contentType: "",
			contentLength: undefined,
			isCollection: true,
			lastModified: new Date("Mon, 15 Jan 2024 10:30:00 GMT"),
		});

		// Check file
		expect(result[1]).toEqual({
			href: "/folder/file.txt",
			displayName: "file.txt",
			contentType: "text/plain",
			contentLength: 1024,
			isCollection: false,
			lastModified: new Date("Tue, 16 Jan 2024 14:45:30 GMT"),
		});
	});

	it("should handle missing displayName", () => {
		const xml = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/file.txt</D:href>
    <D:propstat>
      <D:prop>
        <D:getcontenttype>text/plain</D:getcontenttype>
        <D:resourcetype/>
      </D:prop>
    </D:propstat>
  </D:response>
</D:multistatus>`;

		const result = parseWebDAVPropfindResponse(xml);
		expect(result[0].displayName).toBeUndefined();
	});

	it("should handle missing contentType", () => {
		const xml = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/file</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>file</D:displayname>
        <D:resourcetype/>
      </D:prop>
    </D:propstat>
  </D:response>
</D:multistatus>`;

		const result = parseWebDAVPropfindResponse(xml);
		expect(result[0].contentType).toBeUndefined();
	});

	it("should handle missing contentLength", () => {
		const xml = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/folder/</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>folder</D:displayname>
        <D:resourcetype><D:collection/></D:resourcetype>
      </D:prop>
    </D:propstat>
  </D:response>
</D:multistatus>`;

		const result = parseWebDAVPropfindResponse(xml);
		expect(result[0].contentLength).toBeUndefined();
	});

	it("should parse contentLength as number", () => {
		const xml = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/file.txt</D:href>
    <D:propstat>
      <D:prop>
        <D:getcontentlength>2048576</D:getcontentlength>
        <D:resourcetype/>
      </D:prop>
    </D:propstat>
  </D:response>
</D:multistatus>`;

		const result = parseWebDAVPropfindResponse(xml);
		expect(result[0].contentLength).toBe(2048576);
		expect(typeof result[0].contentLength).toBe("number");
	});

	it("should correctly identify collections", () => {
		const xml = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/folder/</D:href>
    <D:propstat>
      <D:prop>
        <D:resourcetype><D:collection/></D:resourcetype>
      </D:prop>
    </D:propstat>
  </D:response>
  <D:response>
    <D:href>/file.txt</D:href>
    <D:propstat>
      <D:prop>
        <D:resourcetype/>
      </D:prop>
    </D:propstat>
  </D:response>
</D:multistatus>`;

		const result = parseWebDAVPropfindResponse(xml);
		expect(result[0].isCollection).toBe(true);
		expect(result[1].isCollection).toBe(false);
	});

	it("should handle missing lastModified", () => {
		const xml = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/file.txt</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>file.txt</D:displayname>
        <D:resourcetype/>
      </D:prop>
    </D:propstat>
  </D:response>
</D:multistatus>`;

		const result = parseWebDAVPropfindResponse(xml);
		expect(result[0].lastModified).toBeUndefined();
	});

	it("should handle invalid lastModified date", () => {
		const xml = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/file.txt</D:href>
    <D:propstat>
      <D:prop>
        <D:getlastmodified>invalid-date</D:getlastmodified>
        <D:resourcetype/>
      </D:prop>
    </D:propstat>
  </D:response>
</D:multistatus>`;

		const result = parseWebDAVPropfindResponse(xml);
		expect(result[0].lastModified).toBeUndefined();
	});

	it("should parse valid ISO 8601 dates", () => {
		const xml = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/file.txt</D:href>
    <D:propstat>
      <D:prop>
        <D:getlastmodified>2024-01-15T10:30:00Z</D:getlastmodified>
        <D:resourcetype/>
      </D:prop>
    </D:propstat>
  </D:response>
</D:multistatus>`;

		const result = parseWebDAVPropfindResponse(xml);
		expect(result[0].lastModified).toEqual(new Date("2024-01-15T10:30:00Z"));
	});

	it("should handle empty multistatus", () => {
		const xml = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
</D:multistatus>`;

		const result = parseWebDAVPropfindResponse(xml);
		expect(result).toEqual([]);
	});

	it("should handle response without propstat", () => {
		const xml = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/file.txt</D:href>
  </D:response>
</D:multistatus>`;

		const result = parseWebDAVPropfindResponse(xml);
		expect(result[0]).toEqual({
			href: "/file.txt",
			displayName: undefined,
			contentType: undefined,
			contentLength: undefined,
			isCollection: false,
			lastModified: undefined,
		});
	});

	it("should handle response without href", () => {
		const xml = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:propstat>
      <D:prop>
        <D:displayname>file.txt</D:displayname>
      </D:prop>
    </D:propstat>
  </D:response>
</D:multistatus>`;

		const result = parseWebDAVPropfindResponse(xml);
		expect(result[0].href).toBe("");
	});

	it("should handle special characters in file names", () => {
		const xml = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/folder/file%20with%20spaces.txt</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>file with spaces.txt</D:displayname>
        <D:resourcetype/>
      </D:prop>
    </D:propstat>
  </D:response>
</D:multistatus>`;

		const result = parseWebDAVPropfindResponse(xml);
		expect(result[0].displayName).toBe("file with spaces.txt");
	});

	it("should handle unicode characters", () => {
		const xml = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/folder/файл.txt</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>файл.txt</D:displayname>
        <D:resourcetype/>
      </D:prop>
    </D:propstat>
  </D:response>
</D:multistatus>`;

		const result = parseWebDAVPropfindResponse(xml);
		expect(result[0].displayName).toBe("файл.txt");
	});

	it("should handle various content types", () => {
		const xml = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/image.jpg</D:href>
    <D:propstat>
      <D:prop>
        <D:getcontenttype>image/jpeg</D:getcontenttype>
        <D:resourcetype/>
      </D:prop>
    </D:propstat>
  </D:response>
  <D:response>
    <D:href>/video.mp4</D:href>
    <D:propstat>
      <D:prop>
        <D:getcontenttype>video/mp4</D:getcontenttype>
        <D:resourcetype/>
      </D:prop>
    </D:propstat>
  </D:response>
  <D:response>
    <D:href>/doc.pdf</D:href>
    <D:propstat>
      <D:prop>
        <D:getcontenttype>application/pdf</D:getcontenttype>
        <D:resourcetype/>
      </D:prop>
    </D:propstat>
  </D:response>
</D:multistatus>`;

		const result = parseWebDAVPropfindResponse(xml);
		expect(result[0].contentType).toBe("image/jpeg");
		expect(result[1].contentType).toBe("video/mp4");
		expect(result[2].contentType).toBe("application/pdf");
	});

	it("should handle namespace prefixes correctly", () => {
		const xml = `<?xml version="1.0" encoding="utf-8"?>
<multistatus xmlns="DAV:">
  <response>
    <href>/file.txt</href>
    <propstat>
      <prop>
        <displayname>file.txt</displayname>
        <getcontenttype>text/plain</getcontenttype>
        <resourcetype/>
      </prop>
    </propstat>
  </response>
</multistatus>`;

		const result = parseWebDAVPropfindResponse(xml);
		expect(result).toHaveLength(1);
		expect(result[0].displayName).toBe("file.txt");
	});

	it("should handle malformed XML gracefully", () => {
		const xml = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/file.txt
</D:multistatus>`;

		// Should not throw, but return what it can parse
		expect(() => parseWebDAVPropfindResponse(xml)).not.toThrow();
	});

	it("should handle zero content length", () => {
		const xml = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/empty.txt</D:href>
    <D:propstat>
      <D:prop>
        <D:getcontentlength>0</D:getcontentlength>
        <D:resourcetype/>
      </D:prop>
    </D:propstat>
  </D:response>
</D:multistatus>`;

		const result = parseWebDAVPropfindResponse(xml);
		expect(result[0].contentLength).toBe(0);
	});

	it("should handle very large content length", () => {
		const xml = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/large.bin</D:href>
    <D:propstat>
      <D:prop>
        <D:getcontentlength>9999999999</D:getcontentlength>
        <D:resourcetype/>
      </D:prop>
    </D:propstat>
  </D:response>
</D:multistatus>`;

		const result = parseWebDAVPropfindResponse(xml);
		expect(result[0].contentLength).toBe(9999999999);
	});
});
