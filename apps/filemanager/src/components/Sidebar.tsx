import React from "react";
import type { SidebarShortcut } from "../types";


export type SidebarProps = {
  shortcuts: SidebarShortcut[];
  selectedShortcut: string;
  onShortcutClick: (path: string[]) => void;
};

export const Sidebar: React.FC<SidebarProps> = ({
  shortcuts,
  selectedShortcut,
  onShortcutClick,
}) => {
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
                onShortcutClick(sc.path);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onShortcutClick(sc.path);
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
