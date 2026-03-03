import React, { useState } from "react";
import { Sidebar } from "./Sidebar";
import type { SidebarShortcut } from "./Sidebar";
import { Navbar } from "./Navbar";
import type { BreadcrumbSegment } from "./Navbar";
import { FileList } from "./FileList";
import type { FileItemProps } from "./FileItem";
import { Home, Folder, FileText, Music, Film, Image } from "lucide-react";

// Dummy shortcuts for sidebar
const sidebarShortcuts: SidebarShortcut[] = [
  { label: "Home", icon: <Home size={20} />, path: ["Home"] },
  { label: "Documents", icon: <FileText size={20} />, path: ["Documents"] },
  { label: "Music", icon: <Music size={20} />, path: ["Music"] },
  { label: "Movies", icon: <Film size={20} />, path: ["Movies"] },
  { label: "Pictures", icon: <Image size={20} />, path: ["Pictures"] },
];

// Dummy breadcrumb for navbar
const initialBreadcrumb: BreadcrumbSegment[] = [
  { label: "Home", path: ["Home"], icon: <Home size={16} /> },
];

// Dummy files for file list
const dummyFiles: FileItemProps[] = [
  {
    id: "1",
    name: "Resume.pdf",
    type: "PDF",
    size: "50 KB",
    modified: "2026-03-03",
    icon: <FileText size={18} />,
    selected: false,
    onClick: () => {},
  },
  {
    id: "2",
    name: "Vacation.jpg",
    type: "Image",
    size: "2 MB",
    modified: "2026-02-28",
    icon: <Image size={18} />,
    selected: false,
    onClick: () => {},
  },
  {
    id: "3",
    name: "Notes.txt",
    type: "Text",
    size: "6 KB",
    modified: "2026-02-15",
    icon: <FileText size={18} />,
    selected: false,
    onClick: () => {},
  },
  {
    id: "4",
    name: "Project", // Folder
    type: "Folder",
    size: "-",
    modified: "2026-02-10",
    icon: <Folder size={18} />,
    selected: false,
    onClick: () => {},
  },
];

export const FileManager: React.FC = () => {
  const [selectedShortcut, setSelectedShortcut] = useState(sidebarShortcuts[0].label);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbSegment[]>(initialBreadcrumb);
  const [searchValue, setSearchValue] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Dummy control states for navbar
  const canGoBack = false, canGoForward = false, canGoUp = false;

  const handleShortcutClick = (path: string[]) => {
    setSelectedShortcut(path[0]);
    setBreadcrumb([{ label: path[0], path, icon: sidebarShortcuts.find(sc => sc.label === path[0])?.icon }]);
    setSelectedId(null);
    setSearchValue("");
  };

  const handleBreadcrumbClick = (path: string[]) => {
    setBreadcrumb([{ label: path[0], path, icon: sidebarShortcuts.find(sc => sc.label === path[0])?.icon }]);
  };

  const handleSearchChange = (value: string) => setSearchValue(value);

  const filteredFiles = searchValue
    ? dummyFiles.filter(f => f.name.toLowerCase().includes(searchValue.toLowerCase()))
    : dummyFiles;

  const handleItemClick = (id: string) => setSelectedId(id);

  return (
    <div className="flex flex-col h-screen bg-base-100">
      {/* Navbar always on top */}
      <Navbar
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        canGoUp={canGoUp}
        onBack={() => {}}
        onForward={() => {}}
        onUp={() => {}}
        onRefresh={() => {}}
        breadcrumb={breadcrumb}
        onBreadcrumbClick={handleBreadcrumbClick}
        searchValue={searchValue}
        onSearchChange={handleSearchChange}
      />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar collapses to icons on small screens */}
        <Sidebar
          shortcuts={sidebarShortcuts}
          selectedShortcut={selectedShortcut}
          onShortcutClick={handleShortcutClick}
        />
        <main className="flex-1 p-2 overflow-auto">
          <FileList
            files={filteredFiles.map(f => ({ ...f, selected: f.id === selectedId, onClick: () => handleItemClick(f.id) }))}
            selectedId={selectedId}
            onItemClick={handleItemClick}
          />
        </main>
      </div>
    </div>
  );
};
