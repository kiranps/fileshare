import { create } from "zustand";

interface FileManagerState {
	activePath: string;
	setActivePath: (path: string) => void;
}

export const useFileManagerStore = create<FileManagerState>((set) => ({
	activePath: typeof window !== "undefined" ? window.location.pathname : "/",
	setActivePath: (path) => set({ activePath: path }),
}));
