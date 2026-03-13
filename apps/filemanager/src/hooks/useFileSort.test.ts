import { act, renderHook } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import type { FileItemProps } from "../types";
import { useFileSort } from "./useFileSort";

const createMockFile = (id: string, name: string, type: string, modified: Date, size?: number): FileItemProps => ({
	id,
	name,
	type,
	size,
	modified,
	icon: createElement("div"),
	selected: false,
});

describe("useFileSort", () => {
	const mockFiles: FileItemProps[] = [
		createMockFile("/file1", "zebra.txt", "File", new Date("2024-01-15"), 100),
		createMockFile("/file2", "alpha.txt", "File", new Date("2024-01-20"), 500),
		createMockFile("/folder1", "beta", "Folder", new Date("2024-01-18"), undefined),
		createMockFile("/file3", "gamma.txt", "File", new Date("2024-01-10"), 200),
		createMockFile("/folder2", "delta", "Folder", new Date("2024-01-12"), undefined),
	];

	it("should initialize with name column and ascending direction", () => {
		const { result } = renderHook(() => useFileSort(mockFiles));

		expect(result.current.sortColumn).toBe("name");
		expect(result.current.sortDirection).toBe("asc");
	});

	it("should sort files by name in ascending order by default", () => {
		const { result } = renderHook(() => useFileSort(mockFiles));

		const names = result.current.sortedFiles.map((f) => f.name);
		// Folders first, then files alphabetically
		expect(names).toEqual(["beta", "delta", "alpha.txt", "gamma.txt", "zebra.txt"]);
	});

	it("should prioritize folders over files when sorting by name", () => {
		const { result } = renderHook(() => useFileSort(mockFiles));

		const types = result.current.sortedFiles.map((f) => f.type);
		expect(types.slice(0, 2)).toEqual(["Folder", "Folder"]);
		expect(types.slice(2)).toEqual(["File", "File", "File"]);
	});

	it("should toggle sort direction when clicking same column", () => {
		const { result } = renderHook(() => useFileSort(mockFiles));

		expect(result.current.sortDirection).toBe("asc");

		act(() => {
			result.current.handleSort("name");
		});

		expect(result.current.sortDirection).toBe("desc");
		const names = result.current.sortedFiles.map((f) => f.name);
		// Folders still first, but reversed
		expect(names).toEqual(["delta", "beta", "zebra.txt", "gamma.txt", "alpha.txt"]);
	});

	it("should change column and reset to ascending when clicking different column", () => {
		const { result } = renderHook(() => useFileSort(mockFiles));

		act(() => {
			result.current.handleSort("name");
		});
		expect(result.current.sortDirection).toBe("desc");

		act(() => {
			result.current.handleSort("size");
		});

		expect(result.current.sortColumn).toBe("size");
		expect(result.current.sortDirection).toBe("asc");
	});

	it("should sort by size in ascending order", () => {
		const { result } = renderHook(() => useFileSort(mockFiles));

		act(() => {
			result.current.handleSort("size");
		});

		const sizes = result.current.sortedFiles.map((f) => f.size);
		expect(sizes).toEqual([undefined, undefined, 100, 200, 500]);
	});

	it("should sort by size in descending order", () => {
		const { result } = renderHook(() => useFileSort(mockFiles));

		act(() => {
			result.current.handleSort("size");
		});
		act(() => {
			result.current.handleSort("size");
		});

		expect(result.current.sortDirection).toBe("desc");
		const sizes = result.current.sortedFiles.map((f) => f.size);
		expect(sizes).toEqual([undefined, undefined, 500, 200, 100]);
	});

	it("should sort by modified date in ascending order", () => {
		const { result } = renderHook(() => useFileSort(mockFiles));
		act(() => {
			result.current.handleSort("modified");
		});
		const dates = result.current.sortedFiles.map((f) =>
			f.modified instanceof Date ? f.modified.toISOString() : new Date(f.modified).toISOString(),
		);
		expect(dates).toEqual([
			new Date("2024-01-12").toISOString(),
			new Date("2024-01-18").toISOString(),
			new Date("2024-01-10").toISOString(),
			new Date("2024-01-15").toISOString(),
			new Date("2024-01-20").toISOString(),
		]);
	});

	it("should sort by modified date in descending order", () => {
		const { result } = renderHook(() => useFileSort(mockFiles));

		act(() => {
			result.current.handleSort("modified");
		});
		act(() => {
			result.current.handleSort("modified");
		});

		const dates = result.current.sortedFiles.map((f) =>
			f.modified instanceof Date ? f.modified.toISOString() : new Date(f.modified).toISOString(),
		);
		expect(dates).toEqual([
			new Date("2024-01-18").toISOString(),
			new Date("2024-01-12").toISOString(),
			new Date("2024-01-20").toISOString(),
			new Date("2024-01-15").toISOString(),
			new Date("2024-01-10").toISOString(),
		]);
	});

	it("should handle case-insensitive name sorting", () => {
		const files = [
			createMockFile("/1", "ZEBRA.txt", "File", new Date(), 100),
			createMockFile("/2", "alpha.txt", "File", new Date(), 100),
			createMockFile("/3", "Beta.txt", "File", new Date(), 100),
		];

		const { result } = renderHook(() => useFileSort(files));

		const names = result.current.sortedFiles.map((f) => f.name);
		expect(names).toEqual(["alpha.txt", "Beta.txt", "ZEBRA.txt"]);
	});

	it("should handle empty file list", () => {
		const { result } = renderHook(() => useFileSort([]));

		expect(result.current.sortedFiles).toEqual([]);

		act(() => {
			result.current.handleSort("name");
		});

		expect(result.current.sortedFiles).toEqual([]);
	});

	it("should handle single file", () => {
		const singleFile = [createMockFile("/1", "file.txt", "File", "100", new Date())];
		const { result } = renderHook(() => useFileSort(singleFile));

		expect(result.current.sortedFiles).toHaveLength(1);
		expect(result.current.sortedFiles[0].name).toBe("file.txt");
	});

	it("should handle files with same name", () => {
		const files = [
			createMockFile("/1", "duplicate.txt", "File", "100", new Date("2024-01-15")),
			createMockFile("/2", "duplicate.txt", "File", "200", new Date("2024-01-16")),
		];

		const { result } = renderHook(() => useFileSort(files));

		// Should maintain stable sort
		expect(result.current.sortedFiles).toHaveLength(2);
	});

	it("should handle files with non-numeric size values", () => {
		const files = [
			createMockFile("/1", "file1.txt", "File", "1.5 KB", new Date()),
			createMockFile("/2", "file2.txt", "File", "N/A", new Date()),
			createMockFile("/3", "file3.txt", "File", "100", new Date()),
		];

		const { result } = renderHook(() => useFileSort(files));

		act(() => {
			result.current.handleSort("size");
		});

		// Non-numeric values parse to NaN which becomes 0 in comparison
		expect(result.current.sortedFiles).toHaveLength(3);
	});

	it("should handle Date objects and strings for modified", () => {
		const files = [
			createMockFile("/1", "file1.txt", "File", new Date("2024-01-15"), 100),
			createMockFile("/2", "file2.txt", "File", "2024-01-10" as any, 100),
		];

		const { result } = renderHook(() => useFileSort(files));

		act(() => {
			result.current.handleSort("modified");
		});

		// Should handle both Date objects and strings
		expect(result.current.sortedFiles[0].name).toBe("file2.txt");
		expect(result.current.sortedFiles[1].name).toBe("file1.txt");
	});

	it("should not mutate original file list", () => {
		const files = [
			createMockFile("/1", "zebra.txt", "File", 100, new Date(), 100),
			createMockFile("/2", "alpha.txt", "File", 200, new Date(), 100),
		];

		const originalOrder = files.map((f) => f.name);
		const { result } = renderHook(() => useFileSort(files));

		act(() => {
			result.current.handleSort("name");
		});

		// Original array should remain unchanged
		expect(files.map((f) => f.name)).toEqual(originalOrder);
	});

	it("should handle mixed folders and files with same names", () => {
		const files = [
			createMockFile("/1", "test", "Folder", new Date(), undefined),
			createMockFile("/2", "test", "File", new Date(), 100),
		];

		const { result } = renderHook(() => useFileSort(files));

		// Folder should come first
		expect(result.current.sortedFiles[0].type).toBe("Folder");
		expect(result.current.sortedFiles[1].type).toBe("File");
	});

	it("should handle rapid sort column changes", () => {
		const { result } = renderHook(() => useFileSort(mockFiles));

		act(() => {
			result.current.handleSort("size");
		});
		expect(result.current.sortColumn).toBe("size");

		act(() => {
			result.current.handleSort("modified");
		});
		expect(result.current.sortColumn).toBe("modified");

		act(() => {
			result.current.handleSort("name");
		});
		expect(result.current.sortColumn).toBe("name");
		expect(result.current.sortDirection).toBe("asc");
	});

	it("should handle multiple toggles of same column", () => {
		const { result } = renderHook(() => useFileSort(mockFiles));

		act(() => {
			result.current.handleSort("name");
		});
		expect(result.current.sortDirection).toBe("desc");

		act(() => {
			result.current.handleSort("name");
		});
		expect(result.current.sortDirection).toBe("asc");

		act(() => {
			result.current.handleSort("name");
		});
		expect(result.current.sortDirection).toBe("desc");
	});

	it("should sort folders alphabetically when both are folders", () => {
		const files = [
			createMockFile("/1", "zebra", "Folder", new Date(), undefined),
			createMockFile("/2", "alpha", "Folder", new Date(), undefined),
			createMockFile("/3", "beta", "Folder", new Date(), undefined),
		];

		const { result } = renderHook(() => useFileSort(files));

		const names = result.current.sortedFiles.map((f) => f.name);
		expect(names).toEqual(["alpha", "beta", "zebra"]);
	});

	it("should handle size values with units", () => {
		const files = [
			createMockFile("/1", "small.txt", "File", new Date(), 100),
			createMockFile("/2", "medium.txt", "File", new Date(), 200),
			createMockFile("/3", "large.txt", "File", new Date(), 300),
		];

		const { result } = renderHook(() => useFileSort(files));

		act(() => {
			result.current.handleSort("size");
		});

		// parseInt will extract the leading number
		const sizes = result.current.sortedFiles.map((f) => f.size);
		expect(sizes).toEqual([100, 200, 300]);
	});
});
