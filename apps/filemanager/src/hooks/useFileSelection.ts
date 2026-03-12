import { useState, useEffect } from "react";
import type { FileItemProps } from "../types";

/**
 * Manages multi-selection state for a list of files.
 * Supports single-click, Ctrl+click (toggle), and Shift+click (range) selection.
 * Clicking outside any file item clears the selection.
 */
export function useFileSelection(sortedFiles: FileItemProps[]) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

  // Clear selection on clicks that bubble up to the document without a file target.
  useEffect(() => {
    const handleDocumentClick = () => setSelectedIds([]);
    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, []);

  const handleItemClick = (
    e: React.MouseEvent,
    file: FileItemProps,
  ) => {
    e.stopPropagation();
    const index = sortedFiles.findIndex((f) => f.id === file.id);

    if (e.shiftKey) {
      let anchor = lastClickedIndex;
      if (anchor === null) {
        const firstSelected = sortedFiles.findIndex((f) =>
          selectedIds.includes(f.id),
        );
        anchor = firstSelected !== -1 ? firstSelected : index;
      }
      const start = Math.min(anchor, index);
      const end = Math.max(anchor, index);
      setSelectedIds(sortedFiles.slice(start, end + 1).map((f) => f.id));
      setLastClickedIndex(index);
      return;
    }

    if (e.ctrlKey) {
      setSelectedIds((prev) =>
        prev.includes(file.id)
          ? prev.filter((id) => id !== file.id)
          : [...prev, file.id],
      );
      setLastClickedIndex(index);
      return;
    }

    // Plain click: select this item, or deselect if it's the only one selected.
    if (selectedIds.length === 1 && selectedIds[0] === file.id) {
      setSelectedIds([]);
      setLastClickedIndex(null);
    } else {
      setSelectedIds([file.id]);
      setLastClickedIndex(index);
    }
  };

  const clearSelection = () => {
    setSelectedIds([]);
    setLastClickedIndex(null);
  };

  const selectAll = () => {
    setSelectedIds(sortedFiles.map((f) => f.id));
  };

  return { selectedIds, handleItemClick, clearSelection, selectAll };
}
