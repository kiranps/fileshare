import React from "react";
import { ArrowLeft, ArrowRight, ArrowUp, RefreshCcw, Search } from "lucide-react";
import type { JSX } from "react/jsx-runtime";

export type BreadcrumbSegment = {
  label: string;
  path: string[];
  icon?: JSX.Element;
};

export type NavbarProps = {
  canGoBack: boolean;
  canGoForward: boolean;
  canGoUp: boolean;
  onBack: () => void;
  onForward: () => void;
  onUp: () => void;
  onRefresh: () => void;
  breadcrumb: BreadcrumbSegment[];
  onBreadcrumbClick: (path: string[]) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
};

export const Navbar: React.FC<NavbarProps> = ({
  canGoBack,
  canGoForward,
  canGoUp,
  onBack,
  onForward,
  onUp,
  onRefresh,
  breadcrumb,
  onBreadcrumbClick,
  searchValue,
  onSearchChange,
}) => (
  <nav className="flex items-center px-4 py-2 bg-base-100 border-b gap-2 shadow-sm" aria-label="File navigation">
    <button onClick={onBack} disabled={!canGoBack} aria-label="Back" className="btn btn-sm btn-ghost text-base-content hover:bg-base-200 focus:ring-primary"><ArrowLeft size={18} /></button>
    <button onClick={onForward} disabled={!canGoForward} aria-label="Forward" className="btn btn-sm btn-ghost text-base-content hover:bg-base-200 focus:ring-primary"><ArrowRight size={18} /></button>
    <button onClick={onUp} disabled={!canGoUp} aria-label="Up" className="btn btn-sm btn-ghost text-base-content hover:bg-base-200 focus:ring-primary"><ArrowUp size={18} /></button>
    <button onClick={onRefresh} aria-label="Refresh" className="btn btn-sm btn-ghost text-base-content hover:bg-base-200 focus:ring-primary"><RefreshCcw size={18} /></button>
    <div className="flex-1">
      <nav className="breadcrumbs text-sm" aria-label="Breadcrumb">
        {breadcrumb.map((seg, i) => (
          <span key={i} onClick={() => onBreadcrumbClick(seg.path)} className="cursor-pointer flex items-center gap-1 px-1 text-base-content hover:text-primary">
            {seg.icon} <span>{seg.label}</span>
          </span>
        ))}
      </nav>
    </div>
    <label className="input input-sm flex items-center gap-1 max-w-xs rounded bg-base-200 text-base-content">
      <Search size={16} />
      <input
        type="text"
        aria-label="Search files/folders"
        placeholder="Search"
        value={searchValue}
        onChange={e => onSearchChange(e.target.value)}
        className="bg-transparent outline-none w-full text-base-content"
      />
    </label>
  </nav>
);
