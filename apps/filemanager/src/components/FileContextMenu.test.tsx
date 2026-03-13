import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileContextMenu } from "./FileContextMenu";

describe("FileContextMenu", () => {
	const defaultActions = [
		{ label: "Rename", value: "rename" },
		{ label: "Download", value: "download" },
		{ label: "Delete", value: "delete", disabled: true },
	];

	const defaultProps = {
		x: 100,
		y: 200,
		actions: defaultActions,
		visible: true,
		onAction: vi.fn(),
		onClose: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
		Object.defineProperty(window, "innerWidth", { value: 1024, writable: true });
		Object.defineProperty(window, "innerHeight", { value: 768, writable: true });
	});

	// No afterEach body cleanup needed — @testing-library cleanup handles it

	describe("visibility", () => {
		it("renders nothing when visible is false", () => {
			const { container } = render(<FileContextMenu {...defaultProps} visible={false} />);
			expect(container).toBeEmptyDOMElement();
		});

		it("renders menu to document.body via portal when visible is true", () => {
			render(<FileContextMenu {...defaultProps} />);
			// createPortal renders into document.body; query via screen (searches whole document)
			expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
		});
	});

	describe("rendering actions", () => {
		it("renders all provided actions as buttons", () => {
			render(<FileContextMenu {...defaultProps} />);
			expect(screen.getByRole("button", { name: "Rename" })).toBeInTheDocument();
			expect(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();
			expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
		});

		it("renders disabled actions with disabled attribute", () => {
			render(<FileContextMenu {...defaultProps} />);
			const deleteBtn = screen.getByRole("button", { name: "Delete" });
			expect(deleteBtn).toBeDisabled();
		});

		it("renders disabled actions with pointer-events-none class", () => {
			render(<FileContextMenu {...defaultProps} />);
			const deleteBtn = screen.getByRole("button", { name: "Delete" });
			expect(deleteBtn.className).toContain("pointer-events-none");
		});

		it("renders disabled actions with text-gray-400 class", () => {
			render(<FileContextMenu {...defaultProps} />);
			const deleteBtn = screen.getByRole("button", { name: "Delete" });
			expect(deleteBtn.className).toContain("text-gray-400");
		});

		it("renders enabled actions without pointer-events-none", () => {
			render(<FileContextMenu {...defaultProps} />);
			const renameBtn = screen.getByRole("button", { name: "Rename" });
			expect(renameBtn.className).not.toContain("pointer-events-none");
		});

		it("renders empty actions list without crashing", () => {
			// Should not throw
			expect(() => render(<FileContextMenu {...defaultProps} actions={[]} />)).not.toThrow();
		});

		it("renders single action", () => {
			render(<FileContextMenu {...defaultProps} actions={[{ label: "Paste", value: "paste" }]} />);
			expect(screen.getByRole("button", { name: "Paste" })).toBeInTheDocument();
		});
	});

	describe("action callbacks", () => {
		it("calls onAction with correct value when action button clicked", () => {
			const onAction = vi.fn();
			render(<FileContextMenu {...defaultProps} onAction={onAction} />);
			fireEvent.click(screen.getByRole("button", { name: "Rename" }));
			expect(onAction).toHaveBeenCalledWith("rename");
		});

		it("calls onAction with download value for Download button", () => {
			const onAction = vi.fn();
			render(<FileContextMenu {...defaultProps} onAction={onAction} />);
			fireEvent.click(screen.getByRole("button", { name: "Download" }));
			expect(onAction).toHaveBeenCalledWith("download");
		});

		it("disabled button is not interactive", () => {
			render(<FileContextMenu {...defaultProps} />);
			const deleteBtn = screen.getByRole("button", { name: "Delete" });
			// Verify it is disabled (the native disabled attribute prevents click callbacks)
			expect(deleteBtn).toBeDisabled();
		});
	});

	describe("outside click dismiss", () => {
		it("calls onClose when mousedown outside the menu", () => {
			const onClose = vi.fn();
			const { baseElement } = render(<FileContextMenu {...defaultProps} onClose={onClose} />);
			// Fire mousedown on the baseElement (document.body area outside the menu ul)
			// The portal renders into document.body; fireEvent on baseElement triggers the listener
			fireEvent.mouseDown(baseElement);
			expect(onClose).toHaveBeenCalledTimes(1);
		});

		it("does not call onClose when mousedown inside the menu", () => {
			const onClose = vi.fn();
			render(<FileContextMenu {...defaultProps} onClose={onClose} />);
			// Click inside the menu (on a button)
			fireEvent.mouseDown(screen.getByRole("button", { name: "Rename" }));
			expect(onClose).not.toHaveBeenCalled();
		});

		it("does not register mousedown listener when not visible", () => {
			const onClose = vi.fn();
			const { baseElement } = render(<FileContextMenu {...defaultProps} visible={false} onClose={onClose} />);
			fireEvent.mouseDown(baseElement);
			expect(onClose).not.toHaveBeenCalled();
		});
	});

	describe("positioning", () => {
		it("renders menu with fixed position style", () => {
			const { baseElement } = render(<FileContextMenu {...defaultProps} x={100} y={200} />);
			const menu = baseElement.querySelector("ul")!;
			expect(menu.style.position).toBe("fixed");
		});

		it("renders menu with high z-index", () => {
			const { baseElement } = render(<FileContextMenu {...defaultProps} />);
			const menu = baseElement.querySelector("ul")!;
			expect(Number(menu.style.zIndex)).toBeGreaterThanOrEqual(1000);
		});

		it("renders menu with minWidth set as inline style", () => {
			const { baseElement } = render(<FileContextMenu {...defaultProps} />);
			const menu = baseElement.querySelector("ul")!;
			// minWidth is set as a number in the style object: minWidth: 140
			// jsdom converts this to "140px"
			expect(menu.style.minWidth).toBe("140px");
		});

		it("initial position is set from x,y props", () => {
			const { baseElement } = render(<FileContextMenu {...defaultProps} x={150} y={300} />);
			const menu = baseElement.querySelector("ul")!;
			expect(menu.style.left).toBeTruthy();
			expect(menu.style.top).toBeTruthy();
		});
	});

	describe("accessibility", () => {
		it("renders as a list element (ul)", () => {
			const { baseElement } = render(<FileContextMenu {...defaultProps} />);
			const ul = baseElement.querySelector("ul");
			expect(ul).toBeInTheDocument();
		});

		it("renders each action inside a list item", () => {
			const { baseElement } = render(<FileContextMenu {...defaultProps} />);
			const ul = baseElement.querySelector("ul")!;
			const listItems = ul.querySelectorAll("li");
			expect(listItems).toHaveLength(3);
		});

		it("renders buttons with type=button", () => {
			render(<FileContextMenu {...defaultProps} />);
			const buttons = screen.getAllByRole("button");
			for (const btn of buttons) {
				expect(btn).toHaveAttribute("type", "button");
			}
		});
	});

	describe("effect cleanup", () => {
		it("removes mousedown listener when component unmounts", () => {
			const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");
			const { unmount } = render(<FileContextMenu {...defaultProps} />);
			unmount();
			expect(removeEventListenerSpy).toHaveBeenCalledWith("mousedown", expect.any(Function));
			removeEventListenerSpy.mockRestore();
		});

		it("removes mousedown listener when visibility changes to false", () => {
			const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");
			const { rerender } = render(<FileContextMenu {...defaultProps} visible={true} />);
			rerender(<FileContextMenu {...defaultProps} visible={false} />);
			expect(removeEventListenerSpy).toHaveBeenCalledWith("mousedown", expect.any(Function));
			removeEventListenerSpy.mockRestore();
		});
	});
});
