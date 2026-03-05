import React from "react";
import { ArrowLeft, ArrowRight, RefreshCcw, Search } from "lucide-react";
import { useFileManagerStore } from "../store/useFileManagerStore";

export const Navbar: React.FC = () => {
  const activePath = useFileManagerStore((s) => s.activePath);
  const setActivePath = useFileManagerStore((s) => s.setActivePath);

  // Parse segments from activePath, removing leading/trailing slashes
  const segments = activePath
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean);

  const breadcrumbData = segments.map((segment, i) => {
    const path = "/" + segments.slice(0, i + 1).join("/");
    return { label: segment, path };
  });

  return (
    <nav
      className="flex items-center px-4 py-2 bg-base-100 border-y border-base-300 gap-2"
      aria-label="File navigation"
    >
      <button
        onClick={() => {}}
        aria-label="Back"
        className="btn btn-sm btn-ghost text-base-content hover:bg-base-200 focus:ring-primary"
      >
        <ArrowLeft size={18} />
      </button>
      <button
        onClick={() => {}}
        aria-label="Forward"
        className="btn btn-sm btn-ghost text-base-content hover:bg-base-200 focus:ring-primary"
      >
        <ArrowRight size={18} />
      </button>
      <button
        onClick={() => {}}
        aria-label="Refresh"
        className="btn btn-sm btn-ghost text-base-content hover:bg-base-200 focus:ring-primary"
      >
        <RefreshCcw size={18} />
      </button>
      <div className="flex-1">
        <nav className="breadcrumbs text-sm" aria-label="Breadcrumb">
          <ul className="breadcrumbs">
            <li>
              <a onClick={() => setActivePath("/")}>Home</a>
            </li>
            {breadcrumbData.map((seg, idx) => (
              <li key={seg.path}>
                {idx === breadcrumbData.length - 1 ? (
                  <span>{seg.label}</span>
                ) : (
                  <a onClick={() => setActivePath(seg.path)}>{seg.label}</a>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </nav>
  );
};
