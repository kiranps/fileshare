import React from "react";

import type { JSX } from "react/jsx-runtime";

export type FileItemProps = {
  id: string; // intentionally unused in UI shell phase
  name: string;
  type: string;
  size?: string;
  modified?: string;
  icon: JSX.Element;
  selected: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
};

export const FileItem: React.FC<FileItemProps> = ({
  id, name, type, size, modified, icon, selected, onClick, onDoubleClick
}) => (
  <tr
    className={`cursor-pointer ${selected ? "bg-primary text-primary-content" : "hover:bg-base-100"}`}
    onClick={onClick}
    onDoubleClick={onDoubleClick}
    tabIndex={0} aria-selected={selected}
  >
    <td>{icon}</td>
    <td className="font-medium">{name}</td>
    <td>{type}</td>
    <td>{size || "-"}</td>
    <td>{modified || "-"}</td>
  </tr>
);
