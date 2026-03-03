import React from "react";
import { ChevronRight } from "lucide-react";
import type { JSX } from "react/jsx-runtime";

export type SidebarShortcut = {
  label: string;
  icon: JSX.Element;
  path: string[];
};

export type SidebarProps = {
  shortcuts: SidebarShortcut[];
  selectedShortcut: string;
  onShortcutClick: (path: string[]) => void;
};

export const Sidebar: React.FC<SidebarProps> = ({ shortcuts, selectedShortcut, onShortcutClick }) => {
  return (
    <aside className="w-56 bg-base-200 p-4 flex flex-col gap-2 border-r">
      {shortcuts.map(sc => (
        <button
          key={sc.label}
          className={`flex items-center gap-2 px-3 py-2 rounded hover:bg-base-300 transition ${selectedShortcut === sc.label ? "bg-primary text-primary-content" : "text-base-content"}`}
          onClick={() => onShortcutClick(sc.path)}
        >
          {sc.icon}
          <span>{sc.label}</span>
          <ChevronRight className="ml-auto" size={16} />
        </button>
      ))}
    </aside>
  );
}
