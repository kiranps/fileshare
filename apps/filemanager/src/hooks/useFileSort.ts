import { useState } from "react";
import type { FileItemProps } from "../types";

export type SortColumn = "name" | "size" | "modified";
export type SortDirection = "asc" | "desc";

/**
 * Manages sort state and returns a sorted copy of the provided file list.
 * Folders are always listed before files when sorting by name.
 */
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

  const sortedFiles = [...files].sort((a, b) => {
    // When sorting by name, list folders before files.
    if (sortColumn === "name" && a.type !== b.type) {
      if (a.type === "Folder") return -1;
      if (b.type === "Folder") return 1;
    }

    let valA: string | number;
    let valB: string | number;

    switch (sortColumn) {
      case "name":
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
        break;
      case "size":
        valA = a.size ? parseInt(a.size, 10) : 0;
        valB = b.size ? parseInt(b.size, 10) : 0;
        break;
      case "modified":
        valA =
          a.modified instanceof Date
            ? a.modified.getTime()
            : new Date(a.modified).getTime();
        valB =
          b.modified instanceof Date
            ? b.modified.getTime()
            : new Date(b.modified).getTime();
        break;
      default:
        return 0;
    }

    if (valA < valB) return sortDirection === "asc" ? -1 : 1;
    if (valA > valB) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  return { sortedFiles, sortColumn, sortDirection, handleSort };
}
