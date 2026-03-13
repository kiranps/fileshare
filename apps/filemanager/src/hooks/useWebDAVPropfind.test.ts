import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the WebDAV API functions
vi.mock("../api/webdav", () => ({
	webdavPropfind: vi.fn(),
	webdavDelete: vi.fn(),
	webdavMove: vi.fn(),
	webdavCopy: vi.fn(),
	webdavMkcol: vi.fn(),
	webdavPut: vi.fn(),
}));

import { webdavCopy, webdavDelete, webdavMkcol, webdavMove, webdavPropfind, webdavPut } from "../api/webdav";
import {
	useWebDAVCopy,
	useWebDAVDelete,
	useWebDAVMkcol,
	useWebDAVMove,
	useWebDAVPropfind,
	useWebDAVPut,
} from "./useWebDAVPropfind";

const createWrapper = () => {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: 0 },
			mutations: { retry: false },
		},
	});
	const Wrapper = ({ children }: { children: ReactNode }) =>
		createElement(QueryClientProvider, { client: queryClient }, children);
	return { Wrapper, queryClient };
};

describe("useWebDAVPropfind", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("calls webdavPropfind with the given path", async () => {
		const mockData = [
			{
				href: "/",
				displayName: "/",
				isCollection: true,
				contentType: undefined,
				lastModified: undefined,
			},
		];
		(webdavPropfind as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

		const { Wrapper } = createWrapper();
		const { result } = renderHook(() => useWebDAVPropfind("/documents"), { wrapper: Wrapper });

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(webdavPropfind).toHaveBeenCalledWith("/documents");
		expect(result.current.data).toEqual(mockData);
	});

	it("returns isLoading true initially", () => {
		(webdavPropfind as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
		const { Wrapper } = createWrapper();
		const { result } = renderHook(() => useWebDAVPropfind("/"), { wrapper: Wrapper });
		expect(result.current.isLoading).toBe(true);
	});

	it("returns error when webdavPropfind rejects", async () => {
		const error = new Error("PROPFIND failed: 404");
		(webdavPropfind as ReturnType<typeof vi.fn>).mockRejectedValue(error);

		const { Wrapper } = createWrapper();
		const { result } = renderHook(() => useWebDAVPropfind("/missing"), { wrapper: Wrapper });

		await waitFor(() => expect(result.current.isError).toBe(true));
		expect(result.current.error).toBe(error);
	});

	it("uses ['files', path] as query key", async () => {
		(webdavPropfind as ReturnType<typeof vi.fn>).mockResolvedValue([]);
		const { Wrapper, queryClient } = createWrapper();
		renderHook(() => useWebDAVPropfind("/test-path"), { wrapper: Wrapper });
		await waitFor(() => {
			const cache = queryClient.getQueryCache().find({ queryKey: ["files", "/test-path"] });
			expect(cache).toBeDefined();
		});
	});
});

describe("useWebDAVDelete", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("calls webdavDelete with path", async () => {
		const result = { path: "/files/doc.txt", ok: true, status: 204 };
		(webdavDelete as ReturnType<typeof vi.fn>).mockResolvedValue(result);

		const { Wrapper } = createWrapper();
		const { result: hookResult } = renderHook(() => useWebDAVDelete(), { wrapper: Wrapper });

		await act(async () => {
			hookResult.current.mutate("/files/doc.txt");
		});

		await waitFor(() => expect(hookResult.current.isSuccess).toBe(true));
		expect(webdavDelete).toHaveBeenCalledWith("/files/doc.txt");
	});

	it("enters error state when webdavDelete fails", async () => {
		(webdavDelete as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("DELETE failed"));

		const { Wrapper } = createWrapper();
		const { result: hookResult } = renderHook(() => useWebDAVDelete(), { wrapper: Wrapper });

		await act(async () => {
			hookResult.current.mutate("/files/doc.txt");
		});

		await waitFor(() => expect(hookResult.current.isError).toBe(true));
	});

	it("invalidates parent directory query on success", async () => {
		const deleteResult = { path: "/files/doc.txt", ok: true, status: 204 };
		(webdavDelete as ReturnType<typeof vi.fn>).mockResolvedValue(deleteResult);

		const { Wrapper, queryClient } = createWrapper();
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

		const { result: hookResult } = renderHook(() => useWebDAVDelete(), { wrapper: Wrapper });

		await act(async () => {
			hookResult.current.mutate("/files/doc.txt");
		});

		await waitFor(() => expect(hookResult.current.isSuccess).toBe(true));
		expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["files", "/files"] });
	});
});

describe("useWebDAVMove", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("calls webdavMove with fromPath, toPath, overwrite", async () => {
		const moveResult = { from: "/src/file.txt", to: "/dst/file.txt", ok: true, status: 201 };
		(webdavMove as ReturnType<typeof vi.fn>).mockResolvedValue(moveResult);

		const { Wrapper } = createWrapper();
		const { result: hookResult } = renderHook(() => useWebDAVMove(), { wrapper: Wrapper });

		await act(async () => {
			hookResult.current.mutate({ fromPath: "/src/file.txt", toPath: "/dst/file.txt", overwrite: true });
		});

		await waitFor(() => expect(hookResult.current.isSuccess).toBe(true));
		expect(webdavMove).toHaveBeenCalledWith("/src/file.txt", "/dst/file.txt", true);
	});

	it("defaults overwrite to false when not provided", async () => {
		const moveResult = { from: "/a.txt", to: "/b.txt", ok: true, status: 201 };
		(webdavMove as ReturnType<typeof vi.fn>).mockResolvedValue(moveResult);

		const { Wrapper } = createWrapper();
		const { result: hookResult } = renderHook(() => useWebDAVMove(), { wrapper: Wrapper });

		await act(async () => {
			hookResult.current.mutate({ fromPath: "/a.txt", toPath: "/b.txt" });
		});

		await waitFor(() => expect(hookResult.current.isSuccess).toBe(true));
		expect(webdavMove).toHaveBeenCalledWith("/a.txt", "/b.txt", false);
	});

	it("invalidates both source and destination parent dirs on success", async () => {
		const moveResult = { from: "/src/file.txt", to: "/dst/file.txt", ok: true, status: 201 };
		(webdavMove as ReturnType<typeof vi.fn>).mockResolvedValue(moveResult);

		const { Wrapper, queryClient } = createWrapper();
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

		const { result: hookResult } = renderHook(() => useWebDAVMove(), { wrapper: Wrapper });

		await act(async () => {
			hookResult.current.mutate({ fromPath: "/src/file.txt", toPath: "/dst/file.txt" });
		});

		await waitFor(() => expect(hookResult.current.isSuccess).toBe(true));
		expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["files", "/src"] });
		expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["files", "/dst"] });
	});

	it("enters error state when webdavMove fails", async () => {
		(webdavMove as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("MOVE failed: 409"));

		const { Wrapper } = createWrapper();
		const { result: hookResult } = renderHook(() => useWebDAVMove(), { wrapper: Wrapper });

		await act(async () => {
			hookResult.current.mutate({ fromPath: "/a.txt", toPath: "/b.txt" });
		});

		await waitFor(() => expect(hookResult.current.isError).toBe(true));
	});
});

describe("useWebDAVCopy", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("calls webdavCopy with fromPath, toPath", async () => {
		const copyResult = { from: "/src/file.txt", to: "/dst/file.txt", ok: true, status: 201 };
		(webdavCopy as ReturnType<typeof vi.fn>).mockResolvedValue(copyResult);

		const { Wrapper } = createWrapper();
		const { result: hookResult } = renderHook(() => useWebDAVCopy(), { wrapper: Wrapper });

		await act(async () => {
			hookResult.current.mutate({ fromPath: "/src/file.txt", toPath: "/dst/file.txt" });
		});

		await waitFor(() => expect(hookResult.current.isSuccess).toBe(true));
		expect(webdavCopy).toHaveBeenCalledWith("/src/file.txt", "/dst/file.txt", false);
	});

	it("invalidates both parent directories on success", async () => {
		const copyResult = { from: "/docs/a.pdf", to: "/archive/a.pdf", ok: true, status: 201 };
		(webdavCopy as ReturnType<typeof vi.fn>).mockResolvedValue(copyResult);

		const { Wrapper, queryClient } = createWrapper();
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

		const { result: hookResult } = renderHook(() => useWebDAVCopy(), { wrapper: Wrapper });

		await act(async () => {
			hookResult.current.mutate({ fromPath: "/docs/a.pdf", toPath: "/archive/a.pdf" });
		});

		await waitFor(() => expect(hookResult.current.isSuccess).toBe(true));
		expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["files", "/docs"] });
		expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["files", "/archive"] });
	});
});

describe("useWebDAVMkcol", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("calls webdavMkcol with path", async () => {
		const mkcolResult = { path: "/files/NewFolder", ok: true, status: 201 };
		(webdavMkcol as ReturnType<typeof vi.fn>).mockResolvedValue(mkcolResult);

		const { Wrapper } = createWrapper();
		const { result: hookResult } = renderHook(() => useWebDAVMkcol(), { wrapper: Wrapper });

		await act(async () => {
			hookResult.current.mutate("/files/NewFolder");
		});

		await waitFor(() => expect(hookResult.current.isSuccess).toBe(true));
		expect(webdavMkcol).toHaveBeenCalledWith("/files/NewFolder");
	});

	it("invalidates parent directory on success", async () => {
		const mkcolResult = { path: "/files/NewFolder", ok: true, status: 201 };
		(webdavMkcol as ReturnType<typeof vi.fn>).mockResolvedValue(mkcolResult);

		const { Wrapper, queryClient } = createWrapper();
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

		const { result: hookResult } = renderHook(() => useWebDAVMkcol(), { wrapper: Wrapper });

		await act(async () => {
			hookResult.current.mutate("/files/NewFolder");
		});

		await waitFor(() => expect(hookResult.current.isSuccess).toBe(true));
		expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["files", "/files"] });
	});

	it("enters error state on failure", async () => {
		(webdavMkcol as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("MKCOL failed: 405"));

		const { Wrapper } = createWrapper();
		const { result: hookResult } = renderHook(() => useWebDAVMkcol(), { wrapper: Wrapper });

		await act(async () => {
			hookResult.current.mutate("/files/ExistingFolder");
		});

		await waitFor(() => expect(hookResult.current.isError).toBe(true));
	});
});

describe("useWebDAVPut", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("calls webdavPut with path and file", async () => {
		const putResult = { path: "/files/upload.txt", ok: true, status: 201 };
		(webdavPut as ReturnType<typeof vi.fn>).mockResolvedValue(putResult);

		const { Wrapper } = createWrapper();
		const { result: hookResult } = renderHook(() => useWebDAVPut(), { wrapper: Wrapper });

		const mockFile = new File(["content"], "upload.txt", { type: "text/plain" });

		await act(async () => {
			hookResult.current.mutate({ path: "/files/upload.txt", file: mockFile });
		});

		await waitFor(() => expect(hookResult.current.isSuccess).toBe(true));
		expect(webdavPut).toHaveBeenCalledWith("/files/upload.txt", mockFile);
	});

	it("invalidates parent directory on success", async () => {
		const putResult = { path: "/files/upload.txt", ok: true, status: 201 };
		(webdavPut as ReturnType<typeof vi.fn>).mockResolvedValue(putResult);

		const { Wrapper, queryClient } = createWrapper();
		const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

		const { result: hookResult } = renderHook(() => useWebDAVPut(), { wrapper: Wrapper });

		const mockFile = new File(["content"], "upload.txt");

		await act(async () => {
			hookResult.current.mutate({ path: "/files/upload.txt", file: mockFile });
		});

		await waitFor(() => expect(hookResult.current.isSuccess).toBe(true));
		expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["files", "/files"] });
	});

	it("enters error state on upload failure", async () => {
		(webdavPut as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("PUT failed: 507"));

		const { Wrapper } = createWrapper();
		const { result: hookResult } = renderHook(() => useWebDAVPut(), { wrapper: Wrapper });

		const mockFile = new File(["content"], "upload.txt");

		await act(async () => {
			hookResult.current.mutate({ path: "/files/upload.txt", file: mockFile });
		});

		await waitFor(() => expect(hookResult.current.isError).toBe(true));
	});
});
