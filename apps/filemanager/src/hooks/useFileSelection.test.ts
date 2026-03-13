import { act, renderHook } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FileItemProps } from "../types";
import { useFileSelection } from "./useFileSelection";

const createMockFile = (id: string, name: string): FileItemProps => ({
	id,
	name,
	type: "File",
	size: "1.0 KB",
	modified: new Date("2024-01-15"),
	icon: createElement("div"),
	selected: false,
});

const mockFiles: FileItemProps[] = [
	createMockFile("/file1", "file1.txt"),
	createMockFile("/file2", "file2.txt"),
	createMockFile("/file3", "file3.txt"),
	createMockFile("/file4", "file4.txt"),
	createMockFile("/file5", "file5.txt"),
];

describe("useFileSelection", () => {
	beforeEach(() => {
		// Clean up any existing event listeners
		document.removeEventListener("click", () => {});
	});

	it("should initialize with empty selection", () => {
		const { result } = renderHook(() => useFileSelection(mockFiles));
		expect(result.current.selectedIds).toEqual([]);
	});

	it("should select a single file on plain click", () => {
		const { result } = renderHook(() => useFileSelection(mockFiles));

		act(() => {
			const event = { stopPropagation: () => {} } as React.MouseEvent;
			result.current.handleItemClick(event, mockFiles[0]);
		});

		expect(result.current.selectedIds).toEqual(["/file1"]);
	});

	it("should deselect file when clicking it again (single selected item)", () => {
		const { result } = renderHook(() => useFileSelection(mockFiles));

		// First click - select
		act(() => {
			const event = { stopPropagation: () => {} } as React.MouseEvent;
			result.current.handleItemClick(event, mockFiles[0]);
		});
		expect(result.current.selectedIds).toEqual(["/file1"]);

		// Second click - deselect
		act(() => {
			const event = { stopPropagation: () => {} } as React.MouseEvent;
			result.current.handleItemClick(event, mockFiles[0]);
		});
		expect(result.current.selectedIds).toEqual([]);
	});

	it("should replace selection when clicking another file", () => {
		const { result } = renderHook(() => useFileSelection(mockFiles));

		act(() => {
			const event = { stopPropagation: () => {} } as React.MouseEvent;
			result.current.handleItemClick(event, mockFiles[0]);
		});
		expect(result.current.selectedIds).toEqual(["/file1"]);

		act(() => {
			const event = { stopPropagation: () => {} } as React.MouseEvent;
			result.current.handleItemClick(event, mockFiles[1]);
		});
		expect(result.current.selectedIds).toEqual(["/file2"]);
	});

	it("should toggle selection on Ctrl+click", () => {
		const { result } = renderHook(() => useFileSelection(mockFiles));

		// Select first file
		act(() => {
			const event = { stopPropagation: () => {}, ctrlKey: true } as React.MouseEvent;
			result.current.handleItemClick(event, mockFiles[0]);
		});
		expect(result.current.selectedIds).toEqual(["/file1"]);

		// Add second file with Ctrl+click
		act(() => {
			const event = { stopPropagation: () => {}, ctrlKey: true } as React.MouseEvent;
			result.current.handleItemClick(event, mockFiles[1]);
		});
		expect(result.current.selectedIds).toEqual(["/file1", "/file2"]);

		// Deselect first file with Ctrl+click
		act(() => {
			const event = { stopPropagation: () => {}, ctrlKey: true } as React.MouseEvent;
			result.current.handleItemClick(event, mockFiles[0]);
		});
		expect(result.current.selectedIds).toEqual(["/file2"]);
	});

	it("should select range on Shift+click", () => {
		const { result } = renderHook(() => useFileSelection(mockFiles));

		// Select first file
		act(() => {
			const event = { stopPropagation: () => {} } as React.MouseEvent;
			result.current.handleItemClick(event, mockFiles[0]);
		});

		// Shift+click on fourth file
		act(() => {
			const event = { stopPropagation: () => {}, shiftKey: true } as React.MouseEvent;
			result.current.handleItemClick(event, mockFiles[3]);
		});

		expect(result.current.selectedIds).toEqual(["/file1", "/file2", "/file3", "/file4"]);
	});

	it("should handle Shift+click in reverse order", () => {
		const { result } = renderHook(() => useFileSelection(mockFiles));

		// Select fourth file
		act(() => {
			const event = { stopPropagation: () => {} } as React.MouseEvent;
			result.current.handleItemClick(event, mockFiles[3]);
		});

		// Shift+click on first file
		act(() => {
			const event = { stopPropagation: () => {}, shiftKey: true } as React.MouseEvent;
			result.current.handleItemClick(event, mockFiles[0]);
		});

		expect(result.current.selectedIds).toEqual(["/file1", "/file2", "/file3", "/file4"]);
	});

	it("should handle Shift+click without prior selection", () => {
		const { result } = renderHook(() => useFileSelection(mockFiles));

		// Shift+click on third file without prior selection
		act(() => {
			const event = { stopPropagation: () => {}, shiftKey: true } as React.MouseEvent;
			result.current.handleItemClick(event, mockFiles[2]);
		});

		// Should select only the clicked item
		expect(result.current.selectedIds).toEqual(["/file3"]);
	});

	it("should use first selected item as anchor for Shift+click when lastClicked is null", () => {
		const { result } = renderHook(() => useFileSelection(mockFiles));

		// Ctrl+click to select multiple items
		act(() => {
			const event = { stopPropagation: () => {}, ctrlKey: true } as React.MouseEvent;
			result.current.handleItemClick(event, mockFiles[1]);
		});
		act(() => {
			const event = { stopPropagation: () => {}, ctrlKey: true } as React.MouseEvent;
			result.current.handleItemClick(event, mockFiles[3]);
		});

		// Clear last clicked by manually clearing
		act(() => {
			result.current.clearSelection();
		});

		// Re-select manually
		act(() => {
			const event = { stopPropagation: () => {} } as React.MouseEvent;
			result.current.handleItemClick(event, mockFiles[1]);
		});

		// Now shift+click should use file1 (index 1) as anchor
		act(() => {
			const event = { stopPropagation: () => {}, shiftKey: true } as React.MouseEvent;
			result.current.handleItemClick(event, mockFiles[4]);
		});

		expect(result.current.selectedIds).toEqual(["/file2", "/file3", "/file4", "/file5"]);
	});

	it("should clear selection with clearSelection function", () => {
		const { result } = renderHook(() => useFileSelection(mockFiles));

		act(() => {
			const event = { stopPropagation: () => {}, ctrlKey: true } as React.MouseEvent;
			result.current.handleItemClick(event, mockFiles[0]);
			result.current.handleItemClick(event, mockFiles[1]);
			result.current.handleItemClick(event, mockFiles[2]);
		});

		expect(result.current.selectedIds).toHaveLength(3);

		act(() => {
			result.current.clearSelection();
		});

		expect(result.current.selectedIds).toEqual([]);
	});

	it("should select all files with selectAll function", () => {
		const { result } = renderHook(() => useFileSelection(mockFiles));

		act(() => {
			result.current.selectAll();
		});

		expect(result.current.selectedIds).toEqual(["/file1", "/file2", "/file3", "/file4", "/file5"]);
	});

	it("should clear selection on document click", () => {
		const { result } = renderHook(() => useFileSelection(mockFiles));

		act(() => {
			const event = { stopPropagation: () => {} } as React.MouseEvent;
			result.current.handleItemClick(event, mockFiles[0]);
		});

		expect(result.current.selectedIds).toEqual(["/file1"]);

		// Simulate document click
		act(() => {
			document.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		});

		expect(result.current.selectedIds).toEqual([]);
	});

	it("should stop propagation on item click", () => {
		const { result } = renderHook(() => useFileSelection(mockFiles));
		const stopPropagationSpy = vi.fn();

		act(() => {
			const event = { stopPropagation: stopPropagationSpy } as unknown as React.MouseEvent;
			result.current.handleItemClick(event, mockFiles[0]);
		});

		expect(stopPropagationSpy).toHaveBeenCalled();
	});

	it("should handle empty file list", () => {
		const { result } = renderHook(() => useFileSelection([]));

		expect(result.current.selectedIds).toEqual([]);

		act(() => {
			result.current.selectAll();
		});

		expect(result.current.selectedIds).toEqual([]);
	});

	it("should handle single file list", () => {
		const singleFile = [createMockFile("/file1", "file1.txt")];
		const { result } = renderHook(() => useFileSelection(singleFile));

		act(() => {
			const event = { stopPropagation: () => {} } as React.MouseEvent;
			result.current.handleItemClick(event, singleFile[0]);
		});

		expect(result.current.selectedIds).toEqual(["/file1"]);
	});

	it("should handle selecting adjacent items with Shift+click", () => {
		const { result } = renderHook(() => useFileSelection(mockFiles));

		act(() => {
			const event = { stopPropagation: () => {} } as React.MouseEvent;
			result.current.handleItemClick(event, mockFiles[2]);
		});

		act(() => {
			const event = { stopPropagation: () => {}, shiftKey: true } as React.MouseEvent;
			result.current.handleItemClick(event, mockFiles[3]);
		});

		expect(result.current.selectedIds).toEqual(["/file3", "/file4"]);
	});

	it("should handle Ctrl+click to build non-contiguous selection", () => {
		const { result } = renderHook(() => useFileSelection(mockFiles));

		act(() => {
			const event = { stopPropagation: () => {}, ctrlKey: true } as React.MouseEvent;
			result.current.handleItemClick(event, mockFiles[0]);
			result.current.handleItemClick(event, mockFiles[2]);
			result.current.handleItemClick(event, mockFiles[4]);
		});

		expect(result.current.selectedIds).toEqual(["/file1", "/file3", "/file5"]);
	});

	it("should maintain last clicked index for subsequent Shift operations", () => {
		const { result } = renderHook(() => useFileSelection(mockFiles));

		// Click file 1
		act(() => {
			const event = { stopPropagation: () => {} } as React.MouseEvent;
			result.current.handleItemClick(event, mockFiles[1]);
		});

		// Shift+click file 3
		act(() => {
			const event = { stopPropagation: () => {}, shiftKey: true } as React.MouseEvent;
			result.current.handleItemClick(event, mockFiles[3]);
		});

		expect(result.current.selectedIds).toEqual(["/file2", "/file3", "/file4"]);

		// Another Shift+click from the last clicked position
		act(() => {
			const event = { stopPropagation: () => {}, shiftKey: true } as React.MouseEvent;
			result.current.handleItemClick(event, mockFiles[0]);
		});

		// Should select from file 3 (last clicked) to file 0
		expect(result.current.selectedIds).toEqual(["/file1", "/file2", "/file3", "/file4"]);
	});

	it("should cleanup event listener on unmount", () => {
		const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");
		const { unmount } = renderHook(() => useFileSelection(mockFiles));

		unmount();

		expect(removeEventListenerSpy).toHaveBeenCalledWith("click", expect.any(Function));

		removeEventListenerSpy.mockRestore();
	});
});
