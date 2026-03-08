import { Folder, FileText, Music, Film, Image } from "lucide-react";
import type { FileItemProps } from "../types";
import type { JSX } from "react/jsx-runtime";

const ICON_SIZE = 18;
const icons = {
  folder: <Folder size={ICON_SIZE} />,
  file: <FileText size={ICON_SIZE} />,
  pdf: <FileText size={ICON_SIZE} />,
  image: <Image size={ICON_SIZE} />,
  music: <Music size={ICON_SIZE} />,
  film: <Film size={ICON_SIZE} />,
};

export function filesFromWebDAV(
  data: Array<{
    href: string;
    displayName: string;
    contentType: string;
    contentLength?: number;
    isCollection: boolean;
    lastModified: Date;
    raw: unknown;
  }>,
  selectedId: string | null,
  handleItemClick: (id: string) => void,
  handleItemDoubleClick?: (id: string) => void,
): { activeDirectory: FileItemProps; files: FileItemProps[] } {
  // Icon helpers
  function getIcon(contentType: string, isCollection: boolean): JSX.Element {
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
    const i = Math.floor(Math.log(size) / Math.log(1024));
    const rounded = (size / Math.pow(1024, i)).toFixed(1);
    const units = ["B", "KB", "MB", "GB", "TB"];
    return `${rounded} ${units[i]}`;
  }
  function basename(href: string): string {
    const segments = href.split(/\/+|^@/).filter(Boolean);
    return segments.length > 0
      ? decodeURIComponent(segments[segments.length - 1])
      : href;
  }

  const EXT_IMAGE = ["jpg", "jpeg", "png", "gif", "bmp", "webp"];
  const EXT_MUSIC = ["mp3", "wav", "ogg"];
  const EXT_VIDEO = ["mp4", "avi", "mkv", "mov"];
  const EXT_PDF = ["pdf"];
  const EXT_TEXT = ["txt", "md", "rtf"];

  const items: FileItemProps[] = data
    .filter((entry) => entry.href && basename(entry.href) !== "")
    .map((entry) => {
      const name = entry.displayName || basename(entry.href);
      const ext =
        !entry.isCollection && name.includes(".")
          ? (name.split(".").pop()?.toLowerCase() ?? "")
          : "";

      let type = entry.isCollection ? "Folder" : entry.contentType || "File";
      if (!entry.isCollection && ext) {
        if (EXT_IMAGE.includes(ext)) type = "Image";
        else if (EXT_MUSIC.includes(ext)) type = "Music";
        else if (EXT_VIDEO.includes(ext)) type = "Video";
        else if (EXT_PDF.includes(ext)) type = "PDF";
        else if (EXT_TEXT.includes(ext)) type = "Text";
      }

      return {
        id: entry.href,
        name,
        type,
        size: entry.isCollection ? "-" : humanFileSize(entry.contentLength),
        modified: entry.lastModified,
        icon: getIcon(
          entry.contentType || type.toLowerCase(),
          entry.isCollection,
        ),
        selected: entry.href === selectedId,
        onClick: () => handleItemClick(entry.href),
        onDoubleClick:
          entry.isCollection && typeof handleItemDoubleClick === "function"
            ? () => handleItemDoubleClick(entry.href)
            : undefined,
      };
    });

  const [activeDirectory, ...files] = items;
  return { activeDirectory, files };
}
