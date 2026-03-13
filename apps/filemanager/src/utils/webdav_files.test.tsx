import { describe, expect, it } from "vitest";
import type { WebDAVEntry } from "../api/webdav";
import { filesFromWebDAV } from "./webdav_files";

describe("filesFromWebDAV", () => {
	it("should map WebDAV entries to FileItemProps", () => {
		const webdavData: WebDAVEntry[] = [
			{
				href: "/folder/",
				displayName: "folder",
				contentType: undefined,
				contentLength: undefined,
				isCollection: true,
				lastModified: new Date("2024-01-15T10:00:00Z"),
			},
			{
				href: "/folder/subfolder/",
				displayName: "subfolder",
				contentType: undefined,
				contentLength: undefined,
				isCollection: true,
				lastModified: new Date("2024-01-16T10:00:00Z"),
			},
			{
				href: "/folder/file.txt",
				displayName: "file.txt",
				contentType: "text/plain",
				contentLength: 1024,
				isCollection: false,
				lastModified: new Date("2024-01-17T10:00:00Z"),
			},
		];

		const result = filesFromWebDAV(webdavData);

		expect(result.activeDirectory).toBeDefined();
		expect(result.activeDirectory?.name).toBe("folder");
		expect(result.activeDirectory?.type).toBe("Folder");

		expect(result.files).toHaveLength(2);

		// Check subfolder
		expect(result.files[0]).toMatchObject({
			id: "/folder/subfolder/",
			name: "subfolder",
			type: "Folder",
			size: "-",
			selected: false,
		});

		// Check file
		expect(result.files[1]).toMatchObject({
			id: "/folder/file.txt",
			name: "file.txt",
			type: "Text",
			size: "1.0 KB",
			selected: false,
		});
	});

	it("should use displayName when provided, otherwise use basename of href", () => {
		const webdavData: WebDAVEntry[] = [
			{
				href: "/root/",
				displayName: "Custom Name",
				contentType: undefined,
				contentLength: undefined,
				isCollection: true,
				lastModified: new Date(),
			},
			{
				href: "/root/file.txt",
				displayName: undefined,
				contentType: "text/plain",
				contentLength: 100,
				isCollection: false,
				lastModified: new Date(),
			},
		];

		const result = filesFromWebDAV(webdavData);

		expect(result.activeDirectory?.name).toBe("Custom Name");
		expect(result.files[0].name).toBe("file.txt");
	});

	it("should correctly identify file types by extension", () => {
		const createEntry = (href: string, ext: string): WebDAVEntry => ({
			href,
			displayName: `file.${ext}`,
			contentType: "application/octet-stream",
			contentLength: 1000,
			isCollection: false,
			lastModified: new Date(),
		});

		const webdavData: WebDAVEntry[] = [
			{ href: "/root/", displayName: "root", contentType: undefined, isCollection: true, lastModified: new Date() },
			createEntry("/root/image.jpg", "jpg"),
			createEntry("/root/image.png", "png"),
			createEntry("/root/audio.mp3", "mp3"),
			createEntry("/root/video.mp4", "mp4"),
			createEntry("/root/document.pdf", "pdf"),
			createEntry("/root/text.txt", "txt"),
		];

		const result = filesFromWebDAV(webdavData);

		expect(result.files[0].type).toBe("Image");
		expect(result.files[1].type).toBe("Image");
		expect(result.files[2].type).toBe("Music");
		expect(result.files[3].type).toBe("Video");
		expect(result.files[4].type).toBe("PDF");
		expect(result.files[5].type).toBe("Text");
	});

	it.skip("should correctly identify file types by content type", () => {
		const webdavData: WebDAVEntry[] = [
			{ href: "/root/", displayName: "root", contentType: undefined, isCollection: true, lastModified: new Date() },
			{
				href: "/root/photo",
				displayName: "photo",
				contentType: "image/jpeg",
				contentLength: 2048,
				isCollection: false,
				lastModified: new Date(),
			},
			{
				href: "/root/song",
				displayName: "song",
				contentType: "audio/mpeg",
				contentLength: 4096,
				isCollection: false,
				lastModified: new Date(),
			},
			{
				href: "/root/movie",
				displayName: "movie",
				contentType: "video/mp4",
				contentLength: 8192,
				isCollection: false,
				lastModified: new Date(),
			},
			{
				href: "/root/document",
				displayName: "document",
				contentType: "application/pdf",
				contentLength: 1024,
				isCollection: false,
				lastModified: new Date(),
			},
		];

		const result = filesFromWebDAV(webdavData);

		expect(result.files[0].type).toBe("Image");
		expect(result.files[1].type).toBe("Music");
		expect(result.files[2].type).toBe("Video");
		expect(result.files[3].type).toBe("PDF");
	});

	it("should prioritize extension over content type for file type detection", () => {
		const webdavData: WebDAVEntry[] = [
			{ href: "/root/", displayName: "root", contentType: undefined, isCollection: true, lastModified: new Date() },
			{
				href: "/root/file.jpg",
				displayName: "file.jpg",
				contentType: "application/octet-stream",
				contentLength: 1000,
				isCollection: false,
				lastModified: new Date(),
			},
		];

		const result = filesFromWebDAV(webdavData);
		expect(result.files[0].type).toBe("Image");
	});

	it("should format file sizes correctly", () => {
		const createEntry = (size: number): WebDAVEntry => ({
			href: `/root/file${size}`,
			displayName: `file${size}`,
			contentType: "text/plain",
			contentLength: size,
			isCollection: false,
			lastModified: new Date(),
		});

		const webdavData: WebDAVEntry[] = [
			{ href: "/root/", displayName: "root", contentType: undefined, isCollection: true, lastModified: new Date() },
			createEntry(0), // 0 B
			createEntry(500), // 500 B
			createEntry(1024), // 1.0 KB
			createEntry(1536), // 1.5 KB
			createEntry(1048576), // 1.0 MB
			createEntry(1073741824), // 1.0 GB
		];

		const result = filesFromWebDAV(webdavData);

		expect(result.files[0].size).toBe("0 B");
		expect(result.files[1].size).toBe("500.0 B");
		expect(result.files[2].size).toBe("1.0 KB");
		expect(result.files[3].size).toBe("1.5 KB");
		expect(result.files[4].size).toBe("1.0 MB");
		expect(result.files[5].size).toBe("1.0 GB");
	});

	it('should show "-" for folder sizes', () => {
		const webdavData: WebDAVEntry[] = [
			{ href: "/root/", displayName: "root", contentType: undefined, isCollection: true, lastModified: new Date() },
			{
				href: "/root/folder/",
				displayName: "folder",
				contentType: undefined,
				contentLength: undefined,
				isCollection: true,
				lastModified: new Date(),
			},
		];

		const result = filesFromWebDAV(webdavData);
		expect(result.activeDirectory?.size).toBe("-");
		expect(result.files[0].size).toBe("-");
	});

	it('should show "-" for undefined file sizes', () => {
		const webdavData: WebDAVEntry[] = [
			{ href: "/root/", displayName: "root", contentType: undefined, isCollection: true, lastModified: new Date() },
			{
				href: "/root/file.txt",
				displayName: "file.txt",
				contentType: "text/plain",
				contentLength: undefined,
				isCollection: false,
				lastModified: new Date(),
			},
		];

		const result = filesFromWebDAV(webdavData);
		expect(result.files[0].size).toBe("-");
	});

	it("should handle missing lastModified dates", () => {
		const webdavData: WebDAVEntry[] = [
			{
				href: "/root/",
				displayName: "root",
				contentType: undefined,
				isCollection: true,
				lastModified: undefined,
			},
			{
				href: "/root/file.txt",
				displayName: "file.txt",
				contentType: "text/plain",
				contentLength: 100,
				isCollection: false,
				lastModified: undefined,
			},
		];

		const result = filesFromWebDAV(webdavData);

		// Should use epoch date when missing
		expect(result.activeDirectory?.modified).toEqual(new Date(0));
		expect(result.files[0].modified).toEqual(new Date(0));
	});

	it("should set selected to false for all files", () => {
		const webdavData: WebDAVEntry[] = [
			{ href: "/root/", displayName: "root", contentType: undefined, isCollection: true, lastModified: new Date() },
			{
				href: "/root/file1.txt",
				displayName: "file1.txt",
				contentType: "text/plain",
				contentLength: 100,
				isCollection: false,
				lastModified: new Date(),
			},
			{
				href: "/root/file2.txt",
				displayName: "file2.txt",
				contentType: "text/plain",
				contentLength: 200,
				isCollection: false,
				lastModified: new Date(),
			},
		];

		const result = filesFromWebDAV(webdavData);

		expect(result.activeDirectory?.selected).toBe(false);
		expect(result.files[0].selected).toBe(false);
		expect(result.files[1].selected).toBe(false);
	});

	it("should generate correct icons for different file types", () => {
		const webdavData: WebDAVEntry[] = [
			{ href: "/root/", displayName: "root", contentType: undefined, isCollection: true, lastModified: new Date() },
			{
				href: "/root/folder/",
				displayName: "folder",
				contentType: undefined,
				isCollection: true,
				lastModified: new Date(),
			},
			{
				href: "/root/image.jpg",
				displayName: "image.jpg",
				contentType: "image/jpeg",
				contentLength: 1000,
				isCollection: false,
				lastModified: new Date(),
			},
			{
				href: "/root/text.txt",
				displayName: "text.txt",
				contentType: "text/plain",
				contentLength: 100,
				isCollection: false,
				lastModified: new Date(),
			},
		];

		const result = filesFromWebDAV(webdavData);

		// Icons are React elements, so we check they exist and have the right type
		expect(result.activeDirectory?.icon).toBeDefined();
		expect(result.files[0].icon).toBeDefined(); // folder
		expect(result.files[1].icon).toBeDefined(); // image
		expect(result.files[2].icon).toBeDefined(); // text
	});

	it("should handle empty WebDAV response", () => {
		const webdavData: WebDAVEntry[] = [];

		const result = filesFromWebDAV(webdavData);

		expect(result.activeDirectory).toBeUndefined();
		expect(result.files).toEqual([]);
	});

	it("should handle single entry (directory only)", () => {
		const webdavData: WebDAVEntry[] = [
			{
				href: "/root/",
				displayName: "root",
				contentType: undefined,
				isCollection: true,
				lastModified: new Date(),
			},
		];

		const result = filesFromWebDAV(webdavData);

		expect(result.activeDirectory).toBeDefined();
		expect(result.files).toEqual([]);
	});

	it("should handle files with no extension", () => {
		const webdavData: WebDAVEntry[] = [
			{ href: "/root/", displayName: "root", contentType: undefined, isCollection: true, lastModified: new Date() },
			{
				href: "/root/README",
				displayName: "README",
				contentType: "text/plain",
				contentLength: 500,
				isCollection: false,
				lastModified: new Date(),
			},
			{
				href: "/root/Makefile",
				displayName: "Makefile",
				contentType: undefined,
				contentLength: 300,
				isCollection: false,
				lastModified: new Date(),
			},
		];

		const result = filesFromWebDAV(webdavData);

		expect(result.files[0].type).toBe("text/plain");
		expect(result.files[1].type).toBe("File");
	});

	it("should handle case-insensitive extension matching", () => {
		const webdavData: WebDAVEntry[] = [
			{ href: "/root/", displayName: "root", contentType: undefined, isCollection: true, lastModified: new Date() },
			{
				href: "/root/IMAGE.JPG",
				displayName: "IMAGE.JPG",
				contentType: "application/octet-stream",
				contentLength: 1000,
				isCollection: false,
				lastModified: new Date(),
			},
			{
				href: "/root/VIDEO.MP4",
				displayName: "VIDEO.MP4",
				contentType: "application/octet-stream",
				contentLength: 2000,
				isCollection: false,
				lastModified: new Date(),
			},
		];

		const result = filesFromWebDAV(webdavData);

		expect(result.files[0].type).toBe("Image");
		expect(result.files[1].type).toBe("Video");
	});

	it("should handle all supported image extensions", () => {
		const extensions = ["jpg", "jpeg", "png", "gif", "bmp", "webp"];
		const webdavData: WebDAVEntry[] = [
			{ href: "/root/", displayName: "root", contentType: undefined, isCollection: true, lastModified: new Date() },
			...extensions.map((ext) => ({
				href: `/root/image.${ext}`,
				displayName: `image.${ext}`,
				contentType: "application/octet-stream",
				contentLength: 1000,
				isCollection: false,
				lastModified: new Date(),
			})),
		];

		const result = filesFromWebDAV(webdavData);

		result.files.forEach((file) => {
			expect(file.type).toBe("Image");
		});
	});

	it("should handle all supported video extensions", () => {
		const extensions = ["mp4", "avi", "mkv", "mov"];
		const webdavData: WebDAVEntry[] = [
			{ href: "/root/", displayName: "root", contentType: undefined, isCollection: true, lastModified: new Date() },
			...extensions.map((ext) => ({
				href: `/root/video.${ext}`,
				displayName: `video.${ext}`,
				contentType: "application/octet-stream",
				contentLength: 1000,
				isCollection: false,
				lastModified: new Date(),
			})),
		];

		const result = filesFromWebDAV(webdavData);

		result.files.forEach((file) => {
			expect(file.type).toBe("Video");
		});
	});

	it("should handle all supported audio extensions", () => {
		const extensions = ["mp3", "wav", "ogg"];
		const webdavData: WebDAVEntry[] = [
			{ href: "/root/", displayName: "root", contentType: undefined, isCollection: true, lastModified: new Date() },
			...extensions.map((ext) => ({
				href: `/root/audio.${ext}`,
				displayName: `audio.${ext}`,
				contentType: "application/octet-stream",
				contentLength: 1000,
				isCollection: false,
				lastModified: new Date(),
			})),
		];

		const result = filesFromWebDAV(webdavData);

		result.files.forEach((file) => {
			expect(file.type).toBe("Music");
		});
	});

	it("should use href as id for file items", () => {
		const webdavData: WebDAVEntry[] = [
			{ href: "/root/", displayName: "root", contentType: undefined, isCollection: true, lastModified: new Date() },
			{
				href: "/root/unique-path/file.txt",
				displayName: "file.txt",
				contentType: "text/plain",
				contentLength: 100,
				isCollection: false,
				lastModified: new Date(),
			},
		];

		const result = filesFromWebDAV(webdavData);
		expect(result.files[0].id).toBe("/root/unique-path/file.txt");
	});
});
