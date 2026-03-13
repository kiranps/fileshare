import { useState } from "react";
import type { FileItemProps } from "../types";

export type SortColumn = "name" | "size" | "modified";
export type SortDirection = "asc" | "desc";

export function useFileSort(files: FileItemProps[]) {
	const [sortColumn, setSortColumn] = useState<SortColumn>("name");
	const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

	const handleSort = (column: SortColumn) => {
		if (sortColumn === column) {
			setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
		} else {
			setSortColumn(column);
			setSortDirection("asc");
		}
	};

	const sortedFiles = (() => {
		// split folders and regular files so folders are always first
		const folders = files.filter((f) => f.type === "Folder");
		const regularFiles = files.filter((f) => f.type !== "Folder");

		const getComparator = (col: typeof sortColumn, dir: typeof sortDirection) => {
			const multiplier = dir === "asc" ? 1 : -1;
			if (col === "name") {
				return (a: FileItemProps, b: FileItemProps) =>
					multiplier * a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
			}
			if (col === "size") {
				return (a: FileItemProps, b: FileItemProps) => {
					const aSize = typeof a.size === "number" ? a.size : 0;
					const bSize = typeof b.size === "number" ? b.size : 0;
					if (aSize === bSize) return 0;
					return multiplier * (aSize < bSize ? -1 : 1);
				};
			}
			// modified
			return (a: FileItemProps, b: FileItemProps) => {
				const aTime = a.modified instanceof Date ? a.modified.getTime() : new Date(a.modified).getTime();
				const bTime = b.modified instanceof Date ? b.modified.getTime() : new Date(b.modified).getTime();
				if (aTime === bTime) return 0;
				return multiplier * (aTime < bTime ? -1 : 1);
			};
		};

		const comparator = getComparator(sortColumn, sortDirection);

		const sortedFolders = [...folders].sort(comparator);
		const sortedRegularFiles = [...regularFiles].sort(comparator);

		return [...sortedFolders, ...sortedRegularFiles];
	})();

	return { sortedFiles, sortColumn, sortDirection, handleSort };
}
