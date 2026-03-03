# File Manager UI Shell — Context

---
## 1. Overview
- UI shell only: No logic, no state wiring, no backend, no filesystem operations.
- Only design/structure phase—components with props/callbacks for actions, but no actual navigation or mutations.
- No routing libraries; future navigation and state will use Zustand (not React Router).
- Uses React, DaisyUI (for UI components/styling), and lucide-react (for all icons).
- All actionable UI elements have interfaces/callback props for actions, but implementation deferred.

---
## 2. Checklist (UI & Interfaces Only)
- [x] React, DaisyUI, lucide-react set as core libraries
- [x] Sidebar present for favorites, shortcuts, and quick links (not a folder tree or browser)
- [x] Navbar: Back, Forward, Up, Refresh, Breadcrumb navigation, Search box
- [x] File list in "Details" style table/list view—not grid
- [x] Table columns: Icon (lucide-react), Name, Type, Size, Modified
- [x] Selectable file rows in FileList
- [ ] No DetailsPanel or modal for file/folder info in this build
- [x] All components expose props/interfaces for actions (no implemented logic yet)
- [ ] Zustand state reserved for future phase
- [x] Integrated DaisyUI responsive layout and basic adaptive styling in FileManager shell.
- [x] context.md maintained for all major decisions, requirements, and evolution

---
## 3. Architectural Decisions & Rationale
- UI shell first: props/interfaces only, designed for easy wiring later
- Sidebar scoped to favorites/shortcuts only (no folder tree)
- Files displayed in table/list (not grid)
- lucide-react chosen for all icons (file types, folders, actions)
- DaisyUI for all styling and layout components
- Navbar includes all Windows-like navigation controls and breadcrumb
- No details panel/modal for file/folder info in initial version
- Zustand planned for global state; logic and mutation deferred

---
## 4. Development Conventions
- /src/components: AppShell, Sidebar, Navbar, Breadcrumb, FileList, FileItem, Modal/
- Table columns: Icon, Name, Type, Size, Modified
- All prop interfaces are in TypeScript; all callbacks are present but not connected
- All icons provided by lucide-react as JSX.Element
- DaisyUI for layouts, tables, buttons
- UI-only: no state connection; all logic reserved for future

---
## 5. Open Questions / Pending Choices
- Sidebar: Should shortcuts display icons only, labels only, or both?
- FileList: Want more/fewer columns?
- Any special requirements for shortcut management?
- Preferred DaisyUI theme or color presets?

---
## 6. Decision Log
- 2026-03-04: Initial UI shell plan finalized and migrated to context.md
- 2026-03-04: Sidebar set for favorites/shortcuts only (not tree); details panel removed from initial build
- 2026-03-04: Table/list view adopted for files; grid abandoned
- 2026-03-04: lucide-react chosen for all icons
- 2026-03-04: Zustand reserved for future logic/data

---

## 7. Component Types and Props [Summary]

```ts
// Sidebar
export type SidebarProps = {
  shortcuts: Array<{label: string; icon: JSX.Element; path: string[]}>;
  selectedShortcut: string;
  onShortcutClick: (path: string[]) => void;
};

// Navbar
export type NavbarProps = {
  canGoBack: boolean;
  canGoForward: boolean;
  canGoUp: boolean;
  onBack: () => void;
  onForward: () => void;
  onUp: () => void;
  onRefresh: () => void;
  breadcrumb: Array<{label: string; path: string[]; icon?: JSX.Element}>;
  onBreadcrumbClick: (path: string[]) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
};

// FileList
export type FileListProps = {
  files: Array<{
    id: string;
    name: string;
    type: string;
    size?: string;
    modified?: string;
    icon: JSX.Element;
  }>;
  selectedId: string | null;
  onItemClick: (id: string) => void;
  onItemDoubleClick?: (id: string) => void;
};

// FileItem
export type FileItemProps = {
  id: string;
  name: string;
  type: string;
  size?: string;
  modified?: string;
  icon: JSX.Element;
  selected: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
};

// Modal
export type ModalProps = {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
};
```

---
