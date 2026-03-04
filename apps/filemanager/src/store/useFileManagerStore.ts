import { create } from 'zustand'
import type { SidebarShortcut, BreadcrumbSegment, FileItemProps } from '../types'

interface FileManagerState {
  shortcuts: SidebarShortcut[];
  selectedShortcut: string;
  breadcrumb: BreadcrumbSegment[];
  files: FileItemProps[];
  selectedId: string | null;
  searchValue: string;
  setSelectedShortcut: (label: string) => void;
  setBreadcrumb: (breadcrumb: BreadcrumbSegment[]) => void;
  setFiles: (files: FileItemProps[]) => void;
  setSelectedId: (id: string | null) => void;
  setSearchValue: (search: string) => void;
}

export const useFileManagerStore = create<FileManagerState>((set) => ({
  shortcuts: [],
  selectedShortcut: '',
  breadcrumb: [],
  files: [],
  selectedId: null,
  searchValue: '',
  setSelectedShortcut: (label) => set({ selectedShortcut: label }),
  setBreadcrumb: (crumbs) => set({ breadcrumb: crumbs }),
  setFiles: (files) => set({ files }),
  setSelectedId: (id) => set({ selectedId: id }),
  setSearchValue: (search) => set({ searchValue: search }),
}))
