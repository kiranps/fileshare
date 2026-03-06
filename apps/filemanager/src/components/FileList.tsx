import React, { useState } from "react";
import type { FileItemProps } from "../types/FileItemProps";
import { FileItem } from "./FileItem";
import { openFileContextMenu } from "./FileContextMenu";
import { useFileManagerStore } from "../store/useFileManagerStore";
import { useNavigate } from "react-router-dom";
import { ArrowDownUp } from "lucide-react";

const SORTABLE_COLUMNS = ["name", "type", "size", "modified"] as const;
type SortColumn = (typeof SORTABLE_COLUMNS)[number];
type SortDirection = "asc" | "desc";
type MouseEvent = React.MouseEvent<HTMLTableRowElement, MouseEvent>;

const SortIcon = () => (
  <span className="ml-2 align-middle inline-block text-sm text-base-content/60">
    <ArrowDownUp size={16} className="inline" />
  </span>
);

export const FileList: React.FC<{ files: FileItemProps[] }> = ({ files }) => {
  const selectedId = useFileManagerStore((s) => s.selectedId);
  const setSelectedId = useFileManagerStore((s) => s.setSelectedId);
  const navigate = useNavigate();

  // Sorting state
  const [sortColumn, setSortColumn] = useState<SortColumn>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleDoubleClick = (file: FileItemProps) => {
    if (file.type === "Folder") {
      navigate(file.id);
    }
  };

  const handleRightClick = (e: MouseEvent, file: FileItemProps) => {
    e.preventDefault();
    setSelectedId(file.id);
    openFileContextMenu({
      x: e.clientX,
      y: e.clientY,
      onAction: (action) => {
        console.log(`Action '${action}' chosen for file:`, file);
      },
    });
  };

  // Sorting handler
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Sorting logic
  const sortedFiles = [...files].sort((a, b) => {
    let valA, valB;
    switch (sortColumn) {
      case "name":
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
        break;
      case "type":
        valA = a.type.toLowerCase();
        valB = b.type.toLowerCase();
        break;
      case "size":
        // Size may be undefined or string; treat undefined as smallest
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
        valA = 0;
        valB = 0;
    }
    if (valA < valB) return sortDirection === "asc" ? -1 : 1;
    if (valA > valB) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  // Icon rendering

  return (
    <div className="overflow-auto">
      <table className="table w-full text-sm">
        <thead className="sticky top-0 z-20">
          <tr>
            <th scope="col" className="w-12 text-center"></th>
            <th
              scope="col"
              className="font-semibold cursor-pointer select-none"
              onClick={() => handleSort("name")}
            >
              Name <SortIcon />
            </th>
            <th
              scope="col"
              className="cursor-pointer select-none"
              onClick={() => handleSort("type")}
            >
              Type <SortIcon />
            </th>
            <th
              scope="col"
              className="text-right cursor-pointer select-none"
              onClick={() => handleSort("size")}
            >
              Size <SortIcon />
            </th>
            <th
              scope="col"
              className="cursor-pointer select-none"
              onClick={() => handleSort("modified")}
            >
              Modified <SortIcon />
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedFiles.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center text-base-content/50 py-8">
                No files or folders found.
              </td>
            </tr>
          ) : (
            sortedFiles.map((file) => (
              <FileItem
                key={file.id}
                {...file}
                selected={selectedId === file.id}
                onClick={() => setSelectedId(file.id)}
                onDoubleClick={() => handleDoubleClick(file)}
                onRightClick={(e) => handleRightClick(e, file)}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
