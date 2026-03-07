import React from "react";
import { format } from "date-fns";
import type { FileItemProps } from "../types/FileItemProps";

export const FileItem: React.FC<
  FileItemProps & {
    onClick?: () => void;
    onDoubleClick?: () => void;
    onRightClick?: (
      e: React.MouseEvent<HTMLTableRowElement, MouseEvent>,
    ) => void;
  }
> = ({
  name,
  type,
  size,
  modified,
  icon,
  selected,
  onClick,
  onDoubleClick,
  onRightClick,
}) => (
  <tr
    tabIndex={0}
    aria-selected={selected}
    className={`cursor-pointer outline-none ${selected ? "bg-primary text-primary-content hove:none" : "hover:bg-base-200"}`}
    onClick={onClick}
    onDoubleClick={onDoubleClick}
    onContextMenu={onRightClick}
    role="row"
  >
    <td className="w-12 text-center" role="gridcell">
      {icon}
    </td>
    <td className="font-medium" role="gridcell">
      {name}
    </td>
    <td className="text-right" role="gridcell">
      {size || "-"}
    </td>
    <td role="gridcell">
      {modified ? format(modified, "yyyy-MM-dd HH:mm:ss") : "-"}
    </td>
  </tr>
);
