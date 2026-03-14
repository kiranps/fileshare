import { FileText, Film, Home, Image, Music } from "lucide-react";
import type { FC } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { SidebarShortcut } from "../types";

const shortcuts: SidebarShortcut[] = [
	{ label: "Home", icon: <Home size={20} aria-hidden="true" />, path: ["/"] },
	{ label: "Documents", icon: <FileText size={20} aria-hidden="true" />, path: ["/Documents"] },
	{ label: "Music", icon: <Music size={20} aria-hidden="true" />, path: ["/Music"] },
	{ label: "Movies", icon: <Film size={20} aria-hidden="true" />, path: ["/Movies"] },
	{ label: "Pictures", icon: <Image size={20} aria-hidden="true" />, path: ["/Pictures"] },
];

export const Sidebar: FC = () => {
	const navigate = useNavigate();
	const location = useLocation();

	return (
		<aside
			className="w-56 bg-base-200 p-4 flex flex-col gap-2  h-full min-w-[3.5rem]"
			aria-label="Sidebar with shortcuts, favorites"
		>
			<h2 className="text-sm font-semibold uppercase mb-2 text-base-content/70 pl-1 tracking-wide">Places</h2>
			<ul className="menu bg-base-200 w-full p-0 flex-1 overflow-auto">
				{shortcuts.map((sc) => {
					const path = sc.path[0];
					const isActive = location.pathname === path;
					return (
						<li key={sc.label}>
							<button
								type="button"
								className={`flex items-center gap-2 px-2 py-2 w-full font-medium text-base-content rounded ${isActive ? "active" : "hover:bg-base-300 hover:text-primary-content"}`}
								aria-current={isActive ? "page" : undefined}
								onClick={() => navigate(path)}
							>
								{sc.icon}
								<span className="flex-1 text-left">{sc.label}</span>
							</button>
						</li>
					);
				})}
			</ul>
		</aside>
	);
};
