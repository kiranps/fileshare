import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, RefreshCcw } from "lucide-react";
import type { FC } from "react";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useFileManagerStore } from "../store/useFileManagerStore";

export const Navbar: FC = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const queryClient = useQueryClient();

	const setActivePath = useFileManagerStore((s) => s.setActivePath);
	const activePath = useFileManagerStore((s) => s.activePath);

	useEffect(() => {
		setActivePath(location.pathname);
	}, [location.pathname, setActivePath]);

	const handleRefresh = () => {
		queryClient.invalidateQueries({ queryKey: ["files"] });
	};

	const segments = activePath
		.replace(/^\/+|\/+$/g, "")
		.split("/")
		.filter(Boolean);

	const breadcrumbData = segments.map((segment, i) => {
		const path = "/" + segments.slice(0, i + 1).join("/");
		return { label: decodeURIComponent(segment), path };
	});

	return (
		<nav
			className="fixed top-0 left-56 right-0 flex items-center px-4 py-2 bg-base-100 border-y border-base-300 gap-2"
			aria-label="File navigation"
		>
			<button
				type="button"
				onClick={() => navigate(-1)}
				aria-label="Back"
				className="btn btn-sm btn-ghost text-base-content hover:bg-base-200 focus:ring-primary"
			>
				<ArrowLeft size={18} aria-hidden="true" />
			</button>
			<button
				type="button"
				onClick={() => navigate(1)}
				aria-label="Forward"
				className="btn btn-sm btn-ghost text-base-content hover:bg-base-200 focus:ring-primary"
			>
				<ArrowRight size={18} aria-hidden="true" />
			</button>
			<button
				type="button"
				onClick={handleRefresh}
				aria-label="Refresh"
				className="btn btn-sm btn-ghost text-base-content hover:bg-base-200 focus:ring-primary"
			>
				<RefreshCcw size={18} aria-hidden="true" />
			</button>
			<div className="flex-1 min-w-0">
				<nav
					className="breadcrumbs text-sm border border-base-300 px-3 bg-base-200 overflow-x-auto"
					aria-label="Breadcrumb"
				>
					<ul className="breadcrumbs py-0">
						<li>
							<button type="button" className="link link-hover" onClick={() => navigate("/")}>
								Home
							</button>
						</li>
						{breadcrumbData.map((seg, idx) => (
							<li key={seg.path}>
								{idx === breadcrumbData.length - 1 ? (
									<span>{seg.label}</span>
								) : (
									<button type="button" className="link link-hover" onClick={() => navigate(seg.path)}>
										{seg.label}
									</button>
								)}
							</li>
						))}
					</ul>
				</nav>
			</div>
		</nav>
	);
};
