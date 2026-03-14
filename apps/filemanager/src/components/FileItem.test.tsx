import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "../test/test-utils";
import type { FileItemProps } from "../types";
import { FileItem, fileHoverWhenNotSelected, fileSelectedClass } from "./FileItem";

const makeFile = (overrides: Partial<FileItemProps> = {}): FileItemProps => ({
	id: "/files/document.txt",
	name: "document.txt",
	type: "Text",
	size: 1024,
	modified: new Date("2024-06-15T10:30:00Z"),
	icon: createElement("span", { "data-testid": "file-icon" }, "icon"),
	selected: false,
	...overrides,
});

describe("FileItem", () => {
	describe("rendering", () => {
		it("renders a table row", () => {
			const { container } = render(
				<table>
					<tbody>
						<FileItem {...makeFile()} />
					</tbody>
				</table>,
			);
			expect(container.querySelector("tr")).toBeInTheDocument();
		});

		it("renders the file name", () => {
			render(
				<table>
					<tbody>
						<FileItem {...makeFile({ name: "hello.txt" })} />
					</tbody>
				</table>,
			);
			expect(screen.getByText("hello.txt")).toBeInTheDocument();
		});

		it("renders the icon", () => {
			render(
				<table>
					<tbody>
						<FileItem {...makeFile()} />
					</tbody>
				</table>,
			);
			expect(screen.getByTestId("file-icon")).toBeInTheDocument();
		});

		it("renders formatted file size", () => {
			render(
				<table>
					<tbody>
						<FileItem {...makeFile({ size: 2048 })} />
					</tbody>
				</table>,
			);
			expect(screen.getByText("2.0 KB")).toBeInTheDocument();
		});

		it("renders '-' when size is 0", () => {
			render(
				<table>
					<tbody>
						<FileItem {...makeFile({ size: 0 })} />
					</tbody>
				</table>,
			);
			// size === 0 is falsy, so it renders "-"
			expect(screen.getByText("-")).toBeInTheDocument();
		});

		it("renders '-' when size is undefined", () => {
			render(
				<table>
					<tbody>
						<FileItem {...makeFile({ size: undefined })} />
					</tbody>
				</table>,
			);
			// size is undefined (falsy) → renders "-" for size cell
			expect(screen.getAllByText("-")).toHaveLength(1);
		});

		it("renders formatted modified date", () => {
			render(
				<table>
					<tbody>
						<FileItem {...makeFile({ modified: new Date("2024-06-15T10:30:00Z") })} />
					</tbody>
				</table>,
			);
			// date-fns format: "yyyy-MM-dd HH:mm:ss"
			// The exact value depends on timezone but should contain "2024-06-15"
			const row = screen.getByRole("row");
			expect(row.textContent).toContain("2024-06-15");
		});

		it("renders '-' when modified date is falsy", () => {
			render(
				<table>
					<tbody>
						<FileItem {...makeFile({ modified: null as unknown as Date })} />
					</tbody>
				</table>,
			);
			expect(screen.getAllByText("-").length).toBeGreaterThan(0);
		});

		it("has tabIndex={0} on the row for keyboard accessibility", () => {
			const { container } = render(
				<table>
					<tbody>
						<FileItem {...makeFile()} />
					</tbody>
				</table>,
			);
			const row = container.querySelector("tr");
			expect(row).toHaveAttribute("tabindex", "0");
		});
	});

	describe("selection state", () => {
		it("applies selection style class when selected", () => {
			const { container } = render(
				<table>
					<tbody>
						<FileItem {...makeFile({ selected: true })} />
					</tbody>
				</table>,
			);
			const row = container.querySelector("tr");
			expect(row?.className).toContain(fileSelectedClass);
		});

		it("does not apply bg-primary when not selected", () => {
			const { container } = render(
				<table>
					<tbody>
						<FileItem {...makeFile({ selected: false })} />
					</tbody>
				</table>,
			);
			const row = container.querySelector("tr");
			expect(row?.className).not.toContain("bg-primary");
		});

		it("applies hover class when not selected", () => {
			const { container } = render(
				<table>
					<tbody>
						<FileItem {...makeFile({ selected: false })} />
					</tbody>
				</table>,
			);
			const row = container.querySelector("tr");
			expect(row?.className).toContain(fileHoverWhenNotSelected);
		});
	});

	describe("event handlers", () => {
		it("calls onClick when row is clicked", () => {
			const onClick = vi.fn();
			const { container } = render(
				<table>
					<tbody>
						<FileItem {...makeFile()} onClick={onClick} />
					</tbody>
				</table>,
			);
			container.querySelector("tr")?.click();
			expect(onClick).toHaveBeenCalledTimes(1);
		});

		it("calls onDoubleClick when row is double-clicked", () => {
			const onDoubleClick = vi.fn();
			const { container } = render(
				<table>
					<tbody>
						<FileItem {...makeFile()} onDoubleClick={onDoubleClick} />
					</tbody>
				</table>,
			);
			const row = container.querySelector("tr")!;
			row.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
			expect(onDoubleClick).toHaveBeenCalledTimes(1);
		});

		it("calls onRightClick on contextmenu event", () => {
			const onRightClick = vi.fn();
			const { container } = render(
				<table>
					<tbody>
						<FileItem {...makeFile()} onRightClick={onRightClick} />
					</tbody>
				</table>,
			);
			const row = container.querySelector("tr")!;
			row.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
			expect(onRightClick).toHaveBeenCalledTimes(1);
		});

		it("works without optional event handlers", () => {
			// Should not throw when handlers are undefined
			expect(() =>
				render(
					<table>
						<tbody>
							<FileItem {...makeFile()} />
						</tbody>
					</table>,
				),
			).not.toThrow();
		});
	});

	describe("URL-decoded names", () => {
		it("decodes URL-encoded names for display", () => {
			render(
				<table>
					<tbody>
						<FileItem {...makeFile({ name: "my%20file.txt" })} />
					</tbody>
				</table>,
			);
			expect(screen.getByText("my file.txt")).toBeInTheDocument();
		});

		it("handles names with special URL characters", () => {
			render(
				<table>
					<tbody>
						<FileItem {...makeFile({ name: "file%28copy%29.txt" })} />
					</tbody>
				</table>,
			);
			expect(screen.getByText("file(copy).txt")).toBeInTheDocument();
		});

		it("renders malformed percent-encoded names without throwing", () => {
			render(
				<table>
					<tbody>
						<FileItem {...makeFile({ name: "bad%ZZname.txt" })} />
					</tbody>
				</table>,
			);
			// urlDecodeSafe falls back to the original string
			expect(screen.getByText("bad%ZZname.txt")).toBeInTheDocument();
		});

		it("renders names without encoding unchanged", () => {
			render(
				<table>
					<tbody>
						<FileItem {...makeFile({ name: "regular-file.pdf" })} />
					</tbody>
				</table>,
			);
			expect(screen.getByText("regular-file.pdf")).toBeInTheDocument();
		});

		it("renders unicode names correctly", () => {
			render(
				<table>
					<tbody>
						<FileItem {...makeFile({ name: "日本語ファイル.txt" })} />
					</tbody>
				</table>,
			);
			expect(screen.getByText("日本語ファイル.txt")).toBeInTheDocument();
		});
	});

	describe("file size formatting", () => {
		it("renders KB for kilobyte-range files", () => {
			render(
				<table>
					<tbody>
						<FileItem {...makeFile({ size: 1536 })} />
					</tbody>
				</table>,
			);
			expect(screen.getByText("1.5 KB")).toBeInTheDocument();
		});

		it("renders MB for megabyte-range files", () => {
			render(
				<table>
					<tbody>
						<FileItem {...makeFile({ size: 1048576 })} />
					</tbody>
				</table>,
			);
			expect(screen.getByText("1.0 MB")).toBeInTheDocument();
		});

		it("renders GB for gigabyte-range files", () => {
			render(
				<table>
					<tbody>
						<FileItem {...makeFile({ size: 1073741824 })} />
					</tbody>
				</table>,
			);
			expect(screen.getByText("1.0 GB")).toBeInTheDocument();
		});
	});
});
