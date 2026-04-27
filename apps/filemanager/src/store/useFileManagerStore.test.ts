import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { FileItemProps } from "../types";
import { useFileManagerStore } from "./useFileManagerStore";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeFile = (overrides: Partial<FileItemProps> = {}): FileItemProps => ({
	id: "/files/doc.txt",
	name: "doc.txt",
	type: "text",
	size: 1024,
	modified: new Date("2024-06-15"),
	...overrides,
});

const makeFolder = (overrides: Partial<FileItemProps> = {}): FileItemProps => ({
	id: "/Photos",
	name: "Photos",
	type: "folder",
	size: undefined,
	modified: new Date("2024-05-01"),
	...overrides,
});

const sampleFiles: FileItemProps[] = [
	makeFile({ id: "/files/zebra.txt", name: "zebra.txt", size: 100, modified: new Date("2024-01-15") }),
	makeFile({ id: "/files/alpha.txt", name: "alpha.txt", size: 500, modified: new Date("2024-01-20") }),
	makeFolder({ id: "/Beta", name: "Beta", modified: new Date("2024-01-18") }),
	makeFile({ id: "/files/gamma.txt", name: "gamma.txt", size: 200, modified: new Date("2024-01-10") }),
	makeFolder({ id: "/Delta", name: "Delta", modified: new Date("2024-01-12") }),
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useFileManagerStore", () => {
	beforeEach(() => {
		useFileManagerStore.setState({
			activePath: "/",
			files: [],
			sortedFiles: [],
			sortColumn: "name",
			sortDirection: "asc",
			selectedIds: [],
			clipboard: [],
			activeAction: null,
			hasPending: false,
		});
	});

	// -------------------------------------------------------------------------
	// Path slice
	// -------------------------------------------------------------------------
	describe("activePath", () => {
		it("has a non-empty activePath on init", () => {
			expect(useFileManagerStore.getState().activePath).toBeTruthy();
		});

		it("activePath is a string", () => {
			expect(typeof useFileManagerStore.getState().activePath).toBe("string");
		});

		it("has setActivePath function", () => {
			expect(typeof useFileManagerStore.getState().setActivePath).toBe("function");
		});

		it("updates activePath to the given value", () => {
			act(() => {
				useFileManagerStore.getState().setActivePath("/Documents");
			});
			expect(useFileManagerStore.getState().activePath).toBe("/Documents");
		});

		it("updates activePath to root '/'", () => {
			act(() => {
				useFileManagerStore.getState().setActivePath("/some/path");
				useFileManagerStore.getState().setActivePath("/");
			});
			expect(useFileManagerStore.getState().activePath).toBe("/");
		});

		it("replaces previous activePath", () => {
			act(() => {
				useFileManagerStore.getState().setActivePath("/first");
				useFileManagerStore.getState().setActivePath("/second");
			});
			expect(useFileManagerStore.getState().activePath).toBe("/second");
		});

		it("allows direct state reset via setState", () => {
			useFileManagerStore.setState({ activePath: "/custom-path" });
			expect(useFileManagerStore.getState().activePath).toBe("/custom-path");
		});
	});

	// -------------------------------------------------------------------------
	// Files / Sort slice
	// -------------------------------------------------------------------------
	describe("files + sort", () => {
		it("setFiles stores the raw files", () => {
			act(() => {
				useFileManagerStore.getState().setFiles(sampleFiles);
			});
			expect(useFileManagerStore.getState().files).toHaveLength(5);
		});

		it("setFiles updates sortedFiles immediately (folders first, asc by name)", () => {
			act(() => {
				useFileManagerStore.getState().setFiles(sampleFiles);
			});
			const names = useFileManagerStore.getState().sortedFiles.map((f) => f.name);
			// Folders first (alphabetical), then files (alphabetical)
			expect(names).toEqual(["Beta", "Delta", "alpha.txt", "gamma.txt", "zebra.txt"]);
		});

		it("sortedFiles is empty initially", () => {
			expect(useFileManagerStore.getState().sortedFiles).toEqual([]);
		});

		it("handleSort toggles direction on same column", () => {
			act(() => {
				useFileManagerStore.getState().setFiles(sampleFiles);
				useFileManagerStore.getState().handleSort("name");
			});
			expect(useFileManagerStore.getState().sortDirection).toBe("desc");
		});

		it("handleSort re-sorts sortedFiles after toggle", () => {
			act(() => {
				useFileManagerStore.getState().setFiles(sampleFiles);
				useFileManagerStore.getState().handleSort("name"); // now desc
			});
			const names = useFileManagerStore.getState().sortedFiles.map((f) => f.name);
			expect(names).toEqual(["Delta", "Beta", "zebra.txt", "gamma.txt", "alpha.txt"]);
		});

		it("handleSort changes column and resets to asc", () => {
			act(() => {
				useFileManagerStore.getState().setFiles(sampleFiles);
				useFileManagerStore.getState().handleSort("name"); // desc
				useFileManagerStore.getState().handleSort("size"); // new col → asc
			});
			expect(useFileManagerStore.getState().sortColumn).toBe("size");
			expect(useFileManagerStore.getState().sortDirection).toBe("asc");
		});

		it("handleSort by size sorts files correctly (folders first)", () => {
			act(() => {
				useFileManagerStore.getState().setFiles(sampleFiles);
				useFileManagerStore.getState().handleSort("size");
			});
			const sizes = useFileManagerStore.getState().sortedFiles.map((f) => f.size);
			expect(sizes).toEqual([undefined, undefined, 100, 200, 500]);
		});

		it("handleSort by modified sorts files correctly", () => {
			act(() => {
				useFileManagerStore.getState().setFiles(sampleFiles);
				useFileManagerStore.getState().handleSort("modified");
			});
			const dates = useFileManagerStore
				.getState()
				.sortedFiles.map((f) =>
					f.modified instanceof Date ? f.modified.toISOString() : new Date(f.modified).toISOString(),
				);
			// Folders first by date asc, then files by date asc
			expect(dates[0]).toBe(new Date("2024-01-12").toISOString()); // Delta
			expect(dates[1]).toBe(new Date("2024-01-18").toISOString()); // Beta
		});

		it("re-sorting after setFiles picks up new files", () => {
			act(() => {
				useFileManagerStore.getState().setFiles([makeFile({ id: "/z.txt", name: "z.txt" })]);
				useFileManagerStore
					.getState()
					.setFiles([makeFile({ id: "/z.txt", name: "z.txt" }), makeFile({ id: "/a.txt", name: "a.txt" })]);
			});
			const names = useFileManagerStore.getState().sortedFiles.map((f) => f.name);
			expect(names).toEqual(["a.txt", "z.txt"]);
		});

		it("does not mutate the original files array", () => {
			const original = [...sampleFiles];
			act(() => {
				useFileManagerStore.getState().setFiles(sampleFiles);
				useFileManagerStore.getState().handleSort("name");
			});
			expect(sampleFiles.map((f) => f.id)).toEqual(original.map((f) => f.id));
		});
	});

	// -------------------------------------------------------------------------
	// Selection slice
	// -------------------------------------------------------------------------
	describe("selection", () => {
		beforeEach(() => {
			act(() => {
				useFileManagerStore.getState().setFiles(sampleFiles);
			});
		});

		it("selectedIds is empty initially", () => {
			expect(useFileManagerStore.getState().selectedIds).toEqual([]);
		});

		it("plain click selects one file", () => {
			const file = sampleFiles[0];
			act(() => {
				useFileManagerStore.getState().handleItemClick({ stopPropagation: () => {} } as React.MouseEvent, file);
			});
			expect(useFileManagerStore.getState().selectedIds).toEqual([file.id]);
		});

		it("plain click on already-selected sole item deselects it", () => {
			const file = sampleFiles[0];
			act(() => {
				useFileManagerStore.getState().handleItemClick({ stopPropagation: () => {} } as React.MouseEvent, file);
			});
			act(() => {
				useFileManagerStore.getState().handleItemClick({ stopPropagation: () => {} } as React.MouseEvent, file);
			});
			expect(useFileManagerStore.getState().selectedIds).toEqual([]);
		});

		it("ctrl+click toggles items on/off", () => {
			const [f1, f2] = sampleFiles;
			act(() => {
				useFileManagerStore
					.getState()
					.handleItemClick({ stopPropagation: () => {}, ctrlKey: true } as React.MouseEvent, f1);
				useFileManagerStore
					.getState()
					.handleItemClick({ stopPropagation: () => {}, ctrlKey: true } as React.MouseEvent, f2);
			});
			expect(useFileManagerStore.getState().selectedIds).toEqual([f1.id, f2.id]);

			act(() => {
				useFileManagerStore
					.getState()
					.handleItemClick({ stopPropagation: () => {}, ctrlKey: true } as React.MouseEvent, f1);
			});
			expect(useFileManagerStore.getState().selectedIds).toEqual([f2.id]);
		});

		it("shift+click selects a range", () => {
			// sortedFiles for sampleFiles (name asc) = [Beta, Delta, alpha.txt, gamma.txt, zebra.txt]
			const sorted = useFileManagerStore.getState().sortedFiles;
			act(() => {
				useFileManagerStore.getState().handleItemClick({ stopPropagation: () => {} } as React.MouseEvent, sorted[0]);
			});
			act(() => {
				useFileManagerStore
					.getState()
					.handleItemClick({ stopPropagation: () => {}, shiftKey: true } as React.MouseEvent, sorted[2]);
			});
			expect(useFileManagerStore.getState().selectedIds).toEqual([sorted[0].id, sorted[1].id, sorted[2].id]);
		});

		it("clearSelection empties selectedIds", () => {
			const file = sampleFiles[0];
			act(() => {
				useFileManagerStore.getState().handleItemClick({ stopPropagation: () => {} } as React.MouseEvent, file);
				useFileManagerStore.getState().clearSelection();
			});
			expect(useFileManagerStore.getState().selectedIds).toEqual([]);
		});

		it("selectAll selects every file in sortedFiles", () => {
			act(() => {
				useFileManagerStore.getState().selectAll();
			});
			const allIds = useFileManagerStore.getState().sortedFiles.map((f) => f.id);
			expect(useFileManagerStore.getState().selectedIds).toEqual(allIds);
		});

		it("selectAll on empty list results in empty selectedIds", () => {
			act(() => {
				useFileManagerStore.getState().setFiles([]);
				useFileManagerStore.getState().selectAll();
			});
			expect(useFileManagerStore.getState().selectedIds).toEqual([]);
		});
	});

	// -------------------------------------------------------------------------
	// Clipboard slice
	// -------------------------------------------------------------------------
	describe("clipboard", () => {
		it("clipboard and activeAction are null/empty initially", () => {
			const state = useFileManagerStore.getState();
			expect(state.clipboard).toEqual([]);
			expect(state.activeAction).toBeNull();
			expect(state.hasPending).toBe(false);
		});

		it("cut sets clipboard and activeaction='cut'", () => {
			useFileManagerStore.setState({
				selectedIds: ["/file1.txt", "/file2.txt"],
			});
			act(() => {
				useFileManagerStore.getState().cut();
			});
			const state = useFileManagerStore.getState();
			expect(state.clipboard).toEqual(["/file1.txt", "/file2.txt"]);
			expect(state.activeAction).toBe("cut");
			expect(state.hasPending).toBe(true);
		});

		it("copy sets clipboard and activeAction='copy'", () => {
			useFileManagerStore.setState({
				selectedIds: ["/file1.txt"],
			});
			act(() => {
				useFileManagerStore.getState().copy();
			});
			const state = useFileManagerStore.getState();
			expect(state.clipboard).toEqual(["/file1.txt"]);
			expect(state.activeAction).toBe("copy");
			expect(state.hasPending).toBe(true);
		});

		it("cut with empty selectedId sets hasPending=false", () => {
			act(() => {
				useFileManagerStore.getState().cut();
			});
			expect(useFileManagerStore.getState().hasPending).toBe(false);
		});

		it("clearClipboard resets clipboard state", () => {
			useFileManagerStore.setState({
				selectedIds: ["/file1.txt"],
			});
			act(() => {
				useFileManagerStore.getState().cut();
				useFileManagerStore.getState().clearClipboard();
			});
			const state = useFileManagerStore.getState();
			expect(state.clipboard).toEqual([]);
			expect(state.activeAction).toBeNull();
			expect(state.hasPending).toBe(false);
		});

		it("calling copy after cut replaces clipboard", () => {
			useFileManagerStore.setState({
				selectedIds: ["/old.txt"],
			});
			act(() => {
				useFileManagerStore.getState().cut();
			});
			useFileManagerStore.setState({
				selectedIds: ["/new.txt"],
			});
			act(() => {
				useFileManagerStore.getState().copy();
			});
			const state = useFileManagerStore.getState();
			expect(state.clipboard).toEqual(["/new.txt"]);
			expect(state.activeAction).toBe("copy");
		});
	});
});
