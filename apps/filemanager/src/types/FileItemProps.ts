import type { JSX } from "react/jsx-runtime";

export type FileItemProps = {
  id: string;
  name: string;
  type: string;
  size?: string;
  modified: Date;
  icon: JSX.Element;
  selected: boolean;
  onClick?: (e: React.MouseEvent<HTMLTableRowElement, MouseEvent>) => void;
  onDoubleClick?: () => void;
};
