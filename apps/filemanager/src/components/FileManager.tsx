import React from "react";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";
import { FileList } from "./FileList";
import { useWebDAVPropfind } from "../hooks/useWebDAVPropfind";
import { filesFromWebDAV } from "../utils/webdav_files";
import { useFileManagerStore } from "../store/useFileManagerStore";

export const FileManager: React.FC = () => {
  const { activePath } = useFileManagerStore();

  // FileManager no longer manages selection; FileList manages selection locally via useState
  const handleItemClick = (id: string) => {};
  const { data, isLoading, error } = useWebDAVPropfind(activePath);

  // pass an empty array for selected ids; FileList will manage selection locally
  const webdavFiles = data ? filesFromWebDAV(data, [], () => {}).files : [];

  const files = webdavFiles.filter((x) => !x.name.startsWith("."));

  return (
    <div className="flex flex-col h-screen bg-base-100">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Navbar />
          {isLoading ? (
            <div className="p-8 text-center text-lg text-base-content/50">
              Loading files...
            </div>
          ) : error ? (
            <div className="p-8 text-center text-lg text-error">
              Error loading files.
            </div>
          ) : (
            <FileList files={files} />
          )}
        </main>
      </div>
    </div>
  );
};
