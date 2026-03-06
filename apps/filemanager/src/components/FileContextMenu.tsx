import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client"; // For mounting/unmounting programmatically

interface FileContextMenuProps {
  x: number;
  y: number;
  actions: Array<{ label: string; value: string }>;
  visible: boolean;
  onAction: (action: string) => void;
  onClose: () => void;
}

// Edge/corner detection utility
function getMenuPosition({
  x,
  y,
  menuWidth,
  menuHeight,
}: {
  x: number;
  y: number;
  menuWidth: number;
  menuHeight: number;
}) {
  const buffer = 8; // margin from edge
  let left = x;
  let top = y;
  const winW = window.innerWidth;
  const winH = window.innerHeight;

  if (left + menuWidth + buffer > winW) {
    left = winW - menuWidth - buffer;
  }
  if (top + menuHeight + buffer > winH) {
    top = winH - menuHeight - buffer;
  }
  left = Math.max(buffer, left);
  top = Math.max(buffer, top);
  return { left, top };
}

export const FileContextMenu: React.FC<FileContextMenuProps> = ({
  x,
  y,
  actions,
  visible,
  onAction,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [computedPosition, setComputedPosition] = React.useState<{
    left: number;
    top: number;
  }>({ left: x, top: y });

  useEffect(() => {
    if (visible && menuRef.current) {
      const menu = menuRef.current;
      const menuWidth = menu.offsetWidth;
      const menuHeight = menu.offsetHeight;
      setComputedPosition(getMenuPosition({ x, y, menuWidth, menuHeight }));
    }
  }, [visible, x, y]);

  // Hide on outside click
  useEffect(() => {
    if (!visible) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [visible, onClose]);

  if (!visible) return null;

  return createPortal(
    <div
      ref={menuRef}
      style={{
        left: computedPosition.left,
        top: computedPosition.top,
        zIndex: 5000,
        minWidth: 140,
      }}
      className="menu bg-base-100 border border-base-300 shadow fixed"
      aria-label="File context menu"
      tabIndex={0}
    >
      {actions.map((action) => (
        <button
          key={action.value}
          type="button"
          className="menu-item px-4 py-2 w-full text-left hover:bg-base-200"
          onClick={() => onAction(action.value)}
        >
          {action.label}
        </button>
      ))}
    </div>,
    document.body,
  );
};

// Utility function to programmatically open the menu
export function openFileContextMenu({
  x,
  y,
  actions,
  onAction,
}: {
  x: number;
  y: number;
  actions?: Array<{ label: string; value: string }>;
  onAction: (action: string) => void;
}) {
  const menuActions = actions || [
    { label: "Cut", value: "cut" },
    { label: "Copy", value: "copy" },
    { label: "Paste", value: "paste" },
  ];

  const div = document.createElement("div");
  document.body.appendChild(div);

  const close = () => {
    root.unmount();
    div.remove();
  };

  const root = createRoot(div);
  root.render(
    <FileContextMenu
      x={x}
      y={y}
      actions={menuActions}
      visible={true}
      onAction={(action) => {
        onAction(action);
        close();
      }}
      onClose={close}
    />,
  );

  return close;
}

// Usage: openFileContextMenu({ x, y, onAction: (action) => { ... } });
