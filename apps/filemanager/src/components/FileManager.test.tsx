import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FileItemProps } from "../types";
import { useFileManagerStore } from "../store/useFileManagerStore";
import { render } from "../test/test-utils";
import { FileManager } from "./FileManager";

// Mock useFileSystem hooks
const mockUseFiles = vi.fn();

vi.mock("../hooks/useFileSystem", () => ({
	useFiles: (...args: unknown[]) => mockUseFiles(...args),
	useDeleteFile: vi.fn(() => ({ mutate: vi.fn(), isPending: false, isError: false })),
	useRenameFile: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, isError: false })),
	useCreateDirectory: vi.fn(() => ({ mutate: vi.fn(), isPending: false, isError: false })),
	useMoveFile: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, isError: false })),
	useUploadFile: vi.fn(() => ({ mutate: vi.fn(), isPending: false, isError: false })),
	useDownloadFile: vi.fn(() => ({ download: vi.fn(), progress: null, downloading: false, error: null, abort: vi.fn() })),
	useCopyFile: vi.fn(() => ({ mutateAsync: vi.fn().mockResolvedValue({}) })),
}));

// Also mock WebDAV propfind so context/sidebar doesn't blow up
vi.mock("../hooks/useWebDAVPropfind", () => ({
	useWebDAVPropfind: vi.fn(() => ({ data: undefined, isLoading: false, error: null })),
	useWebDAVDelete: vi.fn(() => ({ mutate: vi.fn(), isPending: false, isError: false })),
	useWebDAVMove: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, isError: false })),
	useWebDAVMkcol: vi.fn(() => ({ mutate: vi.fn(), isPending: false, isError: false })),
	useWebDAVPut: vi.fn(() => ({ mutate: vi.fn(), isPending: false, isError: false })),
	useWebDAVCopy: vi.fn(() => ({ mutateAsync: vi.fn() })),
}));

const mockFiles: FileItemProps[] = [
	{
		id: "/document.txt",
		name: "document.txt",
		type: "text",
		size: 1024,
		modified: new Date("2024-06-10"),
	},
	{
		id: "/Photos",
		name: "Photos",
		type: "folder",
		size: undefined,
		modified: new Date("2024-05-01"),
	},
];

const hiddenFile: FileItemProps = {
	id: "/.hidden-file",
	name: ".hidden-file",
	type: "file",
	size: 512,
	modified: new Date("2024-01-01"),
};

describe("FileManager", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		useFileManagerStore.setState({ activePath: "/" });
	});

	describe("loading state", () => {
		it("renders loading message when isLoading is true", () => {
			mockUseFiles.mockReturnValue({ data: undefined, isLoading: true, error: null });
			render(<FileManager />);
			expect(screen.getByText("Loading files...")).toBeInTheDocument();
		});

		it("does not render FileList when loading", () => {
			mockUseFiles.mockReturnValue({ data: undefined, isLoading: true, error: null });
			render(<FileManager />);
			expect(screen.queryByRole("table")).not.toBeInTheDocument();
		});
	});

	describe("error state", () => {
		it("renders error message when error is set", () => {
			mockUseFiles.mockReturnValue({ data: undefined, isLoading: false, error: new Error("Network error") });
			render(<FileManager />);
			expect(screen.getByText("Error loading files.")).toBeInTheDocument();
		});

		it("does not render FileList on error", () => {
			mockUseFiles.mockReturnValue({ data: undefined, isLoading: false, error: new Error("Network error") });
			render(<FileManager />);
			expect(screen.queryByRole("table")).not.toBeInTheDocument();
		});
	});

	describe("success state", () => {
		beforeEach(() => {
			mockUseFiles.mockReturnValue({
				data: { activeDirectory: undefined, files: [...mockFiles, hiddenFile] },
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
			mockUseFiles.mockReturnValue({
				data: { activeDirectory: undefined, files: [] },
				isLoading: false,
				error: null,
			});
			render(<FileManager />);
			expect(screen.getByText("No files or folders found.")).toBeInTheDocument();
		});

		it("renders empty state when data is undefined", () => {
			mockUseFiles.mockReturnValue({ data: undefined, isLoading: false, error: null });
			render(<FileManager />);
			// Should still render FileList with empty files array
			expect(screen.getByText("No files or folders found.")).toBeInTheDocument();
		});
	});

	describe("all-hidden directory", () => {
		it("renders empty state when all files are hidden", () => {
			mockUseFiles.mockReturnValue({
				data: {
					activeDirectory: undefined,
					files: [
						{
							id: "/.gitignore",
							name: ".gitignore",
							type: "file",
							size: undefined,
							modified: new Date("2024-01-01"),
						},
					],
				},
				isLoading: false,
				error: null,
			});
			render(<FileManager />);
			expect(screen.getByText("No files or folders found.")).toBeInTheDocument();
		});
	});

	describe("layout structure", () => {
		it("renders main layout container", () => {
			mockUseFiles.mockReturnValue({ data: { activeDirectory: undefined, files: [] }, isLoading: false, error: null });
			const { container } = render(<FileManager />);
			// Root div should be present
			expect(container.firstChild).toBeInTheDocument();
		});

		it("renders main element", () => {
			mockUseFiles.mockReturnValue({ data: { activeDirectory: undefined, files: [] }, isLoading: false, error: null });
			render(<FileManager />);
			expect(screen.getByRole("main")).toBeInTheDocument();
		});
	});
});
