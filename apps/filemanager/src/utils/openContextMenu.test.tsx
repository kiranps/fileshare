import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openFileContextMenu } from "./openContextMenu";

describe("openFileContextMenu", () => {
	// Track close functions so we can properly tear down after each test
	// (avoids forceful body.innerHTML="" which breaks React's portal bookkeeping)
	const pendingClosers: Array<() => void> = [];

	afterEach(async () => {
		// Properly close any open menus via their close() function
		await act(async () => {
			for (const close of pendingClosers) {
				try {
					close();
				} catch {
					// already closed — ignore
				}
			}
		});
		pendingClosers.length = 0;
	});

	it("appends a container div to document.body", async () => {
		await act(async () => {
			const close = openFileContextMenu({
				x: 100,
				y: 200,
				actions: [{ label: "Rename", value: "rename" }],
				onAction: vi.fn(),
			});
			pendingClosers.push(close);
		});
		// A new div should have been appended
		expect(document.body.children.length).toBeGreaterThan(0);
	});

	it("renders the context menu with provided actions", async () => {
		await act(async () => {
			const close = openFileContextMenu({
				x: 100,
				y: 200,
				actions: [
					{ label: "Cut", value: "cut" },
					{ label: "Copy", value: "copy" },
				],
				onAction: vi.fn(),
			});
			pendingClosers.push(close);
		});
		// The menu should be visible in the body
		const buttons = document.body.querySelectorAll("button");
		const labels = Array.from(buttons).map((b) => b.textContent);
		expect(labels).toContain("Cut");
		expect(labels).toContain("Copy");
	});

	it("returns a close function", async () => {
		let closeFn: (() => void) | undefined;
		await act(async () => {
			closeFn = openFileContextMenu({
				x: 100,
				y: 200,
				actions: [{ label: "Delete", value: "delete" }],
				onAction: vi.fn(),
			});
			pendingClosers.push(closeFn);
		});
		expect(typeof closeFn).toBe("function");
	});

	it("removes container from body when close is called", async () => {
		let closeFn: (() => void) | undefined;
		await act(async () => {
			closeFn = openFileContextMenu({
				x: 50,
				y: 50,
				actions: [{ label: "Paste", value: "paste" }],
				onAction: vi.fn(),
			});
			// don't push to pendingClosers — we close manually below
		});

		expect(document.body.children.length).toBeGreaterThan(0);

		await act(async () => {
			closeFn?.();
		});

		expect(document.body.children.length).toBe(0);
	});

	it("calls onAction and then closes when an action button is clicked", async () => {
		const onAction = vi.fn();
		await act(async () => {
			const close = openFileContextMenu({
				x: 100,
				y: 200,
				actions: [{ label: "Download", value: "download" }],
				onAction,
			});
			pendingClosers.push(close);
		});

		const downloadBtn = document.body.querySelector("button");
		expect(downloadBtn?.textContent).toBe("Download");

		await act(async () => {
			downloadBtn?.click();
		});

		expect(onAction).toHaveBeenCalledWith("download");
		// After action, container should be removed (close is called internally)
		expect(document.body.children.length).toBe(0);
		// Menu was already closed by the click — remove from pending
		pendingClosers.length = 0;
	});

	it("closes menu on outside click (onClose callback)", async () => {
		await act(async () => {
			const close = openFileContextMenu({
				x: 100,
				y: 200,
				actions: [{ label: "New Folder", value: "new_folder" }],
				onAction: vi.fn(),
			});
			pendingClosers.push(close);
		});

		expect(document.body.children.length).toBeGreaterThan(0);

		// Create an element outside the menu to dispatch mousedown on.
		// FileContextMenu listens on `document` for mousedown and calls onClose
		// when the target is outside the menu's <ul> element.
		const outsideEl = document.createElement("div");
		document.body.appendChild(outsideEl);

		await act(async () => {
			outsideEl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
		});

		// After close(): portal <ul> and container <div> are removed from body.
		// Only outsideEl remains.
		expect(Array.from(document.body.children).filter((c) => c !== outsideEl)).toHaveLength(0);

		outsideEl.remove();
		// Menu was already closed by outside click — nothing for afterEach to do
		pendingClosers.length = 0;
	});

	it("renders multiple actions", async () => {
		const actions = [
			{ label: "Rename", value: "rename" },
			{ label: "Download", value: "download" },
			{ label: "Cut", value: "cut" },
			{ label: "Copy", value: "copy" },
			{ label: "Delete", value: "delete" },
		];
		await act(async () => {
			const close = openFileContextMenu({ x: 0, y: 0, actions, onAction: vi.fn() });
			pendingClosers.push(close);
		});
		const buttons = document.body.querySelectorAll("button");
		expect(buttons.length).toBe(5);
	});

	it("renders with empty actions array", async () => {
		await act(async () => {
			const close = openFileContextMenu({ x: 0, y: 0, actions: [], onAction: vi.fn() });
			pendingClosers.push(close);
		});
		// Menu container exists but has no action buttons
		const ul = document.body.querySelector("ul");
		expect(ul).toBeInTheDocument();
		expect(ul?.querySelectorAll("li").length).toBe(0);
	});
});
