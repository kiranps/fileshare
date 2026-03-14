import {
	type FileActions,
	type ModalRequest,
	useCreateFolder,
	useFileActions,
	useRenameFile,
} from "@hooks/useFileActions";
import { useFileManagerStore } from "@store/useFileManagerStore";
import { dirname, joinPath } from "@utils/files";
import { createContext, type FC, type ReactNode, useCallback, useContext, useState } from "react";

// ---------------------------------------------------------------------------
// Modal state (kept local to this provider — purely UI state)
// ---------------------------------------------------------------------------

type ModalType = "new_folder" | "rename";

interface ModalState {
	type: ModalType | null;
	inputValue: string;
	renameTargetId: string | null;
	renameTargetName: string | null;
}

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface FileActionsContextValue extends FileActions {
	/** Whether the new-folder / rename modal is open. */
	isModalOpen: boolean;
	modalType: ModalType | null;
	modalInputValue: string;
	setModalInputValue: (v: string) => void;
	modalRenameTargetId: string | null;
	modalRenameTargetName: string | null;
	submitModal: () => void;
	closeModal: () => void;
	isModalLoading: boolean;
	isModalError: boolean;
	modalErrorText: string | undefined;
}

const FileActionsContext = createContext<FileActionsContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const FileActionsProvider: FC<{ children: ReactNode }> = ({ children }) => {
	const activePath = useFileManagerStore((s) => s.activePath);

	// Modal state lives here, not in Zustand — it is purely ephemeral UI state.
	const [modal, setModal] = useState<ModalState>({
		type: null,
		inputValue: "",
		renameTargetId: null,
		renameTargetName: null,
	});

	const mkdirMutation = useCreateFolder();
	const moveMutation = useRenameFile();

	const handleModalRequest = useCallback((req: ModalRequest) => {
		if (req.type === "new_folder") {
			setModal({ type: "new_folder", inputValue: "", renameTargetId: null, renameTargetName: null });
		} else {
			setModal({
				type: "rename",
				inputValue: req.currentName,
				renameTargetId: req.fileId,
				renameTargetName: req.currentName,
			});
		}
	}, []);

	const actions = useFileActions(handleModalRequest);

	const closeModal = useCallback(() => {
		setModal({ type: null, inputValue: "", renameTargetId: null, renameTargetName: null });
	}, []);

	const submitModal = useCallback(() => {
		if (!modal.inputValue) return;

		if (modal.type === "new_folder") {
			mkdirMutation.mutate(joinPath(activePath, modal.inputValue), {
				onSuccess: () => closeModal(),
			});
		} else if (modal.type === "rename" && modal.renameTargetId) {
			moveMutation.mutate(
				{
					fromPath: modal.renameTargetId,
					toPath: joinPath(dirname(modal.renameTargetId), modal.inputValue),
					overwrite: true,
				},
				{
					onSuccess: () => closeModal(),
				},
			);
		}
	}, [modal, activePath, mkdirMutation, moveMutation, closeModal]);

	const isModalLoading = modal.type === "rename" ? moveMutation.isPending : mkdirMutation.isPending;
	const isModalError = modal.type === "rename" ? moveMutation.isError : mkdirMutation.isError;
	const modalErrorText = (modal.type === "rename" ? moveMutation.error : mkdirMutation.error)?.message;

	const value: FileActionsContextValue = {
		...actions,
		isModalOpen: modal.type !== null,
		modalType: modal.type,
		modalInputValue: modal.inputValue,
		setModalInputValue: (v) => setModal((prev) => ({ ...prev, inputValue: v })),
		modalRenameTargetId: modal.renameTargetId,
		modalRenameTargetName: modal.renameTargetName,
		submitModal,
		closeModal,
		isModalLoading,
		isModalError,
		modalErrorText,
	};

	return <FileActionsContext.Provider value={value}>{children}</FileActionsContext.Provider>;
};

// ---------------------------------------------------------------------------
// Consumer hook
// ---------------------------------------------------------------------------

/**
 * Returns the file-actions context. Must be called inside a FileActionsProvider.
 */
export function useFileActionsContext(): FileActionsContextValue {
	const ctx = useContext(FileActionsContext);
	if (!ctx) {
		throw new Error("useFileActionsContext must be used inside <FileActionsProvider>");
	}
	return ctx;
}
