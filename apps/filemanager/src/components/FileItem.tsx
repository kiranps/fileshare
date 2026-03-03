import React from "react";
import type { JSX } from "react/jsx-runtime";

export type FileItemProps = {
  id: string; // used as key/id only
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
  name, type, size, modified, icon, selected, onClick, onDoubleClick
}) => (
  <tr
    tabIndex={0} aria-selected={selected}
    className={`cursor-pointer outline-none ${selected ? "bg-primary text-primary-content shadow" : "hover:bg-base-100"}`}
    onClick={onClick}
    onDoubleClick={onDoubleClick}
    role="row"
  >
    <td className="w-12 text-center" role="gridcell">{icon}</td>
    <td className="font-medium" role="gridcell">{name}</td>
    <td role="gridcell">{type}</td>
    <td className="text-right" role="gridcell">{size || "-"}</td>
    <td role="gridcell">{modified || "-"}</td>
  </tr>
);
