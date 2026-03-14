import { create } from "zustand";
import type { FileItemProps } from "../types";

export type SortColumn = "name" | "size" | "modified";
export type SortDirection = "asc" | "desc";
export type ClipboardAction = "cut" | "copy";

// ---------------------------------------------------------------------------
// Helpers (pure, no hooks — safe to call inside the store)
// ---------------------------------------------------------------------------

function computeSortedFiles(files: FileItemProps[], col: SortColumn, dir: SortDirection): FileItemProps[] {
	const folders = files.filter((f) => f.type === "Folder");
	const regularFiles = files.filter((f) => f.type !== "Folder");

	const multiplier = dir === "asc" ? 1 : -1;

	const comparator = (a: FileItemProps, b: FileItemProps): number => {
		if (col === "name") {
			return multiplier * a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
		}
		if (col === "size") {
			const aSize = typeof a.size === "number" ? a.size : 0;
			const bSize = typeof b.size === "number" ? b.size : 0;
			if (aSize === bSize) return 0;
			return multiplier * (aSize < bSize ? -1 : 1);
		}
		// modified
		const aTime = a.modified instanceof Date ? a.modified.getTime() : new Date(a.modified).getTime();
		const bTime = b.modified instanceof Date ? b.modified.getTime() : new Date(b.modified).getTime();
		if (aTime === bTime) return 0;
		return multiplier * (aTime < bTime ? -1 : 1);
	};

	return [...folders.sort(comparator), ...regularFiles.sort(comparator)];
}

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------

export interface FileManagerState {
	// --- Path ---
	activePath: string;
	setActivePath: (path: string) => void;

	// --- Files (raw list set by FileManager after fetch) ---
	files: FileItemProps[];
	setFiles: (files: FileItemProps[]) => void;

	// --- Sort ---
	sortColumn: SortColumn;
	sortDirection: SortDirection;
	handleSort: (column: SortColumn) => void;
	/** Derived: files sorted by sortColumn / sortDirection. Always up-to-date. */
	sortedFiles: FileItemProps[];

	// --- Selection ---
	selectedIds: string[];
	handleItemClick: (e: React.MouseEvent, file: FileItemProps) => void;
	clearSelection: () => void;
	selectAll: () => void;

	// --- Clipboard ---
	clipboard: string[];
	activeAction: ClipboardAction | null;
	hasPending: boolean;
	cut: (paths: string[]) => void;
	copy: (paths: string[]) => void;
	clearClipboard: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useFileManagerStore = create<FileManagerState>((set, get) => ({
	// --- Path ---
	activePath: typeof window !== "undefined" ? window.location.pathname : "/",
	setActivePath: (path) => set({ activePath: path }),

	// --- Files ---
	files: [],
	setFiles: (files) => {
		const { sortColumn, sortDirection } = get();
		set({ files, sortedFiles: computeSortedFiles(files, sortColumn, sortDirection) });
	},

	// --- Sort ---
	sortColumn: "name",
	sortDirection: "asc",
	sortedFiles: [],
	handleSort: (column) => {
		const { sortColumn, sortDirection, files } = get();
		const newDirection: SortDirection = sortColumn === column ? (sortDirection === "asc" ? "desc" : "asc") : "asc";
		const newColumn: SortColumn = column;
		set({
			sortColumn: newColumn,
			sortDirection: newDirection,
			sortedFiles: computeSortedFiles(files, newColumn, newDirection),
		});
	},

	// --- Selection ---
	selectedIds: [],

	handleItemClick: (e, file) => {
		e.stopPropagation();
		const { selectedIds, sortedFiles } = get();
		const index = sortedFiles.findIndex((f) => f.id === file.id);

		// We need per-interaction ephemeral state (lastClickedIndex, selectionAnchor).
		// These are stored inside the Zustand state but are only meaningful transiently.
		const state = get() as FileManagerState & {
			_lastClickedIndex: number | null;
			_selectionAnchor: number | null;
		};
		const lastClickedIndex = state._lastClickedIndex ?? null;
		const selectionAnchor = state._selectionAnchor ?? null;

		if (e.shiftKey) {
			let anchor = selectionAnchor;
			if (anchor === null) {
				anchor = lastClickedIndex !== null ? lastClickedIndex : index;
			}
			const start = Math.min(anchor, index);
			const end = Math.max(anchor, index);
			const newSelected = sortedFiles.slice(start, end + 1).map((f) => f.id);
			set({
				selectedIds: newSelected,
				_lastClickedIndex: index,
				_selectionAnchor: anchor,
			} as Partial<FileManagerState>);
			return;
		}

		if (e.ctrlKey || e.metaKey) {
			const newSelected = selectedIds.includes(file.id)
				? selectedIds.filter((id) => id !== file.id)
				: [...selectedIds, file.id];
			set({
				selectedIds: newSelected,
				_lastClickedIndex: index,
				_selectionAnchor: index,
			} as Partial<FileManagerState>);
			return;
		}

		// Plain click: select this item, or deselect if already the only one selected.
		if (selectedIds.length === 1 && selectedIds[0] === file.id) {
			set({
				selectedIds: [],
				_lastClickedIndex: null,
				_selectionAnchor: null,
			} as Partial<FileManagerState>);
		} else {
			set({
				selectedIds: [file.id],
				_lastClickedIndex: index,
				_selectionAnchor: index,
			} as Partial<FileManagerState>);
		}
	},

	clearSelection: () =>
		set({
			selectedIds: [],
			_lastClickedIndex: null,
			_selectionAnchor: null,
		} as Partial<FileManagerState>),

	selectAll: () => {
		const { sortedFiles } = get();
		set({ selectedIds: sortedFiles.map((f) => f.id) });
	},

	// --- Clipboard ---
	clipboard: [],
	activeAction: null,
	hasPending: false,

	cut: (paths) => set({ clipboard: paths, activeAction: "cut", hasPending: paths.length > 0 }),
	copy: (paths) => set({ clipboard: paths, activeAction: "copy", hasPending: paths.length > 0 }),
	clearClipboard: () => set({ clipboard: [], activeAction: null, hasPending: false }),
}));
