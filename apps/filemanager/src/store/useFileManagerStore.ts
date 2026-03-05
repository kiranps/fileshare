import { create } from "zustand";

interface FileManagerState {
  activePath: string;
  selectedId: string | null;
  showHiddleFiles: boolean;
  setActivePath: (path: string) => void;
  setSelectedId: (id: string | null) => void;
}

export const useFileManagerStore = create<FileManagerState>((set) => ({
  activePath: "/",
  showHiddleFiles: false,
  selectedId: null,
  setActivePath: (path) => set({ activePath: path }),
  setSelectedId: (id) => set({ selectedId: id }),
}));
