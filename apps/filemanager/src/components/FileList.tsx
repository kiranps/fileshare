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

import { downloadFile } from "../api/webdav";
import { basename, dirname, normalizePath, joinPath } from "../utils/files";

type SortColumn = "name" | "type" | "size" | "modified";
type SortDirection = "asc" | "desc";
type MouseEvent = React.MouseEvent;
type ClipboardState = {
  path: string;
  operation: "cut" | "copy";
} | null;

type InputModalProps = {
  open: boolean;
  title: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel?: string;
  isLoading?: boolean;
  isError?: boolean;
  errorText?: string;
};

const SortIcon = () => (
  <span className="ml-2 align-middle inline-block text-sm text-base-content/60">
    <ArrowDownUp size={16} className="inline" />
  </span>
);

const InputModal: React.FC<InputModalProps> = ({
  open,
  title,
  label,
  placeholder,
  value,
  onChange,
  onSubmit,
  onCancel,
  submitLabel = "Create",
  isLoading,
  isError,
  errorText,
}) =>
  open ? (
    <dialog className="modal" open>
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-4">{title}</h3>
        <label className="form-control w-full mb-4">
          <span className="label-text mb-1">{label}</span>
          <input
            type="text"
            className="input input-bordered w-full"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoFocus
            disabled={isLoading}
          />
        </label>
        {isLoading && <div className="my-2 text-primary">Please wait...</div>}
        {isError && (
          <div className="my-2 text-error">{errorText || "Error occurred"}</div>
        )}
        <div className="modal-action">
          <button
            className="btn btn-primary"
            onClick={onSubmit}
            disabled={isLoading || !value.trim()}
          >
            {submitLabel}
          </button>
          <button className="btn" onClick={onCancel} disabled={isLoading}>
            Cancel
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onClick={onCancel} />
    </dialog>
  ) : null;

export const FileList: React.FC<{ files: FileItemProps[] }> = ({ files }) => {
  const selectedId = useFileManagerStore((s) => s.selectedId);
  const setSelectedId = useFileManagerStore((s) => s.setSelectedId);
  const activePath = useFileManagerStore((s) => s.activePath);
  const deleteMutation = useWebDAVDelete();
  const moveMutation = useWebDAVMove();
  const copyMutation = useWebDAVCopy();
  const mkdirMutation = useWebDAVMkcol();
  const navigate = useNavigate();

  const [clipboard, setClipboard] = useState<ClipboardState>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const [modalType, setModalType] = useState<null | "new_folder" | "rename">(
    null,
  );
  const [inputValue, setInputValue] = useState("");
  const [renameTarget, setRenameTarget] = useState<FileItemProps | null>(null);

  const handleDoubleClick = (file: FileItemProps) => {
    if (file.type === "Folder") {
      navigate(file.id);
    }
  };

  const handleRightClick = (e: MouseEvent, file?: FileItemProps) => {
    e.preventDefault();
    e.stopPropagation();
    const handlePaste = () => {
      switch (clipboard?.operation) {
        case "cut": {
          const filename = basename(clipboard!.path);
          moveMutation.mutate({
            fromPath: clipboard!.path,
            toPath: joinPath(activePath, filename),
          });
          break;
        }
        case "copy": {
          copyMutation.mutate({
            fromPath: clipboard!.path,
            toPath: normalizePath(activePath),
          });
          break;
        }
      }
      setClipboard(null);
    };

    if (file) {
      const menuActions = clipboard
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
              setClipboard({ path: file!.id, operation: "cut" });
              break;
            }
            case "copy": {
              setClipboard({ path: file!.id, operation: "copy" });
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
      const menuActions = clipboard
        ? [
            { label: "New Folder", value: "new_folder" },
            { label: "Paste", value: "paste" },
          ]
        : [
            { label: "New Folder", value: "new_folder" },
            { label: "Upload", value: "cut" },
            { label: "Select All", value: "select_all" },
            { label: "Properties", value: "properties" },
          ];
      openFileContextMenu({
        x: e.clientX,
        y: e.clientY,
        actions: menuActions,
        onAction: (action) => {
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
    if (!inputValue.trim()) return;
    if (modalType === "new_folder") {
      const newFolderPath = joinPath(activePath, inputValue.trim());
      mkdirMutation.mutate(newFolderPath, {
        onSuccess: () => {
          setModalType(null);
          setInputValue("");
        },
      });
    } else if (modalType === "rename" && renameTarget) {
      const fromPath = renameTarget.id;
      const destPath = joinPath(dirname(fromPath), inputValue.trim());
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
