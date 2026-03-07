import React, { useState } from "react";
import type { FileItemProps } from "../types/FileItemProps";
import { FileItem } from "./FileItem";
import { openFileContextMenu } from "./FileContextMenu";
import { useFileManagerStore } from "../store/useFileManagerStore";
import { useNavigate } from "react-router-dom";
import { ArrowDownUp } from "lucide-react";
import {
  useWebDAVDelete,
  useWebDAVMove,
  useWebDAVCopy,
  useWebDAVMkcol,
} from "../hooks/useWebDAVPropfind";

const SORTABLE_COLUMNS = ["name", "type", "size", "modified"] as const;
type SortColumn = (typeof SORTABLE_COLUMNS)[number];
type SortDirection = "asc" | "desc";
type MouseEvent = React.MouseEvent;
type ClipboardState = {
  path: string;
  operation: "cut" | "copy";
} | null;

const SortIcon = () => (
  <span className="ml-2 align-middle inline-block text-sm text-base-content/60">
    <ArrowDownUp size={16} className="inline" />
  </span>
);

export const FileList: React.FC<{ files: FileItemProps[] }> = ({ files }) => {
  const selectedId = useFileManagerStore((s) => s.selectedId);
  const setSelectedId = useFileManagerStore((s) => s.setSelectedId);
  const activePath = useFileManagerStore((s) => s.activePath);
  const deleteMutation = useWebDAVDelete();
  const moveMutation = useWebDAVMove();
  const copyMutation = useWebDAVCopy();
  const mkdirMutation = useWebDAVMkcol();
  const navigate = useNavigate();

  // cut
  const [clipboard, setClipboard] = useState<ClipboardState>(null);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<SortColumn>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // New folder modal state
  const [newFolderModalOpen, setNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const handleDoubleClick = (file: FileItemProps) => {
    if (file.type === "Folder") {
      navigate(file.id);
    }
  };

  const handleRightClick = (e: MouseEvent, file?: FileItemProps) => {
    e.preventDefault();
    e.stopPropagation();
    if (file) {
      const menuActions = clipboard
        ? [{ label: "Paste", value: "paste" }]
        : [
            { label: "Cut", value: "cut" },
            { label: "Copy", value: "copy" },
            { label: "Delete", value: "delete" },
          ];

      openFileContextMenu({
        x: e.clientX,
        y: e.clientY,
        actions: menuActions,
        onAction: (action) => {
          switch (action) {
            case "delete": {
              deleteMutation.mutate(file!.id);
              break;
            }
            case "cut": {
              setClipboard({ path: file!.id, operation: "cut" });
              break;
            }
            case "copy": {
              setClipboard({ path: file!.id, operation: "copy" });
              break;
            }
            case "paste": {
              switch (clipboard?.operation) {
                case "cut": {
                  moveMutation.mutate({
                    fromPath: clipboard!.path,
                    toPath: activePath,
                  });
                  break;
                }
                case "copy": {
                  copyMutation.mutate({
                    fromPath: clipboard!.path,
                    toPath: activePath,
                  });
                  break;
                }
              }
              setClipboard(null);
            }
          }
        },
      });
    } else {
      const menuActions = clipboard
        ? [
            { label: "New Folder", value: "new_folder" },
            { label: "Paste", value: "paste" },
          ]
        : [
            { label: "New Folder", value: "new_folder" },
            { label: "Paste", value: "paste", disabled: true },
            { label: "Cut", value: "cut" },
            { label: "Copy", value: "copy" },
          ];

      openFileContextMenu({
        x: e.clientX,
        y: e.clientY,
        actions: menuActions,
        onAction: (action) => {
          switch (action) {
            case "new_folder": {
              setNewFolderModalOpen(true);
              break;
            }
          }
        },
      });
    }
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

  // Modal create handler
  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    let normalizedPath = activePath.endsWith("/")
      ? activePath
      : activePath + "/";
    if (!normalizedPath.startsWith("/")) normalizedPath = "/" + normalizedPath;
    const newFolderPath = normalizedPath + newFolderName;
    mkdirMutation.mutate(newFolderPath, {
      onSuccess: () => {
        setNewFolderModalOpen(false);
        setNewFolderName("");
      },
      onError: () => {},
    });
  };

  // Modal close handler
  const handleCloseModal = () => {
    setNewFolderModalOpen(false);
    setNewFolderName("");
  };

  return (
    <div
      className="fixed h-full left-56 right-0 top-14 bottom-0 pb-20 overflow-auto"
      onContextMenu={(e) => handleRightClick(e)}
    >
      <table className="table text-sm">
        <thead className="sticky top-0 z-20 bg-white">
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
      {newFolderModalOpen && (
        <dialog className="modal" open>
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">New Folder</h3>
            <input
              type="text"
              className="input input-bordered w-full mb-4"
              placeholder="folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              autoFocus
            />
            {mkdirMutation.isPending && (
              <div className="my-2 text-primary">Creating...</div>
            )}
            {mkdirMutation.isError && (
              <div className="my-2 text-error">
                Error: Failed to create folder
              </div>
            )}
            <div className="modal-action">
              <button
                className="btn btn-primary"
                onClick={handleCreateFolder}
                disabled={mkdirMutation.isPending || !newFolderName.trim()}
              >
                Create
              </button>
              <button
                className="btn"
                onClick={handleCloseModal}
                disabled={mkdirMutation.isPending}
              >
                Cancel
              </button>
            </div>
          </div>
          <form
            method="dialog"
            className="modal-backdrop"
            onClick={handleCloseModal}
          />
        </dialog>
      )}
    </div>
  );
};
