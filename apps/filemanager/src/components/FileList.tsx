import { downloadFile } from "@api/webdav";
import { FileItem } from "@components/FileItem";
import InputModal from "@components/FileListModal";
import { useFileManagerStore } from "@store/useFileManagerStore";
import { openFileContextMenu } from "@utils/openContextMenu";
import type { FC } from "react";
import { useNavigate } from "react-router-dom";
import { useFileActionsContext } from "../contexts/FileActionsContext";
import type { FileItemProps } from "../types/FileItemProps";
import { SortIcon } from "./CustomIcons";

/**
 * FileList renders the sortable table of files and folders.
 *
 * All state (selection, sort, clipboard) is read from the global Zustand store.
 * All async file operations (upload, delete, rename, paste) are consumed from
 * the FileActionsContext so this component stays free of direct mutation-hook calls.
 */
export const FileList: FC = () => {
	const navigate = useNavigate();

	// --- Store state ---
	const sortedFiles = useFileManagerStore((s) => s.sortedFiles);
	const sortColumn = useFileManagerStore((s) => s.sortColumn);
	const sortDirection = useFileManagerStore((s) => s.sortDirection);
	const handleSort = useFileManagerStore((s) => s.handleSort);

	const selectedIds = useFileManagerStore((s) => s.selectedIds);
	const handleItemClick = useFileManagerStore((s) => s.handleItemClick);
	const selectAll = useFileManagerStore((s) => s.selectAll);

	const hasPending = useFileManagerStore((s) => s.hasPending);
	const cut = useFileManagerStore((s) => s.cut);
	const copy = useFileManagerStore((s) => s.copy);

	// --- Context actions ---
	const {
		openNewFolderModal,
		openRenameModal,
		deleteFiles,
		uploadFile,
		uploadFolder,
		paste,
		isModalOpen,
		modalType,
		modalInputValue,
		setModalInputValue,
		modalRenameTargetName,
		submitModal,
		closeModal,
		isModalLoading,
		isModalError,
		modalErrorText,
	} = useFileActionsContext();

	// --- Navigation ---
	const handleDoubleClick = (file: FileItemProps) => {
		if (file.type === "Folder") {
			navigate(file.id);
		}
	};

	// --- Context menu ---
	const handleRightClick = (e: React.MouseEvent, file?: FileItemProps) => {
		e.preventDefault();
		e.stopPropagation();

		if (file) {
			// Ensure the right-clicked file is in the selection.
			if (!selectedIds.includes(file.id)) {
				handleItemClick(e, file);
			}

			const menuActions = hasPending
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
				onAction: async (action) => {
					switch (action) {
						case "rename":
							openRenameModal(file.id, file.name);
							break;
						case "delete":
							deleteFiles();
							break;
						case "cut":
							cut(selectedIds);
							break;
						case "copy":
							copy(selectedIds);
							break;
						case "download":
							downloadFile(file.id);
							break;
						case "paste":
							await paste().catch((err: unknown) => {
								console.error("Paste failed:", err);
							});
							break;
					}
				},
			});
		} else {
			const menuActions = hasPending
				? [
						{ label: "New Folder", value: "new_folder" },
						{ label: "Paste", value: "paste" },
					]
				: [
						{ label: "New Folder", value: "new_folder" },
						{ label: "File Upload", value: "file_upload" },
						{ label: "Folder Upload", value: "folder_upload" },
						{ label: "Select All", value: "select_all" },
					];

			openFileContextMenu({
				x: e.clientX,
				y: e.clientY,
				actions: menuActions,
				onAction: async (action) => {
					switch (action) {
						case "new_folder":
							openNewFolderModal();
							break;
						case "paste":
							await paste().catch((err: unknown) => {
								console.error("Paste failed:", err);
							});
							break;
						case "file_upload":
							uploadFile();
							break;
						case "folder_upload":
							uploadFolder();
							break;
						case "select_all":
							selectAll();
							break;
					}
				},
			});
		}
	};

	return (
		<section
			aria-label="File list"
			className="fixed h-full left-56 right-0 top-14 bottom-0 pb-20"
			onContextMenu={(e) => handleRightClick(e)}
		>
			<div className="fixed top-26 left-56 right-0 overflow-auto h-full">
				<table className="table text-sm z-20 top-0 pb-40">
					<thead className="sticky z-20 top-0 bg-base-100">
						<tr>
							<th scope="col" className="w-12 text-center"></th>
							<th
								scope="col"
								className="font-semibold cursor-pointer select-none"
								onClick={() => handleSort("name")}
								aria-sort={sortColumn === "name" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
							>
								Name <SortIcon />
							</th>
							<th
								scope="col"
								className="text-right cursor-pointer select-none"
								onClick={() => handleSort("size")}
								aria-sort={sortColumn === "size" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
							>
								Size <SortIcon />
							</th>
							<th
								scope="col"
								className="cursor-pointer select-none"
								onClick={() => handleSort("modified")}
								aria-sort={sortColumn === "modified" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
							>
								Modified <SortIcon />
							</th>
						</tr>
					</thead>
					<tbody className="top-24">
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
									selected={selectedIds.includes(file.id)}
									onClick={(e) => handleItemClick(e, file)}
									onDoubleClick={() => handleDoubleClick(file)}
									onRightClick={(e) => handleRightClick(e, file)}
								/>
							))
						)}
					</tbody>
				</table>
			</div>

			<InputModal
				open={isModalOpen}
				title={modalType === "rename" ? "Rename" : "New Folder"}
				label={modalType === "rename" ? "New name" : "Folder name"}
				placeholder={modalType === "rename" && modalRenameTargetName ? modalRenameTargetName : "folder name"}
				value={modalInputValue}
				onChange={setModalInputValue}
				onSubmit={submitModal}
				onCancel={closeModal}
				submitLabel={modalType === "rename" ? "Rename" : "Create"}
				isLoading={isModalLoading}
				isError={isModalError}
				errorText={modalErrorText}
			/>
		</section>
	);
};
