import type { FC } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useWebDAVPropfind } from "../hooks/useWebDAVPropfind";
import { filesFromWebDAV } from "../utils/webdav_files";

const canonicalSidebarFolders = [
	"desktop",
	"documents",
	"downloads",
	"music",
	"pictures",
	"videos",
	"templates",
	"public",
	"movies",
	"favorites",
];

export const Sidebar: FC = () => {
	const navigate = useNavigate();
	const location = useLocation();

	const { data } = useWebDAVPropfind("/");
	const filteredFolders = filesFromWebDAV(data ?? []).files.filter(
		(f) => f.type === "Folder" && canonicalSidebarFolders.includes(f.name.toLowerCase()) && !f.name.startsWith("."),
	);
	filteredFolders.sort((a, b) => {
		return (
			canonicalSidebarFolders.indexOf(a.name.toLowerCase()) - canonicalSidebarFolders.indexOf(b.name.toLowerCase())
		);
	});

	function capitalize(label: string): string {
		return label.charAt(0).toUpperCase() + label.slice(1);
	}

	return (
		<aside className="w-56 bg-base-200 pl-4 flex flex-col gap-2 h-full min-w-[3.5rem]">
			<h2 className="text-xs font-semibold uppercase mb-2 mt-6 text-base-content/70 pl-1 tracking-wide">Places</h2>
			<ul className="menu bg-base-200 w-full p-0">
				{/* Always show Home entry first */}
				<li key="/">
					<button
						type="button"
						className={`flex items-center gap-2 px-2 py-2 w-full font-medium rounded text-base-content hover:bg-base-300 hover:text-primary-content ${location.pathname === "/" ? "active" : ""}`}
						aria-current={location.pathname === "/" ? "page" : undefined}
						onClick={() => navigate("/")}
					>
						<span className="flex-1 text-left">Home</span>
					</button>
				</li>
				{filteredFolders.map((item) => {
					const label = capitalize(item.name);
					const folderPath = "/" + label;
					const isActive = location.pathname === folderPath;
					return (
						<li key={folderPath}>
							<button
								type="button"
								className={`flex items-center gap-2 px-2 py-2 w-full font-medium rounded text-base-content hover:bg-base-300 hover:text-primary-content ${isActive ? "active" : ""}`}
								aria-current={isActive ? "page" : undefined}
								onClick={() => navigate(folderPath)}
							>
								<span className="flex-1 text-left">{label}</span>
							</button>
						</li>
					);
				})}
			</ul>
		</aside>
	);
};
