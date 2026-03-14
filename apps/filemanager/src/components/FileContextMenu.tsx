import type { FC } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface ContextMenuAction {
	label: string;
	value: string;
	disabled?: boolean;
}

interface FileContextMenuProps {
	x: number;
	y: number;
	actions: ContextMenuAction[];
	visible: boolean;
	onAction: (action: string) => void;
	onClose: () => void;
}

/** Repositions a menu to stay within the viewport bounds. */
function clampToViewport(x: number, y: number, width: number, height: number) {
	const buffer = 8;
	return {
		left: Math.max(buffer, Math.min(x, window.innerWidth - width - buffer)),
		top: Math.max(buffer, Math.min(y, window.innerHeight - height - buffer)),
	};
}

export const FileContextMenu: FC<FileContextMenuProps> = ({ x, y, actions, visible, onAction, onClose }) => {
	const menuRef = useRef<HTMLUListElement>(null);
	const [position, setPosition] = useState({ left: x, top: y });

	// Adjust position once the menu is rendered so we know its dimensions.
	useEffect(() => {
		if (visible && menuRef.current) {
			const { offsetWidth, offsetHeight } = menuRef.current;
			setPosition(clampToViewport(x, y, offsetWidth, offsetHeight));
		}
	}, [visible, x, y]);

	// Dismiss on outside click.
	useEffect(() => {
		if (!visible) return;
		const handleMouseDown = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				onClose();
			}
		};
		document.addEventListener("mousedown", handleMouseDown);
		return () => document.removeEventListener("mousedown", handleMouseDown);
	}, [visible, onClose]);

	if (!visible) return null;

	return createPortal(
		<ul
			ref={menuRef}
			style={{
				left: position.left,
				top: position.top,
				zIndex: 5000,
				minWidth: 140,
				position: "fixed",
			}}
			className="menu bg-base-100 px-0 border border-base-300 shadow"
		>
			{actions.map((action) => (
				<li key={action.value}>
					<button
						type="button"
						className={`px-4 py-2 w-full text-left hover:bg-base-200 ${
							action.disabled ? "pointer-events-none text-gray-400" : ""
						}`}
						onClick={(e) => {
							e.stopPropagation();
							onAction(action.value);
						}}
						disabled={action.disabled}
					>
						{action.label}
					</button>
				</li>
			))}
		</ul>,
		document.body,
	);
};
