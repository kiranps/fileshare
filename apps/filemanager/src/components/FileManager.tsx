import React from "react";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";
import { FileList } from "./FileList";
import { Home } from "lucide-react";
import { useWebDAVPropfind } from "../hooks/useWebDAVPropfind";
import { filesFromWebDAV } from "../utils/webdav_files";
import { useFileManagerStore } from "../store/useFileManagerStore";

export const FileManager: React.FC = () => {
  const {
    activePath,
    setActivePath,
    setBreadcrumb,
    selectedId,
    setSelectedId,
  } = useFileManagerStore();
  const canGoBack = false,
    canGoForward = false;

  const handleItemClick = (id: string) => setSelectedId(id);
  const { data, isLoading, error } = useWebDAVPropfind(activePath);

  // Map and filter WebDAV data to FileItemProps
  const webdavFiles = data
    ? filesFromWebDAV(data, selectedId, handleItemClick)
    : [];

  return (
    <div className="flex flex-col h-screen bg-base-100">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Navbar
            canGoBack={canGoBack}
            canGoForward={canGoForward}
            onBack={() => {}}
            onForward={() => {}}
            onRefresh={() => {}}
          />
          {isLoading ? (
            <div className="p-8 text-center text-lg text-base-content/50">
              Loading files...
            </div>
          ) : error ? (
            <div className="p-8 text-center text-lg text-error">
              Error loading files.
            </div>
          ) : (
            <FileList
              files={webdavFiles}
              onItemDoubleClick={(id) => {
                const isFolder =
                  webdavFiles.find((f) => f.id === id)?.type === "Folder";
                if (isFolder) {
                  setActivePath(id);
                  setSelectedId(null);
                  useFileManagerStore.getState().setSearchValue("");
                  const segments = id.split(/\/+|\0/).filter(Boolean);
                  const label = segments.length
                    ? decodeURIComponent(segments[segments.length - 1])
                    : id;
                  setBreadcrumb([
                    { label, path: [label], icon: <Home size={16} /> },
                  ]);
                }
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
};
