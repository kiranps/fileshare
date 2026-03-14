import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WebDAVEntry } from "../api/webdav";
import { useFileManagerStore } from "../store/useFileManagerStore";
import { render } from "../test/test-utils";
import { FileManager } from "./FileManager";

// Mock the WebDAV propfind hook
vi.mock("../hooks/useWebDAVPropfind", () => ({
	useWebDAVPropfind: vi.fn(),
	useWebDAVDelete: vi.fn(() => ({ mutate: vi.fn(), isPending: false, isError: false })),
	useWebDAVMove: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, isError: false })),
	useWebDAVMkcol: vi.fn(() => ({ mutate: vi.fn(), isPending: false, isError: false })),
	useWebDAVPut: vi.fn(() => ({ mutate: vi.fn(), isPending: false, isError: false })),
	useWebDAVCopy: vi.fn(() => ({ mutateAsync: vi.fn() })),
}));

import { useWebDAVPropfind } from "../hooks/useWebDAVPropfind";

const mockEntries: WebDAVEntry[] = [
	{
		href: "/",
		displayName: "/",
		isCollection: true,
		contentType: undefined,
		contentLength: undefined,
		lastModified: new Date("2024-01-01"),
	},
	{
		href: "/document.txt",
		displayName: "document.txt",
		isCollection: false,
		contentType: "text/plain",
		contentLength: 1024,
		lastModified: new Date("2024-06-10"),
	},
	{
		href: "/Photos",
		displayName: "Photos",
		isCollection: true,
		contentType: undefined,
		contentLength: undefined,
		lastModified: new Date("2024-05-01"),
	},
	{
		href: "/.hidden-file",
		displayName: ".hidden-file",
		isCollection: false,
		contentType: "text/plain",
		contentLength: 512,
		lastModified: new Date("2024-01-01"),
	},
];

describe("FileManager", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		useFileManagerStore.setState({ activePath: "/" });
	});

	describe("loading state", () => {
		it("renders loading message when isLoading is true", () => {
			(useWebDAVPropfind as ReturnType<typeof vi.fn>).mockReturnValue({
				data: undefined,
				isLoading: true,
				error: null,
			});
			render(<FileManager />);
			expect(screen.getByText("Loading files...")).toBeInTheDocument();
		});

		it("does not render FileList when loading", () => {
			(useWebDAVPropfind as ReturnType<typeof vi.fn>).mockReturnValue({
				data: undefined,
				isLoading: true,
				error: null,
			});
			render(<FileManager />);
			expect(screen.queryByRole("table")).not.toBeInTheDocument();
		});
	});

	describe("error state", () => {
		it("renders error message when error is set", () => {
			(useWebDAVPropfind as ReturnType<typeof vi.fn>).mockReturnValue({
				data: undefined,
				isLoading: false,
				error: new Error("Network error"),
			});
			render(<FileManager />);
			expect(screen.getByText("Error loading files.")).toBeInTheDocument();
		});

		it("does not render FileList on error", () => {
			(useWebDAVPropfind as ReturnType<typeof vi.fn>).mockReturnValue({
				data: undefined,
				isLoading: false,
				error: new Error("Network error"),
			});
			render(<FileManager />);
			expect(screen.queryByRole("table")).not.toBeInTheDocument();
		});
	});

	describe("success state", () => {
		beforeEach(() => {
			(useWebDAVPropfind as ReturnType<typeof vi.fn>).mockReturnValue({
				data: mockEntries,
				isLoading: false,
				error: null,
			});
		});

		it("renders the file list table", () => {
			render(<FileManager />);
			expect(screen.getByRole("table")).toBeInTheDocument();
		});

		it("renders non-hidden files", () => {
			render(<FileManager />);
			expect(screen.getByText("document.txt")).toBeInTheDocument();
			expect(screen.getByText("Photos")).toBeInTheDocument();
		});

		it("does not render hidden files (starting with '.')", () => {
			render(<FileManager />);
			expect(screen.queryByText(".hidden-file")).not.toBeInTheDocument();
		});

		it("renders Sidebar", () => {
			render(<FileManager />);
			expect(screen.getByRole("complementary")).toBeInTheDocument();
		});

		it("renders Navbar navigation", () => {
			render(<FileManager />);
			expect(screen.getByRole("navigation", { name: "File navigation" })).toBeInTheDocument();
		});
	});

	describe("empty directory", () => {
		it("renders empty state message when no files returned", () => {
			// Only the directory itself (first entry) with no files
			(useWebDAVPropfind as ReturnType<typeof vi.fn>).mockReturnValue({
				data: [
					{
						href: "/",
						displayName: "/",
						isCollection: true,
						contentType: undefined,
						lastModified: new Date("2024-01-01"),
					},
				],
				isLoading: false,
				error: null,
			});
			render(<FileManager />);
			expect(screen.getByText("No files or folders found.")).toBeInTheDocument();
		});

		it("renders empty state when data is undefined", () => {
			(useWebDAVPropfind as ReturnType<typeof vi.fn>).mockReturnValue({
				data: undefined,
				isLoading: false,
				error: null,
			});
			render(<FileManager />);
			// Should still render FileList with empty files array
			expect(screen.getByText("No files or folders found.")).toBeInTheDocument();
		});
	});

	describe("all-hidden directory", () => {
		it("renders empty state when all files are hidden", () => {
			(useWebDAVPropfind as ReturnType<typeof vi.fn>).mockReturnValue({
				data: [
					{
						href: "/",
						displayName: "/",
						isCollection: true,
						contentType: undefined,
						lastModified: new Date("2024-01-01"),
					},
					{
						href: "/.gitignore",
						displayName: ".gitignore",
						isCollection: false,
						contentType: "text/plain",
						lastModified: new Date("2024-01-01"),
					},
				],
				isLoading: false,
				error: null,
			});
			render(<FileManager />);
			expect(screen.getByText("No files or folders found.")).toBeInTheDocument();
		});
	});

	describe("layout structure", () => {
		it("renders main layout container", () => {
			(useWebDAVPropfind as ReturnType<typeof vi.fn>).mockReturnValue({
				data: [],
				isLoading: false,
				error: null,
			});
			const { container } = render(<FileManager />);
			// Root div should be present
			expect(container.firstChild).toBeInTheDocument();
		});

		it("renders main element", () => {
			(useWebDAVPropfind as ReturnType<typeof vi.fn>).mockReturnValue({
				data: [],
				isLoading: false,
				error: null,
			});
			render(<FileManager />);
			expect(screen.getByRole("main")).toBeInTheDocument();
		});
	});
});
