import type { JSX } from "react/jsx-runtime";

export type FileItemProps = {
  id: string;
  name: string;
  type: string;
  size?: string;
  modified?: string;
  icon: JSX.Element;
  selected: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
};
