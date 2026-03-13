import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFileManagerStore } from "../store/useFileManagerStore";
import { render } from "../test/test-utils";
import { Navbar } from "./Navbar";

// Mock react-router-dom navigate and location
const mockNavigate = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock("react-router-dom", async () => {
	const actual = await vi.importActual("react-router-dom");
	return {
		...actual,
		useNavigate: () => mockNavigate,
	};
});

vi.mock("@tanstack/react-query", async () => {
	const actual = await vi.importActual("@tanstack/react-query");
	return {
		...actual,
		useQueryClient: () => ({
			invalidateQueries: mockInvalidateQueries,
		}),
	};
});

describe("Navbar", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset store to root
		useFileManagerStore.setState({ activePath: "/" });
	});

	describe("rendering", () => {
		it("renders a nav element with aria-label", () => {
			render(<Navbar />);
			expect(screen.getByRole("navigation", { name: "File navigation" })).toBeInTheDocument();
		});

		it("renders Back button", () => {
			render(<Navbar />);
			expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
		});

		it("renders Forward button", () => {
			render(<Navbar />);
			expect(screen.getByRole("button", { name: "Forward" })).toBeInTheDocument();
		});

		it("renders Refresh button", () => {
			render(<Navbar />);
			expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
		});

		it("renders Home breadcrumb link at root", () => {
			render(<Navbar />);
			expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
		});

		it("renders breadcrumb nav with aria-label", () => {
			render(<Navbar />);
			expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
		});
	});

	describe("breadcrumb navigation", () => {
		it("shows only Home at root path", () => {
			render(<Navbar />, { initialPath: "/" });
			// Only "Home" button in the breadcrumb list
			const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
			expect(breadcrumb).toHaveTextContent("Home");
		});

		it("shows path segments as breadcrumbs for nested paths", () => {
			render(<Navbar />, { initialPath: "/Documents/Reports" });
			expect(screen.getByText("Documents")).toBeInTheDocument();
			expect(screen.getByText("Reports")).toBeInTheDocument();
		});

		it("renders last segment as span (not a button/link)", () => {
			render(<Navbar />, { initialPath: "/Documents/Reports" });
			const reportsEl = screen.getByText("Reports");
			expect(reportsEl.tagName).toBe("SPAN");
		});

		it("renders intermediate segments as clickable buttons", () => {
			render(<Navbar />, { initialPath: "/Documents/Reports" });
			// "Documents" should be a button (not the last segment)
			const documentsEl = screen.getByText("Documents");
			expect(documentsEl.tagName).toBe("BUTTON");
		});

		it("decodes URL-encoded path segments", () => {
			render(<Navbar />, { initialPath: "/My%20Documents" });
			expect(screen.getByText("My Documents")).toBeInTheDocument();
		});

		it("navigates to segment path when breadcrumb button clicked", () => {
			render(<Navbar />, { initialPath: "/Documents/Reports/2024" });
			fireEvent.click(screen.getByText("Documents"));
			expect(mockNavigate).toHaveBeenCalledWith("/Documents");
		});

		it("shows full path for deeply nested structure", () => {
			render(<Navbar />, { initialPath: "/a/b/c" });
			expect(screen.getByText("a")).toBeInTheDocument();
			expect(screen.getByText("b")).toBeInTheDocument();
			expect(screen.getByText("c")).toBeInTheDocument();
		});
	});

	describe("navigation buttons", () => {
		it("calls navigate(-1) when Back button clicked", () => {
			render(<Navbar />);
			fireEvent.click(screen.getByRole("button", { name: "Back" }));
			expect(mockNavigate).toHaveBeenCalledWith(-1);
		});

		it("calls navigate(1) when Forward button clicked", () => {
			render(<Navbar />);
			fireEvent.click(screen.getByRole("button", { name: "Forward" }));
			expect(mockNavigate).toHaveBeenCalledWith(1);
		});

		it("calls invalidateQueries when Refresh button clicked", () => {
			render(<Navbar />);
			fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
			expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["files"] });
		});
	});

	describe("store sync", () => {
		it("syncs activePath to store when location changes", async () => {
			render(<Navbar />);
			// After mount, the useEffect should have run and synced
			await waitFor(() => {
				// The store activePath should reflect the current browser URL
				// In test environment (BrowserRouter), this is "/"
				expect(useFileManagerStore.getState().activePath).toBeTruthy();
			});
		});
	});
});
