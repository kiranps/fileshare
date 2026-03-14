import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FileActionsProvider, useFileActionsContext } from "../contexts/FileActionsContext";
import { useFileManagerStore } from "../store/useFileManagerStore";
import { render } from "../test/test-utils";
import { ActionBar } from "./ActionBar";

// FileActionsProvider uses these hooks internally — mock them so tests stay isolated.
vi.mock("../hooks/useWebDAVPropfind", () => ({
	useWebDAVMkcol: vi.fn(() => ({ mutate: vi.fn(), isPending: false, isError: false, error: null })),
	useWebDAVMove: vi.fn(() => ({
		mutate: vi.fn(),
		mutateAsync: vi.fn().mockResolvedValue({}),
		isPending: false,
		isError: false,
		error: null,
	})),
	useWebDAVDelete: vi.fn(() => ({ mutate: vi.fn(), isPending: false, isError: false, error: null })),
	useWebDAVPut: vi.fn(() => ({ mutate: vi.fn(), isPending: false, isError: false, error: null })),
	useWebDAVCopy: vi.fn(() => ({ mutateAsync: vi.fn().mockResolvedValue({}) })),
}));

// Mock file pickers used by uploadFile / uploadFolder actions
vi.mock("../utils/files", async () => {
	const actual = await vi.importActual("../utils/files");
	return {
		...actual,
		openFilePicker: vi.fn().mockResolvedValue([]),
		openFolderPicker: vi.fn().mockResolvedValue([]),
	};
});

/**
 * Small test-only consumer that renders a dialog when the new-folder modal is open.
 * This lets ActionBar tests assert modal state without needing to render FileList.
 */
function ModalStateIndicator() {
	const { isModalOpen, modalType } = useFileActionsContext();
	if (!isModalOpen) return null;
	return (
		<div role="dialog" aria-label={modalType ?? "modal"}>
			{modalType === "new_folder" ? "New Folder" : "Rename"}
		</div>
	);
}

/** Render ActionBar wrapped in the required providers, with a modal state indicator. */
function renderActionBar() {
	return render(
		<FileActionsProvider>
			<ActionBar />
			<ModalStateIndicator />
		</FileActionsProvider>,
	);
}

describe("ActionBar", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset store to known state
		useFileManagerStore.setState({ activePath: "/files", selectedIds: [] });
	});

	describe("rendering", () => {
		it("renders a toolbar landmark", () => {
			renderActionBar();
			expect(screen.getByRole("toolbar", { name: "File actions" })).toBeInTheDocument();
		});

		it("renders the New button", () => {
			renderActionBar();
			expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
		});

		it("renders the New Folder dropdown item", () => {
			renderActionBar();
			expect(screen.getByRole("button", { name: /New Folder/ })).toBeInTheDocument();
		});

		it("renders the Upload File dropdown item", () => {
			renderActionBar();
			expect(screen.getByRole("button", { name: /Upload File/ })).toBeInTheDocument();
		});

		it("renders the Upload Folder dropdown item", () => {
			renderActionBar();
			expect(screen.getByRole("button", { name: /Upload Folder/ })).toBeInTheDocument();
		});
	});

	describe("selection count badge", () => {
		it("does not render a selection badge when no items are selected", () => {
			useFileManagerStore.setState({ selectedIds: [] });
			renderActionBar();
			expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
		});

		it("renders '1 selected' when one item is selected", () => {
			useFileManagerStore.setState({ selectedIds: ["/files/a.txt"] });
			renderActionBar();
			expect(screen.getByText("1 selected")).toBeInTheDocument();
		});

		it("renders the correct count when multiple items are selected", () => {
			useFileManagerStore.setState({ selectedIds: ["/a", "/b", "/c", "/d", "/e"] });
			renderActionBar();
			expect(screen.getByText("5 selected")).toBeInTheDocument();
		});
	});

	describe("New Folder button", () => {
		it("clicking New Folder opens the new folder modal", () => {
			renderActionBar();
			fireEvent.click(screen.getByRole("button", { name: /New Folder/ }));
			expect(screen.getByRole("dialog")).toBeInTheDocument();
		});

		it("New Folder modal has the correct title", () => {
			renderActionBar();
			fireEvent.click(screen.getByRole("button", { name: /New Folder/ }));
			expect(within(screen.getByRole("dialog")).getByText("New Folder")).toBeInTheDocument();
		});
	});

	describe("Upload File button", () => {
		it("calls openFilePicker when Upload File is clicked", async () => {
			const { openFilePicker } = vi.mocked(await import("../utils/files"));
			renderActionBar();
			fireEvent.click(screen.getByRole("button", { name: /Upload File/ }));
			expect(openFilePicker).toHaveBeenCalledTimes(1);
		});
	});

	describe("Upload Folder button", () => {
		it("calls openFolderPicker when Upload Folder is clicked", async () => {
			const { openFolderPicker } = vi.mocked(await import("../utils/files"));
			renderActionBar();
			fireEvent.click(screen.getByRole("button", { name: /Upload Folder/ }));
			expect(openFolderPicker).toHaveBeenCalledTimes(1);
		});
	});
});

describe("ActionBar", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset store to known state
		useFileManagerStore.setState({ activePath: "/files", selectedIds: [] });
	});

	describe("rendering", () => {
		it("renders a toolbar landmark", () => {
			renderActionBar();
			expect(screen.getByRole("toolbar", { name: "File actions" })).toBeInTheDocument();
		});

		it("renders the New button", () => {
			renderActionBar();
			expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
		});

		it("renders the New Folder dropdown item", () => {
			renderActionBar();
			expect(screen.getByRole("button", { name: /New Folder/ })).toBeInTheDocument();
		});

		it("renders the Upload File dropdown item", () => {
			renderActionBar();
			expect(screen.getByRole("button", { name: /Upload File/ })).toBeInTheDocument();
		});

		it("renders the Upload Folder dropdown item", () => {
			renderActionBar();
			expect(screen.getByRole("button", { name: /Upload Folder/ })).toBeInTheDocument();
		});
	});

	describe("selection count badge", () => {
		it("does not render a selection badge when no items are selected", () => {
			useFileManagerStore.setState({ selectedIds: [] });
			renderActionBar();
			expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
		});

		it("renders '1 selected' when one item is selected", () => {
			useFileManagerStore.setState({ selectedIds: ["/files/a.txt"] });
			renderActionBar();
			expect(screen.getByText("1 selected")).toBeInTheDocument();
		});

		it("renders the correct count when multiple items are selected", () => {
			useFileManagerStore.setState({ selectedIds: ["/a", "/b", "/c", "/d", "/e"] });
			renderActionBar();
			expect(screen.getByText("5 selected")).toBeInTheDocument();
		});
	});

	describe("New Folder button", () => {
		it("clicking New Folder opens the new folder modal", () => {
			renderActionBar();
			fireEvent.click(screen.getByRole("button", { name: /New Folder/ }));
			expect(screen.getByRole("dialog")).toBeInTheDocument();
		});

		it("New Folder modal has the correct title", () => {
			renderActionBar();
			fireEvent.click(screen.getByRole("button", { name: /New Folder/ }));
			expect(within(screen.getByRole("dialog")).getByText("New Folder")).toBeInTheDocument();
		});
	});

	describe("Upload File button", () => {
		it("calls openFilePicker when Upload File is clicked", async () => {
			const { openFilePicker } = vi.mocked(await import("../utils/files"));
			renderActionBar();
			fireEvent.click(screen.getByRole("button", { name: /Upload File/ }));
			expect(openFilePicker).toHaveBeenCalledTimes(1);
		});
	});

	describe("Upload Folder button", () => {
		it("calls openFolderPicker when Upload Folder is clicked", async () => {
			const { openFolderPicker } = vi.mocked(await import("../utils/files"));
			renderActionBar();
			fireEvent.click(screen.getByRole("button", { name: /Upload Folder/ }));
			expect(openFolderPicker).toHaveBeenCalledTimes(1);
		});
	});
});
