import React from "react";
import type { FileItemProps } from "./FileItem";
import { FileItem } from "./FileItem";

export type FileListProps = {
  files: FileItemProps[];
  selectedId: string | null;
  onItemClick: (id: string) => void;
  onItemDoubleClick?: (id: string) => void;
};

export const FileList: React.FC<FileListProps> = ({ files, selectedId, onItemClick, onItemDoubleClick }) => (
  <table className="table w-full">
    <thead className="bg-base-200">
      <tr>
        <th></th>
        <th>Name</th>
        <th>Type</th>
        <th>Size</th>
        <th>Modified</th>
      </tr>
    </thead>
    <tbody>
      {files.map(file => (
        <FileItem
          key={file.id}
          {...file}
          selected={selectedId === file.id}
          onClick={() => onItemClick(file.id)}
          onDoubleClick={() => onItemDoubleClick?.(file.id)}
        />
      ))}
    </tbody>
  </table>
);
