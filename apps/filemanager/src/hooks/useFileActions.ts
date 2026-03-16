import { downloadFile } from "@api/webdav";
import { useWebDAVCopy, useWebDAVDelete, useWebDAVMkcol, useWebDAVMove, useWebDAVPut } from "@hooks/useWebDAVPropfind";
import { useFileManagerStore } from "@store/useFileManagerStore";
import { basename, collectDirs, dirname, joinPath, openFilePicker, openFolderPicker } from "@utils/files";

export type ModalRequest = { type: "new_folder" } | { type: "rename"; fileId: string; currentName: string };

export interface FileActions {
	/** Open the new-folder creation modal. */
	openNewFolderModal: () => void;
	/** Upload one or more files to the current directory. */
	uploadFile: () => void;
	/** Upload a folder (with all its contents) to the current directory. */
	uploadFolder: () => void;
	/** Delete a file/folder by its path id. */
	deleteFiles: () => Promise<void>;
	/** Download a file by its path id. */
	downloadFile: (id: string) => void;
	/** Open the rename modal for a specific file. */
	openRenameModal: (fileId: string, currentName: string) => void;
	/** Paste clipboard items into the current directory. Resolves on success, rejects with AggregateError on failure. */
	paste: () => Promise<void>;
}

/**
 * Bridges the global Zustand store with the WebDAV mutation hooks.
 *
 * Call this hook once, near the top of the component tree (FileManager or
 * FileActionsProvider), to wire together reactive store state with the
 * async WebDAV operations that require React hooks.
 *
 * @param onModalRequest - callback invoked when an action needs to open a modal
 */
export function useFileActions(onModalRequest: (req: ModalRequest) => void): FileActions {
	const activePath = useFileManagerStore((s) => s.activePath);
	const clipboard = useFileManagerStore((s) => s.clipboard);
	const activeAction = useFileManagerStore((s) => s.activeAction);
	const clearClipboard = useFileManagerStore((s) => s.clearClipboard);
	const clearSelection = useFileManagerStore((s) => s.clearSelection);

	const deleteMutation = useWebDAVDelete();
	const moveMutation = useWebDAVMove();
	const mkdirMutation = useWebDAVMkcol();
	const putMutation = useWebDAVPut();
	const copyMutation = useWebDAVCopy();

	const openNewFolderModal = () => {
		onModalRequest({ type: "new_folder" });
	};

	const handleUploadFile = () => {
		openFilePicker()
			.then((picked) => {
				picked.forEach((f) => {
					putMutation.mutate({ path: joinPath(activePath, f.name), file: f });
				});
			})
			.catch((err: unknown) => {
				console.error("File picker failed:", err);
			});
	};

	const handleUploadFolder = () => {
		openFolderPicker()
			.then((picked) => {
				collectDirs(picked).forEach((folder) => {
					mkdirMutation.mutate(joinPath(activePath, folder));
				});
				picked.forEach((f) => {
					putMutation.mutate({
						path: joinPath(activePath, f.webkitRelativePath),
						file: f,
					});
				});
			})
			.catch((err: unknown) => {
				console.error("Folder picker failed:", err);
			});
	};

	const handleDeleteFiles = async (): Promise<void> => {
		const selectedIds = useFileManagerStore.getState().selectedIds;
		const results = await Promise.allSettled(
			selectedIds.map((p) => {
				return deleteMutation.mutateAsync(p);
			}),
		);

		const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");

		if (failures.length === 0) {
			clearSelection();
		} else {
			throw new AggregateError(
				failures.map((f: PromiseRejectedResult) => f.reason as unknown),
				`${failures.length} of ${selectedIds.length} delete operation(s) failed`,
			);
		}
	};

	const handleDownloadFile = (id: string) => {
		downloadFile(id);
	};

	const handleOpenRenameModal = (fileId: string, currentName: string) => {
		onModalRequest({ type: "rename", fileId, currentName });
	};

	const handlePaste = async (): Promise<void> => {
		if (!activeAction || clipboard.length === 0) return;

		const results = await Promise.allSettled(
			clipboard.map((p) => {
				const toPath = joinPath(activePath, basename(p));
				if (activeAction === "cut") {
					return moveMutation.mutateAsync({ fromPath: p, toPath });
				}
				return copyMutation.mutateAsync({ fromPath: p, toPath });
			}),
		);

		const failures = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");

		if (failures.length === 0) {
			clearClipboard();
		} else {
			throw new AggregateError(
				failures.map((f: PromiseRejectedResult) => f.reason as unknown),
				`${failures.length} of ${clipboard.length} ${activeAction} operation(s) failed`,
			);
		}
	};

	return {
		openNewFolderModal,
		uploadFile: handleUploadFile,
		uploadFolder: handleUploadFolder,
		deleteFiles: handleDeleteFiles,
		downloadFile: handleDownloadFile,
		openRenameModal: handleOpenRenameModal,
		paste: handlePaste,
	};
}

/**
 * Convenience: create a folder at the given path.
 * This is used by FileList's modal submit handler which already has
 * the WebDAV mutation available — we expose a factory so callers
 * can call the mutation directly without re-calling useWebDAVMkcol.
 */
export function useCreateFolder() {
	return useWebDAVMkcol();
}

/**
 * Convenience: rename/move a file. Same rationale as useCreateFolder.
 */
export function useRenameFile() {
	return useWebDAVMove();
}

// Re-export so that callers don't need to import from two different places.
export { dirname };
