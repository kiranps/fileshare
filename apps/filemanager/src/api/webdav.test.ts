import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadFile, webdavCopy, webdavDelete, webdavMkcol, webdavMove, webdavPropfind, webdavPut } from "./webdav";

// Mock environment variable
vi.stubEnv("VITE_HOST", "http://localhost:8080");

describe("downloadFile", () => {
	let appendChildSpy: ReturnType<typeof vi.spyOn>;
	let removeSpy: ReturnType<typeof vi.fn>;
	let clickSpy: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		appendChildSpy = vi.spyOn(document.body, "appendChild");
		removeSpy = vi.fn();
		clickSpy = vi.fn();

		const originalCreateElement = document.createElement.bind(document);
		vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
			const element = originalCreateElement(tagName);
			if (tagName === "a") {
				element.click = clickSpy as unknown as () => void;
				element.remove = removeSpy as unknown as () => void;
			}
			return element;
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should create and click download link with correct URL", () => {
		downloadFile("/path/to/file.txt");

		expect(appendChildSpy).toHaveBeenCalled();
		expect(clickSpy).toHaveBeenCalled();
		expect(removeSpy).toHaveBeenCalled();

		const anchor = appendChildSpy.mock.calls[0][0] as HTMLAnchorElement;
		expect(anchor.href).toContain("http://localhost:8080/path/to/file.txt?download=true");
		expect(anchor.download).toBe("");
	});

	it("should encode path with special characters", () => {
		downloadFile("/path/to/file with spaces.txt");

		const anchor = appendChildSpy.mock.calls[0][0] as HTMLAnchorElement;
		expect(anchor.href).toContain("file%20with%20spaces.txt");
	});
});

describe("webdavPropfind", () => {
	beforeEach(() => {
		globalThis.fetch = vi.fn();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should make PROPFIND request with correct headers", async () => {
		const mockXML = `<?xml version="1.0"?>
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

		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			status: 207,
			text: async () => mockXML,
		});

		await webdavPropfind("/folder");

		expect(globalThis.fetch).toHaveBeenCalledWith(
			"http://localhost:8080/folder",
			expect.objectContaining({
				method: "PROPFIND",
				headers: {
					Depth: "1",
					"Content-Type": "text/xml",
				},
				credentials: "include",
			}),
		);
	});

	it("should parse and return WebDAV entries", async () => {
		const mockXML = `<?xml version="1.0"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/folder/</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>folder</D:displayname>
        <D:resourcetype><D:collection/></D:resourcetype>
        <D:getlastmodified>Mon, 15 Jan 2024 10:00:00 GMT</D:getlastmodified>
      </D:prop>
    </D:propstat>
  </D:response>
</D:multistatus>`;

		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			text: async () => mockXML,
		});

		const result = await webdavPropfind("/folder");

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			href: "/folder/",
			displayName: "folder",
			isCollection: true,
		});
	});

	it("should throw error on non-ok response", async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: false,
			status: 404,
			statusText: "Not Found",
		});

		await expect(webdavPropfind("/nonexistent")).rejects.toThrow("WebDAV PROPFIND failed: 404 Not Found");
	});

	it("should pass abort signal to fetch", async () => {
		const controller = new AbortController();

		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			text: async () => '<D:multistatus xmlns:D="DAV:"></D:multistatus>',
		});

		await webdavPropfind("/folder", { signal: controller.signal });

		expect(globalThis.fetch).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				signal: controller.signal,
			}),
		);
	});

	it("should encode path with special characters", async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			text: async () => '<D:multistatus xmlns:D="DAV:"></D:multistatus>',
		});

		await webdavPropfind("/folder/file with spaces.txt");

		expect(globalThis.fetch).toHaveBeenCalledWith(
			"http://localhost:8080/folder/file%20with%20spaces.txt",
			expect.any(Object),
		);
	});
});

describe("webdavDelete", () => {
	beforeEach(() => {
		globalThis.fetch = vi.fn();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should make DELETE request and return result", async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			status: 204,
		});

		const result = await webdavDelete("/folder/file.txt");

		expect(globalThis.fetch).toHaveBeenCalledWith(
			"http://localhost:8080/folder/file.txt",
			expect.objectContaining({
				method: "DELETE",
				credentials: "include",
			}),
		);

		expect(result).toEqual({
			path: "/folder/file.txt",
			ok: true,
			status: 204,
		});
	});

	it("should throw error on non-ok response", async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: false,
			status: 403,
			statusText: "Forbidden",
		});

		await expect(webdavDelete("/protected/file.txt")).rejects.toThrow("WebDAV DELETE failed: 403 Forbidden");
	});

	it("should throw error on network failure", async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

		await expect(webdavDelete("/file.txt")).rejects.toThrow("WebDAV DELETE request failed: Network error");
	});

	it("should pass abort signal", async () => {
		const controller = new AbortController();

		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			status: 204,
		});

		await webdavDelete("/file.txt", { signal: controller.signal });

		expect(globalThis.fetch).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				signal: controller.signal,
			}),
		);
	});
});

describe("webdavMove", () => {
	beforeEach(() => {
		globalThis.fetch = vi.fn();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should make MOVE request with correct headers", async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			status: 201,
		});

		const result = await webdavMove("/old/path.txt", "/new/path.txt");

		expect(globalThis.fetch).toHaveBeenCalledWith(
			"http://localhost:8080/old/path.txt",
			expect.objectContaining({
				method: "MOVE",
				headers: {
					Destination: "http://localhost:8080/new/path.txt",
					Overwrite: "F",
				},
				credentials: "include",
			}),
		);

		expect(result).toEqual({
			from: "/old/path.txt",
			to: "/new/path.txt",
			ok: true,
			status: 201,
		});
	});

	it("should set Overwrite header to T when overwrite is true", async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			status: 204,
		});

		await webdavMove("/old.txt", "/new.txt", true);

		expect(globalThis.fetch).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				headers: expect.objectContaining({
					Overwrite: "T",
				}),
			}),
		);
	});

	it("should throw error on non-ok response", async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: false,
			status: 409,
			statusText: "Conflict",
		});

		await expect(webdavMove("/old.txt", "/new.txt")).rejects.toThrow("WebDAV MOVE failed: 409 Conflict");
	});

	it("should throw error on network failure", async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

		await expect(webdavMove("/old.txt", "/new.txt")).rejects.toThrow("WebDAV MOVE request failed: Network error");
	});

	it("should encode paths with special characters", async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			status: 201,
		});

		await webdavMove("/old file.txt", "/new file.txt");

		expect(globalThis.fetch).toHaveBeenCalledWith(
			"http://localhost:8080/old%20file.txt",
			expect.objectContaining({
				headers: expect.objectContaining({
					Destination: "http://localhost:8080/new%20file.txt",
				}),
			}),
		);
	});
});

describe("webdavCopy", () => {
	beforeEach(() => {
		globalThis.fetch = vi.fn();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should make COPY request with correct headers", async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			status: 201,
		});

		const result = await webdavCopy("/source.txt", "/copy.txt");

		expect(globalThis.fetch).toHaveBeenCalledWith(
			"http://localhost:8080/source.txt",
			expect.objectContaining({
				method: "COPY",
				headers: {
					Destination: "http://localhost:8080/copy.txt",
					Overwrite: "F",
				},
				credentials: "include",
			}),
		);

		expect(result).toEqual({
			from: "/source.txt",
			to: "/copy.txt",
			ok: true,
			status: 201,
		});
	});

	it("should set Overwrite header to T when overwrite is true", async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			status: 204,
		});

		await webdavCopy("/source.txt", "/copy.txt", true);

		expect(globalThis.fetch).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				headers: expect.objectContaining({
					Overwrite: "T",
				}),
			}),
		);
	});

	it("should throw error on non-ok response", async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: false,
			status: 507,
			statusText: "Insufficient Storage",
		});

		await expect(webdavCopy("/large.txt", "/copy.txt")).rejects.toThrow("WebDAV COPY failed: 507 Insufficient Storage");
	});

	it("should throw error on network failure", async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network timeout"));

		await expect(webdavCopy("/source.txt", "/copy.txt")).rejects.toThrow("WebDAV COPY request failed: Network timeout");
	});
});

describe("webdavMkcol", () => {
	beforeEach(() => {
		globalThis.fetch = vi.fn();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should make MKCOL request and return result on 201", async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			status: 201,
		});

		const result = await webdavMkcol("/new/folder");

		expect(globalThis.fetch).toHaveBeenCalledWith(
			"http://localhost:8080/new/folder",
			expect.objectContaining({
				method: "MKCOL",
				credentials: "include",
			}),
		);

		expect(result).toEqual({
			path: "/new/folder",
			ok: true,
			status: 201,
		});
	});

	it("should accept 200 status as success", async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			status: 200,
		});

		const result = await webdavMkcol("/new/folder");

		expect(result).toEqual({
			path: "/new/folder",
			ok: true,
			status: 200,
		});
	});

	it("should throw error on non-success status", async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			status: 405,
			statusText: "Method Not Allowed",
		});

		await expect(webdavMkcol("/existing/folder")).rejects.toThrow("WebDAV MKCOL failed: 405 Method Not Allowed");
	});

	it("should throw error on 409 conflict", async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			status: 409,
			statusText: "Conflict",
		});

		await expect(webdavMkcol("/conflicting/folder")).rejects.toThrow("WebDAV MKCOL failed: 409 Conflict");
	});

	it("should throw error on network failure", async () => {
		(globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Connection refused"));

		await expect(webdavMkcol("/folder")).rejects.toThrow("WebDAV MKCOL request failed: Connection refused");
	});
});

describe("webdavPut", () => {
	beforeEach(() => {
		globalThis.fetch = vi.fn();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should make PUT request with file body", async () => {
		const file = new File(["content"], "test.txt", { type: "text/plain" });

		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			status: 201,
		});

		const result = await webdavPut("/folder/test.txt", file);

		expect(globalThis.fetch).toHaveBeenCalledWith(
			"http://localhost:8080/folder/test.txt",
			expect.objectContaining({
				method: "PUT",
				body: file,
				credentials: "include",
			}),
		);

		expect(result).toEqual({
			path: "/folder/test.txt",
			ok: true,
			status: 201,
		});
	});

	it("should include Content-Type header when provided", async () => {
		const file = new File(["content"], "test.txt");

		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			status: 201,
		});

		await webdavPut("/folder/test.txt", file, { contentType: "text/plain" });

		expect(globalThis.fetch).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				headers: {
					"Content-Type": "text/plain",
				},
			}),
		);
	});

	it("should not include Content-Type header when not provided", async () => {
		const file = new File(["content"], "test.txt");

		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			status: 201,
		});

		await webdavPut("/folder/test.txt", file);

		expect(globalThis.fetch).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				headers: {},
			}),
		);
	});

	it("should throw error on non-ok response", async () => {
		const file = new File(["content"], "test.txt");

		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: false,
			status: 413,
			statusText: "Payload Too Large",
		});

		await expect(webdavPut("/folder/test.txt", file)).rejects.toThrow("WebDAV PUT failed: 413 Payload Too Large");
	});

	it("should throw error on network failure", async () => {
		const file = new File(["content"], "test.txt");

		(globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Upload interrupted"));

		await expect(webdavPut("/folder/test.txt", file)).rejects.toThrow("WebDAV PUT request failed: Upload interrupted");
	});

	it("should pass abort signal", async () => {
		const file = new File(["content"], "test.txt");
		const controller = new AbortController();

		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			status: 201,
		});

		await webdavPut("/folder/test.txt", file, { signal: controller.signal });

		expect(globalThis.fetch).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				signal: controller.signal,
			}),
		);
	});

	it("should handle large files", async () => {
		const largeContent = "a".repeat(10 * 1024 * 1024); // 10MB
		const file = new File([largeContent], "large.bin");

		(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			status: 201,
		});

		const result = await webdavPut("/large.bin", file);

		expect(result.ok).toBe(true);
		expect(globalThis.fetch).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				body: file,
			}),
		);
	});
});
