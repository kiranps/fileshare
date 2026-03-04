import { create } from "zustand";
import type { BreadcrumbSegment, FileItemProps } from "../types";

interface FileManagerState {
  activePath: string;
  files: FileItemProps[];
  selectedId: string | null;
  searchValue: string;
  setActivePath: (path: string) => void;
  setFiles: (files: FileItemProps[]) => void;
  setSelectedId: (id: string | null) => void;
  setSearchValue: (search: string) => void;
}

export const useFileManagerStore = create<FileManagerState>((set) => ({
  activePath: "/",
  files: [],
  selectedId: null,
  searchValue: "",
  setActivePath: (path) => set({ activePath: path }),
  setFiles: (files) => set({ files }),
  setSelectedId: (id) => set({ selectedId: id }),
  setSearchValue: (search) => set({ searchValue: search }),
}));
