import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFileManagerStore } from "../store/useFileManagerStore";
import { useFileClipboard } from "./useFileClipboard";

// Mock the WebDAV hooks
vi.mock("./useWebDAVPropfind", () => ({
	useWebDAVMove: vi.fn(() => ({
		mutateAsync: vi.fn(),
	})),
	useWebDAVCopy: vi.fn(() => ({
		mutateAsync: vi.fn(),
	})),
}));

import { useWebDAVCopy, useWebDAVMove } from "./useWebDAVPropfind";

const createTestQueryClient = () =>
	new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});

const wrapper = ({ children }: { children: ReactNode }) =>
	createElement(QueryClientProvider, { client: createTestQueryClient() }, children);

describe("useFileClipboard", () => {
	let mockMoveMutate: ReturnType<typeof vi.fn>;
	let mockCopyMutate: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		// Reset store
		useFileManagerStore.setState({ activePath: "/current" });

		mockMoveMutate = vi.fn();
		mockCopyMutate = vi.fn();

		(useWebDAVMove as ReturnType<typeof vi.fn>).mockReturnValue({
			mutateAsync: mockMoveMutate,
		});

		(useWebDAVCopy as ReturnType<typeof vi.fn>).mockReturnValue({
			mutateAsync: mockCopyMutate,
		});
	});

	it("should initialize with empty clipboard", () => {
		const { result } = renderHook(() => useFileClipboard(), { wrapper });

		expect(result.current.clipboard).toEqual([]);
		expect(result.current.activeAction).toBeNull();
		expect(result.current.hasPending).toBe(false);
	});

	it("should set clipboard for cut action", () => {
		const { result } = renderHook(() => useFileClipboard(), { wrapper });

		act(() => {
			result.current.cut(["/path/to/file1.txt", "/path/to/file2.txt"]);
		});

		expect(result.current.clipboard).toEqual(["/path/to/file1.txt", "/path/to/file2.txt"]);
		expect(result.current.activeAction).toBe("cut");
		expect(result.current.hasPending).toBe(true);
	});

	it("should set clipboard for copy action", () => {
		const { result } = renderHook(() => useFileClipboard(), { wrapper });

		act(() => {
			result.current.copy(["/path/to/file1.txt", "/path/to/file2.txt"]);
		});

		expect(result.current.clipboard).toEqual(["/path/to/file1.txt", "/path/to/file2.txt"]);
		expect(result.current.activeAction).toBe("copy");
		expect(result.current.hasPending).toBe(true);
	});

	it("should replace clipboard on subsequent cut", () => {
		const { result } = renderHook(() => useFileClipboard(), { wrapper });

		act(() => {
			result.current.cut(["/file1.txt"]);
		});

		act(() => {
			result.current.cut(["/file2.txt", "/file3.txt"]);
		});

		expect(result.current.clipboard).toEqual(["/file2.txt", "/file3.txt"]);
	});

	it("should paste with cut action (move)", async () => {
		mockMoveMutate.mockResolvedValue({});

		const { result } = renderHook(() => useFileClipboard(), { wrapper });

		act(() => {
			result.current.cut(["/source/file1.txt", "/source/file2.txt"]);
		});

		await act(async () => {
			await result.current.paste();
		});

		expect(mockMoveMutate).toHaveBeenCalledTimes(2);
		expect(mockMoveMutate).toHaveBeenCalledWith({
			fromPath: "/source/file1.txt",
			toPath: "/current/file1.txt",
		});
		expect(mockMoveMutate).toHaveBeenCalledWith({
			fromPath: "/source/file2.txt",
			toPath: "/current/file2.txt",
		});

		// Clipboard should be cleared on success
		expect(result.current.clipboard).toEqual([]);
		expect(result.current.activeAction).toBeNull();
	});

	it("should paste with copy action", async () => {
		mockCopyMutate.mockResolvedValue({});

		const { result } = renderHook(() => useFileClipboard(), { wrapper });

		act(() => {
			result.current.copy(["/source/file1.txt"]);
		});

		await act(async () => {
			await result.current.paste();
		});

		expect(mockCopyMutate).toHaveBeenCalledTimes(1);
		expect(mockCopyMutate).toHaveBeenCalledWith({
			fromPath: "/source/file1.txt",
			toPath: "/current/file1.txt",
		});

		expect(result.current.clipboard).toEqual([]);
	});

	it("should not paste when clipboard is empty", async () => {
		const { result } = renderHook(() => useFileClipboard(), { wrapper });

		await act(async () => {
			await result.current.paste();
		});

		expect(mockMoveMutate).not.toHaveBeenCalled();
		expect(mockCopyMutate).not.toHaveBeenCalled();
	});

	it("should not paste when activeAction is null", async () => {
		const { result } = renderHook(() => useFileClipboard(), { wrapper });

		// Set clipboard but no action
		act(() => {
			result.current.clipboard.push("/file.txt");
		});

		await act(async () => {
			await result.current.paste();
		});

		expect(mockMoveMutate).not.toHaveBeenCalled();
		expect(mockCopyMutate).not.toHaveBeenCalled();
	});

	it("should throw AggregateError on paste failure", async () => {
		const error = new Error("Move failed");
		mockMoveMutate.mockRejectedValue(error);

		const { result } = renderHook(() => useFileClipboard(), { wrapper });

		act(() => {
			result.current.cut(["/source/file1.txt", "/source/file2.txt"]);
		});

		await expect(async () => {
			await act(async () => {
				await result.current.paste();
			});
		}).rejects.toThrow("2 of 2 cut operation(s) failed");

		// Clipboard should NOT be cleared on failure
		expect(result.current.clipboard).toEqual(["/source/file1.txt", "/source/file2.txt"]);
		expect(result.current.activeAction).toBe("cut");
	});

	it("should throw AggregateError on partial failure", async () => {
		mockMoveMutate
			.mockResolvedValueOnce({})
			.mockRejectedValueOnce(new Error("Second move failed"))
			.mockResolvedValueOnce({});

		const { result } = renderHook(() => useFileClipboard(), { wrapper });

		act(() => {
			result.current.cut(["/file1.txt", "/file2.txt", "/file3.txt"]);
		});

		await expect(async () => {
			await act(async () => {
				await result.current.paste();
			});
		}).rejects.toThrow("1 of 3 cut operation(s) failed");

		// Clipboard preserved for retry
		expect(result.current.clipboard).toHaveLength(3);
	});

	it("should handle copy failure with correct error message", async () => {
		mockCopyMutate.mockRejectedValue(new Error("Copy failed"));

		const { result } = renderHook(() => useFileClipboard(), { wrapper });

		act(() => {
			result.current.copy(["/file1.txt"]);
		});

		await expect(async () => {
			await act(async () => {
				await result.current.paste();
			});
		}).rejects.toThrow("1 of 1 copy operation(s) failed");
	});

	it("should use active path from store for destination", async () => {
		mockMoveMutate.mockResolvedValue({});
		useFileManagerStore.setState({ activePath: "/custom/path" });

		const { result } = renderHook(() => useFileClipboard(), { wrapper });

		act(() => {
			result.current.cut(["/source/file.txt"]);
		});

		await act(async () => {
			await result.current.paste();
		});

		expect(mockMoveMutate).toHaveBeenCalledWith({
			fromPath: "/source/file.txt",
			toPath: "/custom/path/file.txt",
		});
	});

	it("should extract basename correctly for nested paths", async () => {
		mockCopyMutate.mockResolvedValue({});

		const { result } = renderHook(() => useFileClipboard(), { wrapper });

		act(() => {
			result.current.copy(["/very/deep/nested/path/file.txt"]);
		});

		await act(async () => {
			await result.current.paste();
		});

		expect(mockCopyMutate).toHaveBeenCalledWith({
			fromPath: "/very/deep/nested/path/file.txt",
			toPath: "/current/file.txt",
		});
	});

	it("should handle empty cut array", () => {
		const { result } = renderHook(() => useFileClipboard(), { wrapper });

		act(() => {
			result.current.cut([]);
		});

		expect(result.current.clipboard).toEqual([]);
		expect(result.current.hasPending).toBe(false);
	});

	it("should handle multiple paste attempts", async () => {
		mockCopyMutate.mockResolvedValue({});

		const { result } = renderHook(() => useFileClipboard(), { wrapper });

		act(() => {
			result.current.copy(["/file.txt"]);
		});

		await act(async () => {
			await result.current.paste();
		});

		expect(result.current.clipboard).toEqual([]);

		// Second paste should do nothing
		await act(async () => {
			await result.current.paste();
		});

		expect(mockCopyMutate).toHaveBeenCalledTimes(1);
	});

	it("should allow retrying after failure", async () => {
		mockMoveMutate.mockRejectedValueOnce(new Error("Failed")).mockResolvedValueOnce({});

		const { result } = renderHook(() => useFileClipboard(), { wrapper });

		act(() => {
			result.current.cut(["/file.txt"]);
		});

		// First attempt fails
		await expect(async () => {
			await act(async () => {
				await result.current.paste();
			});
		}).rejects.toThrow();

		expect(result.current.clipboard).toEqual(["/file.txt"]);

		// Retry succeeds
		await act(async () => {
			await result.current.paste();
		});

		expect(result.current.clipboard).toEqual([]);
	});

	it("should switch between cut and copy actions", () => {
		const { result } = renderHook(() => useFileClipboard(), { wrapper });

		act(() => {
			result.current.cut(["/file1.txt"]);
		});
		expect(result.current.activeAction).toBe("cut");

		act(() => {
			result.current.copy(["/file2.txt"]);
		});
		expect(result.current.activeAction).toBe("copy");
		expect(result.current.clipboard).toEqual(["/file2.txt"]);
	});
});
