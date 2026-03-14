import { useFileManagerStore } from "@store/useFileManagerStore";
import { FileUp, FolderPlus, FolderUp, Plus } from "lucide-react";
import type { FC } from "react";
import { useFileActionsContext } from "../contexts/FileActionsContext";

/**
 * ActionBar renders the fixed toolbar above the file list.
 *
 * It reads all state and callbacks directly from the global store and the
 * FileActionsContext — no props are required. This makes it usable from any
 * position in the component tree without threading callbacks down.
 */
export const ActionBar: FC = () => {
	const selectedIds = useFileManagerStore((s) => s.selectedIds);
	const { openNewFolderModal, uploadFile, uploadFolder } = useFileActionsContext();

	return (
		<div
			className="fixed bg-base-100 flex p-2 z-30 left-56 right-0 items-center px-4 border-b border-base-300 justify-between"
			role="toolbar"
			aria-label="File actions"
		>
			<div className="dropdown ml-2">
				<button type="button" className="btn btn-outline btn-sm border-base-300">
					<Plus className="mr-2 w-4 h-4" />
					New
				</button>
				<ul tabIndex={-1} className="dropdown-content menu bg-base-100 rounded-box z-1 w-52 p-2 shadow-md">
					<li>
						<button type="button" className="flex items-center w-full" onClick={openNewFolderModal}>
							<FolderPlus className="mr-2 w-4 h-4" />
							New Folder
						</button>
					</li>
					<li>
						<button type="button" className="flex items-center w-full" onClick={uploadFile}>
							<FileUp className="mr-2 w-4 h-4" />
							Upload File
						</button>
					</li>
					<li>
						<button type="button" className="flex items-center w-full" onClick={uploadFolder}>
							<FolderUp className="mr-2 w-4 h-4" />
							Upload Folder
						</button>
					</li>
				</ul>
			</div>
			<div>
				{selectedIds.length > 0 && (
					<span className="ml-4 text-xs font-semibold text-base-400">{selectedIds.length} selected</span>
				)}
			</div>
		</div>
	);
};
