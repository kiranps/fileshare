import type { JSX } from "react/jsx-runtime";

export type FileType = "Folder" | "Image" | "Music" | "Video" | "PDF" | "Text" | "File";

export type FileItemProps = {
  id: string;
  name: string;
  type: FileType | string;
  size?: string;
  modified: Date;
  icon: JSX.Element;
  selected: boolean;
  onClick?: (e: React.MouseEvent<HTMLTableRowElement>) => void;
  onDoubleClick?: () => void;
};
