import React from "react";
import { ArrowLeft, ArrowRight, RefreshCcw, Search } from "lucide-react";
import { useFileManagerStore } from "../store/useFileManagerStore";

export const Navbar: React.FC<{ canGoBack: boolean; canGoForward: boolean; onBack: () => void; onForward: () => void; onRefresh: () => void }> = ({
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  onRefresh
}) => {
  const breadcrumb = useFileManagerStore((s) => s.breadcrumb);
  const setBreadcrumb = useFileManagerStore((s) => s.setBreadcrumb);
  const searchValue = useFileManagerStore((s) => s.searchValue);
  const setSearchValue = useFileManagerStore((s) => s.setSearchValue);

  const handleBreadcrumbClick = (path: string[]) => {
    // For simplicity, assume clicking a breadcrumb resets to just that segment
    setBreadcrumb([
      breadcrumb.find((seg) => seg.path[0] === path[0]) || breadcrumb[0]
    ]);
  };

  return (
  <nav
    className="flex items-center px-4 py-2 bg-base-100 border-y border-base-300 gap-2"
    aria-label="File navigation"
  >
    <button
      onClick={onBack}
      disabled={!canGoBack}
      aria-label="Back"
      className="btn btn-sm btn-ghost text-base-content hover:bg-base-200 focus:ring-primary"
    >
      <ArrowLeft size={18} />
    </button>
    <button
      onClick={onForward}
      disabled={!canGoForward}
      aria-label="Forward"
      className="btn btn-sm btn-ghost text-base-content hover:bg-base-200 focus:ring-primary"
    >
      <ArrowRight size={18} />
    </button>
    <button
      onClick={onRefresh}
      aria-label="Refresh"
      className="btn btn-sm btn-ghost text-base-content hover:bg-base-200 focus:ring-primary"
    >
      <RefreshCcw size={18} />
    </button>
    <div className="flex-1">
      <nav className="breadcrumbs text-sm" aria-label="Breadcrumb">
        {breadcrumb.map((seg, i) => (
          <span
            key={i}
            onClick={() => handleBreadcrumbClick(seg.path)}
            className="cursor-pointer flex items-center gap-1 px-1 text-base-content hover:text-primary"
          >
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
         onChange={(e) => setSearchValue(e.target.value)}
        className="bg-transparent outline-none w-full text-base-content"
      />
     </label>
   </nav>
  );
};


