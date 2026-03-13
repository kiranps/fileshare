import { FileText, Film, Folder, Image, Music } from "lucide-react";
import type { WebDAVEntry } from "../api/webdav";
import type { FileItemProps } from "../types";
import { basename } from "../utils/files";

const ICON_SIZE = 18;

const icons = {
	folder: <Folder size={ICON_SIZE} />,
	file: <FileText size={ICON_SIZE} />,
	pdf: <FileText size={ICON_SIZE} />,
	image: <Image size={ICON_SIZE} />,
	music: <Music size={ICON_SIZE} />,
	film: <Film size={ICON_SIZE} />,
};

const EXT_IMAGE = new Set(["jpg", "jpeg", "png", "gif", "bmp", "webp"]);
const EXT_MUSIC = new Set(["mp3", "wav", "ogg"]);
const EXT_VIDEO = new Set(["mp4", "avi", "mkv", "mov"]);
const EXT_PDF = new Set(["pdf"]);
const EXT_TEXT = new Set(["txt", "md", "rtf"]);

function getIcon(contentType: string, isCollection: boolean) {
	if (isCollection) return icons.folder;
	if (contentType.startsWith("image")) return icons.image;
	if (contentType.startsWith("audio")) return icons.music;
	if (contentType.startsWith("video")) return icons.film;
	if (contentType === "application/pdf") return icons.pdf;
	return icons.file;
}

function humanFileSize(size?: number): string {
	if (typeof size !== "number" || size < 0) return "-";
	if (size === 0) return "0 B";
	const units = ["B", "KB", "MB", "GB", "TB", "PB"] as const;
	const i = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
	const rounded = (size / 1024 ** i).toFixed(1);
	return `${rounded} ${units[i]}`;
}

function resolveFileType(contentType: string, ext: string, isCollection: boolean): string {
	if (isCollection) return "Folder";
	if (ext) {
		if (EXT_IMAGE.has(ext)) return "Image";
		if (EXT_MUSIC.has(ext)) return "Music";
		if (EXT_VIDEO.has(ext)) return "Video";
		if (EXT_PDF.has(ext)) return "PDF";
		if (EXT_TEXT.has(ext)) return "Text";
	}
	return contentType || "File";
}

/**
 * Maps a WebDAV PROPFIND response to `FileItemProps` for rendering.
 * The first entry in the response is the directory itself and is excluded
 * from the returned `files` array.
 */
export function filesFromWebDAV(data: WebDAVEntry[]): {
	activeDirectory: FileItemProps | undefined;
	files: FileItemProps[];
} {
	const items: FileItemProps[] = data
		.filter((entry) => entry.href)
		.map((entry) => {
			const name = entry.displayName ?? basename(entry.href);
			const ext = !entry.isCollection && name.includes(".") ? (name.split(".").pop()?.toLowerCase() ?? "") : "";
			const contentType = entry.contentType ?? "";
			const type = resolveFileType(contentType, ext, entry.isCollection);

			return {
				id: entry.href,
				name,
				type,
				size: entry.isCollection ? "-" : humanFileSize(entry.contentLength),
				modified: entry.lastModified ?? new Date(0),
				icon: getIcon(contentType || type.toLowerCase(), entry.isCollection),
				selected: false,
			};
		});

	const [activeDirectory, ...files] = items;
	return { activeDirectory, files };
}
