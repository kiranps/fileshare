import type { FC } from "react";
import { useWebDAVPropfind } from "../hooks/useWebDAVPropfind";
import { useFileManagerStore } from "../store/useFileManagerStore";
import { filesFromWebDAV } from "../utils/webdav_files";
import { FileList } from "./FileList";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";

export const FileManager: FC = () => {
	const { activePath } = useFileManagerStore();
	const { data, isLoading, error } = useWebDAVPropfind(activePath);

	const files = data ? filesFromWebDAV(data).files.filter((f) => !f.name.startsWith(".")) : [];

	return (
		<div className="flex flex-col h-screen bg-base-100">
			<div className="flex flex-1 overflow-hidden">
				<Sidebar />
				<main className="flex-1 overflow-auto">
					<Navbar />
					{isLoading ? (
						<div className="p-8 text-center text-lg text-base-content/50">Loading files...</div>
					) : error ? (
						<div className="p-8 text-center text-lg text-error">Error loading files.</div>
					) : (
						<FileList files={files} />
					)}
				</main>
			</div>
		</div>
	);
};
