import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFileManagerStore } from "../store/useFileManagerStore";
import { render } from "../test/test-utils";
import type { FileItemProps } from "../types";
import { fileSelectedClass } from "./FileItem";
import { FileList } from "./FileList";

// Mock all heavy external dependencies
const mockNavigate = vi.fn();
const mockDeleteMutate = vi.fn();
const mockMoveMutate = vi.fn();
const mockMkdirMutate = vi.fn();
const mockPutMutate = vi.fn();

vi.mock("react-router-dom", async () => {
	const actual = await vi.importActual("react-router-dom");
	return {
		...actual,
		useNavigate: () => mockNavigate,
	};
});

vi.mock("../hooks/useWebDAVPropfind", () => ({
	useWebDAVDelete: vi.fn(() => ({
		mutate: mockDeleteMutate,
		isPending: false,
		isError: false,
		error: null,
	})),
	useWebDAVMove: vi.fn(() => ({
		mutate: mockMoveMutate,
		mutateAsync: vi.fn().mockResolvedValue({}),
		isPending: false,
		isError: false,
		error: null,
	})),
	useWebDAVMkcol: vi.fn(() => ({
		mutate: mockMkdirMutate,
		isPending: false,
		isError: false,
		error: null,
	})),
	useWebDAVPut: vi.fn(() => ({
		mutate: mockPutMutate,
		isPending: false,
		isError: false,
		error: null,
	})),
	useWebDAVCopy: vi.fn(() => ({
		mutateAsync: vi.fn().mockResolvedValue({}),
	})),
}));

// Mock openContextMenu to capture actions
let capturedContextMenuProps: {
	x: number;
	y: number;
	actions: { label: string; value: string }[];
	onAction: (action: string) => void | Promise<void>;
} | null = null;

vi.mock("../utils/openContextMenu", () => ({
	openFileContextMenu: vi.fn((props) => {
		capturedContextMenuProps = props;
		return vi.fn(); // close function
	}),
}));

// Mock download
vi.mock("../api/webdav", () => ({
	downloadFile: vi.fn(),
}));

// Mock file pickers
vi.mock("../utils/files", async () => {
	const actual = await vi.importActual("../utils/files");
	return {
		...actual,
		openFilePicker: vi.fn().mockResolvedValue([]),
		openFolderPicker: vi.fn().mockResolvedValue([]),
	};
});

const makeFile = (overrides: Partial<FileItemProps> = {}): FileItemProps => ({
	id: "/files/document.txt",
	name: "document.txt",
	type: "Text",
	size: 1024,
	modified: new Date("2024-06-15"),
	icon: createElement("span", { "data-testid": "file-icon" }),
	selected: false,
	...overrides,
});

const makeFolder = (overrides: Partial<FileItemProps> = {}): FileItemProps => ({
	id: "/Photos",
	name: "Photos",
	type: "Folder",
	size: undefined,
	modified: new Date("2024-05-01"),
	icon: createElement("span", { "data-testid": "folder-icon" }),
	selected: false,
	...overrides,
});

const sampleFiles: FileItemProps[] = [
	makeFile({ id: "/files/a.txt", name: "a.txt" }),
	makeFile({ id: "/files/b.pdf", name: "b.pdf", type: "PDF" }),
	makeFolder({ id: "/Photos", name: "Photos" }),
];

describe("FileList", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		capturedContextMenuProps = null;
		useFileManagerStore.setState({ activePath: "/files" });
	});

	describe("rendering", () => {
		it("renders a table", () => {
			render(<FileList files={sampleFiles} />);
			expect(screen.getByRole("table")).toBeInTheDocument();
		});

		it("renders table header with Name column", () => {
			render(<FileList files={sampleFiles} />);
			expect(screen.getByText("Name")).toBeInTheDocument();
		});

		it("renders table header with Size column", () => {
			render(<FileList files={sampleFiles} />);
			expect(screen.getByText("Size")).toBeInTheDocument();
		});

		it("renders table header with Modified column", () => {
			render(<FileList files={sampleFiles} />);
			expect(screen.getByText("Modified")).toBeInTheDocument();
		});

		it("renders all files as rows", () => {
			render(<FileList files={sampleFiles} />);
			expect(screen.getByText("a.txt")).toBeInTheDocument();
			expect(screen.getByText("b.pdf")).toBeInTheDocument();
			expect(screen.getByText("Photos")).toBeInTheDocument();
		});

		it("renders empty state when files is empty", () => {
			render(<FileList files={[]} />);
			expect(screen.getByText("No files or folders found.")).toBeInTheDocument();
		});

		it("renders section with aria-label 'File list'", () => {
			render(<FileList files={[]} />);
			expect(screen.getByRole("region", { name: "File list" })).toBeInTheDocument();
		});
	});

	describe("sort headers", () => {
		it("Name header has aria-sort='ascending' by default", () => {
			render(<FileList files={sampleFiles} />);
			const nameHeader = screen.getByRole("columnheader", { name: /Name/ });
			expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
		});

		it("Size header has aria-sort='none' by default", () => {
			render(<FileList files={sampleFiles} />);
			const sizeHeader = screen.getByRole("columnheader", { name: /Size/ });
			expect(sizeHeader).toHaveAttribute("aria-sort", "none");
		});

		it("Modified header has aria-sort='none' by default", () => {
			render(<FileList files={sampleFiles} />);
			const modifiedHeader = screen.getByRole("columnheader", { name: /Modified/ });
			expect(modifiedHeader).toHaveAttribute("aria-sort", "none");
		});

		it("clicking Name header toggles sort direction", () => {
			render(<FileList files={sampleFiles} />);
			const nameHeader = screen.getByRole("columnheader", { name: /Name/ });
			fireEvent.click(nameHeader);
			expect(nameHeader).toHaveAttribute("aria-sort", "descending");
		});

		it("clicking Size header activates size sort", () => {
			render(<FileList files={sampleFiles} />);
			const sizeHeader = screen.getByRole("columnheader", { name: /Size/ });
			fireEvent.click(sizeHeader);
			expect(sizeHeader).toHaveAttribute("aria-sort", "ascending");
		});

		it("clicking Modified header activates modified sort", () => {
			render(<FileList files={sampleFiles} />);
			const modifiedHeader = screen.getByRole("columnheader", { name: /Modified/ });
			fireEvent.click(modifiedHeader);
			expect(modifiedHeader).toHaveAttribute("aria-sort", "ascending");
		});
	});

	describe("double-click folder navigation", () => {
		it("navigates to folder path on double-click", () => {
			render(<FileList files={[makeFolder({ id: "/Photos" })]} />);
			const row = screen.getByText("Photos").closest("tr")!;
			fireEvent.doubleClick(row);
			expect(mockNavigate).toHaveBeenCalledWith("/Photos");
		});

		it("does not navigate on double-click of a file", () => {
			render(<FileList files={[makeFile({ id: "/files/doc.txt", name: "doc.txt" })]} />);
			const row = screen.getByText("doc.txt").closest("tr")!;
			fireEvent.doubleClick(row);
			expect(mockNavigate).not.toHaveBeenCalled();
		});
	});

	describe("context menu on file", () => {
		it("opens context menu on right-click on a file", async () => {
			const { openFileContextMenu } = vi.mocked(await import("../utils/openContextMenu"));
			render(<FileList files={[makeFile({ id: "/files/doc.txt", name: "doc.txt" })]} />);
			const row = screen.getByText("doc.txt").closest("tr")!;
			fireEvent.contextMenu(row);
			expect(openFileContextMenu).toHaveBeenCalled();
		});

		it("file context menu includes Rename action", () => {
			render(<FileList files={[makeFile()]} />);
			const row = screen.getByText("document.txt").closest("tr")!;
			fireEvent.contextMenu(row);
			expect(capturedContextMenuProps?.actions.some((a) => a.value === "rename")).toBe(true);
		});

		it("file context menu includes Delete action", () => {
			render(<FileList files={[makeFile()]} />);
			const row = screen.getByText("document.txt").closest("tr")!;
			fireEvent.contextMenu(row);
			expect(capturedContextMenuProps?.actions.some((a) => a.value === "delete")).toBe(true);
		});

		it("file context menu includes Cut action", () => {
			render(<FileList files={[makeFile()]} />);
			const row = screen.getByText("document.txt").closest("tr")!;
			fireEvent.contextMenu(row);
			expect(capturedContextMenuProps?.actions.some((a) => a.value === "cut")).toBe(true);
		});

		it("file context menu includes Copy action", () => {
			render(<FileList files={[makeFile()]} />);
			const row = screen.getByText("document.txt").closest("tr")!;
			fireEvent.contextMenu(row);
			expect(capturedContextMenuProps?.actions.some((a) => a.value === "copy")).toBe(true);
		});

		it("file context menu includes Download action", () => {
			render(<FileList files={[makeFile()]} />);
			const row = screen.getByText("document.txt").closest("tr")!;
			fireEvent.contextMenu(row);
			expect(capturedContextMenuProps?.actions.some((a) => a.value === "download")).toBe(true);
		});

		it("triggers delete mutation when Delete action is selected", async () => {
			render(<FileList files={[makeFile({ id: "/files/doc.txt" })]} />);
			const row = screen.getByText("document.txt").closest("tr")!;
			fireEvent.contextMenu(row);
			await act(async () => {
				await capturedContextMenuProps?.onAction("delete");
			});
			expect(mockDeleteMutate).toHaveBeenCalledWith("/files/doc.txt");
		});

		it("triggers download when Download action is selected", async () => {
			const { downloadFile } = vi.mocked(await import("../api/webdav"));
			render(<FileList files={[makeFile({ id: "/files/doc.txt" })]} />);
			const row = screen.getByText("document.txt").closest("tr")!;
			fireEvent.contextMenu(row);
			await act(async () => {
				await capturedContextMenuProps?.onAction("download");
			});
			expect(downloadFile).toHaveBeenCalledWith("/files/doc.txt");
		});

		it("opens rename modal when Rename action is selected", async () => {
			render(<FileList files={[makeFile({ name: "doc.txt" })]} />);
			const row = screen.getByText("doc.txt").closest("tr")!;
			fireEvent.contextMenu(row);
			await act(async () => {
				await capturedContextMenuProps?.onAction("rename");
			});
			// InputModal should appear with Rename title
			expect(screen.getByRole("dialog")).toBeInTheDocument();
		});
	});

	describe("context menu on empty area", () => {
		it("opens context menu on right-click on empty area", () => {
			render(<FileList files={[]} />);
			const section = screen.getByRole("region", { name: "File list" });
			fireEvent.contextMenu(section);
			expect(capturedContextMenuProps).not.toBeNull();
		});

		it("empty area context menu includes New Folder", () => {
			render(<FileList files={[]} />);
			const section = screen.getByRole("region", { name: "File list" });
			fireEvent.contextMenu(section);
			expect(capturedContextMenuProps?.actions.some((a) => a.value === "new_folder")).toBe(true);
		});

		it("empty area context menu includes File Upload", () => {
			render(<FileList files={[]} />);
			const section = screen.getByRole("region", { name: "File list" });
			fireEvent.contextMenu(section);
			expect(capturedContextMenuProps?.actions.some((a) => a.value === "file_upload")).toBe(true);
		});

		it("empty area context menu includes Folder Upload", () => {
			render(<FileList files={[]} />);
			const section = screen.getByRole("region", { name: "File list" });
			fireEvent.contextMenu(section);
			expect(capturedContextMenuProps?.actions.some((a) => a.value === "folder_upload")).toBe(true);
		});

		it("empty area context menu includes Select All", () => {
			render(<FileList files={[]} />);
			const section = screen.getByRole("region", { name: "File list" });
			fireEvent.contextMenu(section);
			expect(capturedContextMenuProps?.actions.some((a) => a.value === "select_all")).toBe(true);
		});

		it("opens new folder modal when New Folder action selected", async () => {
			render(<FileList files={[]} />);
			const section = screen.getByRole("region", { name: "File list" });
			fireEvent.contextMenu(section);
			await act(async () => {
				await capturedContextMenuProps?.onAction("new_folder");
			});
			expect(screen.getByRole("dialog")).toBeInTheDocument();
			expect(screen.getByText("New Folder")).toBeInTheDocument();
		});
	});

	describe("new folder modal", () => {
		it("renders InputModal when new_folder modal is open", async () => {
			render(<FileList files={[]} />);
			const section = screen.getByRole("region", { name: "File list" });
			fireEvent.contextMenu(section);
			await act(async () => {
				await capturedContextMenuProps?.onAction("new_folder");
			});
			expect(screen.getByRole("dialog")).toBeInTheDocument();
		});

		it("closes modal when Cancel is clicked", async () => {
			render(<FileList files={[]} />);
			const section = screen.getByRole("region", { name: "File list" });
			fireEvent.contextMenu(section);
			await act(async () => {
				await capturedContextMenuProps?.onAction("new_folder");
			});
			expect(screen.getByRole("dialog")).toBeInTheDocument();
			fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
			expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		});

		it("submit button is disabled when input is empty", async () => {
			render(<FileList files={[]} />);
			const section = screen.getByRole("region", { name: "File list" });
			fireEvent.contextMenu(section);
			await act(async () => {
				await capturedContextMenuProps?.onAction("new_folder");
			});
			expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
		});

		it("submit button is enabled when folder name is typed", async () => {
			render(<FileList files={[]} />);
			const section = screen.getByRole("region", { name: "File list" });
			fireEvent.contextMenu(section);
			await act(async () => {
				await capturedContextMenuProps?.onAction("new_folder");
			});
			fireEvent.change(screen.getByRole("textbox"), { target: { value: "New Folder" } });
			expect(screen.getByRole("button", { name: "Create" })).not.toBeDisabled();
		});

		it("calls mkdirMutate when folder creation is submitted", async () => {
			render(<FileList files={[]} />);
			const section = screen.getByRole("region", { name: "File list" });
			fireEvent.contextMenu(section);
			await act(async () => {
				await capturedContextMenuProps?.onAction("new_folder");
			});
			fireEvent.change(screen.getByRole("textbox"), { target: { value: "MyFolder" } });
			fireEvent.click(screen.getByRole("button", { name: "Create" }));
			expect(mockMkdirMutate).toHaveBeenCalledWith(
				"/files/MyFolder",
				expect.objectContaining({ onSuccess: expect.any(Function) }),
			);
		});
	});

	describe("rename modal", () => {
		it("opens rename modal with file name pre-filled", async () => {
			render(<FileList files={[makeFile({ name: "original.txt" })]} />);
			const row = screen.getByText("original.txt").closest("tr")!;
			fireEvent.contextMenu(row);
			await act(async () => {
				await capturedContextMenuProps?.onAction("rename");
			});
			const input = screen.getByRole("textbox");
			expect(input).toHaveValue("original.txt");
		});

		it("calls move mutation when rename is submitted", async () => {
			render(<FileList files={[makeFile({ id: "/files/original.txt", name: "original.txt" })]} />);
			const row = screen.getByText("original.txt").closest("tr")!;
			fireEvent.contextMenu(row);
			await act(async () => {
				await capturedContextMenuProps?.onAction("rename");
			});
			fireEvent.change(screen.getByRole("textbox"), { target: { value: "renamed.txt" } });
			fireEvent.click(screen.getByRole("button", { name: "Rename" }));
			expect(mockMoveMutate).toHaveBeenCalledWith(
				expect.objectContaining({
					fromPath: "/files/original.txt",
					toPath: "/files/renamed.txt",
					overwrite: true,
				}),
				expect.any(Object),
			);
		});
	});

	describe("file selection highlight", () => {
		it("selected file row has selection class", () => {
			render(<FileList files={[makeFile({ id: "/f.txt", name: "f.txt" })]} />);
			const row = screen.getByText("f.txt").closest("tr")!;
			fireEvent.click(row);
			expect(row.className).toContain(fileSelectedClass);
		});

		it("unselected file row does not have selected class", () => {
			render(<FileList files={[makeFile({ id: "/f.txt", name: "f.txt" })]} />);
			const row = screen.getByText("f.txt").closest("tr")!;
			expect(row.className).not.toContain(fileSelectedClass);
		});
	});
});
