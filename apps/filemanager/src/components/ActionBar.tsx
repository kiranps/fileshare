import { FileUp, FolderUp, FolderPlus, Upload } from "lucide-react";
import type { FC } from "react";

export const ActionBar: FC = () => (
	<div className="sticky z-30 top-14 bg-base-100 flex p-2 items-center px-4 border-b border-base-300">
		<button type="button" className="btn btn-outline btn-sm border-base-300 hover:bg-base-200">
			<FolderPlus className="mr-2 w-4 h-4" />
			New Folder
		</button>
		<div className="dropdown ml-2">
			<button type="button" className="btn btn-outline btn-sm border-base-300 hover:bg-base-200">
				<Upload className="mr-2 w-4 h-4" />
				Upload
			</button>
			<ul tabIndex={-1} className="dropdown-content menu bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm">
				<li>
					<button
						type="button"
						className="flex items-center w-full"
						onClick={(e) => {
							e.preventDefault(); /* Handle file upload */
						}}
					>
						<FileUp className="mr-2 w-4 h-4" />
						Upload File
					</button>
				</li>
				<li>
					<button
						type="button"
						className="flex items-center w-full"
						onClick={(e) => {
							e.preventDefault(); /* Handle folder upload */
						}}
					>
						<FolderUp className="mr-2 w-4 h-4" />
						Upload Folder
					</button>
				</li>
			</ul>
		</div>
	</div>
);
