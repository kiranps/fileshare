import { format } from "date-fns";
import type { FC } from "react";
import type { FileItemProps } from "../types";
import { humanFileSize } from "../utils/webdav_files";
import { icons } from "../utils/webdav_files";

function urlDecodeSafe(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

export const fileSelectedClass =
	"bg-base-200 text-primary-content shadow-[inset_1px_0_0_rgb(218,220,224),inset_-1px_0_0_rgb(218,220,224)]";
export const fileHoverWhenNotSelected =
	"hover:shadow-[inset_1px_0_0_rgb(218,220,224),inset_-1px_0_0_rgb(218,220,224),0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)]";

export const FileItem: FC<
	FileItemProps & {
		selected: boolean;
		onClick?: (e: React.MouseEvent<HTMLTableRowElement>) => void;
		onDoubleClick?: () => void;
		onRightClick?: (e: React.MouseEvent<HTMLTableRowElement>) => void;
	}
> = ({ name, size, modified, type, selected, onClick, onDoubleClick, onRightClick }) => (
	<tr
		tabIndex={0}
		className={`cursor-pointer outline-none ${selected ? fileSelectedClass : fileHoverWhenNotSelected}`}
		onClick={onClick}
		onDoubleClick={onDoubleClick}
		onContextMenu={onRightClick}
	>
		<td className="w-12 text-center">{icons[type]}</td>
		<td className="font-medium">{urlDecodeSafe(name)}</td>
		<td className="text-right">{size ? humanFileSize(size) : "-"}</td>
		<td>{modified ? format(modified, "yyyy-MM-dd HH:mm:ss") : "-"}</td>
	</tr>
);
