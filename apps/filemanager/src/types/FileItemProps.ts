export type FileType = "folder" | "image" | "music" | "video" | "pdf" | "text" | "file";

export type FileItemProps = {
	id: string;
	name: string;
	type: FileType;
	size?: number;
	modified: Date;
};
