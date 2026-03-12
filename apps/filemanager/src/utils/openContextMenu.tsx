import { createRoot } from "react-dom/client";
import { FileContextMenu, type ContextMenuAction } from "../components/FileContextMenu";

/**
 * Programmatically renders a context menu at (x, y) outside of the React tree.
 * Returns a `close` function that can be used to dismiss the menu imperatively.
 */
export function openFileContextMenu({
  x,
  y,
  actions,
  onAction,
}: {
  x: number;
  y: number;
  actions: ContextMenuAction[];
  onAction: (action: string) => void;
}): () => void {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const close = () => {
    root.unmount();
    container.remove();
  };

  const root = createRoot(container);
  root.render(
    <FileContextMenu
      x={x}
      y={y}
      actions={actions}
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
