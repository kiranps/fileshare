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
    <aside
      className="w-56 bg-base-200 p-4 flex flex-col gap-2 border-r h-full min-w-[3.5rem] shadow-lg"
      aria-label="Sidebar with shortcuts, favorites"
    >
      <h2 className="text-sm font-semibold uppercase mb-4 text-base-content/70 pl-1 tracking-wide">Shortcuts</h2>
      {shortcuts.map(sc => (
        <button
          key={sc.label}
          className={`flex items-center gap-2 px-3 py-2 rounded font-medium transition duration-150 outline-none focus:ring-2 focus:ring-primary cursor-pointer text-base-content hover:bg-base-300 hover:text-primary-content ${selectedShortcut === sc.label ? "bg-primary text-primary-content shadow" : ""}`}
          aria-current={selectedShortcut === sc.label ? "true" : undefined}
          onClick={() => onShortcutClick(sc.path)}
        >
          {sc.icon}
          <span className="flex-1 text-left">{sc.label}</span>
          <ChevronRight className="ml-auto opacity-50" size={16} />
        </button>
      ))}
    </aside>
  );
}
