import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	basename,
	collectDirs,
	dirname,
	encodePath,
	joinPath,
	normalizePath,
	openFilePicker,
	openFolderPicker,
} from "./files";

describe("basename", () => {
	it("should extract filename from simple path", () => {
		expect(basename("/path/to/file.txt")).toBe("file.txt");
	});

	it("should extract filename from path with trailing slash", () => {
		expect(basename("/path/to/folder/")).toBe("folder");
	});

	it("should extract filename from path with multiple trailing slashes", () => {
		expect(basename("/path/to/folder///")).toBe("folder");
	});

	it("should handle root path", () => {
		expect(basename("/")).toBe("");
	});

	it("should handle single filename", () => {
		expect(basename("file.txt")).toBe("file.txt");
	});

	it("should handle empty string", () => {
		expect(basename("")).toBe("");
	});

	it("should handle path without slashes", () => {
		expect(basename("filename")).toBe("filename");
	});

	it("should handle special characters", () => {
		expect(basename("/path/to/file with spaces.txt")).toBe("file with spaces.txt");
		expect(basename("/path/to/file-with-dashes.txt")).toBe("file-with-dashes.txt");
		expect(basename("/path/to/файл.txt")).toBe("файл.txt");
	});
});

describe("dirname", () => {
	it("should extract directory from simple path", () => {
		expect(dirname("/path/to/file.txt")).toBe("/path/to");
	});

	it("should extract directory from path with trailing slash", () => {
		expect(dirname("/path/to/folder/")).toBe("/path/to");
	});

	it("should handle root path", () => {
		expect(dirname("/")).toBe("/");
	});

	it("should handle single level path", () => {
		expect(dirname("/file.txt")).toBe("/");
	});

	it("should handle nested paths", () => {
		expect(dirname("/a/b/c/d/file.txt")).toBe("/a/b/c/d");
	});

	it("should handle paths with multiple trailing slashes", () => {
		expect(dirname("/path/to/folder///")).toBe("/path/to");
	});

	it("should handle relative paths", () => {
		expect(dirname("path/to/file.txt")).toBe("path/to");
	});

	it("should return root for single segment", () => {
		expect(dirname("filename")).toBe("/");
	});
});

describe("normalizePath", () => {
	it("should normalize path with multiple slashes", () => {
		expect(normalizePath("/path///to//file.txt")).toBe("/path/to/file.txt");
	});

	it("should add leading slash if missing", () => {
		expect(normalizePath("path/to/file.txt")).toBe("/path/to/file.txt");
	});

	it("should remove trailing slash for non-root paths", () => {
		expect(normalizePath("/path/to/folder/")).toBe("/path/to/folder");
	});

	it("should preserve root path", () => {
		expect(normalizePath("/")).toBe("/");
		expect(normalizePath("///")).toBe("/");
	});

	it("should handle empty string", () => {
		expect(normalizePath("")).toBe("/");
	});

	it("should handle single slash", () => {
		expect(normalizePath("/")).toBe("/");
	});

	it("should handle multiple consecutive slashes", () => {
		expect(normalizePath("////path////to////file////")).toBe("/path/to/file");
	});

	it("should preserve path without issues", () => {
		expect(normalizePath("/path/to/file.txt")).toBe("/path/to/file.txt");
	});
});

describe("joinPath", () => {
	it("should join simple paths", () => {
		expect(joinPath("/path", "to", "file.txt")).toBe("/path/to/file.txt");
	});

	it("should handle paths with trailing slashes", () => {
		expect(joinPath("/path/", "/to/", "/file.txt")).toBe("/path/to/file.txt");
	});

	it("should handle empty strings", () => {
		expect(joinPath("/path", "", "file.txt")).toBe("/path/file.txt");
	});

	it("should handle single part", () => {
		expect(joinPath("/path")).toBe("/path");
	});

	it("should handle multiple slashes", () => {
		expect(joinPath("/path//", "//to//", "//file.txt")).toBe("/path/to/file.txt");
	});

	it("should add leading slash if missing", () => {
		expect(joinPath("path", "to", "file.txt")).toBe("/path/to/file.txt");
	});

	it("should handle root path", () => {
		expect(joinPath("/", "file.txt")).toBe("/file.txt");
	});

	it("should handle complex paths", () => {
		expect(joinPath("/a/b/", "/c/d/", "/e/f")).toBe("/a/b/c/d/e/f");
	});
});

describe("openFilePicker", () => {
	let clickSpy: ReturnType<typeof vi.fn>;
	let createdInput: HTMLInputElement;

	beforeEach(() => {
		clickSpy = vi.fn();
		// Mock document.createElement for input
		const originalCreateElement = document.createElement.bind(document);
		vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
			const element = originalCreateElement(tagName);
			if (tagName === "input") {
				createdInput = element as HTMLInputElement;
				createdInput.type = "file";
				createdInput.multiple = true;
				element.click = clickSpy;
			}
			return element;
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should create file input with correct attributes", async () => {
		const promise = openFilePicker();

		// Verify input was created
		expect(document.createElement).toHaveBeenCalledWith("input");
		expect(clickSpy).toHaveBeenCalled();

		// Simulate file selection
		const file1 = new File(["content1"], "test1.txt", { type: "text/plain" });
		const file2 = new File(["content2"], "test2.txt", { type: "text/plain" });
		Object.defineProperty(createdInput, "files", {
			value: [file1, file2],
			writable: false,
		});

		createdInput.dispatchEvent(new Event("change"));

		expect(createdInput.type).toBe("file");
		expect(createdInput.multiple).toBe(true);

		const result = await promise;

		expect(result).toEqual([file1, file2]);
	});

	it("should resolve with empty array when no files selected", async () => {
		const promise = openFilePicker();

		// Manipulate createdInput just as in the first test
		Object.defineProperty(createdInput, "files", {
			value: null,
			writable: false,
		});

		createdInput.dispatchEvent(new Event("change"));

		const result = await promise;
		expect(result).toEqual([]);
	});
});

describe("openFolderPicker", () => {
	let clickSpy: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		clickSpy = vi.fn();
		const originalCreateElement = document.createElement.bind(document);
		vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
			const element = originalCreateElement(tagName);
			if (tagName === "input") {
				element.click = clickSpy;
			}
			return element;
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should create folder input with correct attributes", async () => {
		const promise = openFolderPicker();

		expect(clickSpy).toHaveBeenCalled();

		const inputs = document.querySelectorAll('input[type="file"]');
		const input = inputs[inputs.length - 1] as HTMLInputElement & { webkitdirectory: boolean };

		expect(input.type).toBe("file");
		expect(input.multiple).toBe(true);
		expect(input.webkitdirectory).toBe(true);

		// Simulate folder selection
		const file1 = new File(["content1"], "file1.txt", { type: "text/plain" });
		Object.defineProperty(file1, "webkitRelativePath", { value: "folder/file1.txt" });

		const file2 = new File(["content2"], "file2.txt", { type: "text/plain" });
		Object.defineProperty(file2, "webkitRelativePath", { value: "folder/file2.txt" });

		Object.defineProperty(input, "files", {
			value: [file1, file2],
			writable: false,
		});

		input.dispatchEvent(new Event("change"));

		const result = await promise;
		expect(result).toEqual([file1, file2]);
	});
});

describe("collectDirs", () => {
	it("should collect unique directories from flat structure", () => {
		const file1 = new File(["content"], "file1.txt");
		Object.defineProperty(file1, "webkitRelativePath", { value: "folder/file1.txt" });

		const file2 = new File(["content"], "file2.txt");
		Object.defineProperty(file2, "webkitRelativePath", { value: "folder/file2.txt" });

		const result = collectDirs([file1, file2]);
		expect(result).toEqual(["folder"]);
	});

	it("should collect nested directories", () => {
		const file1 = new File(["content"], "file1.txt");
		Object.defineProperty(file1, "webkitRelativePath", { value: "a/b/c/file1.txt" });

		const file2 = new File(["content"], "file2.txt");
		Object.defineProperty(file2, "webkitRelativePath", { value: "a/b/file2.txt" });

		const result = collectDirs([file1, file2]);
		expect(result.sort()).toEqual(["a", "a/b", "a/b/c"].sort());
	});

	it("should handle empty file list", () => {
		expect(collectDirs([])).toEqual([]);
	});

	it("should collect unique directories only", () => {
		const file1 = new File(["content"], "file1.txt");
		Object.defineProperty(file1, "webkitRelativePath", { value: "folder/subfolder/file1.txt" });

		const file2 = new File(["content"], "file2.txt");
		Object.defineProperty(file2, "webkitRelativePath", { value: "folder/subfolder/file2.txt" });

		const file3 = new File(["content"], "file3.txt");
		Object.defineProperty(file3, "webkitRelativePath", { value: "folder/file3.txt" });

		const result = collectDirs([file1, file2, file3]);
		expect(result.sort()).toEqual(["folder", "folder/subfolder"].sort());
	});

	it("should handle complex directory structures", () => {
		const file1 = new File(["content"], "file1.txt");
		Object.defineProperty(file1, "webkitRelativePath", { value: "root/a/b/file1.txt" });

		const file2 = new File(["content"], "file2.txt");
		Object.defineProperty(file2, "webkitRelativePath", { value: "root/c/d/e/file2.txt" });

		const result = collectDirs([file1, file2]);
		expect(result.sort()).toEqual(["root", "root/a", "root/a/b", "root/c", "root/c/d", "root/c/d/e"].sort());
	});
});

describe("encodePath", () => {
	it("should encode path segments with special characters", () => {
		expect(encodePath("/path/to/file with spaces.txt")).toBe("/path/to/file%20with%20spaces.txt");
	});

	it("should handle already encoded paths", () => {
		expect(encodePath("/path/to/file%20encoded.txt")).toBe("/path/to/file%20encoded.txt");
	});

	it("should preserve slashes", () => {
		expect(encodePath("/path/to/file.txt")).toBe("/path/to/file.txt");
	});

	it("should encode unicode characters", () => {
		expect(encodePath("/path/to/файл.txt")).toBe("/path/to/%D1%84%D0%B0%D0%B9%D0%BB.txt");
	});

	it("should encode special URL characters", () => {
		expect(encodePath("/path/to/file?query=value&other=123.txt")).toBe(
			"/path/to/file%3Fquery%3Dvalue%26other%3D123.txt",
		);
	});

	it("should handle empty path", () => {
		expect(encodePath("")).toBe("");
	});

	it("should handle root path", () => {
		expect(encodePath("/")).toBe("/");
	});

	it("should handle mixed encoded/unencoded content", () => {
		// If a segment is already encoded, it should be decoded first then re-encoded
		expect(encodePath("/path/hello%20world")).toBe("/path/hello%20world");
	});

	it("should handle malformed encoding safely", () => {
		// Malformed encoding should be preserved
		expect(encodePath("/path/bad%encode")).toBe("/path/bad%25encode");
	});

	it("should encode all reserved characters except slash", () => {
		expect(encodePath("/path/to/[brackets].txt")).toBe("/path/to/%5Bbrackets%5D.txt");
		expect(encodePath("/path/to/(parens).txt")).toBe("/path/to/(parens).txt");
	});
});
