import { ActionBar } from "@components/ActionBar";
import { FileList } from "@components/FileList";
import { Navbar } from "@components/Navbar";
import { Sidebar } from "@components/Sidebar";
import { useFiles } from "@hooks/useFileSystem";
import { useFileManagerStore } from "@store/useFileManagerStore";
import type { FC } from "react";
import { useEffect } from "react";
import { FileActionsProvider } from "../contexts/FileActionsContext";

export const FileManager: FC = () => {
	const activePath = useFileManagerStore((s) => s.activePath);
	const setFiles = useFileManagerStore((s) => s.setFiles);
	const { data, isLoading, error } = useFiles(activePath);
	console.log("files");
	console.log(data);

	// Push the fetched (and filtered) files into the global store so that the
	// sort/selection slices always work on the current file list.
	const showHiddenFiles = useFileManagerStore((s) => s.showHiddenFiles);

	useEffect(() => {
		let files = data ? data.files : [];
		if (!showHiddenFiles) {
			files = files.filter((f) => !f.name.startsWith("."));
		}
		setFiles(files);
	}, [data, showHiddenFiles]);

	return (
		<FileActionsProvider>
			<div className="flex flex-col h-screen bg-base-100">
				<div className="flex flex-1 overflow-hidden">
					<Sidebar />
					<main className="flex-1 overflow-auto">
						<Navbar />
						<div style={{ height: 48 }} />
						{isLoading ? (
							<div className="p-8 text-center text-lg text-base-content/50">Loading files...</div>
						) : error ? (
							<div className="p-8 text-center text-lg text-error">Error loading files.</div>
						) : (
							<>
								<ActionBar />
								<FileList />
							</>
						)}
					</main>
				</div>
			</div>
		</FileActionsProvider>
	);
};
