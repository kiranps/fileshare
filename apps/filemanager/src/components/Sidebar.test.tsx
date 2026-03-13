import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "../test/test-utils";
import { Sidebar } from "./Sidebar";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
	const actual = await vi.importActual("react-router-dom");
	return {
		...actual,
		useNavigate: () => mockNavigate,
	};
});

describe("Sidebar", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("rendering", () => {
		it("renders an aside element with correct aria-label", () => {
			render(<Sidebar />);
			expect(screen.getByRole("complementary")).toBeInTheDocument();
		});

		it("renders 'Places' heading", () => {
			render(<Sidebar />);
			expect(screen.getByText("Places")).toBeInTheDocument();
		});

		it("renders all 5 shortcut buttons", () => {
			render(<Sidebar />);
			expect(screen.getByRole("button", { name: /Home/ })).toBeInTheDocument();
			expect(screen.getByRole("button", { name: /Documents/ })).toBeInTheDocument();
			expect(screen.getByRole("button", { name: /Music/ })).toBeInTheDocument();
			expect(screen.getByRole("button", { name: /Movies/ })).toBeInTheDocument();
			expect(screen.getByRole("button", { name: /Pictures/ })).toBeInTheDocument();
		});
	});

	describe("navigation", () => {
		it("navigates to '/' when Home is clicked", () => {
			render(<Sidebar />);
			fireEvent.click(screen.getByRole("button", { name: /Home/ }));
			expect(mockNavigate).toHaveBeenCalledWith("/");
		});

		it("navigates to '/Documents' when Documents is clicked", () => {
			render(<Sidebar />);
			fireEvent.click(screen.getByRole("button", { name: /Documents/ }));
			expect(mockNavigate).toHaveBeenCalledWith("/Documents");
		});

		it("navigates to '/Music' when Music is clicked", () => {
			render(<Sidebar />);
			fireEvent.click(screen.getByRole("button", { name: /Music/ }));
			expect(mockNavigate).toHaveBeenCalledWith("/Music");
		});

		it("navigates to '/Movies' when Movies is clicked", () => {
			render(<Sidebar />);
			fireEvent.click(screen.getByRole("button", { name: /Movies/ }));
			expect(mockNavigate).toHaveBeenCalledWith("/Movies");
		});

		it("navigates to '/Pictures' when Pictures is clicked", () => {
			render(<Sidebar />);
			fireEvent.click(screen.getByRole("button", { name: /Pictures/ }));
			expect(mockNavigate).toHaveBeenCalledWith("/Pictures");
		});
	});

	describe("active state", () => {
		it("marks Home as active when at root path", () => {
			// BrowserRouter starts at "/" in test environment
			render(<Sidebar />, { initialEntries: ["/"] } as never);
			const homeBtn = screen.getByRole("button", { name: /Home/ });
			expect(homeBtn).toHaveAttribute("aria-current", "page");
		});

		it("does not mark other shortcuts as active when at root path", () => {
			render(<Sidebar />);
			const documentsBtn = screen.getByRole("button", { name: /Documents/ });
			expect(documentsBtn).not.toHaveAttribute("aria-current");
		});

		it("renders all buttons with type=button", () => {
			render(<Sidebar />);
			const buttons = screen.getAllByRole("button");
			for (const btn of buttons) {
				expect(btn).toHaveAttribute("type", "button");
			}
		});
	});

	describe("accessibility", () => {
		it("renders aside with correct aria-label", () => {
			render(<Sidebar />);
			const aside = screen.getByRole("complementary");
			expect(aside).toHaveAttribute("aria-label", "Sidebar with shortcuts, favorites");
		});

		it("renders navigation list", () => {
			render(<Sidebar />);
			expect(screen.getByRole("list")).toBeInTheDocument();
		});

		it("renders shortcuts as list items", () => {
			render(<Sidebar />);
			const list = screen.getByRole("list");
			const items = list.querySelectorAll("li");
			expect(items).toHaveLength(5);
		});
	});
});
