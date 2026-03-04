import React from "react";
import type { FileItemProps } from "../types";
import { FileItem } from "./FileItem";
import { useFileManagerStore } from "../store/useFileManagerStore";

export const FileList: React.FC<{
  files: FileItemProps[];
}> = ({ files }) => {
  const selectedId = useFileManagerStore((s) => s.selectedId);
  const setSelectedId = useFileManagerStore((s) => s.setSelectedId);
  return (
    <div className="overflow-auto">
      <table className="table w-full text-sm">
        <thead className="sticky top-0 z-20">
          <tr>
            <th scope="col" className="w-12 text-center"></th>
            <th scope="col" className="font-semibold">
              Name
            </th>
            <th scope="col">Type</th>
            <th scope="col" className="text-right">
              Size
            </th>
            <th scope="col">Modified</th>
          </tr>
        </thead>
        <tbody>
          {files.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center text-base-content/50 py-8">
                No files or folders found.
              </td>
            </tr>
          ) : (
            files.map((file) => (
              <FileItem
                key={file.id}
                {...file}
                selected={selectedId === file.id}
                onClick={() => setSelectedId(file.id)}
                onDoubleClick={() => {}}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
