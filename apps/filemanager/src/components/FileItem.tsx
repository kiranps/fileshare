import { format } from "date-fns";
import type { FC } from "react";
import type { FileItemProps } from "../types";
import { humanFileSize } from "../utils/webdav_files";

function urlDecodeSafe(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

export const FileItem: FC<
	FileItemProps & {
		onClick?: (e: React.MouseEvent<HTMLTableRowElement>) => void;
		onDoubleClick?: () => void;
		onRightClick?: (e: React.MouseEvent<HTMLTableRowElement>) => void;
	}
> = ({ name, size, modified, icon, selected, onClick, onDoubleClick, onRightClick }) => (
	<tr
		tabIndex={0}
		className={`cursor-pointer outline-none ${selected ? "bg-primary text-primary-content" : "hover:bg-base-200"}`}
		onClick={onClick}
		onDoubleClick={onDoubleClick}
		onContextMenu={onRightClick}
	>
		<td className="w-12 text-center">{icon}</td>
		<td className="font-medium">{urlDecodeSafe(name)}</td>
		<td className="text-right">{humanFileSize(size) ?? "-"}</td>
		<td>{modified ? format(modified, "yyyy-MM-dd HH:mm:ss") : "-"}</td>
	</tr>
);
