import type { JSX } from "react/jsx-runtime";

export type FileType = "folder" | "image" | "music" | "video" | "pdf" | "text" | "file";

export type FileItemProps = {
	id: string;
	name: string;
	type: FileType;
	size?: number;
	modified: Date;
	//selected: boolean;
	//onClick?: (e: React.MouseEvent<HTMLTableRowElement>) => void;
	//onDoubleClick?: () => void;
};
