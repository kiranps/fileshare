import { downloadFile } from "@api/webdav";
import { FileItem } from "@components/FileItem";
import InputModal from "@components/FileListModal";
import { useFileClipboard } from "@hooks/useFileClipboard";
import { useFileSelection } from "@hooks/useFileSelection";
import { useFileSort } from "@hooks/useFileSort";
import { useWebDAVDelete, useWebDAVMkcol, useWebDAVMove, useWebDAVPut } from "@hooks/useWebDAVPropfind";
import { useFileManagerStore } from "@store/useFileManagerStore";
import type { FileItemProps } from "@types/FileItemProps";
import { collectDirs, dirname, joinPath, openFilePicker, openFolderPicker } from "@utils/files";
import { openFileContextMenu } from "@utils/openContextMenu";
import { ArrowDownUp } from "lucide-react";
import type { FC } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

type ModalType = "new_folder" | "rename";

const SortIcon: FC = () => (
	<span className="ml-2 align-middle inline-block text-sm text-base-content/60">
		<ArrowDownUp size={16} className="inline" />
	</span>
);

export const FileList: FC<{ files: FileItemProps[] }> = ({ files }) => {
	const activePath = useFileManagerStore((s) => s.activePath);
	const navigate = useNavigate();

	const { sortedFiles, sortColumn, sortDirection, handleSort } = useFileSort(files);
	const { selectedIds, handleItemClick, selectAll } = useFileSelection(sortedFiles);
	const { hasPending, cut, copy, paste } = useFileClipboard();

	const deleteMutation = useWebDAVDelete();
	const moveMutation = useWebDAVMove();
	const mkdirMutation = useWebDAVMkcol();
	const putMutation = useWebDAVPut();

	const [modalType, setModalType] = useState<ModalType | null>(null);
	const [inputValue, setInputValue] = useState("");
	const [renameTarget, setRenameTarget] = useState<FileItemProps | null>(null);

	const handleDoubleClick = (file: FileItemProps) => {
		if (file.type === "Folder") {
			navigate(file.id);
		}
	};

	const handleModalSubmit = () => {
		if (!inputValue) return;
		if (modalType === "new_folder") {
			mkdirMutation.mutate(joinPath(activePath, inputValue), {
				onSuccess: () => {
					setModalType(null);
					setInputValue("");
				},
			});
		} else if (modalType === "rename" && renameTarget) {
			moveMutation.mutate(
				{
					fromPath: renameTarget.id,
					toPath: joinPath(dirname(renameTarget.id), inputValue),
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
							setRenameTarget(file);
							setInputValue(file.name);
							setModalType("rename");
							break;
						case "delete":
							deleteMutation.mutate(file.id);
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
							setModalType("new_folder");
							setInputValue("");
							break;
						case "paste":
							await paste().catch((err: unknown) => {
								console.error("Paste failed:", err);
							});
							break;
						case "file_upload": {
							const picked = await openFilePicker();
							picked.forEach((f) => {
								putMutation.mutate({ path: joinPath(activePath, f.name), file: f });
							});
							break;
						}
						case "folder_upload": {
							const picked = await openFolderPicker();
							collectDirs(picked).forEach((folder) => {
								mkdirMutation.mutate(joinPath(activePath, folder));
							});
							picked.forEach((f) => {
								putMutation.mutate({
									path: joinPath(activePath, f.webkitRelativePath),
									file: f,
								});
							});
							break;
						}
						case "select_all":
							selectAll();
							break;
					}
				},
			});
		}
	};

	const isModalOpen = modalType !== null;
	const isLoading = modalType === "rename" ? moveMutation.isPending : mkdirMutation.isPending;
	const isError = modalType === "rename" ? moveMutation.isError : mkdirMutation.isError;
	const errorText = (modalType === "rename" ? moveMutation.error : mkdirMutation.error)?.message;

	return (
		<section
			aria-label="File list"
			className="fixed h-full left-56 right-0 top-26 bottom-0 pb-20 overflow-auto"
			onContextMenu={(e) => handleRightClick(e)}
		>
			<table className="table text-sm">
				<thead className="sticky top-0 z-20 bg-base-100">
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
								selected={selectedIds.includes(file.id)}
								onClick={(e) => handleItemClick(e, file)}
								onDoubleClick={() => handleDoubleClick(file)}
								onRightClick={(e) => handleRightClick(e, file)}
							/>
						))
					)}
				</tbody>
			</table>

			<InputModal
				open={isModalOpen}
				title={modalType === "rename" ? "Rename" : "New Folder"}
				label={modalType === "rename" ? "New name" : "Folder name"}
				placeholder={modalType === "rename" && renameTarget ? renameTarget.name : "folder name"}
				value={inputValue}
				onChange={setInputValue}
				onSubmit={handleModalSubmit}
				onCancel={handleCloseModal}
				submitLabel={modalType === "rename" ? "Rename" : "Create"}
				isLoading={isLoading}
				isError={isError}
				errorText={errorText}
			/>
		</section>
	);
};
