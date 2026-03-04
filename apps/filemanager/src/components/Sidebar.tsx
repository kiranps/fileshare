import React from "react";
import type { SidebarShortcut } from "../types";
import { useFileManagerStore } from "../store/useFileManagerStore";
import { Home, FileText, Music, Film, Image } from "lucide-react";

// Dummy shortcuts for sidebar
const shortcuts: SidebarShortcut[] = [
  { label: "Home", icon: <Home size={20} />, path: ["Home"] },
  { label: "Documents", icon: <FileText size={20} />, path: ["Documents"] },
  { label: "Music", icon: <Music size={20} />, path: ["Music"] },
  { label: "Movies", icon: <Film size={20} />, path: ["Movies"] },
  { label: "Pictures", icon: <Image size={20} />, path: ["Pictures"] },
];

export const Sidebar: React.FC = () => {
  const selectedShortcut = useFileManagerStore((s) => s.selectedShortcut);
  const setSelectedShortcut = useFileManagerStore((s) => s.setSelectedShortcut);
  const setBreadcrumb = useFileManagerStore((s) => s.setBreadcrumb);
  const setSelectedId = useFileManagerStore((s) => s.setSelectedId);
  const setSearchValue = useFileManagerStore((s) => s.setSearchValue);

  const handleShortcutClick = (path: string[]) => {
    setSelectedShortcut(path[0]);
    setBreadcrumb([
      {
        label: path[0],
        path,
        icon: shortcuts.find((sc) => sc.label === path[0])?.icon,
      },
    ]);
    setSelectedId(null);
    setSearchValue("");
  };

  return (
    <aside
      className="w-56 bg-base-200 p-4 flex flex-col gap-2 border-r border-base-300 h-full min-w-[3.5rem]"
      aria-label="Sidebar with shortcuts, favorites"
    >
      <h2 className="text-sm font-semibold uppercase mb-2 text-base-content/70 pl-1 tracking-wide">
        Places
      </h2>
      <ul className="menu bg-base-200 w-full p-0 flex-1 overflow-auto">
        {shortcuts.map((sc) => (
          <li key={sc.label}>
            <a
              className={`flex items-center gap-2 px-0 py-2 font-medium text-base-content ${selectedShortcut === sc.label ? "active" : "hover:bg-base-300 hover:text-primary-content"}`}
              aria-current={selectedShortcut === sc.label ? "page" : undefined}
              tabIndex={0}
              onClick={(e) => {
                e.preventDefault();
                handleShortcutClick(sc.path);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleShortcutClick(sc.path);
                }
              }}
              role="menuitem"
            >
              {sc.icon}
              <span className="flex-1 text-left">{sc.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
};
