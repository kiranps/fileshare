import React, { useState, useEffect } from "react";
import type { FileItemProps } from "../types/FileItemProps";
import { FileItem } from "./FileItem";
import { openFileContextMenu } from "./FileContextMenu";
import { useFileManagerStore } from "../store/useFileManagerStore";
import { useNavigate } from "react-router-dom";
import { ArrowDownUp } from "lucide-react";
import InputModal from "./FileListModal";
import {
  useWebDAVDelete,
  useWebDAVMove,
  useWebDAVCopy,
  useWebDAVMkcol,
  useWebDAVPut,
} from "../hooks/useWebDAVPropfind";

import { downloadFile } from "../api/webdav";
import {
  basename,
  dirname,
  joinPath,
  openFilePicker,
  openFolderPicker,
  collectDirs,
} from "../utils/files";

type SortColumn = "name" | "type" | "size" | "modified";
type SortDirection = "asc" | "desc";
type MouseEvent = React.MouseEvent;
// clipboard state for cut/copy operations is used only for copy/cut/paste

const SortIcon = () => (
  <span className="ml-2 align-middle inline-block text-sm text-base-content/60">
    <ArrowDownUp size={16} className="inline" />
  </span>
);

export const FileList: React.FC<{ files: FileItemProps[] }> = ({ files }) => {
  // selectionClipboard is local to the FileList component
  const [selectionClipboard, setSelectionClipboard] = useState<string[]>([]);
  const activePath = useFileManagerStore((s) => s.activePath);
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const deleteMutation = useWebDAVDelete();
  const moveMutation = useWebDAVMove();
  const copyMutation = useWebDAVCopy();
  const mkdirMutation = useWebDAVMkcol();
  const putMutation = useWebDAVPut();
  const navigate = useNavigate();

  const [clipboard, setClipboard] = useState<string[]>([]);
  const [sortColumn, setSortColumn] = useState<SortColumn>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const [modalType, setModalType] = useState<null | "new_folder" | "rename">(
    null,
  );
  const [inputValue, setInputValue] = useState("");
  const [renameTarget, setRenameTarget] = useState<FileItemProps | null>(null);
  const [activeAction, setActiveAction] = useState<"cut" | "copy" | null>(null);

  useEffect(() => {
    const handleClick = () => setSelectionClipboard([]);
    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, []);

  const handleDoubleClick = (file: FileItemProps) => {
    if (file.type === "Folder") {
      navigate(file.id);
    }
  };

  const handleRightClick = (e: MouseEvent, file?: FileItemProps) => {
    e.preventDefault();
    e.stopPropagation();
    const handlePaste = () => {
      switch (activeAction) {
        case "cut": {
          console.log(clipboard);
          clipboard.forEach((p) => {
            const filename = basename(p);
            moveMutation.mutate({
              fromPath: p,
              toPath: joinPath(activePath, filename),
            });
          });
          break;
        }
        case "copy": {
          clipboard.forEach((p) => {
            const filename = basename(p);
            copyMutation.mutate({
              fromPath: p,
              toPath: joinPath(activePath, filename),
            });
          });
          break;
        }
      }
      setClipboard([]);
    };

    if (file) {
      // when right-clicking a file, make it the only selection
      if (!selectionClipboard.includes(file.id)) {
        setSelectionClipboard([file.id]);
      }
      const menuActions =
        clipboard.length > 0
          ? [{ label: "Paste", value: "paste" }]
          : [
              { label: "Rename", value: "rename" },
              { label: "Download", value: "download" },
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
            case "rename": {
              setRenameTarget(file);
              setInputValue(file.name || "");
              setModalType("rename");
              break;
            }
            case "delete": {
              deleteMutation.mutate(file!.id);
              break;
            }
            case "cut": {
              setClipboard(selectionClipboard);
              setActiveAction("cut");
              break;
            }
            case "copy": {
              setClipboard(selectionClipboard);
              setActiveAction("copy");
              break;
            }
            case "download": {
              downloadFile(file.id);
              break;
            }
            case "paste": {
              handlePaste();
              break;
            }
          }
        },
      });
    } else {
      const menuActions =
        clipboard.length > 0
          ? [
              { label: "New Folder", value: "new_folder" },
              { label: "Paste", value: "paste" },
            ]
          : [
              { label: "New Folder", value: "new_folder" },
              { label: "File Upload", value: "file_upload" },
              { label: "Folder Upload", value: "folder_upload" },
              { label: "Select All", value: "select_all" },
              { label: "Properties", value: "properties" },
            ];
      openFileContextMenu({
        x: e.clientX,
        y: e.clientY,
        actions: menuActions,
        onAction: async (action) => {
          switch (action) {
            case "new_folder": {
              setModalType("new_folder");
              setInputValue("");
              break;
            }
            case "paste": {
              handlePaste();
              break;
            }
            case "file_upload": {
              const files = await openFilePicker();
              files.forEach((file) => {
                putMutation.mutate({
                  path: joinPath(activePath, file.name),
                  file,
                });
              });
              break;
            }
            case "folder_upload": {
              const files = await openFolderPicker();
              const folders = collectDirs(files);
              folders.forEach((folder) => {
                const folderPath = joinPath(activePath, folder);
                mkdirMutation.mutate(folderPath);
              });
              files.forEach((file) => {
                putMutation.mutate({
                  path: joinPath(activePath, file.webkitRelativePath),
                  file,
                });
              });
              break;
            }
          }
        },
      });
    }
  };

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
    // When sorting by name, list folders before files. For other columns keep natural order.
    if (sortColumn === "name" && a.type !== b.type) {
      if (a.type === "Folder") return -1;
      if (b.type === "Folder") return 1;
    }

    let valA, valB;
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
        valA = 0;
        valB = 0;
    }
    if (valA < valB) return sortDirection === "asc" ? -1 : 1;
    if (valA > valB) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  // Modal submit handler
  const handleModalSubmit = () => {
    if (!inputValue) return;
    if (modalType === "new_folder") {
      const newFolderPath = joinPath(activePath, inputValue);
      mkdirMutation.mutate(newFolderPath, {
        onSuccess: () => {
          setModalType(null);
          setInputValue("");
        },
      });
    } else if (modalType === "rename" && renameTarget) {
      const fromPath = renameTarget.id;
      const destPath = joinPath(dirname(fromPath), inputValue);
      moveMutation.mutate(
        {
          fromPath,
          toPath: destPath,
          overwrite: true,
        },
        {
          onSuccess: () => {
            setModalType(null);
            setInputValue("");
            setRenameTarget(null);
          },
        },
      );
    }
  };

  const handleItemClick = (e: MouseEvent, file: FileItemProps) => {
    e.stopPropagation();
    const isCtrl = e.ctrlKey;
    const isShift = e.shiftKey;
    const current = selectionClipboard;
    const index = sortedFiles.findIndex((f) => f.id === file.id);

    if (isShift) {
      // range selection from lastClickedIndex (or first selected) to this index
      let anchor = lastClickedIndex;
      if (anchor === null) {
        const firstSelected = sortedFiles.findIndex((f) =>
          current.includes(f.id),
        );
        anchor = firstSelected !== -1 ? firstSelected : index;
      }
      const start = Math.min(anchor, index);
      const end = Math.max(anchor, index);
      const idsInRange = sortedFiles.slice(start, end + 1).map((f) => f.id);
      // replace selection with the range
      setSelectionClipboard(idsInRange);
      setLastClickedIndex(index);
      return;
    }

    if (isCtrl) {
      // toggle presence
      if (current.includes(file.id)) {
        setSelectionClipboard(current.filter((id) => id !== file.id));
      } else {
        setSelectionClipboard([...current, file.id]);
      }
      setLastClickedIndex(index);
      return;
    }

    // neither ctrl nor shift: replace selection with this item or clear if already sole
    if (current.length === 1 && current[0] === file.id) {
      setSelectionClipboard([]);
      setLastClickedIndex(null);
    } else {
      setSelectionClipboard([file.id]);
      setLastClickedIndex(index);
    }
  };

  const handleCloseModal = () => {
    setModalType(null);
    setInputValue("");
    setRenameTarget(null);
  };

  const isModalOpen = modalType !== null;
  const isLoading =
    modalType === "rename" ? moveMutation.isPending : mkdirMutation.isPending;
  const isError =
    modalType === "rename" ? moveMutation.isError : mkdirMutation.isError;
  const errorText = (
    modalType === "rename" ? moveMutation.error : mkdirMutation.error
  )?.message;

  return (
    <div
      className="fixed h-full left-56 right-0 top-14 bottom-0 pb-20 overflow-auto"
      onContextMenu={(e) => handleRightClick(e)}
      onClick={(e) => {
        // clicking outside of items clears multi-selection when ctrl isn't pressed
        if (!(e as MouseEvent).ctrlKey) {
          setSelectionClipboard([]);
        }
      }}
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
                selected={selectionClipboard.includes(file.id)}
                onClick={(e) => handleItemClick(e, file)}
                onDoubleClick={() => handleDoubleClick(file)}
                onRightClick={(e) => handleRightClick(e, file)}
              />
            ))
          )}
        </tbody>
      </table>

      {/* Modal for New Folder or Rename, daisyUI style */}
      <InputModal
        open={isModalOpen}
        title={modalType === "rename" ? "Rename" : "New Folder"}
        label={modalType === "rename" ? "New name" : "Folder name"}
        placeholder={
          modalType === "rename" && renameTarget
            ? renameTarget.name
            : "folder name"
        }
        value={inputValue}
        onChange={setInputValue}
        onSubmit={handleModalSubmit}
        onCancel={handleCloseModal}
        submitLabel={modalType === "rename" ? "Rename" : "Create"}
        isLoading={isLoading}
        isError={isError}
        errorText={errorText}
      />
    </div>
  );
};
